const Database = require("./newosase/database");
const { InsertQueryBuilder } = require("./mysql-query-builder");

module.exports = async (errCode, errDesc, msgId, userId) => {
    const db = new Database();
    const queryDbError = new InsertQueryBuilder("telegram_alarm_error");
    queryDbError.addFields("error_code");
    queryDbError.addFields("description");
    queryDbError.addFields("message_id");
    queryDbError.addFields("alarm_user_id");
    queryDbError.appendRow([errCode, errDesc, msgId, userId]);

    try {
        db.runQuery({
            query: queryDbError.getQuery(),
            bind: queryDbError.getBuiltBindData()
        });
    } catch(err) {
        console.error(err);
    }
};