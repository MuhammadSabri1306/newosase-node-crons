const { Database } = require("../helpers/newosase");
const getOpnimusPortStatus = require("./get-opnimus-port-status");
const alarmDb = require("../helpers/write-alarm-db");
const defineAlarm = require("../helpers/define-alarm");

module.exports = async (regional) => {
    const db = new Database();
    try {
        const dataReal = await getOpnimusPortStatus({
            regionalId: regional.id,
            isAlert: 1
        });

        const dbPort = await db.runQuery({
            query: "SELECT * FROM rtu_port_status WHERE regional_id=?",
            bind: [regional.id]
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
            await alarmDb.writeNewAlarm(newPorts);
        }

        if(openedAlarm.length > 0) {
            // write new rtu port message
            await alarmDb.writeNewMessage(openedAlarm);
        }

        if(closedAlarm.length > 0) {
            // close state in rtu port status
            await alarmDb.closePortState(closedAlarm);
        }

        // await sendTelegramAlert();
        return Promise.resolve({ regionalId: regional.id });
        
    } catch(err) {
        console.error(err);
        return Promise.reject({ regionalId: regional.id });
    }
};