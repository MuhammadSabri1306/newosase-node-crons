const Database = require("../newosase/database");
const { logger } = require("../logger");
const { UpdateQueryBuilder } = require("../mysql-query-builder");
const { isDateObject, toDatetimeString } = require("../date");

// query: "UPDATE rtu_port_status SET value=?, rtu_status=?, port_status=?, state=?, start_at=? WHERE id=?",
// bind: [item.newRow.value, item.newRow.rtu_status, item.newRow.severity.name, true, currDateTime, item.oldRow.id]

module.exports = async (id, data) => {
    const db = new Database();
    const queryDbPort = new UpdateQueryBuilder("rtu_port_status");

    Object.entries(data).forEach(([key, val]) => {
        if(isDateObject(val))
            val = toDatetimeString(val);
        queryDbPort.setValue(key, val);
    });

    if(Array.isArray(id))
        queryDbPort.where("id IN (?)", id);
    else
        queryDbPort.where("id=?", id);
    try {

        await db.runQuery({
            query: queryDbPort.getQuery(),
            bind: queryDbPort.getBuiltBindData()
        });
        return true;

    } catch(err) {
        logger.error(err);
        return false;
    }
};