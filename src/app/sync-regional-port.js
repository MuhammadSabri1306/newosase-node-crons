const { Database } = require("../helpers/newosase");
const getOpnimusPortStatus = require("./get-opnimus-port-status");
const alarmDb = require("../helpers/write-alarm-db");
const defineAlarm = require("../helpers/define-alarm");

const isRawMatch = (dbItem, rawItem) => {
    if(dbItem.rtu_code != rawItem.rtu_sname)
        return false;
    if(dbItem.port != rawItem.no_port)
        return false;
    if(dbItem.unit != rawItem.units)
        return false;
    return true;
};

module.exports = async (regional) => {
    const db = new Database();
    try {
        const dataReal = await getOpnimusPortStatus({
            regionalId: regional.id,
            witelId: 43,
            isAlert: 1
        });

        // const dbPort = await db.runQuery({
        //     query: "SELECT * FROM rtu_port_status WHERE regional_id=?",
        //     bind: [regional.id]
        // });
        const dbPort = await db.runQuery({
            query: "SELECT port.* FROM `rtu_port_status` AS port JOIN rtu_list AS rtu ON rtu.sname=port.rtu_code WHERE rtu.witel_id=?",
            bind: [43]
        });

        const alarmRawData = dataReal.map(item => {
            return { ...item, regional_id: regional.id };
        });

        const { newPorts, openedAlarm, closedAlarm } = defineAlarm(alarmRawData, dbPort.results);
        console.log({
            newPorts: newPorts.length,
            openedAlarm: openedAlarm.length,
            closedAlarm: closedAlarm.length
        });

        if(newPorts.length > 0) {
            // write new alarm
            await alarmDb.writeNewPortAlarm(newPorts);
        }

        if(openedAlarm.length > 0) {
            // open state in rtu port status and write new rtu port message
            // await alarmDb.writeNewMessage(openedAlarm);
            await alarmDb.openAlarmState(openedAlarm);
        }

        if(closedAlarm.length > 0) {
            // close state in rtu port status
            await alarmDb.closeAlarmState(closedAlarm);
        }

        // await sendTelegramAlert();
        return Promise.resolve({ regionalId: regional.id });
        
    } catch(err) {
        console.error(err);
        return Promise.reject({ regionalId: regional.id });
    }
};