const Database = require("../newosase/database");
const { toDatetimeString } = require("../date");
const { logger } = require("../logger");

module.exports = async (alarmList) => {
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
        logger.error(err);
    }
};