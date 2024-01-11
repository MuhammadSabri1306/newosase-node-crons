const cron = require("node-cron");
const JobQueue = require("../core/job-queue");
const logger = require("./logger");
const dbConfig = require("../env/database");
const { useHttp } = require("./http");
const { toDatetimeString } = require("../helpers/date");
const { InsertQueryBuilder } = require("../helpers/mysql-query-builder");
const {
    createDbPool,
    closePool,
    executeQuery,
    selectRowQuery,
    selectRowCollumnQuery,
    createQuery
} = require("../core/mysql");
const { createAlarmPortUserQuery, createAlertStack, createPortAlarmQuery } = require("./alerting");

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

const runWorkerSendAlert = (alertStack, eachErrorCallback = null) => {
    return new Promise((resolve, reject) => {

        const worker = new JobQueue(10);
        worker.setDelay(1000);

        alertStack.forEach(alert => {
            if(alert.alertId)
                worker.registerWorker("opnimus-alerting-port-v2/worker-send-alert", { alert });
        });

        const sendedAlertIds = [];
        const unsendedAlerts = [];

        if(worker.workers.length < 1) {
            logger.warn("The jobs of Worker Send Alert is empty");
            resolve({ sendedAlertIds, unsendedAlerts });
            return;
        }

        worker.onEachAfter(workerResult => {
            
            const { alertId, success, error } = workerResult;
            if(success)
                sendedAlertIds.push(alertId);
            else {
                unsendedAlerts.push({ alertId, error });
                if(typeof eachErrorCallback == "function")
                    eachErrorCallback(error);
            }

        });

        if(typeof eachErrorCallback == "function")
            worker.onEachError(err => eachErrorCallback(err));

        worker.onAfterRun(() => resolve({ sendedAlertIds, unsendedAlerts }));
        worker.run();

    });
};

const extractAlarmPortAreaIds = (alarmPorts) => {
    const regionalIds = [];
    const witelIds = [];
    const locIds = [];
    for(let i=0; i<alarmPorts.length; i++) {


        if(regionalIds.indexOf(alarmPorts[i].regional_id) < 0)
            regionalIds.push(alarmPorts[i].regional_id);

        if(witelIds.indexOf(alarmPorts[i].witel_id) < 0)
            witelIds.push(alarmPorts[i].witel_id);

        if(locIds.indexOf(alarmPorts[i].location_id) < 0)
            locIds.push(alarmPorts[i].location_id);

    }
    return { regionalIds, witelIds, locationIds: locIds };
};

const onAlertSuccess = async (pool, sendedAlertIds) => {
    
    let updateSuccessAlertQueryStr = "UPDATE alert_message SET status=? WHERE id IN (?)";
    updateSuccessAlertQueryStr = createQuery(updateSuccessAlertQueryStr, ["success", sendedAlertIds]);

    logger.info("Update alert success status in database", {
        database: dbConfig.opnimusNewMigrated2.database,
        query: updateSuccessAlertQueryStr
    });
    try {
        await executeQuery(pool, updateSuccessAlertQueryStr);
    } catch(err) {
        logger.error(err);
    }
};

const onAlertUnsended = async (pool, alertId, alertErr) => {
    const processDateStr = toDatetimeString(new Date());
    try {
    
        let updateUnsendedAlertQueryStr = "UPDATE alert_message SET status=? WHERE id=?";
        updateUnsendedAlertQueryStr = createQuery(updateUnsendedAlertQueryStr, ["unsended", item.alertId]);
        
        logger.info("Update alert unsended status in database", {
            database: dbConfig.opnimusNewMigrated2.database,
            query: updateUnsendedAlertQueryStr
        });
        await executeQuery(pool, updateUnsendedAlertQueryStr);

        if(alertErr.description) {

            let insertErrorQueryStr = "INSERT INTO alert_message_error (alert_id, error_code, description, created_at)"+
                " VALUES (?, ?, ?, ?, ?)";
            insertErrorQueryStr = createQuery(insertErrorQueryStr, [
                alertId, alertErr.code, alertErr.description, processDateStr
            ]);

            logger.info("Alert error has description, push alert error to database", {
                database: dbConfig.opnimusNewMigrated2.database,
                query: insertErrorQueryStr
            });
            await executeQuery(pool, insertErrorQueryStr);

        }

    } catch(err) {
        logger.error(err);
    }
};

