const Database = require("../newosase/database");
const { logger } = require("../logger");
const { SelectQueryBuilder } = require("../mysql-query-builder");

module.exports = async (params) => {
    const db = new Database();
    const queryDbUser = new SelectQueryBuilder("telegram_user");
    
    queryDbUser.where("alert_status=?", 1);
    Object.entries(params).forEach(([key, val]) => {
        queryDbUser.where(key+"=?", val);
    });
    
    try {
        const stm = await db.runQuery({
            query: queryDbUser.getQuery(),
            bind: queryDbUser.getBuiltBindData()
        });
        return stm.results;
    } catch(err) {
        logger.error(err);
        return [];
    }
};