const { http, Database } = require("../helpers/newosase");
const getOpnimusPortStatus = require("./get-opnimus-port-status");
const alarmDb = require("../helpers/write-alarm-db");
const sendTelegramAlert = require("./send-message");

const defineAlarm = (rawData, dataDbPort) => {
    const newAlarm = [];
    const newPorts = [];
    const openedAlarm = [];
    const closedAlarm = [];

    rawData.forEach(item => {
        const dbItem = dataDbPort.find(portItem => {
            if(portItem.rtu_code != item.rtu_sname)
                return false;
            if(portItem.port != item.no_port)
                return false;
            if(portItem.unit != item.units)
                return false;
            return true;
        });

        const isSeverityNormal = item.severity.id === 1;
        const isPortStateOpen = dbItem ? Boolean(dbItem.state) : false;

        if(!dbItem) {
            
            newPorts.push(item);

        } else if(!isPortStateOpen && !isSeverityNormal) {
            
            openedAlarm.push({
                dataAlarm: item,
                portStatusId: dbItem.id
            });
        
        } else if(isPortStateOpen && isSeverityNormal) {

            closedAlarm.push({
                dataAlarm: item,
                portStatusId: dbItem.id
            });

        }

        // if(!dbItem && item.severity.id !== 1) {
            
        //     newAlarm.push(item);

        // } else if(dbItem && Boolean(dbItem.state) && item.severity.id === 1) {

        //     closedAlarm.push({
        //         dataAlarm: item,
        //         dbStatusId: dbItem.id
        //     });

        // }
    });

    return { newPorts, openedAlarm, closedAlarm };
};

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

        await sendTelegramAlert();
        
        // console.log(newAlarm.length);
        // await alarmDb.writeNewAlarm(newAlarm);
        // console.log(newAlarm.length);
        
    } catch(err) {
        console.error(err);
        return;
    }
};