const config = require("../../config");
const Database = require("../newosase/database");
const { SelectQueryBuilder } = require("../mysql-query-builder");

module.exports = async (params) => {
    const db = new Database();
    const query = new SelectQueryBuilder("rtu_list");

    if(config.alert.workerLevel == "rtu") {
        query.addFields("name AS rtu_name");
        query.addFields("sname AS rtu_sname");
        query.addFields("witel_id");
        query.addFields("regional_id");
    } else if(config.alert.workerLevel == "witel") {
        query.addFields("witel_id");
        query.groupBy("witel_id");
    } else if(config.alert.workerLevel == "regional") {
        query.addFields("regional_id");
        query.groupBy("regional_id");
    }

    if(params.level == "witel")
        query.where("witel_id=?", params.witelId);
    if(params.level == "regional")
        query.where("regional_id=?", params.regionalId);
    
    try {
        const { results } = await db.runQuery({
            query: query.getQuery(),
            bind: query.getBuiltBindData()
        });
        return results;
    } catch(err) {
        return [];
    }
};