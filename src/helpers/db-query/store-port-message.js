const Database = require("../newosase/database");
const { toDatetimeString } = require("../date");
const { logger } = require("../logger");

module.exports = async (portId, chatId) => {
    const currDateTime = toDatetimeString(new Date());
    const db = new Database();

    try {
        await db.runQuery({
            query: "INSERT INTO rtu_port_message (port_id, chat_id, created_at) VALUES (?, ?, ?)",
            bind: [portId, chatId, currDateTime],
            autoClose: false
        });
    } catch(err) {
        logger.error(err);
    }
};