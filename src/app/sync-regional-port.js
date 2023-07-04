const { Database } = require("../helpers/newosase");
const getOpnimusPortStatus = require("./get-opnimus-port-status");
const alarmDb = require("../helpers/write-alarm-db");
const defineAlarm = require("../helpers/define-alarm");
// const sendTelegramAlert = require("./send-message");

module.exports = async (regional) => {
    const db = new Database();
    try {
        const dataReal = await getOpnimusPortStatus({ regionalId: regional.id });
        const dbPort = await db.runQuery({
            query: "SELECT * FROM rtu_port_status WHERE regional_id=?",
            bind: [regional.id]
        });

        const alarmRawData = dataReal.map(item => {
            return { ...item, regional_id: regional.id };
        });

        const { newPorts, openedAlarm, closedAlarm } = defineAlarm(alarmRawData, dbPort.results);
        // console.log(newPorts.length, openedAlarm.length, closedAlarm.length)

        if(newPorts.length < 1)
            console.log("newPorts length: "+newPorts.length);
        else {
            // write new alarm
            await alarmDb.writeNewAlarm(newPorts);
        }

        if(openedAlarm.length < 1)
            console.log("openedAlarm length: "+openedAlarm.length);
        else {
            // write new rtu port message
            await alarmDb.writeNewMessage(openedAlarm);
        }

        if(closedAlarm.length < 1)
            console.log("closedAlarm length: "+closedAlarm.length);
        else {
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