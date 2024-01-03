const logger = require("./logger");
const dbConfig = require("../env/database");
const { toDatetimeString } = require("../helpers/date");
const { createDbPool, closePool, executeQuery } = require("../core/mysql");
const { createAlarmPortUserQuery, createPortAlarmQuery } = require("./alerting");

const extractAlarmPortAreaIds = (alarmPorts) => {
    const regionalIds = [];
    const witelIds = [];
    const locIds = [];
    for(let i=0; i<alarmPorts.length; i++) {


        if(regionalIds.indexOf(alarmPorts[i].regional_id) < 0)
            regionalIds.push(alarmPorts[i].regional_id);

        if(witelIds.indexOf(alarmPorts[i].witel_id) < 0)
            witelIds.push(alarmPorts[i].witel_id);

        if(locIds.indexOf(alarmPorts[i].location_id) < 0)
            locIds.push(alarmPorts[i].location_id);

    }
    return { regionalIds, witelIds, locationIds: locIds };
};

const main = async (applyAlertingMessage = false) => {
    logger.info("App is starting");
    const processDateStr = toDatetimeString(new Date());

    logger.info("Creating a database connection");
    const pool = createDbPool({
        ...dbConfig.opnimusNewMigrated2,
        multipleStatements: true
    });

    try {

        
        const lastPortId = '36179';
        const alarmPortQueryStr = createPortAlarmQuery(lastPortId);
        logger.info("Get inserted alarm_port_status id from database", {
            database: dbConfig.opnimusNewMigrated2.database,
            query: alarmPortQueryStr
        });

        const alarmPortQuery = await executeQuery(pool, alarmPortQueryStr);
        if(alarmPortQuery.results)
            alarmPorts = alarmPortQuery.results;
        
        
        const { regionalIds, witelIds, locationIds } = extractAlarmPortAreaIds(alarmPorts);
        const { user: alarmPortUserQuery, pic: alarmPortPicQuery } = createAlarmPortUserQuery({ regionalIds, witelIds, locationIds });

        logger.info("Get user of port alarm from database", {
            database: dbConfig.opnimusNewMigrated2.database,
            query: alarmPortUserQuery
        });
        const { results: alarmPortUsers } = await executeQuery(pool, alarmPortUserQuery);

        logger.info("Get user of port alarm from database", {
            database: dbConfig.opnimusNewMigrated2.database,
            query: alarmPortPicQuery
        });
        const { results: alarmPortPics } = await executeQuery(pool, alarmPortPicQuery);

        console.log(alarmPortUsers, alarmPortPics);

    } catch(err) {
        logger.error(err);
    } finally {
        await closePool(pool);
        logger.info("App has closed");
    }
};

main();

/*
====================================================================================
===========> alarmPortUserQuery

SELECT * FROM telegram_user
WHERE
	(is_pic=0 AND alert_status=1 AND level='nasional')
	OR (is_pic=0 AND alert_status=1 AND level='regional' AND regional_id IN (4))
	OR (is_pic=0 AND alert_status=1 AND level='witel' AND witel_id IN (106))
ORDER BY regional_id, witel_id


SELECT
	user.*, mode.id AS mode_id, mode.rules,
	mode.apply_rules_file, mode.rules_file
FROM alert_users as alert
JOIN telegram_user as user ON user.id=alert.telegram_user_id
JOIN alert_modes AS mode ON mode.id=alert.mode_id
WHERE
	(alert.cron_alert_status=1 AND alert.user_alert_status=1)
    AND (
        (user.is_pic=0 AND level='nasional')
        OR (user.is_pic=0 AND level='regional' AND user.regional_id IN (2))
        OR (user.is_pic=0 AND level='witel' AND user.witel_id IN (43))
    )
ORDER BY user.regist_id;


====================================================================================
===========> alarmPortPicQuery

SELECT
	user.id, user.user_id, user.type, user.username, user.first_name, user.last_name,
	pers.nama AS full_name,
	pic.location_id
FROM pic_location AS pic
JOIN telegram_user AS user ON user.id=pic.user_id
JOIN telegram_personal_user AS pers ON pers.user_id=pic.user_id
WHERE user.is_pic=1 AND alert_status=1 AND pic.location_id IN (890)


SELECT
	user.id, user.user_id, user.type, user.username, user.first_name, user.last_name,
	pers.nama AS full_name,
	pic.location_id,
    mode.id AS mode_id, mode.rules, mode.apply_rules_file, mode.rules_file
FROM pic_location AS pic
JOIN telegram_user AS user ON user.id=pic.user_id
JOIN telegram_personal_user AS pers ON pers.user_id=pic.user_id
JOIN alert_users as alert ON alert.telegram_user_id=user.id
JOIN alert_modes AS mode ON mode.id=alert.mode_id
WHERE
	user.is_pic=1 AND alert.cron_alert_status=1 AND alert.user_alert_status=1 AND pic.location_id IN (890)
ORDER BY user.pic_regist_id



*/