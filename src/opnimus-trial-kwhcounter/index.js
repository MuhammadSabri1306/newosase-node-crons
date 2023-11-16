const cron = require("node-cron");
const mysql = require("mysql");
const logger = require("./logger");
const dbConfig = require("../env/database");
const { useHttp } = require("./http");
const { toDatetimeString } = require("../helpers/date");
const { InsertQueryBuilder } = require("../helpers/mysql-query-builder");

const runDbQuery = (pool, ...args) => {
    return new Promise((resolve, reject) => {

        const callback = (conn, err, results) => {
            if(err) {
                reject(err);
                return;
            }
            resolve(results);
        };

        pool.getConnection((err, conn) => {
            if(err) {
                reject(err);
                return;
            }
            
            conn.release();
            if(args.length > 1)
                conn.query(args[0], args[1], (err, results) => callback(conn, err, results));
            else
                conn.query(args[0], (err, results) => callback(conn, err, results));
        });

    });
};

const createDelay = time => {
    return new Promise((resolve) => setTimeout(resolve, time));
};

const fetchPortSensor = async (fetchParams, fetchResolve) => {
    logger.info("Create newosase api request");

    const newosaseBaseUrl = "https://newosase.telkom.co.id/api/v1";
    const http = useHttp(newosaseBaseUrl);

    let retryCount = 0;
    let port = null;
    while(retryCount < 3) {
        try {
    
            const response = await http.get("/dashboard-service/dashboard/rtu/port-sensors", { params: fetchParams });
            port = fetchResolve(response);
            if(!port)
                logger.warn(`No data provided in ${ newosaseBaseUrl }/dashboard-service/dashboard/rtu/port-sensors`, response.data);
            else
                logger.info("Collecting newosase api response");
            
            retryCount = 3;
    
        } catch(err) {
    
            retryCount++;
            logger.error(`Error in ${ newosaseBaseUrl }/dashboard-service/dashboard/rtu/port-sensors, retryCount:${ retryCount }, delay:3s`, err);
            await createDelay(3000);
    
        }
    }

    return port;
};

const collect = async (pool, { rtuCode, fetchParams, fetchResolve }) => {
    try {

        const port = await fetchPortSensor(fetchParams, fetchResolve);
        if(!port) {
            logger.info(`The Port isn't exists in api newosase, rtuCode=${ rtuCode }`)
            return;
        }

        const currPortValue = port.value ? port.value : 0;
        let prevPortValue = currPortValue;

        const prevPort = await runDbQuery(pool, "SELECT * FROM trial_kwhcounter_new WHERE rtu_code=? ORDER BY id DESC LIMIT 1", [rtuCode]);
        if(prevPort.length < 1 || prevPort[0].value === undefined)
            logger.info(`Previous Port isn't exists in database, rtuCode=${ rtuCode }`);
        else
            prevPortValue = prevPort[0].value;

        const deltaPortValue = Math.round( (currPortValue - prevPortValue) * 100 ) / 100;

        const queryInsertPort = new InsertQueryBuilder("trial_kwhcounter_new");
        queryInsertPort.addFields("rtu_code");
        queryInsertPort.addFields("port");
        queryInsertPort.addFields("value");
        queryInsertPort.addFields("delta_value");
        queryInsertPort.addFields("unit");
        queryInsertPort.addFields("rtu_status");
        queryInsertPort.addFields("port_status");
        queryInsertPort.addFields("created_at");

        const portStatus = port.severity ? port.severity.name : "";
        const currDateTime = toDatetimeString(new Date());
        queryInsertPort.appendRow([
            port.rtu_sname, port.no_port, currPortValue, deltaPortValue,
            port.units, port.rtu_status, portStatus, currDateTime
        ]);

        logger.info(`Insert new kwh row to database ${ dbConfig.opnimusNew.database }.trial_kwhcounter_new, rtuCode=${ rtuCode }`);
        await runDbQuery(pool, queryInsertPort.getQuery(), queryInsertPort.getBuiltBindData());
        
    } catch(err) {
        logger.error(err);
    }
};

module.exports.main = async () => {
    
    logger.info("App is starting");

    const rtuTargetList = [
        {
            rtuCode: "RTU00-D7-MAT",
            fetchParams: { searchRtuSname: "RTU00-D7-MAT", searchDescription: "Konsumsi daya PLN 2" },
            fetchResolve: response => {
                if(!response.data || !response.data.result || !response.data.result.payload)
                    return null;
                const ports = response.data.result.payload;
                if(Array.isArray(ports) && ports.length > 0)
                    return ports[0];
                return null;
            }
        },
        {
            rtuCode: "RTU00-D7-PNK",
            fetchParams: { searchRtuSname: "RTU00-D7-PNK", searchDescription: "Konsumsi daya PLN 2" },
            fetchResolve: response => {
                if(!response.data || !response.data.result || !response.data.result.payload)
                    return null;
                const ports = response.data.result.payload;
                if(Array.isArray(ports) && ports.length > 0)
                    return ports[0];
                return null;
            }
        }
    ];

    logger.info("Creating a database connection");
    const pool = mysql.createPool({
        ...dbConfig.opnimusNew,
        multipleStatements: true
    });

    let i = 0;
    while(i < rtuTargetList.length) {
        try {
    
            await collect(pool, rtuTargetList[i]);
            
        } catch(err) {
            logger.error(err);
        } finally {
            i++;
        }
    }

    pool.end(() => logger.info("App has closed"));

};

/*
 * Opnimus Trial KwhCounter
 * Runs every Hour
 */
const cronApp = async () => {
    const startTime = toDatetimeString(new Date());
    console.info(`\n\nRunning cron Opnimus Trial KwhCounter at ${ startTime }`);
    try {
        await this.main();
        const endTime = toDatetimeString(new Date());
        console.info(`\n\nCron Opnimus Trial KwhCounter closed at ${ endTime }`);
    } catch(err) {
        logger.error(err);
        const endTime = toDatetimeString(new Date());
        console.info(`\n\nCron Opnimus Trial KwhCounter closed at ${ endTime }`);
    }
};

cron.schedule("0 0 * * * *", cronApp);