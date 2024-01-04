const JobQueue = require("../../core/job-queue");
const logger = require("../logger");
const dbConfig = require("../../env/database");
const { toDatetimeString } = require("../../helpers/date");
const { InsertQueryBuilder } = require("../../helpers/mysql-query-builder");
const {
    createDbPool,
    closePool,
    executeQuery,
    selectRowQuery,
    selectRowCollumnQuery,
    createQuery
} = require("../../core/mysql");
const { createAlarmPortUserQuery, createAlertStack, createPortAlarmQuery } = require("../alerting");

const createWitelGroup = (witelList, portList) => {
    const group = [];
    let item;

    for(let i=0; i<witelList.length; i++) {
        item = { witelId: witelList[i].id, portList: [] };

        for(let j=0; j<portList.length; j++) {
            if(portList[j].witel_id == witelList[i].id)
                item.portList.push(portList[j]);
        }
        
        group.push(item);
    }

    return group;
};

const runWorkerGetAlarm = (witelPortList, eachErrorCallback = null) => {
    return new Promise(resolve => {

        const worker = new JobQueue(10);
        worker.setDelay(1000);

        witelPortList.forEach(witel => {
            worker.registerWorker("opnimus-alerting-port-v2/worker-port-alarm", { witel });
        });

        const openPorts = [];
        const closePorts = [];
        worker.onEachAfter(workerResult => {
            if(workerResult.openAlarm.length > 0)
                openPorts.push(...workerResult.openAlarm);
            if(workerResult.closeAlarm.length > 0)
                closePorts.push(...workerResult.closeAlarm);
        });

        if(typeof eachErrorCallback == "function")
            worker.onEachError(err => eachErrorCallback(err));

        worker.onAfterRun(() => resolve({ openPorts, closePorts }));
        worker.run();

    });
};

const main = async () => {
    logger.info("App is starting");
    const processDateStr = toDatetimeString(new Date());

    logger.info("Creating a database connection");
    const pool = createDbPool({
        ...dbConfig.opnimusNewMigrated2,
        multipleStatements: true
    });

    try {

        // const witelListQueryStr = "SELECT * FROM witel";
        const witelListQueryStr = "SELECT * FROM witel WHERE id=43";
        logger.info("Get witel list from database", {
            database: dbConfig.opnimusNewMigrated2.database,
            query: witelListQueryStr
        });

        const { results: witelList } = await executeQuery(pool, witelListQueryStr);

        const portListQueryStr = "SELECT alarm.*, rtu.location_id, rtu.datel_id, rtu.witel_id, rtu.regional_id"+
            " FROM alarm_port_status AS alarm JOIN rtu_list AS rtu ON rtu.sname=alarm.rtu_sname"+
            " WHERE alarm.is_closed=0";
        logger.info("Get opened alarm port list", {
            database: dbConfig.opnimusNewMigrated2.database,
            query: portListQueryStr
        });

        const { results: portList } = await executeQuery(pool, portListQueryStr);
        const witelPortList = createWitelGroup(witelList, portList);

        logger.info("Worker Port Alarm started");
        const { openPorts, closePorts } = await runWorkerGetAlarm(witelPortList, err => {
            logger.error("Error when running worker worker-port-alarm.js:", err);
        });
        logger.info(`Worker Port Alarm run successfully, openPorts:${ openPorts.length }, closePorts:${ closePorts.length }`);
        // logger.debug({ openPorts, closePorts });
        openPorts.forEach(item => {
            if(item.rtu_sname == "RTU00-D7-TMA" && item.no_port == "A-46")
                console.log("OPEN", item);
        });
        closePorts.forEach(item => {
            if(item.rtu_sname == "RTU00-D7-TMA" && item.port_no == "A-46")
                console.log("CLOSE", item);
        });

    } catch(err) {
        logger.error(err);
    } finally {
        await closePool(pool);
        logger.info("App has closed");
    }
};

main();