const { parentPort, workerData } = require("worker_threads");
const config = require("../config");

const getNewosasePortStatus = require("../helpers/newosase/fetch/get-port-status");
const getPortStatus = require("../helpers/db-query/get-port-status");
const defineAlarm = require("../helpers/define-alarm");
const storePortStatus = require("../helpers/db-query/store-port-status");
const storePortMessage = require("../helpers/db-query/store-port-message");
const closePortStatus = require("../helpers/db-query/close-port-status");
const getAlertUser = require("../helpers/db-query/get-alert-user");
const getPortMessage = require("../helpers/db-query/get-port-message");
const buildMessage = require("../helpers/build-message");
const { toFixedNumber } = require("../helpers/number-format");
const { extractDate } = require("../helpers/date");
const sendTelegramAlert = require("../helpers/send-telegram-alert");

const { workData } = workerData; // { level, workData }

const getRtuListParams = () => {
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
    const params = { isAlert: 1 };
    if(config.alert.workerLevel == "rtu")
        params.searchRtuSname = workData.rtu_sname;
    else if(config.alert.workerLevel == "witel")
        params.witelId = workData.witel_id;
    else if(config.alert.workerLevel == "regional")
        params.regionalId = workData.regional_id;
    return params;
};

const buildAlert = async () => {
    const portMsgParams = getRtuListParams();
    try {

        const alerts = [];
        const telegramUsers = await getAlertUser();
        const alertMsg = await getPortMessage(portMsgParams);

        alertMsg.forEach(item => {
            // let statusState = null;
            let title = null, description = null;

            if(item.port_name == "Status DEG" && item.port_value == 1){
                
                // statusState = "GENSET ON";
                title = `🔆 GENSET ON: ${ item.location_name } (${ item.rtu_code })🔆`;
                description = "Terpantau GENSET ON dengan detail sebagai berikut:";

            } else if(item.port_name == "Status PLN" && item.port_value == 1) {
                
                // statusState = "PLN OFF";
                title = `⚡️ PLN OFF: ${ item.location_name } (${ item.rtu_code })⚡️`;
                description = "Terpantau PLN OFF dengan detail sebagai berikut:";

            }

            const datetime = extractDate(new Date(item.created_at));
            const timestamp = `${ datetime.day }-${ datetime.month }-${ datetime.year } ${ datetime.hours }:${ datetime.minutes } WIB`;
            
            const message = buildMessage({
                title,
                description,
                timestamp,
                regional: item.divre_name,
                witel: item.witel_name,
                location: item.location_name,
                rtuCode: item.rtu_code,
                nodeName: item.rtu_name,
                siteType: null,
                portName: item.port_name,
                port: `${ item.port } ${ item.port_name }`,
                value: `${ item.port_value ? toFixedNumber(item.port_value) : null } ${ item.port_unit }`,
                status: item.port_status
            });

            telegramUsers.forEach(user => {
                const alertItem = { user, message, messageId: item.id };
                alerts.push(alertItem);
            });
        });

        return alerts;

    } catch(err) {
        console.error(err);
        return [];
    }
};

const syncPort = async () => {
    const queryRtuListParams = getRtuListParams();
    const apiPortStatusParams = getApiPortParams();
    try {

        const portStatusOld = await getPortStatus(queryRtuListParams);
        const portStatusNew = await getNewosasePortStatus(apiPortStatusParams);
        
        const { newPorts, openedAlarm, closedAlarm } = defineAlarm(portStatusNew, portStatusOld);
        // console.log({
        //     portStatusOld: portStatusOld.length,
        //     portStatusNew: portStatusNew.length,
        //     newPorts: newPorts.length,
        //     openedAlarm: openedAlarm.length,
        //     closedAlarm: closedAlarm.length
        // });

        if(newPorts.length > 0) {
            // write new alarm
            await storePortStatus(newPorts);
        }

        if(openedAlarm.length > 0) {
            // open state in rtu port status and write new rtu port message
            // await alarmDb.writeNewMessage(openedAlarm);
            await storePortMessage(openedAlarm);
        }

        if(closedAlarm.length > 0) {
            // close state in rtu port status
            await closePortStatus(closedAlarm);
        }

        const dataAlert = await buildAlert();
        // await sendTelegramAlert(dataAlert);
        await sendTelegramAlert(dataAlert, () => {
            parentPort.postMessage({
                portStatusOld,
                portStatusNew
            });
            process.exit();
        });


    } catch(err) {
        console.error(err);
        process.exit();
    }
};

syncPort();