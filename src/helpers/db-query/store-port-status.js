const Database = require("../newosase/database");
const { toDatetimeString } = require("../date");
const { InsertQueryBuilder } = require("../mysql-query-builder");
const { logger } = require("../logger");

module.exports = async (alarmList) => {
    if(alarmList.length < 1)
        return;
    
    const db = new Database();
    const queryDbPort = new InsertQueryBuilder('rtu_port_status');
    try {

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
            openedAlarm++;
            queryDbPort.appendRow([item.rtu_sname, item.no_port, item.port_name, (item.value || 0), item.units, item.rtu_status,
                item.severity.name, currDateTime, 1, item.location]);
        });
    
        const resultDbPort = await db.runQuery({
            query: queryDbPort.getQuery(),
            bind: queryDbPort.getBuiltBindData(),
            autoClose: false
        });

        return queryDbPort.buildInsertedId(resultDbPort.results.insertId, resultDbPort.results.affectedRows);

    } catch(err) {
        logger.error(err);
        return [];
    }

};