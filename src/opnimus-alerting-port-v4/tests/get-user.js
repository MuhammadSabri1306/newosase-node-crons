const { createDbPool, closePool, createQuery, executeQuery } = require("../../core/mysql");
const dbConfig = require("../../env/database");

const getUsers = async (pool) => {
    try {

        const groupQuery = "SELECT user.*, mode.id AS mode_id, mode.rules"+
            " FROM alert_users as alert JOIN telegram_user as user ON user.id=alert.telegram_user_id"+
            " JOIN alert_modes AS mode ON mode.id=alert.mode_id WHERE user.is_pic=0 AND alert.cron_alert_status=1"+
            " AND alert.user_alert_status=1 ORDER BY user.regist_id";
        // console.log(groupQuery);
        const { results: groupUsers } = await executeQuery(pool, groupQuery);

        const picQuery = "SELECT user.id, user.user_id, user.type, user.username, user.first_name, user.last_name,"+
            " pers.nama AS full_name, pic.location_id, mode.id AS mode_id, mode.rules, witel.id AS witel_id,"+
            " witel.regional_id FROM pic_location AS pic"+
            " JOIN telegram_user AS user ON user.id=pic.user_id"+
            " JOIN telegram_personal_user AS pers ON pers.user_id=pic.user_id"+
            " JOIN alert_users as alert ON alert.telegram_user_id=user.id"+
            " JOIN alert_modes AS mode ON mode.id=alert.mode_id"+
            " JOIN rtu_location AS loc ON loc.id=pic.location_id"+
            " JOIN datel ON datel.id=loc.datel_id"+
            " JOIN witel ON witel.id=datel.witel_id"+
            " WHERE user.is_pic=1 AND alert.cron_alert_status=1 AND alert.user_alert_status=1"+
            " ORDER BY user.pic_regist_id";
        const { results: picUsers } = await executeQuery(pool, picQuery);

        return { groupUsers, picUsers };

    } catch(err) {
        console.error(err);
        return { groupUsers: [], picUsers: [] };
    }
};

(async () => {

    const pool = createDbPool(dbConfig.opnimusNewMigrated2);
    const [{ groupUsers, picUsers } ] = await Promise.all([ getUsers(pool) ]);
    groupUsers.forEach(groupUser => {
        if(groupUser.chat_id == "-1001778632305")
            console.log(groupUser);
    });
    await closePool(pool);

})();