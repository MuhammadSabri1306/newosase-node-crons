const Database = require("../newosase/database");
const { logger } = require("../logger");

module.exports = async (id, status) => {
    const db = new Database();
    try {
        if(Array.isArray(id)) {

            await db.runQuery({
                query: "UPDATE rtu_port_message SET status=? WHERE id IN (?)",
                bind: [status, id]
            });

        } else {

            await db.runQuery({
                query: "UPDATE rtu_port_message SET status=? WHERE id=?",
                bind: [status, id]
            });

        }
    } catch(err) {
        logger.error(err);
    }
};