const Database = require("../newosase/database");
const { InsertQueryBuilder } = require("../mysql-query-builder");
const { toDatetimeString } = require("../date");

module.exports = async (errCode, errDesc, msgId, userId) => {
    const currDateTime = toDatetimeString(new Date());
    const db = new Database();
    const queryDbError = new InsertQueryBuilder("telegram_alarm_error");

    queryDbError.addFields("error_code");
    queryDbError.addFields("description");
    queryDbError.addFields("message_id");
    queryDbError.addFields("alarm_user_id");
    queryDbError.addFields("created_at");
    queryDbError.appendRow([errCode, errDesc, msgId, userId, currDateTime]);

    try {
        db.runQuery({
            query: queryDbError.getQuery(),
            bind: queryDbError.getBuiltBindData()
        });
    } catch(err) {
        console.error(err);
    }
};