const Database = require("../newosase/database");
const { logger } = require("../logger");

module.exports = async (id) => {
    const db = new Database();
    let query = "SELECT port.*, rtu.location_id, rtu.datel_id, rtu.witel_id, rtu.regional_id FROM rtu_port_status AS port JOIN rtu_list AS rtu ON rtu.sname=port.rtu_code";
    
    if(Array.isArray(id))
        query += " WHERE id IN (?)";
    else
        query += " WHERE id=?";
    try {
        
        const { results } = await db.runQuery({ query, bind: [id] });
        return results;
        
    } catch(err) {
        logger.error(err);
        return [];
    }
};