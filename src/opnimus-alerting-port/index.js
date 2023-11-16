const cron = require("node-cron");
const mysql = require("mysql");
const JobQueue = require("../core/job-queue");
const logger = require("./logger");
const dbConfig = require("../env/database");
const { toDatetimeString } = require("../helpers/date");
const { InsertQueryBuilder } = require("../helpers/mysql-query-builder");

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

const runWorkerGetAlarm = (witelPortList, eachErrorCallback = null) => {
    return new Promise(resolve => {

        const worker = new JobQueue(10);
        worker.setDelay(1000);

        witelPortList.forEach(witel => {
            worker.registerWorker("opnimus-alerting-port/worker-port-alarm", { witel });
        });

        const newPorts = [];
        const openPorts = [];
        const closePorts = [];
        worker.onEachAfter(workerResult => {
            if(workerResult.newPorts.length > 0)
                newPorts.push(...workerResult.newPorts);
            if(workerResult.openedAlarm.length > 0)
                openPorts.push(...workerResult.openedAlarm);
            if(workerResult.closedAlarm.length > 0)
                closePorts.push(...workerResult.closedAlarm);
        });

        if(typeof eachErrorCallback == "function")
            worker.onEachError(err => eachErrorCallback(err));

        worker.onAfterRun(() => resolve({ newPorts, openPorts, closePorts }));
        worker.run();

    });
};

const runWorkerSendAlert = (alertStack, eachErrorCallback = null) => {
    return new Promise((resolve, reject) => {

        const worker = new JobQueue(10);
        worker.setDelay(1000);

        alertStack.forEach(alert => {
            worker.registerWorker("opnimus-alerting-port/worker-send-alert", { alert });
        });

        const sendedAlertIds = [];
        const unsendedAlertIds = [];
        worker.onEachAfter(workerResult => {
            
            const { alertId, success, error } = workerResult;
            if(success)
                sendedAlertIds.push(alertId);
            else {
                unsendedAlertIds.push(alertId);
                if(typeof eachErrorCallback == "function")
                    eachErrorCallback(error);
            }

        });

        if(typeof eachErrorCallback == "function")
            worker.onEachError(err => eachErrorCallback(err));

        worker.onAfterRun(() => resolve({ sendedAlertIds, unsendedAlertIds }));
        worker.run();

    });
};

const getAlertPortAreaIds = (alertPortList) => {
    const regionalIds = [];
    const witelIds = [];
    const locIds = [];
    let currPort;

    for(let i=0; i<alertPortList.length; i++) {

        currPort = alertPortList[i];

        if(regionalIds.indexOf(currPort.regional_id) < 0)
            regionalIds.push(currPort.regional_id);

        if(witelIds.indexOf(currPort.witel_id) < 0)
            witelIds.push(currPort.witel_id);

        if(locIds.indexOf(currPort.location_id) < 0)
            locIds.push(currPort.location_id);

    }

    return { regionalIds, witelIds, locIds };
};

const createAlertList = (alertPortList, userList) => {
    const newAlertList = [];
    let port;
    let user;

    const isMatch = (port, user) => {
        if(user.level == "nasional")
            return true;
        if(user.level == "regional" && user.regional_id == port.regional_id)
            return true;
        if(user.level == "witel" && user.witel_id == port.witel_id)
            return true;
        return false;
    };

    for(let i=0; i<alertPortList.length; i++) {
        for(let j=0; j<userList.length; j++) {

            port = alertPortList[i];
            user = userList[j];

            if(isMatch(port, user)) {
                newAlertList.push({
                    portId: port.id,
                    chatId: user.chat_id
                });
            }

        }
    }

    return newAlertList;
};

const extractAlerList = (alertList) => {
    const alertIds = [];
    const alertLocIds = [];
    for(let i=0; i<alertList.length; i++) {
        alertIds.push(alertList[i].id);
        alertLocIds.push(alertList[i].location_id);
    }
    return { alertIds, alertLocIds };
};

const createAlertStack = ({ alertList, regionalList, witelList, picList }) => {
    let regional;
    let witel;
    let pics;
    for(let i=0; i<alertList.length; i++) {
        
        regional = regionalList.find(item => item.id == alertList[i].regional_id);
        if(regional) {
            alertList[i].regional_name = regional.name;
            alertList[i].regional_code = regional.divre_code;
        }
        
        witel = witelList.find(item => item.id == alertList[i].witel_id);
        if(witel) {
            alertList[i].witel_name = witel.witel_name;
            alertList[i].witel_code = witel.witel_code;
        }

        alertList[i].pics = [];
        for(let j=0; j<picList.length; j++) {
            if(picList[j].location_id == alertList[i].location_id)
                alertList[i].pics.push(picList[j]);
        }
        
    }
    return alertList;
};

