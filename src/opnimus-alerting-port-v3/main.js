const { executeQuery, selectRowQuery, selectRowCollumnQuery, createQuery } = require("../core/mysql");
const { toDatetimeString } = require("../helpers/date");
const dbConfig = require("../env/database");
const JobQueue = require("./jobs/JobQueue");
const App = require("./App");
const { InsertQueryBuilder } = require("../helpers/mysql-query-builder");

const getRegionalList = async (app) => {
    try {
        // const queryStr = "SELECT * FROM regional";
        const queryStr = "SELECT * FROM regional WHERE id=2";
        app.logDatabaseQuery(queryStr, "Get regional list from database");
        const { results } = await executeQuery(app.pool, queryStr);
        return results;
    } catch(err) {
        app.logError(err);
        return [];
    }
};

const getWitelList = async (app, regionalId) => {
    try {
        // const queryStr = createQuery("SELECT * FROM witel WHERE regional_id=?", [ regionalId ]);
        const queryStr = "SELECT * FROM witel WHERE id=43";
        app.logDatabaseQuery(queryStr, "Get witel list from database");
        const { results } = await executeQuery(app.pool, queryStr);
        return results;
    } catch(err) {
        app.logError(err);
        return [];
    }
};

const getAlarmsList = async (app, regionalId) => {
    try {
        let queryStr = "SELECT alarm.*, rtu.location_id, rtu.datel_id, rtu.witel_id, rtu.regional_id"+
            " FROM alarm_port_status AS alarm JOIN rtu_list AS rtu ON rtu.sname=alarm.rtu_sname"+
            " WHERE alarm.is_closed=0 AND rtu.regional_id=?";
        queryStr = createQuery(queryStr, [ regionalId ]);
        app.logDatabaseQuery(queryStr, "Get opened alarm port list from database");
        const { results } = await executeQuery(app.pool, queryStr);
        return results;
    } catch(err) {
        app.logError(err);
        return [];
    }
};

const getUsersInRegional = async (app, regionalId) => {
    try {

        const locQuery = createQuery(
            "SELECT location_id, witel_id FROM rtu_list WHERE regional_id=? GROUP BY regional_id, witel_id, location_id",
            [ regionalId ]
        );
        app.logDatabaseQuery(locQuery, "Get witel and location list from database");
        const { results: locs } = await executeQuery(app.pool, locQuery);
        const { locIds, witelIds } = locs.reduce((result, loc) => {
            result.locIds.push(loc.location_id);
            if(result.witelIds.indexOf(loc.witel_id) < 0)
                result.witelIds.push(loc.witel_id);
            return result;
        }, { locIds: [], witelIds: [] });

        let groupQuery = "SELECT user.*, mode.id AS mode_id, mode.rules"+
            " FROM alert_users as alert JOIN telegram_user as user ON user.id=alert.telegram_user_id"+
            " JOIN alert_modes AS mode ON mode.id=alert.mode_id WHERE (alert.cron_alert_status=1 AND alert.user_alert_status=1)"+
            " AND ("+
            " (user.is_pic=0 AND level='nasional') OR (user.is_pic=0 AND level='regional' AND user.regional_id=?) OR"+
            " (user.is_pic=0 AND level='witel' AND user.witel_id IN (?))"+
            " ) ORDER BY user.regist_id";
        groupQuery = createQuery(groupQuery, [ regionalId, witelIds ]);
        app.logDatabaseQuery(groupQuery, "Get group list from database");
        const { results: groupUsers } = await executeQuery(app.pool, groupQuery);

        let picQuery = "SELECT user.id, user.user_id, user.type, user.username, user.first_name, user.last_name,"+
            " pers.nama AS full_name, pic.location_id, mode.id AS mode_id, mode.rules FROM pic_location AS pic"+
            " JOIN telegram_user AS user ON user.id=pic.user_id"+
            " JOIN telegram_personal_user AS pers ON pers.user_id=pic.user_id"+
            " JOIN alert_users as alert ON alert.telegram_user_id=user.id"+
            " JOIN alert_modes AS mode ON mode.id=alert.mode_id"+
            " WHERE user.is_pic=1 AND alert.cron_alert_status=1 AND alert.user_alert_status=1"+
            " AND pic.location_id IN (?) ORDER BY user.pic_regist_id";
        picQuery = createQuery(picQuery, [ locIds ]);
        app.logDatabaseQuery(picQuery, "Get pic list from database");
        const { results: pics } = await executeQuery(app.pool, picQuery);
        const picUsers = pics.map(pic => {
            const loc = locs.find(item => item.location_id == pic.location_id);
            pic.location_witel_id = loc ? loc.witel_id : null;
            return pic;
        });

        return { groupUsers, picUsers };

    } catch(err) {
        app.logError(err);
        return [];
    }
};

