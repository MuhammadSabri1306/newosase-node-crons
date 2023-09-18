const Database = require("../newosase/database");
const { logger } = require("../logger");

module.exports = async (locationId) => {
    const db = new Database();
    let query = "SELECT user.*, loc.location_id FROM telegram_user AS user"
        +" RIGHT JOIN pic_location AS loc ON loc.user_id=user.id"
        +" JOIN rtu_list AS rtu ON rtu.location_id=loc.location_id"
        +" WHERE user.alert_status=? AND user.is_pic=?";
    
    if(Array.isArray(locationId))
        query += " AND loc.location_id IN (?)";
    else
        query += " AND loc.location_id=?";
    try {
        
        const { results } = await db.runQuery({ query, bind: [1, 1, locationId] });
        return results;
        
    } catch(err) {
        logger.error(err);
        return [];
    }
};