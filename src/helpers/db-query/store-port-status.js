const Database = require("../newosase/database");
const { toDatetimeString } = require("../date");
const { InsertQueryBuilder } = require("../mysql-query-builder");

module.exports = async (alarmList) => {
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
    
    const currDateTime = toDatetimeString(new Date());
    let openedAlarm = 0;
    alarmList.forEach(item => {
        const isSeverityNormal = item.severity.id === 1;
        if(!isSeverityNormal)
            openedAlarm++;
        queryDbPort.appendRow([item.rtu_sname, item.no_port, item.port_name, (item.value || 0), item.units, item.rtu_status,
            item.severity.name, currDateTime, !isSeverityNormal, item.location]);
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

    try {
        await db.runQuery({
            query: queryDbMsg.getQuery(),
            bind: queryDbMsg.getBuiltBindData(),
            autoClose: false
        });
    } catch(err) {
        console.error(err);
    }

};