const groupingWitel = (app, maxGroupItems, witelList) => {
    let witel;
    try {

        const witelsGroup = [];
        for(let i=0; i<witelList.length; i++) {

            const index = i % maxGroupItems;
            if(witelsGroup.length <= index)
                witelsGroup.push({});
    
            witel = witelList[i];
            const key = witel.id;
            witelsGroup[index][key] = witel;

        }
        return witelsGroup;

    } catch(err) {
        app.logError(err);
        return [];
    }
};

const updateClosedPorts = async (app, closePorts, processDateStr) => {
    try {
        if(closePorts.length > 0) {

            const { closePortIds, closePortQueries } = closePorts.reduce(
                (result, item, index) => {
                    result.closePortIds.push(item.id);
                    const queryStr = "UPDATE alarm_port_status SET is_closed=?, closed_at=? WHERE id=?;";
                    result.closePortQueries.push( createQuery(queryStr, [1, processDateStr, item.id]) );
                    return result;
                },
                { closePortIds: [], closePortQueries: [] }
            );

            const closePortIdsStr = closePortIds.join(",");
            const closePortQueryStr = closePortQueries.join(" ");

            app.logDatabaseQuery(closePortQueries, "Closing (update) opened alarm ports", closePortIds.map(id => ({ id })));
            await executeQuery(app.pool, closePortQueryStr);

        }
    } catch(err) {
        app.logError(err);
    }
}

const insertOpenPorts = async (app, openPorts, processDateStr) => {
    let alarms = [];
    try {
        if(openPorts.length > 0){

            const queryInsert = new InsertQueryBuilder("alarm_port_status");
            queryInsert.addFields("port_no");
            queryInsert.addFields("port_name");
            queryInsert.addFields("port_value");
            queryInsert.addFields("port_unit");
            queryInsert.addFields("port_severity");
            queryInsert.addFields("type");
            queryInsert.addFields("location");            
            queryInsert.addFields("rtu_sname");
            queryInsert.addFields("rtu_status");
            queryInsert.addFields("opened_at");

            openPorts.forEach(item => {
                queryInsert.appendRow([
                    item.no_port,
                    item.port_name,
                    item.value,
                    item.units,
                    item.severity.name.toString().toLowerCase(),
                    item.result_type,
                    item.location,
                    item.rtu_sname,
                    item.rtu_status.toString().toLowerCase(),
                    processDateStr
                ]);
            });

            const queryInsertStr = createQuery(queryInsert.getQuery(), queryInsert.getBuiltBindData());
            app.logDatabaseQuery(queryInsertStr, "Open (insert) new alarm ports");
            const { results } = await executeQuery(app.pool, queryInsertStr);

            const alarmIds = queryInsert.buildInsertedId(results.insertId, results.affectedRows);
            if(!Array.isArray(alarmIds) || alarmIds.length < 1) {
                throw Error(
                    "The 'alarmIds' in insertOpenPorts(...args) should be ids<Array> of inserted data,"+
                    ` openPorts count:${ openPorts.length }, insertId:${ results.insertId }, affectedRows:${ results.affectedRows }`
                );
            }

            let queryGetStr = "SELECT port.*, rtu.name AS rtu_name, rtu.location_id,"+
                " loc.location_name, rtu.datel_id, rtu.witel_id, wit.witel_name,"+
                " rtu.regional_id, reg.name AS regional_name, reg.divre_code AS regional_code"+
                " FROM alarm_port_status AS port"+
                " JOIN rtu_list AS rtu ON rtu.sname=port.rtu_sname"+
                " JOIN rtu_location AS loc ON loc.id=rtu.location_id"+
                " JOIN witel AS wit ON wit.id=rtu.witel_id"+
                " JOIN regional AS reg ON reg.id=rtu.regional_id"+
                " WHERE port.id IN (?)";
            queryGetStr = createQuery(queryGetStr, [ alarmIds ]);

            let alarmIdStr = `${ alarmIds[0] }, ..., ${ alarmIds[alarmIds.length - 1] }`;
            if(alarmIds.length < 3)
                alarmIdStr = alarmIds.join(", ");
            app.logDatabaseQuery(queryGetStr, `Get inserted alarm ports, ids:[ ${ alarmIdStr } ]`);

            const { results: insertedAlarms } = await executeQuery(app.pool, queryGetStr);
            alarms = insertedAlarms || [];

        }
    } catch(err) {
        app.logError(err);
    } finally {
        return alarms;
    }
};

