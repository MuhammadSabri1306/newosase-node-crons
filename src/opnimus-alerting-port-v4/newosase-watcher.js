const { executeQuery, createQuery } = require("../core/mysql");
const { InsertQueryBuilder } = require("../helpers/mysql-query-builder");
const { toDatetimeString } = require("../helpers/date");
const dbConfig = require("../env/database");
const { useWitelModel, WitelModel, useGroupUserModel, GroupUserModel,
    usePicUserModel, PicUserModel, useAlarmModel, AlarmModel,
    useRtuModel, RtuModel } = require("./model");
const App = require("./App");
const JobQueue = require("./JobQueue");

const getWitels = async (app) => {
    try {
        const queryStr = "SELECT * FROM witel";
        // const queryStr = "SELECT * FROM witel WHERE id=43";
        app.logDatabaseQuery(queryStr, "Get witel list from database");
        const { results } = await executeQuery(app.pool, queryStr);
        return results;
    } catch(err) {
        app.logError(err);
        return [];
    }
};

const groupingWitel = (app, witels, groupCount) => {
    try {
        if(!witels instanceof WitelModel)
            throw new Error("witels in groupingWitel() is not WitelModel");
    
        const witelList = witels.get();
        
        const groups = [];
        let groupIndex = 0;
        for(let i=0; i<witelList.length; i++) {
            if(groups.length === groupIndex) {
                groups.push([]);
            }
            groups[groupIndex].push(witelList[i]);
            groupIndex++;
            if(groupIndex === groupCount)
                groupIndex = 0;
        }
        return groups;
    } catch(err) {
        app.logError(err);
        return [];
    }
};

const getAlarms = async (app) => {
    try {
        let queryStr = "SELECT alarm.*, rtu.location_id, rtu.datel_id, rtu.witel_id, rtu.regional_id"+
            " FROM alarm_port_status AS alarm JOIN rtu_list AS rtu ON rtu.sname=alarm.rtu_sname"+
            " WHERE alarm.is_closed=0";
        app.logDatabaseQuery(queryStr, "Get opened alarm port list from database");
        const { results } = await executeQuery(app.pool, queryStr);
        return results;
    } catch(err) {
        app.logError(err);
        return [];
    }
};

const getRtus = async (app) => {
    try {
        let queryStr = "SELECT * FROM rtu_list";
        app.logDatabaseQuery(queryStr, "Get rtu list from database");
        const { results } = await executeQuery(app.pool, queryStr);
        return results;
    } catch(err) {
        app.logError(err);
        return [];
    }
};

const getUsers = async (app) => {
    try {

        const groupQuery = "SELECT user.*, mode.id AS mode_id, mode.rules"+
            " FROM alert_users as alert JOIN telegram_user as user ON user.id=alert.telegram_user_id"+
            " JOIN alert_modes AS mode ON mode.id=alert.mode_id WHERE user.is_pic=0 AND alert.cron_alert_status=1"
            " AND alert.user_alert_status=1 ORDER BY user.regist_id";
        app.logDatabaseQuery(groupQuery, "Get group list from database");
        const { results: groupUsers } = await executeQuery(app.pool, groupQuery);

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

        return { groupUsers, picUsers };

    } catch(err) {
        app.logError(err);
        return { groupUsers, picUsers };
    }
};

const updateClosedPorts = async (app, closedAlarms) => {
    if(closedAlarms.length < 1)
        return;
    try {
        const { port_severity, closed_at } = closedAlarms[0].data;
        const ids = closedAlarms.map(item => item.id);
        let queryStr = "UPDATE alarm_port_status SET port_severity=?, is_closed=?, closed_at=? WHERE id IN (?)";
        queryStr = createQuery(queryStr, [ port_severity, 1, closed_at, ids ]);
        app.logDatabaseQuery(queryStr, "Closing (update) opened alarm ports");
        await executeQuery(app.pool, queryStr);
    } catch(err) {
        app.logError(err);
    }
};

const updateOpenedPorts = async (app, updatedAlarms) => {
    if(updatedAlarms.length < 1)
        return [];
    try {
        const queries = updatedAlarms.map(({ id, data }) => {
            const { port_value, port_unit, port_severity } = data;
            const queryStr = "UPDATE alarm_port_status SET port_value=?, port_unit=?, port_severity=? WHERE id=?";
            return createQuery(queryStr, [ port_value, port_unit, port_severity, id ]);
        });
        app.logDatabaseQuery(queries, "Update opened alarm ports");
        await executeQuery(app.pool, queries.join("; "));
        
        const ids = updatedAlarms.map(item => item.id);
        const queryStr = createQuery("SELECT * FROM alarm_port_status WHERE id IN (?)", [ ids ]);
        app.logDatabaseQuery(queries, "Get updated alarm ports");
        const { results } = await executeQuery(app.pool, queryStr);
        return results;
    } catch(err) {
        app.logError(err);
        return [];
    }
};

