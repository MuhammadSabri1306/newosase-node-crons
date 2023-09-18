const { parentPort, workerData } = require("worker_threads");
const config = require("../config");
const { logger } = require("../helpers/logger");
const updatePortMessage = require("../helpers/db-query/update-port-message");
const updatePortStatus = require("../helpers/db-query/update-port-status");
const getPortStatus = require("../helpers/db-query/get-port-status");
const storePortStatus = require("../helpers/db-query/store-port-status");
const getUnsendedPortMessage = require("../helpers/db-query/get-unsended-port-message");
const getPicUserOnLoc = require("../helpers/db-query/get-pic-user-on-loc");

const getNewosasePortStatus = require("../helpers/newosase/fetch/get-port-status");
const defineAlarm = require("../helpers/define-alarm");
const writeMessageStack = require("../helpers/write-message-stack");
const buildMessage = require("../helpers/build-message");
const sendTelegramAlert = require("../helpers/send-telegram-alert");

const { workData, jobQueueNumber } = workerData; // { level, workData, jobQueueNumber }

const getRtuListParams = () => {
    return { witel_id: workData.witel_id };

    const params = {};
    if(config.alert.workerLevel == "rtu")
        params.sname = workData.rtu_sname;
    else if(config.alert.workerLevel == "witel")
        params.witel_id = workData.witel_id;
    else if(config.alert.workerLevel == "regional")
        params.regional_id = workData.regional_id;
    return params;
};

const getApiPortParams = () => {
    return { isAlert: 1, witelId: workData.witel_id };

    const params = { isAlert: 1 };
    if(config.alert.workerLevel == "rtu")
        params.searchRtuSname = workData.rtu_sname;
    else if(config.alert.workerLevel == "witel")
        params.witelId = workData.witel_id;
    else if(config.alert.workerLevel == "regional")
        params.regionalId = workData.regional_id;
    return params;
};

const getAlertPort = async (portMsgParams) => {
    try {

        const alertMsgList = await getUnsendedPortMessage(portMsgParams);
        if(alertMsgList.length < 1)
            return [];

        const alertMsgLocIds = alertMsgList
            .map(loc => loc.location_id)
            .reduce((locIds, locId) => {
                if(!locIds.includes(locId))
                    locIds.push(locId);
                return locIds;
            }, []);

        const portPicList = await getPicUserOnLoc(alertMsgLocIds);
        const result = alertMsgList.map(item => {
            item.pic = portPicList.filter(picItem => picItem.location_id == item.location_id);
            return item;
        });
        return result;

    } catch(err) {
        logger.error(err);
        return [];
    }
};

const buildAlert = async () => {
    const portMsgParams = getRtuListParams();
    const alertMsg = await getAlertPort(portMsgParams);
    
    const alerts = alertMsg.map(item => {
        const message = buildMessage(item);
        return { alert: item, message };
    });

    return alerts;
};

const alert = async () => {
    logger.log(`Starting telegram-alert-v3 thread, queue: ${ jobQueueNumber }`);

    const queryRtuListParams = getRtuListParams();
    const apiPortStatusParams = getApiPortParams();
    try {

        const portStatusOld = await getPortStatus(queryRtuListParams);
        const portStatusNew = await getNewosasePortStatus(apiPortStatusParams);
        
        const { newPorts, openedAlarm, closedAlarm } = defineAlarm(portStatusNew, portStatusOld);
        logger.debug({
            newPorts: newPorts.length,
            openedAlarm: openedAlarm.length,
            closedAlarm: closedAlarm.length
        });

        let openPortId = [];
        if(newPorts.length > 0) {
            // write new alert port
            const newAlertPortId = await storePortStatus(newPorts);
            openPortId = newAlertPortId;
        }

        const currDate = new Date();
        if(openedAlarm.length > 0) {
            // open state in rtu port status and write new rtu port message
            for(let i=0; i<openedAlarm.length; i++) {
                const currPortId = openedAlarm[i].oldRow.id;
                const isPortOpened = await updatePortStatus(currPortId, {
                    value: openedAlarm[i].newRow.value,
                    rtu_status: openedAlarm[i].newRow.rtu_status,
                    port_status: openedAlarm[i].newRow.severity.name,
                    state: 1,
                    start_at: currDate
                });

                if(isPortOpened)
                    openPortId.push(currPortId);
            }
        }

        if(openPortId.length > 0) {
            
            logger.log("Write messages stack, queue: "+jobQueueNumber);
            await writeMessageStack(openPortId, workData.regional_id, workData.witel_id, jobQueueNumber);
            logger.log("Done write messages stack, queue: "+jobQueueNumber);

            // await storePortMessage(openedAlarm);
        }
        
        if(closedAlarm.length > 0) {
            // close state in rtu port status
            const closedAlarmIds = closedAlarm.map(item => item.id);
            await updatePortStatus(closedAlarmIds, {
                rtu_status: "normal",
                port_status: "normal",
                state: 0,
                end_at: currDate
            });
        }

        const dataAlert = await buildAlert();
        if(dataAlert.length > 0)
            await updatePortMessage(dataAlert.map(item => item.alert.id), "sending");

        await sendTelegramAlert(dataAlert, () => {
            logger.log(`Close telegram-alert-v3 thread, queue: ${ jobQueueNumber }`);

            parentPort.postMessage({
                portStatusOld,
                portStatusNew
            });
            
            process.exit();
        });


    } catch(err) {
        logger.error(err);
        process.exit();
    }
};

alert();