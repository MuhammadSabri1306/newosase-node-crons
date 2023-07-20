const Database = require("../newosase/database");
const { SelectQueryBuilder } = require("../mysql-query-builder");
const { logger } = require("../logger");

module.exports = async (rtuParams) => {
    const db = new Database();
    const queryDbMsg = new SelectQueryBuilder("rtu_port_message AS msg");
    
    queryDbMsg.join("rtu_port_status AS port", "port.id=msg.status_id");
    queryDbMsg.join("rtu_list AS rtu", "rtu.sname=port.rtu_code");
    queryDbMsg.join("rtu_location AS loc", "loc.id=rtu.location_id");
    queryDbMsg.join("datel", "datel.id=rtu.datel_id");
    queryDbMsg.join("witel", "witel.id=rtu.witel_id");
    queryDbMsg.join("regional AS reg", "reg.id=rtu.regional_id");

    queryDbMsg.addFields("msg.id");
    queryDbMsg.addFields("msg.created_at");
    queryDbMsg.addFields("port.port");
    queryDbMsg.addFields("port.port_name");
    queryDbMsg.addFields("port.value AS port_value");
    queryDbMsg.addFields("port.unit AS port_unit");
    queryDbMsg.addFields("port.rtu_status");
    queryDbMsg.addFields("port.port_status");
    queryDbMsg.addFields("rtu.name AS rtu_name");
    queryDbMsg.addFields("rtu.sname AS rtu_code");
    queryDbMsg.addFields("loc.location_name");
    queryDbMsg.addFields("loc.location_sname");
    queryDbMsg.addFields("datel.datel_name");
    queryDbMsg.addFields("witel.witel_name");
    queryDbMsg.addFields("reg.divre_code");
    queryDbMsg.addFields("reg.name AS divre_name");

    queryDbMsg.where("msg.status=?", "unsended");
    for(let key in rtuParams) {
        queryDbMsg.where(`rtu.${ key }=?`, rtuParams[key]);
    }

    try {
        const { results } = await db.runQuery({
            query: queryDbMsg.getQuery(),
            bind: queryDbMsg.getBuiltBindData()
        });

        return results;
    } catch(err) {
        logger.error(err);
        return [];
    }
};