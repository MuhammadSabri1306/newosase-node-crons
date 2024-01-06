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
const { logErrorWithFilter } = require("./log-error");

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
        logErrorWithFilter(err);
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
        logErrorWithFilter(err);
    }
};

module.exports.main = async (applyAlertingMessage = false) => {
    logger.info("App is starting");
    const processDateStr = toDatetimeString(new Date());

    logger.info("Creating a database connection");
    const pool = createDbPool({
        ...dbConfig.opnimusNewMigrated2,
        multipleStatements: true
    });

    try {

        const witelListQueryStr = "SELECT * FROM witel";
        // const witelListQueryStr = "SELECT * FROM witel WHERE id=43";
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
            logErrorWithFilter("Error when running worker worker-port-alarm.js:", err);
        });
        logger.info(`Worker Port Alarm run successfully, openPorts:${ openPorts.length }, closePorts:${ closePorts.length }`);

        if(closePorts.length > 0) {

            const { closePortIds, closePortQueries } = closePorts.reduce((result, item, index) => {
                result.closePortIds.push(item.id);
                const queryStr = "UPDATE alarm_port_status SET is_closed=?, closed_at=? WHERE id=?;";
                result.closePortQueries.push( createQuery(queryStr, [1, processDateStr, item.id]) );
                return result;
            }, { closePortIds: [], closePortQueries: [] });

            const closePortIdsStr = closePortIds.join(",");
            const closePortQueryStr = closePortQueries.join(" ");
            logger.info("Closing (update) opened alarm ports", {
                database: dbConfig.opnimusNewMigrated2.database,
                id: closePortIdsStr,
                query: closePortQueryStr
            });

            await executeQuery(pool, closePortQueryStr);

        }

        let alarmPorts = [];
        if(openPorts.length > 0) {

            const lastPortQueryStr = "SELECT id FROM alarm_port_status ORDER BY id DESC LIMIT 1";
            logger.info("Get last alarm_port_status id from database", {
                database: dbConfig.opnimusNewMigrated2.database,
                query: lastPortQueryStr
            });

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
            logger.info("Open (insert) new alarm ports", {
                database: dbConfig.opnimusNewMigrated2.database,
                query: openPortQueryStr
            });
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

        let alertStack = [];
        if(applyAlertingMessage && alarmPorts.length > 0) {

            const { regionalIds, witelIds, locationIds } = extractAlarmPortAreaIds(alarmPorts);
            const { user: alarmPortUserQuery, pic: alarmPortPicQuery } = createAlarmPortUserQuery({ regionalIds, witelIds, locationIds });

            logger.info("Get user of port alarm from database", {
                database: dbConfig.opnimusNewMigrated2.database,
                query: alarmPortUserQuery
            });
            const { results: alarmPortUsers } = await executeQuery(pool, alarmPortUserQuery);

            logger.info("Get user of port alarm from database", {
                database: dbConfig.opnimusNewMigrated2.database,
                query: alarmPortPicQuery
            });
            const { results: alarmPortPics } = await executeQuery(pool, alarmPortPicQuery);
            
            alertStack = createAlertStack(alarmPorts, alarmPortUsers, alarmPortPics);

        }

        let sendedAlertIds = [];
        let unsendedAlerts = [];
        if(alertStack.length > 0) {

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

            const insertAlertQueryStr = createQuery(queryInsertAlert.getQuery(), queryInsertAlert.getBuiltBindData());
            logger.info("Write new alert to database", {
                database: dbConfig.opnimusNewMigrated2.database,
                query: insertAlertQueryStr
            });

            const insertAlertQuery = await executeQuery(pool, insertAlertQueryStr);
            const alertIds = queryInsertAlert.buildInsertedId(insertAlertQuery.results.insertId, insertAlertQuery.results.affectedRows);
            console.log(alertIds)
            for(let i=0; i<alertStack.length; i++) {
                if(i < alertIds.length)
                    alertStack[i].alertId = alertIds[i];
            }

            logger.info("Worker Send Alert started.");
            const sendAlertResult = await runWorkerSendAlert(alertStack, err => {
                logErrorWithFilter("Error when running worker worker-send-alert.js:", err);
            });

            sendedAlertIds = sendAlertResult.sendedAlertIds;
            unsendedAlerts = sendAlertResult.unsendedAlerts;

        }

        if(applyAlertingMessage && sendedAlertIds.length > 0) {

            await onAlertSuccess(pool, sendedAlertIds);

        }

        if(applyAlertingMessage && unsendedAlerts.length > 0) {

            // const { alertId, error } = item;
            for(let j=0; j<unsendedAlerts.length; j++) {
                await onAlertUnsended(pool, unsendedAlerts[j].alertId, unsendedAlerts[j].error);
            }
            
        }

    } catch(err) {

        logErrorWithFilter(err);

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
            await this.main(true);
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
// this.main(true);