const extractRulesKey = rules => {
	const regex = /{{\s*([^\s{}]+)\s*}}/g;
	const matches = [];
	let match;
  
	while((match = regex.exec(rules)) !== null) {
		matches.push({ key: match[1], mark: match[0] });
	}

	return matches;
};

const isRuleMatch = (port, rules) => {
	const portKeys = extractRulesKey(rules);
	portKeys.forEach(({ key, mark }) => {
		let portKey = "null";
		if(port && key in port)
			portKey = `port.${ key }`;
		rules = rules.replaceAll(mark, portKey);
	});

	return eval(rules);
};

const getAlarmAlerts = (app, alarm, groupUsers, picUsers) => {
    try {
        const alerts = [];
        let i = 0;

        while(i < groupUsers.length) {
            if(
                (groupUsers[i].level == "nasional") ||
                (groupUsers[i].level == "regional" && groupUsers[i].regional_id == alarm.regional_id) ||
                (groupUsers[i].level == "witel" && groupUsers[i].witel_id == alarm.witel_id)
            ) {
                if(isRuleMatch(alarm, groupUsers[i].rules)) {
                    alerts.push({ alarm, isPic: false, groupUser: groupUsers[i] });
                }
            }
            i++;
        }

        i = 0;
        while(i < picUsers.length) {
            if(picUsers[i].location_id == alarm.location_id) {
                if(isRuleMatch(alarm, picUsers[i].rules)) {
                    alerts.push({ alarm, isPic: true, picUser: picUsers[i] });
                }
            }
            i++;
        }

        return alerts;
        
    } catch(err) {
        app.logError(err);
        return [];
    }
};

const writeAlertStack = async (app, alarms, groupUsers, picUsers) => {
    try {

        let alertStacks = [];
        for(let i=0; i<alarms.length; i++) {
            alertStacks = [ ...alertStacks, ...getAlarmAlerts(app, alarms[i], groupUsers, picUsers) ];
        }

        app.logProcess(
            `Build alert stack alarmsCount:${ alarms.length }, groupUsersCount:${ groupUsers.length },`+
            ` picUsersCount:${ picUsers.length }, alertStacksCount:${ alertStacks.length }`
        );

        if(alertStacks.length > 0) {
            const queryInsert = new InsertQueryBuilder("alert_message");
            queryInsert.addFields("port_id");
            queryInsert.addFields("chat_id");
            queryInsert.addFields("status");
            queryInsert.addFields("created_at");

            const currDate = toDatetimeString(new Date())
            alertStacks.forEach(stack => {
                console.log(stack.picUser)
                queryInsert.appendRow([
                    stack.alarm.id,
                    stack.isPic ? stack.picUser.user_id : stack.groupUser.chat_id,
                    "unsended",
                    currDate
                ]);
            });

            const queryStr = createQuery(queryInsert.getQuery(), queryInsert.getBuiltBindData());
            app.logDatabaseQuery(queryStr, "Write (insert) new alerts stack");
            const { results } = await executeQuery(app.pool, queryStr);

            const alertIds = queryInsert.buildInsertedId(results.insertId, results.affectedRows);
            if(Array.isArray(alertIds) && alertIds.length > 0) {
                let alertIdStr = `${ alertIds[0] }, ..., ${ alertIds[alertIds.length - 1] }`;
                if(alertIds.length < 3)
                    alertIdStr = alertIds.join(", ");
                app.logProcess(`New alerts stack has been written, ids:[ ${ alertIdStr } ]`);
            }

        }

    } catch(err) {
        app.logError(err);
    }
};

