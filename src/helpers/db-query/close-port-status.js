const Database = require("../newosase/database");
const { toDatetimeString } = require("../date");
const { logger } = require("../logger");

module.exports = async (portData) => {
    const currDateTime = toDatetimeString(new Date());
    const portIds = portData.map(item => item.id);

    const db = new Database();
    try {
        await db.runQuery({
            query: "UPDATE rtu_port_status SET rtu_status=?, port_status=?, state=0, end_at=? WHERE id IN (?)",
            bind: ["normal", "normal", currDateTime, portIds]
        });
    } catch(err) {
        logger.error(err);
    }
};