const Database = require("../newosase/database");
const { InsertQueryBuilder } = require("../mysql-query-builder");
const { toDatetimeString } = require("../date");
const { logger } = require("../logger");

module.exports = async (errCode, errDesc, msgId, chatId) => {
    const currDateTime = toDatetimeString(new Date());
    const db = new Database();
    const queryDbError = new InsertQueryBuilder("telegram_alarm_error");

    queryDbError.addFields("error_code");
    queryDbError.addFields("description");
    queryDbError.addFields("message_id");
    queryDbError.addFields("chat_id");
    queryDbError.addFields("created_at");
    queryDbError.appendRow([errCode, errDesc, msgId, chatId, currDateTime]);

    try {
        await db.runQuery({
            query: queryDbError.getQuery(),
            bind: queryDbError.getBuiltBindData()
        });
    } catch(err) {
        logger.error(err);
    }
};