module.exports.getPortGroupByWitel = async (pool) => {
    try {
        const database = dbConfig.opnimusNewMigrated2.database;

        const witelListQueryStr = "SELECT * FROM witel";
        // const witelListQueryStr = "SELECT * FROM witel WHERE id=43";
        logger.info("Get witel list from database", { database, query: witelListQueryStr });
        const { results: witelList } = await executeQuery(pool, witelListQueryStr);

        const portListQueryStr = "SELECT alarm.*, rtu.location_id, rtu.datel_id, rtu.witel_id, rtu.regional_id"+
            " FROM alarm_port_status AS alarm JOIN rtu_list AS rtu ON rtu.sname=alarm.rtu_sname"+
            " WHERE alarm.is_closed=0";
        logger.info("Get opened alarm port list", { database, query: portListQueryStr });
        const { results: portList } = await executeQuery(pool, portListQueryStr);

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

    } catch(err) {
        logger.error(err);
        return [];
    }
};

module.exports.updateClosedPorts = async (pool, closePorts, processDateStr) => {
    try {

        if(closePorts.length > 0) {

            const database = dbConfig.opnimusNewMigrated2.database;

            const { closePortIds, closePortQueries } = closePorts.reduce(
                (result, item, index) => {
                    result.closePortIds.push(item.id);
                    const queryStr = "UPDATE alarm_port_status SET is_closed=?, closed_at=? WHERE id=?;";
                    result.closePortQueries.push( createQuery(queryStr, [1, processDateStr, item.id]) );
                    return result;
                },
                { closePortIds: [], closePortQueries: [] }
            );

            const closePortIdsStr = closePortIds.join(",");
            const closePortQueryStr = closePortQueries.join(" ");
            logger.info("Closing (update) opened alarm ports", { database, id: closePortIdsStr, query: closePortQueryStr });
            await executeQuery(pool, closePortQueryStr);

        }

    } catch(err) {
        logger.error(err);
    }
}

module.exports.insertOpenPorts = async (pool, openPorts, processDateStr) => {
    let alarmPorts = [];
    try {

        if(openPorts.length > 0) {
            
            const database = dbConfig.opnimusNewMigrated2.database;

            const lastPortQueryStr = "SELECT id FROM alarm_port_status ORDER BY id DESC LIMIT 1";
            logger.info("Get last alarm_port_status id from database", { database, query: lastPortQueryStr });

            const { results: lastPortId } = await selectRowCollumnQuery(pool, "id", lastPortQueryStr);

            const queryInsertPort = new InsertQueryBuilder("alarm_port_status");
            queryInsertPort.addFields("port_no");
            queryInsertPort.addFields("port_name");
            queryInsertPort.addFields("port_value");
            queryInsertPort.addFields("port_unit");
            queryInsertPort.addFields("port_severity");
            queryInsertPort.addFields("type");
            queryInsertPort.addFields("location");            
            queryInsertPort.addFields("rtu_sname");
            queryInsertPort.addFields("rtu_status");
            queryInsertPort.addFields("opened_at");

            openPorts.forEach(item => {
                queryInsertPort.appendRow([
                    item.no_port,
                    item.port_name,
                    item.value,
                    item.units,
                    item.severity.name.toString().toLowerCase(),
                    item.result_type,
                    item.location,
                    item.rtu_sname,
                    item.rtu_status.toString().toLowerCase(),
                    processDateStr
                ]);
            });

            const openPortQueryStr = createQuery(queryInsertPort.getQuery(), queryInsertPort.getBuiltBindData());
            logger.info("Open (insert) new alarm ports", { database, query: openPortQueryStr });
            const insertAlarmQuery = await executeQuery(pool, openPortQueryStr);

            const alarmIds = queryInsertPort.buildInsertedId(
                insertAlarmQuery.results.insertId,
                insertAlarmQuery.results.affectedRows
            );

            if(alarmIds.length > 0) {

                const alarmPortQueryStr = createPortAlarmQuery(alarmIds);
                logger.info("Get inserted alarm_port_status id from database", {
                    database: dbConfig.opnimusNewMigrated2.database,
                    query: alarmPortQueryStr
                });
    
                const alarmPortQuery = await executeQuery(pool, alarmPortQueryStr);
                if(alarmPortQuery.results)
                    alarmPorts = alarmPortQuery.results;
            
            }
        }

    } catch(err) {
        logger.error(err);
    } finally {
        return alarmPorts;
    }
}

module.exports.insertAlarmPorts = async (pool, alarmPorts) => {
    let alertStack = [];
    try {

        if(alarmPorts.length > 0) {

            const database = dbConfig.opnimusNewMigrated2.database;

            const { regionalIds, witelIds, locationIds } = extractAlarmPortAreaIds(alarmPorts);
            const { user: alarmPortUserQuery, pic: alarmPortPicQuery } = createAlarmPortUserQuery({ regionalIds, witelIds, locationIds });

            logger.info("Get group of port alarm from database", { database, query: alarmPortUserQuery });
            const { results: alarmPortUsers } = await executeQuery(pool, alarmPortUserQuery);

            logger.info("Get pic of port alarm from database", { database, query: alarmPortPicQuery });
            const { results: alarmPortPics } = await executeQuery(pool, alarmPortPicQuery);
            
            alertStack = createAlertStack(alarmPorts, alarmPortUsers, alarmPortPics);

        }

    } catch(err) {
        logger.error(err);
    } finally {
        return alertStack;
    }
};

