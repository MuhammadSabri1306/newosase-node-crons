const Database = require("./newosase/database");
const { toDatetimeString } = require("./date");
const { InsertQueryBuilder } = require("../helpers/mysql-query-builder");

const writeNewPortAlarm = async (alarmList) => {
    if(alarmList.length < 1)
        return;
    
    const db = new Database();
    const queryDbPort = new InsertQueryBuilder('rtu_port_status');
    queryDbPort.addFields('rtu_code');
    queryDbPort.addFields('port');
    queryDbPort.addFields('port_name');
    queryDbPort.addFields('value');
    queryDbPort.addFields('unit');
    queryDbPort.addFields('rtu_status');
    queryDbPort.addFields('port_status');
    queryDbPort.addFields('start_at');
    queryDbPort.addFields('state');
    queryDbPort.addFields('location');
    queryDbPort.addFields('regional_id');
    
    const currDateTime = toDatetimeString(new Date());
    let openedAlarm = 0;
    alarmList.forEach(item => {
        const isSeverityNormal = item.severity.id === 1;
        if(!isSeverityNormal)
            openedAlarm++;
        queryDbPort.appendRow([item.rtu_sname, item.no_port, item.port_name, (item.value || 0), item.units, item.rtu_status,
            item.severity.name, currDateTime, !isSeverityNormal, item.location, item.regional_id]);
    });

    const resultDbPort = await db.runQuery({
        query: queryDbPort.getQuery(),
        bind: queryDbPort.getBuiltBindData(),
        autoClose: false
    });

    if(openedAlarm < 1)
        return;
    let results = resultDbPort.results;

    const queryDbMsg = new InsertQueryBuilder("rtu_port_message");
    queryDbMsg.addFields("status_id");
    queryDbMsg.addFields("created_at");

    let portStatusId = results.insertId;
    const maxPortStatusId = results.insertId + results.affectedRows;
    alarmList.forEach(item => {
        if(portStatusId >= maxPortStatusId)
            return;
        queryDbMsg.appendRow([portStatusId, currDateTime]);
        portStatusId++;
    });

    // for(let statusId=results.insertId; statusId<(results.insertId + results.affectedRows); statusId++) {
    //     queryDbMsg.appendRow([statusId, currDateTime]);
    // }

    await db.runQuery({
        query: queryDbMsg.getQuery(),
        bind: queryDbMsg.getBuiltBindData()
    });
};

const writeNewMessage = async (alarmList) => {
    if(alarmList.length < 1)
        return;

    const queryDbMsg = new InsertQueryBuilder("rtu_port_message");
    queryDbMsg.addFields("status_id");
    queryDbMsg.addFields("created_at");

    const currDateTime = toDatetimeString(new Date());
    alarmList.forEach(item => {
        queryDbMsg.appendRow([item.portStatusId, currDateTime]);
    });

    const db = new Database();
    await db.runQuery({
        query: queryDbMsg.getQuery(),
        bind: queryDbMsg.getBuiltBindData()
    });
};

const closePortState = async (portIds) => {
    const currDateTime = toDatetimeString(new Date());
    const db = new Database();
    await db.runQuery({
        query: "UPDATE rtu_port_status SET state=0, end_at=? WHERE id IN (?)",
        bind: [currDateTime, portIds]
    });
};

const openAlarmState = async (alarmList) => {
    const currDateTime = toDatetimeString(new Date());
    const db = new Database();

    try {
        for(let item of alarmList) {
            if(item.oldRow.state == 1) {
                await db.runQuery({
                    query: "UPDATE rtu_port_status SET value=?, rtu_status=?, port_status=? WHERE id=?",
                    bind: [item.newRow.value, item.newRow.rtu_status, item.newRow.severity.name, item.oldRow.id],
                    autoClose: false
                });
            } else {
                await db.runQuery({
                    query: "UPDATE rtu_port_status SET value=?, rtu_status=?, port_status=?, state=?, start_at=? WHERE id=?",
                    bind: [item.newRow.value, item.newRow.rtu_status, item.newRow.severity.name, true, currDateTime, item.oldRow.id],
                    autoClose: false
                });
            }
        
            await db.runQuery({
                query: "INSERT INTO rtu_port_message (status_id, created_at) VALUES (?, ?)",
                bind: [item.oldRow.id, currDateTime],
                autoClose: false
            });
        }
    } catch(err) {
        console.error(err);
    }
};

const closeAlarmState = async (portData) => {
    const currDateTime = toDatetimeString(new Date());
    const portIds = portData.map(item => item.id);

    const db = new Database();
    await db.runQuery({
        query: "UPDATE rtu_port_status SET rtu_status=?, port_status=?, state=0, end_at=? WHERE id IN (?)",
        bind: ["normal", "normal", currDateTime, portIds]
    });
};

module.exports = { writeNewPortAlarm, openAlarmState, closeAlarmState };