const getAlertStacks = async (app, witel) => {
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
            " WHERE alert.status='unsended' AND rtu.witel_id=? AND alert.created_at>=?";
        queryStr = createQuery(queryStr, [ witel.id, toDatetimeString(date) ]);

        app.logDatabaseQuery(queryStr, "Get unsended alarm stacks from last 6 hours");
        const { results } = await executeQuery(app.pool, queryStr);

        if(results.length < 1)
            return results;

        const alertIds = results.map(item => item.alert_id);
        const queryUpdate = createQuery("UPDATE alert_message SET status='sending' WHERE id IN (?)", [ alertIds ]);
        app.logDatabaseQuery(queryUpdate, `Update alarm stacks status to be 'sending', ids:${ alertIds }`);
        await executeQuery(app.pool, queryUpdate);

        return results;

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

const onAlertUnsended = async (app, alertId, alertErr) => {
    const processDateStr = toDatetimeString(new Date());
    try {
    
        let updateQueryStr = "UPDATE alert_message SET status=? WHERE id=?";
        updateQueryStr = createQuery(updateQueryStr, ["unsended", alertId]);

        app.logDatabaseQuery(updateQueryStr, `Update alert unsended status, alertId:${ alertId }`);
        await executeQuery(app.pool, updateQueryStr);

        if(alertErr.description) {

            let insertQueryStr = "INSERT INTO alert_message_error (alert_id, error_code, description, created_at)"+
                " VALUES (?, ?, ?, ?, ?)";
            insertQueryStr = createQuery(insertQueryStr, [
                alertId, alertErr.code, alertErr.description, processDateStr
            ]);

            app.logDatabaseQuery(insertQueryStr, "Alert error has description, push alert error to database");
            await executeQuery(app.pool, insertQueryStr);

        }

    } catch(err) {
        app.logError(err);
    }
};

const witelJob = async (app, { witel, groupUsers, picUsers, openPorts, closePorts, dateTime }) => {
    app.logProcess(`Witel Job is running, witelId:${ witel.id }, closePortsCount:${ closePorts.length }, openPortsCount:${ openPorts.length }`);
    try {

        const [ cp, alarmPorts ] = await Promise.all([
            updateClosedPorts(app, closePorts, dateTime),
            insertOpenPorts(app, openPorts, dateTime)
        ]);

        if(alarmPorts.length < 1) {
            app.logProcess(`Port alarm is empty, witelId:${ witel.id }`);
        } else {
            await writeAlertStack(app, alarmPorts, groupUsers, picUsers);
        }
        
        const alertStacks = await getAlertStacks(app, witel);
        if(alertStacks.length < 1) {
            app.logProcess(`Alert is empty, witelId:${ witel.id }`);
            app.commit(`witelTreg${ witel.regional_id }`, witel.id);
            return;
        }

        const alertWorks = alertStacks.map(stack => ({ id: stack.alert_id, status: false }));
        app.on(`alertWitel${ witel.id }`, alertId => {
            app.logProcess(`App.onAlertWitel${ witel.id } was commited, alertId:${ alertId }`);
            const workIndex = alertWorks.findIndex(work => work.id == alertId);
            if(workIndex >= 0)
                alertWorks[workIndex].status = true;
            if(alertWorks.findIndex(work => !work.status) < 0)
                app.commit(`witelTreg${ witel.regional_id }`, witel.id);
        });

        const worker = new JobQueue(1);
        const workerPath = "workers/worker-telegram-alerting";
        worker.registerWorker(workerPath, {
            appId: app.getAppId(),
            stacks: alertStacks,
            picUsers
        });
    
        worker.onData(async (workerResult) => {
            const { alertId, success, error, retryTime } = workerResult;

            if(success) {
                await onAlertSuccess(app, alertId);
            } else {
                if(retryTime)
                    app.registerDelayTimes(retryTime);
                await onAlertUnsended(app, alertId, error);
            }

            app.commit(`alertWitel${ witel.id }`, alertId);
        });
    
        worker.onEachError(err => {
            app.logError(err);
        });

        worker.run();

    } catch(err) {
        app.logError(err);
        app.commit(`witelTreg${ witel.regional_id }`, witel.id);
    }
};

const regionalJob = async (app, regional) => {

    app.logProcess(`Regional Job is running, regionalId:${ regional.id }`);
    try {

        const witelList = await getWitelList(app, regional.id);
        const { groupUsers, picUsers } = await getUsersInRegional(app, regional.id);
        const oldAlarms = await getAlarmsList(app, regional.id);
    
        const maxJobCount = 3;
        const maxGroupItems = Math.floor( Math.max( maxJobCount / witelList.length ) / maxJobCount );
        const witelsGroup = groupingWitel(app, maxGroupItems, witelList);
    
        if(witelsGroup.length < 1) {
            app.logProcess(`Witels Group is empty, regionalId:${ regional.id }`);
            app.commit("regional", regional.id);
        }
    
        const witelWorks = witelList.map(witel => ({ id: witel.id, status: false }));
        app.on(`witelTreg${ regional.id }`, witelId => {
            app.logProcess(`App.onWitelTreg${ regional.id } was commited, witelId:${ witelId }`);
            const workIndex = witelWorks.findIndex(work => work.id == witelId);
            if(workIndex >= 0)
                witelWorks[workIndex].status = true;
            if(witelWorks.findIndex(work => !work.status) < 0)
                app.commit("regional", regional.id);
        });
    
        const worker = new JobQueue(maxJobCount);
        const workerPath = "workers/worker-port-alarm";
    
        witelsGroup.forEach((witels, i) => {
            if(Object.keys(witels).length > 0) {
                const witelIdsStr = Object.keys(witels).join(",");
                app.logProcess(`Registering witels group:${i + 1 }, witelIds:(${ witelIdsStr }), oldAlarmsCount:${ oldAlarms.length }`);
                worker.registerWorker(workerPath, {
                    appId: app.getAppId(),
                    witels,
                    groupUsers,
                    picUsers,
                    oldAlarms
                });
            }
        });
    
        worker.onData(workerResult => {
            const { witel, groupUsers, picUsers, dateTime } = workerResult;
            const openPorts = [];
            const closePorts = [];
            if(workerResult.openAlarm.length > 0)
                openPorts.push(...workerResult.openAlarm);
            if(workerResult.closeAlarm.length > 0)
                closePorts.push(...workerResult.closeAlarm);
            witelJob(app, { witel, groupUsers, picUsers, openPorts, closePorts, dateTime });
        });
    
        worker.onEachError(err => {
            app.logError(err);
            // throw err;
        });

        worker.run();

    } catch(err) {
        app.logError(err);
        app.commit("regional", regional.id);
    }
};

const runApp = async (app) => {
    return new Promise(async (resolve, reject) => {
        app.on("finish", () => {
            app.logProcess("App.finish was commited");
            resolve();
        });
        getRegionalList(app)
            .then(regionalList => {

                if(regionalList.length < 1) {
                    app.commit("finish");
                    return;
                }
        
                const regionalWorks = regionalList.map(reg => ({ id: reg.id, status: false }));
                app.on("regional", regionalId => {
                    app.logProcess(`App.onRegional was commited, regionalId:${ regionalId }`);
                    const workIndex = regionalWorks.findIndex(work => work.id == regionalId);
                    if(workIndex >= 0)
                        regionalWorks[workIndex].status = true;
                    if(regionalWorks.findIndex(work => !work.status) < 0)
                        app.commit("finish");
                });

                regionalList.forEach(regional => regionalJob(app, regional));

            })
            .catch(err => {
                app.logError(err);
                resolve();
            });
    });
};

const main = async () => {
    const app = new App();
    app.logProcess("\nApp is starting");

    app.useDbPool({
        ...dbConfig.opnimusNewMigrated2,
        connectionLimit: 40
    });
    await runApp(app);
    await app.closeDbPool();

    app.logProcess("App is closed");
    return app;

};

module.exports = main;