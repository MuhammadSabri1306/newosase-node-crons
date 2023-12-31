const Database = require("../newosase/database");
const { logger } = require("../logger");

module.exports = async (params) => {
    const db = new Database();
    let query = "SELECT port.*, rtu.location_id, rtu.datel_id, rtu.witel_id, rtu.regional_id FROM rtu_port_status AS port JOIN rtu_list AS rtu ON rtu.sname=port.rtu_code";
    const whereStm = [];
    const bind = [];

    const paramsKeys = Object.keys(params);
    if(paramsKeys.length > 0) {
        for(let key of paramsKeys) {
            whereStm.push(`rtu.${ key }=?`);
            bind.push(params[key]);
        }
        query += " WHERE " + whereStm.join(" AND ");
    }
    
    try {
        let stm;
        if(bind.length < 1)
            stm = await db.runQuery(query);
        else
            stm = await db.runQuery({ query, bind });
        return stm.results;
    } catch(err) {
        logger.error(err);
        return null;
    }
};