module.exports.insertAlertMessage = async (pool, alertStack, processDateStr) => {
    try {

        if(alertStack.length > 0) {

            const database = dbConfig.opnimusNewMigrated2.database;

            const queryInsertAlert = new InsertQueryBuilder("alert_message");
            queryInsertAlert.addFields("port_id");
            queryInsertAlert.addFields("chat_id");
            queryInsertAlert.addFields("status");
            queryInsertAlert.addFields("created_at");

            alertStack.forEach(item => {
                queryInsertAlert.appendRow([
                    item.alarmId,
                    item.chatId,
                    "sending",
                    processDateStr
                ]);
            });

            const insertAlertQueryStr = createQuery(
                queryInsertAlert.getQuery(),
                queryInsertAlert.getBuiltBindData()
            );
            
            logger.info("Write new alert to database", { database, query: insertAlertQueryStr });
            const insertAlertQuery = await executeQuery(pool, insertAlertQueryStr);
            const alertIds = queryInsertAlert.buildInsertedId(
                insertAlertQuery.results.insertId,
                insertAlertQuery.results.affectedRows
            );

            logger.info("Alert is successfully to write", { ids: alertIds })
            for(let i=0; i<alertStack.length; i++) {
                if(i < alertIds.length)
                    alertStack[i].alertId = alertIds[i];
            }

        }

    } catch(err) {
        logger.error(err);
    } finally {
        return alertStack;
    }
};

module.exports.main = async () => {
    logger.info("App is starting");
    const processDateStr = toDatetimeString(new Date());

    logger.info("Creating a database connection");
    const pool = createDbPool({
        ...dbConfig.opnimusNewMigrated2,
        multipleStatements: true
    });

    try {

        const witelPortList = await this.getPortGroupByWitel(pool);

        logger.info("Worker Port Alarm started");
        const { openPorts, closePorts } = await runWorkerGetAlarm(witelPortList, err => {
            logger.error("Error when running worker worker-port-alarm.js:", err);
        });
        logger.info(`Worker Port Alarm run successfully, openPorts:${ openPorts.length }, closePorts:${ closePorts.length }`);

        await this.updateClosedPorts(pool, closePorts, processDateStr);
        const alarmPorts = await this.insertOpenPorts(pool, openPorts, processDateStr);

        let alertStack = await this.insertAlarmPorts(pool, alarmPorts);
        alertStack = await this.insertAlertMessage(pool, alertStack, processDateStr);

        let sendedAlertIds = [];
        let unsendedAlerts = [];
        if(alertStack.length > 0) {

            logger.info("Worker Send Alert started.");
            const sendAlertResult = await runWorkerSendAlert(alertStack, err => {
                logger.error("Error when running worker worker-send-alert.js:", err);
            });

            sendedAlertIds = sendAlertResult.sendedAlertIds;
            unsendedAlerts = sendAlertResult.unsendedAlerts;

        }

        if(sendedAlertIds.length > 0) {

            await onAlertSuccess(pool, sendedAlertIds);

        }

        if(unsendedAlerts.length > 0) {

            // const { alertId, error } = item;
            for(let j=0; j<unsendedAlerts.length; j++) {
                await onAlertUnsended(pool, unsendedAlerts[j].alertId, unsendedAlerts[j].error);
            }
            
        }

        logger.info("App is running successfully", {
            openPorts: openPorts.length,
            closePorts: closePorts.length,
            sendedAlerts: sendedAlertIds.length,
            unsendedAlerts: unsendedAlerts.length,
        });

    } catch(err) {

        logger.error(err);

    } finally {

        await closePool(pool);
        logger.info("App has closed");

    }
};

const offTimer = (ms) => {
    return new Promise(resolve => {
        setTimeout(() => resolve(), ms);
    });
};

const runCron = async () => {
    const startTime = toDatetimeString(new Date());
    console.info(`\n\nRunning cron Opnimus Alerting Port V2 at ${ startTime }`);
    while(true) {
        try {
            await this.main();
            const endTime = toDatetimeString(new Date());
            console.info(`\n\nCron Opnimus Alerting Port V2 closed at ${ endTime }`);
        } catch(err) {
            console.error(err);
            const endTime = toDatetimeString(new Date());
            console.info(`\n\nCron Opnimus Alerting Port V2 closed at ${ endTime }`);
        } finally {
            await offTimer(1000);
        }
    }
};

/*
 * Opnimus Alerting Port
 * Runs every 2 minutes
 */
// cron.schedule("*/2 * * * *", runCron);
runCron();
// this.main();