const Database = require("../newosase/database");
const { logger } = require("../logger");

module.exports = async () => {
    const db = new Database();
    try {
        const stm = await db.runQuery("SELECT * FROM telegram_user WHERE alert_on=1");
        return stm.results;
    } catch(err) {
        logger.error(err);
        return [];
    }
};