module.exports.main = async () => {
    logger.info("App is starting");

    logger.info("Creating a database connection");
    const pool = mysql.createPool({
        ...dbConfig.opnimusNewMigrated,
        multipleStatements: true
    });

    try {

        logger.info(`Get witel list from database ${ dbConfig.opnimusNewMigrated.database }.witel`);
        // const witelList = await runDbQuery(pool, "SELECT * FROM witel WHERE id=43");
        const witelList = await runDbQuery(pool, "SELECT * FROM witel");

        logger.info(`Get port list from database ${ dbConfig.opnimusNewMigrated.database }.rtu_port_status`);
        const queryStr = "SELECT port.*, rtu.location_id, rtu.datel_id, rtu.witel_id, rtu.regional_id"+
            " FROM rtu_port_status AS port JOIN rtu_list AS rtu ON rtu.sname=port.rtu_code";
        const portList = await runDbQuery(pool, queryStr);
        // const portList = require("./sample-data/rtu-port-status.json");
        const witelPortList = createWitelGroup(witelList, portList);
        
        logger.info("Worker Port Alarm started.");
        const { newPorts, openPorts, closePorts } = await runWorkerGetAlarm(witelPortList, err => {
            logger.error("Error when running worker worker-port-alarm.js:", err);
        });
        logger.info("Worker Port Alarm completed.");

        let alertPortIds = [];
        const currDateTime = toDatetimeString(new Date());

        if(newPorts.length > 0) {

            const queryInsertPort = new InsertQueryBuilder("rtu_port_status");
            queryInsertPort.addFields("rtu_code");
            queryInsertPort.addFields("port");
            queryInsertPort.addFields("port_name");
            queryInsertPort.addFields("value");
            queryInsertPort.addFields("unit");
            queryInsertPort.addFields("rtu_status");
            queryInsertPort.addFields("port_status");
            queryInsertPort.addFields("start_at");
            queryInsertPort.addFields("state");
            queryInsertPort.addFields("location");
        
            newPorts.forEach(item => {
                queryInsertPort.appendRow([ item.rtu_sname, item.no_port,
                    item.port_name, (item.value || 0), item.units,
                    item.rtu_status, item.severity.name, currDateTime,
                    1, item.location ]);
            });

            logger.info(`Insert new ports to database ${ dbConfig.opnimusNewMigrated.database }.rtu_port_status`);
            const insertPortResult = await runDbQuery(pool, queryInsertPort.getQuery(), queryInsertPort.getBuiltBindData());
            alertPortIds = queryInsertPort.buildInsertedId(insertPortResult.insertId, insertPortResult.affectedRows);

        }

        if(openPorts.length > 0 || closePorts.length > 0) {
            const updateQueries = [];

            if(openPorts.length > 0) {
                openPorts.forEach(item => {

                    const queryStr = "UPDATE rtu_port_status SET value=?, rtu_status=?,"+
                        " port_status=?, state=?, start_at=? WHERE id=?";
                    const bindData = [item.newRow.value, item.newRow.rtu_status,
                        item.newRow.severity.name, 1, currDateTime, item.oldRow.id];

                    updateQueries.push( mysql.format(queryStr, bindData) );
                    alertPortIds.push(item.oldRow.id);

                });
            }

            if(closePorts.length > 0) {
                closePorts.forEach(item => {

                    const queryStr = "UPDATE rtu_port_status SET rtu_status=?,"+
                        " port_status=?, state=?, end_at=? WHERE id=?";
                    const bindData = ["normal", "Normal", 0, currDateTime, item.id];
                    updateQueries.push( mysql.format(queryStr, bindData) );

                });
            }

            const updatesQueryStr = updateQueries.join("; ");
            await runDbQuery(pool, updatesQueryStr);
        }

        if(alertPortIds.length > 0) {
            
            const queryAlertPortFields = ["port.*", "rtu.name AS rtu_name", "rtu.location_id", "loc.location_name",
                "rtu.datel_id", "rtu.witel_id", "wit.witel_name", "rtu.regional_id", "reg.name AS regional_name",
                "reg.divre_code AS regional_code"];
            const queryAlertPortStr = "SELECT "+queryAlertPortFields.join(", ")+
                " FROM rtu_port_status AS port"+
                " JOIN rtu_list AS rtu ON rtu.sname=port.rtu_code"+
                " JOIN rtu_location AS loc ON loc.id=rtu.location_id"+
                " JOIN witel AS wit ON wit.id=rtu.witel_id"+
                " JOIN regional AS reg ON reg.id=rtu.regional_id"+
                " WHERE port.id IN (?)";
            const alertPortList = await runDbQuery(pool, queryAlertPortStr, [alertPortIds]);

            const alertPortUserParams = getAlertPortAreaIds(alertPortList); // { regionalIds, witelIds, locIds }
            const queryUserParams = [];
            const queryUserParamsBind = [];
    
            queryUserParams.push("(alert_status=? AND level=?)");
            queryUserParamsBind.push(1, "nasional");
    
            if(alertPortUserParams.regionalIds.length > 0) {
                queryUserParams.push("(alert_status=? AND level=? AND regional_id IN (?))");
                queryUserParamsBind.push(1, "regional", alertPortUserParams.regionalIds);
            }
    
            if(alertPortUserParams.witelIds.length > 0) {
                queryUserParams.push("(alert_status=? AND level=? AND witel_id IN (?))");
                queryUserParamsBind.push(1, "witel", alertPortUserParams.witelIds);
            }
    
            const queryUserParamsStr = queryUserParams.join(" OR ");
            const queryUserStr = `SELECT * FROM telegram_user WHERE ${ queryUserParamsStr } ORDER BY regional_id, witel_id`;
            const userList = await runDbQuery(pool, queryUserStr, queryUserParamsBind);
    
            const newAlertList = createAlertList(alertPortList, userList);
            if(newAlertList.length > 0) {
                
                const queryInsertAlert = new InsertQueryBuilder("alert_message");
                queryInsertAlert.addFields("port_id");
                queryInsertAlert.addFields("chat_id");
                queryInsertAlert.addFields("created_at");
        
                newAlertList.forEach(item => {
                    queryInsertAlert.appendRow([ item.portId, item.chatId, currDateTime ]);
                });
    
                logger.info(`Insert new alert stack to database ${ dbConfig.opnimusNewMigrated.database }.alert_message`);
                await runDbQuery(pool, queryInsertAlert.getQuery(), queryInsertAlert.getBuiltBindData());
    
            }

        }
        

        const queryAlertListStr = "SELECT alert.id AS alert_id, alert.port_id, alert.chat_id, port.rtu_code,"+
            " port.port AS port_code, port.port_name, port.value AS port_value, port.unit AS port_unit,"+
            " port.port_status, port.start_at, rtu.name AS rtu_name, rtu.location_id, rtu.witel_id,"+
            " rtu.regional_id, loc.location_name FROM"+
            " alert_message AS alert JOIN rtu_port_status AS port ON port.id=alert.port_id"+
            " JOIN rtu_list AS rtu ON rtu.sname=port.rtu_code JOIN rtu_location AS loc ON"+
            " loc.id=rtu.location_id WHERE alert.status='unsended'";
        const alertList = await runDbQuery(pool, queryAlertListStr);
        if(alertList.length < 1) {

            logger.info("App was run successfully");
            return;

        }

        const { alertIds, alertLocIds } = extractAlerList(alertList);
        await runDbQuery(pool, "UPDATE alert_message SET status='sending' WHERE id IN (?)", [alertIds]);

        const picQueryStr = "SELECT user.id, user.user_id, user.type, user.username, user.first_name,"+
            " user.last_name, pers.nama AS full_name, pic.location_id FROM pic_location AS pic"+
            " JOIN telegram_user AS user ON user.id=pic.user_id"+
            " JOIN telegram_personal_user AS pers ON pers.user_id=pic.user_id"+
            " WHERE user.is_pic=1 AND pic.location_id IN (?)"
        const picList = await runDbQuery(pool, picQueryStr, [alertLocIds]);

        const regionalList = await runDbQuery(pool, "SELECT * FROM regional");
        const alertStack = createAlertStack({ alertList, regionalList, witelList, picList });

        logger.info("Worker Send Alert started.");
        const { sendedAlertIds, unsendedAlertIds } = await runWorkerSendAlert(alertStack, err => {
            logger.error("Error when running worker worker-send-alert.js:", err);
        });

        if(unsendedAlertIds.length > 0) {
            logger.info("Rollback unsended alerts, total:"+unsendedAlertIds.length);
            await runDbQuery(pool, "UPDATE alert_message SET status='unsended' WHERE id IN (?)", unsendedAlertIds);
        }

        if(sendedAlertIds.length > 0) {
            logger.info("Delete sended alerts, total:"+sendedAlertIds.length);
            await runDbQuery(pool, "DELETE FROM alert_message WHERE id IN (?)", [sendedAlertIds]);
        }

        pool.end(() => {
            logger.info("App was run successfully");
        });
        
    } catch(err) {
        logger.error(err);
        pool.end(() => {
            logger.info("App has closed");
        });
    }
};

/*
 * Opnimus Alerting Port
 * Runs every minutes
 */
cron.schedule("* * * * *", async () => {
    const startTime = toDatetimeString(new Date());
    console.info(`\n\nRunning cron Opnimus Alerting Port at ${ startTime }`);
    try {
        await this.main();
        const endTime = toDatetimeString(new Date());
        console.info(`\n\nCron Opnimus Alerting Port closed at ${ endTime }`);
    } catch(err) {
        logger.error(err);
        const endTime = toDatetimeString(new Date());
        console.info(`\n\nCron Opnimus Alerting Port closed at ${ endTime }`);
    }
});