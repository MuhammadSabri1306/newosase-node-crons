const { executeQuery, createQuery, createDbPool, closePool, } = require("../../core/mysql");
const { toDatetimeString } = require("../../helpers/date");
const dbConfig = require("../../env/database");
const { useWitelModel, WitelModel, useGroupUserModel, GroupUserModel,
    usePicUserModel, PicUserModel, useAlarmModel, AlarmModel,
    useRtuModel, RtuModel } = require("../model");
const JobQueue = require("../JobQueue");

const getWitels = async (pool) => {
    try {
        // const queryStr = "SELECT * FROM witel";
        // const queryStr = "SELECT * FROM witel WHERE regional_id=2";
        const queryStr = "SELECT * FROM witel WHERE id=43";
        const { results } = await executeQuery(pool, queryStr);
        return results;
    } catch(err) {
        console.error(err);
        return [];
    }
};

const groupingWitel = (pool, witels, groupCount) => {
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
        console.error(err);
        return [];
    }
};

const getAlarms = async (pool) => {
    try {
        let queryStr = "SELECT alarm.*, rtu.location_id, rtu.datel_id, rtu.witel_id, rtu.regional_id"+
            " FROM alarm_port_status AS alarm JOIN rtu_list AS rtu ON rtu.sname=alarm.rtu_sname"+
            " WHERE alarm.is_closed=0";
        const { results } = await executeQuery(pool, queryStr);

        let removedIndex = -1;
        results.forEach((alarm, index) => {
            if(alarm.rtu_sname == "RTU00-D7-MAT" && alarm.port_no == "A-40")
                removedIndex = index;
        });

        if(removedIndex >= 0)
            results.splice(removedIndex, 1);

        return results;
    } catch(err) {
        console.error(err);
        return [];
    }
};

const getRtus = async (pool) => {
    try {
        let queryStr = "SELECT * FROM rtu_list";
        const { results } = await executeQuery(pool, queryStr);
        return results;
    } catch(err) {
        console.error(err);
        return [];
    }
};

const getUsers = async (pool) => {
    try {

        const groupQuery = "SELECT user.*, mode.id AS mode_id, mode.rules"+
            " FROM alert_users as alert JOIN telegram_user as user ON user.id=alert.telegram_user_id"+
            " JOIN alert_modes AS mode ON mode.id=alert.mode_id WHERE user.is_pic=0 AND alert.cron_alert_status=1"
            " AND alert.user_alert_status=1 ORDER BY user.regist_id";
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
        return { groupUsers, picUsers };
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

const buildAlertData = (alertMatches, alarms) => {
    if(alertMatches.length < 1 || alarms.length < 1)
        return [];
    try {
        const alerts = [];
        const dateTime = toDatetimeString(new Date());
        for(let i=0; i<alarms.length; i++) {
            for(let j=0; j<alertMatches.length; j++) {
                if(alertMatches[j].rtuSname == alarms[i].rtu_sname) {
                    if(alertMatches[j].portNo == alarms[i].port_no) {
                        console.log(alertMatches[j].user.rules);
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
        console.error(err);
        return [];
    }
};

const main = async () => {
    const pool = createDbPool({
        ...dbConfig.opnimusNewMigrated2,
        multipleStatements: true
    });
    try {

        const [ witels, rtus, oldAlarms, { groupUsers, picUsers } ] = await Promise.all([
            getWitels(pool),
            getRtus(pool),
            getAlarms(pool),
            getUsers(pool)
        ]);

        if(witels.length < 1) {
            console.log("Witels is empty");
            return;
        }

        const groupCount = Math.min(15, witels.length);
        const witelGroups = groupingWitel(pool, useWitelModel(witels), groupCount);
        const worker = new JobQueue(groupCount);
        const workerPath = "tests/worker-get-alarms";
        witelGroups.forEach(group => {
            const witelIds = group.map(witel => witel.id);
            console.log("Registering witels group thread", { witelIds });
            worker.registerWorker(workerPath, {
                witels: group,
                rtus,
                groupUsers,
                picUsers,
                oldAlarms
            });
        });

        worker.onData(async (workerResult) => {
            const { witel, newAlarms, updatedAlarms, closedAlarms, alertMatches } = workerResult;
            if(witel.id == 43) {
                console.log({ witel, newAlarms, updatedAlarms, closedAlarms, alertMatches })
                alertMatches.forEach(item => {
                    console.log(item.user)
                });
            }

            const { results: insertAlarmResults } = await executeQuery(pool, "SELECT * FROM alarm_port_status WHERE id IN (57063)");
            const updateAlarmResults = [];

            insertAlarmResults[0].port_severity = "warning";
            insertAlarmResults[0].is_closed = 0;
            insertAlarmResults[0].closed_at = null;

            const alerts = buildAlertData(alertMatches, [ ...updateAlarmResults, ...insertAlarmResults ]);
        });

        worker.onEachError(err => console.error(err));
        worker.onAfterRun(() => {
            setTimeout(() => closePool(pool), 2000);
        });
        worker.run();

    } catch(err) {
        console.error(err);
    }
};

main();