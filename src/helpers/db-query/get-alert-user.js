const Database = require("../newosase/database");

module.exports = async () => {
    const db = new Database();
    try {
        const stm = await db.runQuery("SELECT * FROM telegram_alarm_user WHERE alert=1");
        return stm.results;
    } catch(err) {
        console.error(err);
        return [];
    }
};