const Database = require("../newosase/database");
const { logger } = require("../logger");

module.exports = async (regionalId, witelId) => {
    const db = new Database();
    const queryCheckerNas = "regional_id IS NULL";
    const queryCheckerReg = "(regional_id=? AND witel_id IS NULL)";
    const queryCheckerWit = "(regional_id=? AND witel_id=?)";
    const query = `SELECT * FROM telegram_user WHERE alert_status=1 AND is_pic=0 AND ${ queryCheckerNas } OR ${ queryCheckerReg } OR ${ queryCheckerWit }`;
    
    try {
        const { results } = await db.runQuery({
            query,
            bind: [regionalId, regionalId, witelId]
        });
        return results;
    } catch(err) {
        logger.error(err);
        return [];
    }
};