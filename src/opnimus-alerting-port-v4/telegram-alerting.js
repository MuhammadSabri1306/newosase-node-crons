const { executeQuery, createQuery } = require("../core/mysql");
const { toDatetimeString } = require("../helpers/date");
const dbConfig = require("../env/database");
const { usePicUserModel, PicUserModel } = require("./model");
const App = require("./App");
const JobQueue = require("./JobQueue");

const getAlertStacks = async (app) => {
    try {

        const date = new Date();
        date.setHours(date.getHours() - 6);

        let queryStr = "SELECT alert.id AS alert_id, alert.chat_id AS alert_chat_id, alert.created_at AS alert_timestamp,"+
            " alarm.*, rtu.name AS rtu_name, rtu.location_id, rtu.datel_id, rtu.witel_id, rtu.regional_id,"+
            " loc.location_name, witel.witel_name, treg.name AS regional_name"+
            " FROM alert_message AS alert"+
            " JOIN alarm_port_status AS alarm ON alarm.id=alert.port_id"+
            " JOIN rtu_list AS rtu ON rtu.sname=alarm.rtu_sname"+
            " LEFT JOIN regional AS treg ON treg.id=rtu.regional_id"+
            " LEFT JOIN witel ON witel.id=rtu.witel_id"+
            " LEFT JOIN rtu_location AS loc ON loc.id=rtu.location_id"+
            " WHERE alert.status='unsended' AND alert.created_at>=?";
        queryStr = createQuery(queryStr, [ toDatetimeString(date) ]);

        app.logDatabaseQuery(queryStr, "Get unsended alarm stacks from last 6 hours");
        const { results } = await executeQuery(app.pool, queryStr);

        if(results.length < 1)
            return results;

        const alertIds = results.map(item => item.alert_id);
        const queryUpdate = createQuery("UPDATE alert_message SET status='sending' WHERE id IN (?)", [ alertIds ]);
        app.logDatabaseQuery(queryUpdate, "Update alarm stacks status to be 'sending'", { alertIds });
        await executeQuery(app.pool, queryUpdate);

        return results;

    } catch(err) {
        app.logError(err);
        return [];
    }
};

const groupAlerts = (app, alertStacks, maxGroupItems) => {
    if(alertStacks.length < 1)
        return [];
    try {

        const chatIdGroups = [];
        let index;
        for(let i=0; i<alertStacks.length; i++) {
            index = chatIdGroups.findIndex(group => group.chatId == alertStacks[i].alert_chat_id);
            if(index < 0)
                chatIdGroups.push({ chatId: alertStacks[i].alert_chat_id, alerts: [ alertStacks[i] ] });
            else
                chatIdGroups[index].alerts.push(alertStacks[i]);
        }

        const groups = [];
        index = 0;
        for(let j=0; j<chatIdGroups.length; j++) {
            if(groups.length === index) {
                groups.push([]);
            }
            groups[index].push(chatIdGroups[j]);
            index++;
            if(index === maxGroupItems)
                index = 0;
        }

        return groups;

    } catch(err) {
        app.logError(err);
        return [];
    }
};

const getPicUsers = async (app) => {
    try {

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
        app.logDatabaseQuery(picQuery, "Get pic list from database");
        const { results: picUsers } = await executeQuery(app.pool, picQuery);

        return picUsers;

    } catch(err) {
        app.logError(err);
        return [];
    }
};

const onAlertSuccess = async (app, alertId) => {
    try {
        let queryStr = "UPDATE alert_message SET status=? WHERE id=?";
        queryStr = createQuery(queryStr, ["success", alertId]);
        app.logDatabaseQuery(queryStr, `Update alert success status, alertId:${ alertId }`);
        await executeQuery(app.pool, queryStr);
    } catch(err) {
        app.logError(err);
    }
};

const onAlertUnsended = async (app, alertId, alertErr = null) => {
    const processDateStr = toDatetimeString(new Date());
    try {
    
        let updateQueryStr = "UPDATE alert_message SET status=? WHERE id=?";
        updateQueryStr = createQuery(updateQueryStr, ["unsended", alertId]);

        app.logDatabaseQuery(updateQueryStr, `Update alert unsended status, alertId:${ alertId }`);
        await executeQuery(app.pool, updateQueryStr);

        if(alertErr && alertErr.isTelegramError) {

            let insertQueryStr = "INSERT INTO alert_message_error (alert_id, error_code, description, response, created_at)"+
                " VALUES (?, ?, ?, ?, ?)";
            insertQueryStr = createQuery(insertQueryStr, [
                alertId, alertErr.code, alertErr.description, alertErr.response, processDateStr
            ]);

            app.logDatabaseQuery(insertQueryStr, "Alert error has description, push alert error to database");
            await executeQuery(app.pool, insertQueryStr);

        }

    } catch(err) {
        app.logError(err);
    }
};

const runApp = async (app) => {
    return new Promise(async (resolve) => {
        try {

            const alertStacks = await getAlertStacks(app);

            const groupCount = Math.min(10, alertStacks.length);
            const alertGroups = groupAlerts(app, alertStacks, groupCount);
            const alertGroupsCount = alertGroups.length;
            app.logProcess("grouping alert stacks", {
                alertStacksCount: alertStacks.length,
                maxGroupItems: groupCount,
                alertGroupsCount
            });

            if(alertGroups.length < 1) {
                resolve();
                return;
            }

            const picUsers = await getPicUsers(app);

            const worker = new JobQueue(alertGroupsCount);
            const workerPath = "worker-send-alert";
            const alertJobs = alertStacks.map(alert => ({ id: alert.alert_id, success: false }));

            alertGroups.forEach(group => {
                app.logProcess("TEST", { group });
                const chatIds = group.map(item => item.chatId);
                app.logProcess("Registering alerts thread", { chatIds });
                worker.registerWorker(workerPath, {
                    appId: app.appId,
                    appName: app.appName,
                    alertGroups: group,
                    picUsers
                });
            });

            worker.onData(async (workerResult) => {
                const { alertId, success, error, retryTime } = workerResult;
                app.logProcess("TEST onData commit", { alertId, success })
                if(success)
                    await onAlertSuccess(app, alertId);
                else
                    await onAlertUnsended(app, alertId, error);
                if(retryTime)
                    app.registerDelayTimes(retryTime);
                    
                const job = alertJobs.find(item => item.id == alertId);
                if(job) job.success = true;

                if(!alertJobs.find(item => !item.success)) {
                    app.logProcess("TEST alert worker commit");
                    resolve();
                }
            });

            worker.onEachError(err => {
                app.logError(err);
                throw err;
            });
    
            worker.run();

        } catch(err) {
            app.logError(err);
            resolve();
        }
    });
};

module.exports.main = async (app) => {

    app.logProcess(`App ${ app.appName } is starting`);
    app.useDbPool({
        ...dbConfig.opnimusNewMigrated2,
        connectionLimit: 20
    });

    await runApp(app);

    await app.closeDbPool();
    app.logProcess(`App ${ app.appName } is closed`);

};