const insertOpenPorts = async (app, newAlarms) => {
    if(newAlarms.length < 1)
        return [];
    try {
        const queryInsert = new InsertQueryBuilder("alarm_port_status");
        const fields = [
            "port_no",
            "port_name",
            "port_value",
            "port_unit",
            "port_severity",
            "type",
            "location",
            "rtu_sname",
            "opened_at"
        ];

        fields.forEach(field => queryInsert.addFields(field));
        newAlarms.forEach(alarm => {
            queryInsert.appendRow( fields.map(key => alarm[key]) );
        });

        const queryInsertStr = createQuery(queryInsert.getQuery(), queryInsert.getBuiltBindData());
        app.logDatabaseQuery(queryInsertStr, "Open (insert) new alarm ports");
        const { results } = await executeQuery(app.pool, queryInsertStr);

        const alarmIds = queryInsert.buildInsertedId(results.insertId, results.affectedRows);
        if(!Array.isArray(alarmIds) || alarmIds.length < 1) {
            throw Error(
                "The 'alarmIds' in insertOpenPorts(...args) should be ids<Array> of inserted data,"+
                ` newAlarms count:${ newAlarms.length }, insertId:${ results.insertId }, affectedRows:${ results.affectedRows }`
            );
        }
        
        const queryStr = createQuery("SELECT * FROM alarm_port_status WHERE id IN (?)", [ alarmIds ]);
        app.logDatabaseQuery(queryStr, "Get inserted alarm ports");
        const { results: alarms } = await executeQuery(app.pool, queryStr);
        return alarms;
    } catch(err) {
        app.logError(err);
        return [];
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
		rules = rules.replace(mark, portKey);
	});

	return eval(rules);
};

const buildAlertData = (app, alertMatches, alarms) => {
    if(alertMatches.length < 1 || alarms.length < 1)
        return [];
    try {
        const alerts = [];
        const dateTime = toDatetimeString(new Date());
        for(let i=0; i<alarms.length; i++) {
            for(let j=0; j<alertMatches.length; j++) {
                if(alertMatches[j].rtuSname == alarms[i].rtu_sname) {
                    if(alertMatches[j].portNo == alarms[i].port_no) {
                        if(isRuleMatch(alarms[i], alertMatches[j].user.rules)) {
                            alerts.push({
                                port_id: alarms[i].id,
                                chat_id: alertMatches[j].user.chatId,
                                status: "unsended",
                                created_at: dateTime
                            });
                        }
                    }
                }
            }
        }
        return alerts;
    } catch(err) {
        app.logError(err);
        return [];
    }
};

const insertAlert = async (app, alerts) => {
    if(alerts.length < 1)
        return;
    try {
        const queryInsert = new InsertQueryBuilder("alert_message");
        const fields = [ "port_id", "chat_id", "status", "created_at" ];

        fields.forEach(field => queryInsert.addFields(field));
        alerts.forEach(alert => {
            queryInsert.appendRow( fields.map(key => alert[key]) );
        });

        const queryInsertStr = createQuery(queryInsert.getQuery(), queryInsert.getBuiltBindData());
        app.logDatabaseQuery(queryInsertStr, "Insert alert stack");
        await executeQuery(app.pool, queryInsertStr);
    } catch(err) {
        app.logError(err);
    }
};

const runApp = async (app) => {
    return new Promise(async (resolve) => {
        try {

            const [ witels, rtus, oldAlarms, { groupUsers, picUsers } ] = await Promise.all([
                getWitels(app),
                getRtus(app),
                getAlarms(app),
                getUsers(app)
            ]);
    
            if(witels.length < 1) {
                app.logProcess("Witels is empty");
                return;
            }
    
            const groupCount = Math.min(15, witels.length);
            const witelGroups = groupingWitel(app, useWitelModel(witels), groupCount);
            app.logProcess("Witel groups was generated", {
                witelsCount: witels.length,
                groupsCount: witelGroups.length
            });
    
            const witelWorks = witels.map(witel => ({ id: witel.id, success: false }));
            app.on("witel", witelId => {
                const index = witelWorks.findIndex(item => item.id == witelId);
                if(index >= 0)
                    witelWorks[index].success = true;
                if(!witelWorks.find(item => !item.success))
                    resolve();
            });
    
            const worker = new JobQueue(groupCount);
            const workerPath = "worker-get-alarms/index";
            witelGroups.forEach(group => {
                const witelIds = group.map(witel => witel.id);
                app.logProcess("Registering witels group thread", { witelIds });
                worker.registerWorker(workerPath, {
                    appId: app.appId,
                    appName: app.appName,
                    witels: group,
                    rtus,
                    groupUsers,
                    picUsers,
                    oldAlarms
                });
            });
    
            worker.onData(async (workerResult) => {
                const { witel, newAlarms, updatedAlarms, closedAlarms, alertMatches } = workerResult;
                app.logProcess("witel job is running", {
                    witelId: witel.id,
                    newAlarmsCount: newAlarms.length,
                    updatedAlarmsCount: updatedAlarms.length,
                    closedAlarmsCount: closedAlarms.length
                });
                const [ c, updateAlarmResults, insertAlarmResults ] = await Promise.all([
                    updateClosedPorts(app, closedAlarms),
                    updateOpenedPorts(app, updatedAlarms),
                    insertOpenPorts(app, newAlarms)
                ]);

                const alerts = buildAlertData(app, alertMatches, [ ...updateAlarmResults, ...insertAlarmResults ]);
                app.logProcess("writing alerts stack", {
                    witelId: witel.id,
                    alertsCount: alerts.length
                });

                await insertAlert(app, alerts);
                app.emit("witel", witel.id);
            });
        
            worker.onEachError(err => app.logError(err));
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
        connectionLimit: 10
    });

    await runApp(app);

    await app.closeDbPool();
    app.removeAllListeners("witel"); 
    app.logProcess(`App ${ app.appName } is closed`);

};