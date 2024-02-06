const dbOpnimusNewConfig = require("../../env/database/opnimus-new-migrated-2");
const path = require("path");
const { useSequelize, useModel, toUnderscoredPlain } = require("./models");
const { Op } = require("sequelize");
const { Logger } = require("./logger");
const { watch, addDelay } = require("./watcher");
const EventEmitter = require("events");
const { Worker, workerData } = require("worker_threads");
const { toDatetimeString } = require("../../helpers/date");
const { isRuleMatch } = require("./alert-mode");
const { ErrorLogger } = require("./err-bot-logger");

module.exports.createSequelize = (pool = null) => {
    const sequelizeLogger = Logger.createWinstonLogger({
        fileName: "sequelize",
        useStream: true,
    });

    const sequelizeOptions = {
        ...dbOpnimusNewConfig,
        // host: "localhost",
        // database: dbOpnimusNewConfig.database,
        // user: "root",
        // password: "",
        options: {
            logging: (msg) => {
                const database = dbOpnimusNewConfig.database;
                sequelizeLogger.info(`(sequelize:${ database }) ${ msg }`);
            },
            timezone: "+07:00"
        }
    };
    if(pool)
        sequelizeOptions.options.pool = pool;

    return useSequelize(sequelizeOptions);
};

module.exports.toWitelGroups = (witels, witelGroupTarget, app = {}) => {
    const logger = Logger.getOrCreate(app.logger);
    try {

        const groups = [];
        let groupIndex = 0;
        for(let i=0; i<witels.length; i++) {
            if(groups.length === groupIndex) {
                groups.push([]);
            }
            groups[groupIndex].push(witels[i]);
            groupIndex++;
            if(groupIndex === witelGroupTarget)
                groupIndex = 0;
        }

        logger.info("Grouping witels", {
            witelsCount: witels.length,
            witelGroupCount: groups.length
        });

        return groups;

    } catch(err) {
        logger.info("Failed to grouping witels", {
            witelsCount: witels.length,
            witelGroupTarget
        });
        logger.error(err);
    }

};

module.exports.createWitelThread = (witel) => {
    return {
        id: witel.id,
        witel,
        running: false,
        done: false,
        events: new EventEmitter(),
        start(data = {}) {
            this.running = true;
            const jobId = this.id;
            this.events.emit("start", { ...data, jobId });
        },
        alarmWrite(data = {}) {
            const jobId = this.id;
            this.events.emit("alarm-write", { ...data, jobId });
        },
        alertWrite(data = {}) {
            const jobId = this.id;
            this.events.emit("alert-write", { ...data, jobId });
        },
        finish(data = {}) {
            const jobId = this.id;
            this.events.emit("finish", { ...data, jobId });
        },
        error(err) {
            const jobId = this.id;
            this.events.emit("error", { err, jobId });
        },
        onStart(callback) {
            this.events.addListener("start", callback);
        },
        onAlarmWrite(callback) {
            this.events.addListener("alarm-write", callback);
        },
        onAlertWrite(callback) {
            this.events.addListener("alert-write", callback);
        },
        onFinish(callback) {
            this.events.addListener("finish", callback);
        },
        onError(callback) {
            this.events.addListener("error", callback);
        },
    }
};

module.exports.getWitelThreadInfo = (jobs) => {
    const all = { count: jobs.length, jobIds: [] };
    const running = { count: 0, jobIds: [] };
    const done = { count: 0, jobIds: [] };
    let i = 0;
    while(i < jobs.length) {
        all.jobIds.push(jobs[i].id);
        if(jobs[i].done) {
            done.jobIds.push(jobs[i].id);
            done.count++;
        } else if(jobs[i].running) {
            running.jobIds.push(jobs[i].id);
            running.count++;
        }
        i++;
    }
    return { all, running, done };
};

module.exports.getAlarmsOfWitels = async (witelIds, app = {}) => {
    let { sequelize, logger } = app;
    logger = Logger.getOrCreate(logger);
    logger.info("get alarms of witels", { witelIds });

    const witelAlarms = {};
    try {

        const { Alarm, Rtu } = useModel(sequelize);
        const alarms = await Alarm.findAll({
            where: {
                isOpen: true,
            },
            include: [{
                model: Rtu,
                required: true,
                where: {
                    witelId: { [Op.in]: witelIds }
                }
            }]
        });

        alarms.forEach(alarm => {
            const witelId = alarm.rtu.witelId;
            if(!Array.isArray(witelAlarms[witelId]))
                witelAlarms[witelId] = [];
            witelAlarms[witelId].push(alarm.get({ plain: true }));
        });

    } catch(err) {
        logger.error(err);
    } finally {
        return witelAlarms;
    }
};

module.exports.closeAlarms = async (closedAlarms, app = {}) => {
    let { logger, jobId, sequelize } = app;
    logger = Logger.getOrCreate(logger);
    
    if(closedAlarms.length < 1) {
        logger.info("closedAlarms is empty", { jobId });
        return;
    }

    try {

        const { Alarm, AlarmHistory } = useModel(sequelize);
        const alarmIds = closedAlarms.map(item => item.alarmId);
        const updateWorks = [];

        updateWorks.push(async () => {
            logger.info("update closed alarms in Alarm model", { jobId, alarmIds });
            return Alarm.update({ isOpen: false }, {
                where: {
                    alarmId: { [Op.in]: alarmIds }
                }
            });
        });

        updateWorks.push(async () => {
            logger.info("update closed alarms in AlarmHistory model", { jobId, alarmIds });
            return AlarmHistory.update({ closedAt: new Date() }, {
                where: {
                    alarmId: { [Op.in]: alarmIds }
                }
            });
        });

        await Promise.all( updateWorks.map(work => work()) );

    } catch(err) {
        logger.error(err);
    }
};

module.exports.updateAlarms = async (changedAlarms, app = {}) => {
    let { logger, jobId, sequelize } = app;
    logger = Logger.getOrCreate(logger);
    
    if(changedAlarms.length < 1) {
        logger.info("changedAlarms is empty", { jobId });
        return { alarmIds: [], alarmHistoryIds: [] };
    }

    try {

        const { Alarm, AlarmHistory } = useModel(sequelize);
        const works = [];

        const alarmIds = [];
        const newHistoryDatas = [];
        changedAlarms.forEach(({ alarmId, data }) => {
            alarmIds.push(alarmId);
            const {
                alarmType, portId, portNo, portName, portValue, portUnit, portSeverity, portDescription,
                portIdentifier, portMetrics, rtuId, rtuSname, rtuStatus, alertStartTime
            } = data;

            works.push(async () => {
                const alarmData = {
                    alarmType, portId, portNo, portName, portValue, portUnit, portSeverity,
                    portDescription, portIdentifier, portMetrics, rtuId, rtuSname, rtuStatus
                };
                logger.info("update changed alarm in Alarm model", { jobId, alarmId });
                return Alarm.update(alarmData, {
                    where: { alarmId }
                });
            });

            newHistoryDatas.push({
                alarmId, alarmType, portId, portNo, portName, portValue, portUnit, portSeverity,
                portDescription, portIdentifier, portMetrics, rtuId, rtuSname, rtuStatus,
                alertStartTime: alertStartTime || null, openedAt: new Date()
            });
        });

        await Promise.all( works.map(work => work()) );

        logger.info("write changed alarms to AlarmHistory model", { jobId, alarmIds });
        const alarmHistories = await AlarmHistory.bulkCreate(newHistoryDatas);
        const alarmHistoryIds = alarmHistories.map(item => item.alarmHistoryId);

        return { alarmIds, alarmHistoryIds };

    } catch(err) {
        logger.error(err);
        return { alarmIds: [], alarmHistoryIds: [] };
    }
};

module.exports.updateOrCreateAlarms = async (newAlarms, app = {}) => {
    let { logger, jobId, sequelize } = app;
    logger = Logger.getOrCreate(logger);

    const result = { alarmIds: [], alarmHistoryIds: [] };
    if(newAlarms.length < 1) {
        logger.info("newAlarms is empty", { jobId });
        return result;
    }

    try {

        const { Alarm, AlarmHistory } = useModel(sequelize);
        const portIds = newAlarms.map(alarm => alarm.portId);
        const existsAlarms = await Alarm.findAll({
            where: {
                portId: { [Op.in]: portIds }
            }
        });

        const works = [];
        newAlarms.forEach(alarm => {

            const existsAlarm = existsAlarms.find(item => item.portId == alarm.portId);
            const isAlarmExists = existsAlarm ? true : false;

            const {
                alarmType, portId, portNo, portName, portValue, portUnit, portSeverity, portDescription,
                portIdentifier, portMetrics, rtuId, rtuSname, rtuStatus, alertStartTime
            } = alarm;

            if(isAlarmExists) {
                works.push(async () => {

                    const alarmData = {
                        alarmType, portId, portNo, portName, portValue, portUnit, portSeverity,
                        portDescription, portIdentifier, portMetrics, rtuId, rtuSname, rtuStatus,
                        isOpen: true
                    };

                    logger.info("update opened alarm in Alarm model", { jobId, alarmId: existsAlarm.alarmId });
                    await Alarm.update(alarmData, {
                        where: { alarmId: existsAlarm.alarmId }
                    });

                    logger.info("insert opened alarm in AlarmHistory model", { jobId, alarmId: existsAlarm.alarmId });
                    const alarmHistory = await AlarmHistory.create({
                        alarmId: existsAlarm.alarmId, alarmType, portId, portNo, portName, portValue, portUnit,
                        portSeverity, portDescription, portIdentifier, portMetrics, rtuId, rtuSname, rtuStatus,
                        alertStartTime: alertStartTime || null, openedAt: new Date()
                    });

                    return { alarmId: existsAlarm.alarmId, alarmHistoryId: alarmHistory.alarmHistoryId };

                });
            } else {
                works.push(async () => {

                    const alarmData = {
                        alarmType, portId, portNo, portName, portValue, portUnit, portSeverity,
                        portDescription, portIdentifier, portMetrics, rtuId, rtuSname, rtuStatus,
                        isOpen: true, createdAt: new Date()
                    };

                    logger.info("insert opened alarm in Alarm model", { jobId, portId: alarm.portId });
                    const insertedAlarm = await Alarm.create(alarmData);

                    logger.info("insert opened alarm in AlarmHistory model", { jobId, alarmId: insertedAlarm.alarmId });
                    const alarmHistory = await AlarmHistory.create({
                        alarmId: insertedAlarm.alarmId, alarmType, portId, portNo, portName, portValue, portUnit,
                        portSeverity, portDescription, portIdentifier, portMetrics, rtuId, rtuSname, rtuStatus,
                        alertStartTime: alertStartTime || null, openedAt: new Date()
                    });

                    return { alarmId: insertedAlarm.alarmId, alarmHistoryId: alarmHistory.alarmHistoryId };

                });
            }

        });

        const workResults = await Promise.all( works.map(work => work()) );
        workResults.forEach(({ alarmId, alarmHistoryId }) => {
            result.alarmIds.push(alarmId);
            result.alarmHistoryIds.push(alarmHistoryId);
        });

        return result;

    } catch(err) {
        logger.error(err);
        return result;
    }
};

module.exports.writeAlertStack = async (witel, alarmIds, alarmHistoryIds, app = {}) => {
    let { logger, jobId, sequelize } = app;
    logger = Logger.getOrCreate(logger);

    if(alarmIds.length < 1) {
        logger.info("no alarms to write as alerts", { jobId });
        return;
    }

    try {

        const { AlarmHistory, TelegramUser, AlertUsers, Rtu, PicLocation, AlertStack, AlertModes } = useModel(sequelize);

        logger.info("get alarms to write as alert", { jobId, alarmIds });
        const alarmHistories = await AlarmHistory.findAll({
            where: {
                alarmHistoryId: { [Op.in]: alarmHistoryIds },
            },
            include: [{
                model: Rtu,
                required: true
            }]
        });

        const regionalIds = [];
        const witelIds = [];
        const locIds = [];
        alarmHistories.forEach(alarmHistory => {
            const regionalId = alarmHistory.rtu.regionalId;
            if(regionalIds.indexOf(regionalId) < 0)
                regionalIds.push(regionalId);
            const witelId = alarmHistory.rtu.witelId;
            if(witelIds.indexOf(witelId) < 0)
                witelIds.push(witelId);
            const locId = alarmHistory.rtu.locationId;
            if(locIds.indexOf(locId) < 0)
                locIds.push(locId);
        });

        const works = {};
        works.getGroupUsers = () => {
            logger.info("get telegram groups of alarms", { jobId, alarmIds });
            return TelegramUser.findAll({
                where: {
                    [Op.and]: [
                        { isPic: false },
                        {
                            [Op.or]: [
                                { level: "nasional" },
                                { level: "regional", regionalId: { [Op.in]: regionalIds } },
                                { level: "witel", witelId: { [Op.in]: witelIds } },
                            ]
                        }
                    ]
                },
                order: [ "registId", "regionalId", "witelId" ],
                include: [{
                    model: AlertUsers,
                    required: true,
                    where: {
                        [Op.and]: [
                            { cronAlertStatus: true },
                            { userAlertStatus: true }
                        ]
                    },
                    include: [{
                        model: AlertModes,
                        required: true,
                    }]
                }]
            });
        };

        works.getPicUsers = () => {
            logger.info("get telegram user of alarm pics", { jobId, alarmIds });
            return TelegramUser.findAll({
                where: { isPic: true },
                order: [ "picRegistId" ],
                include: [{
                    model: AlertUsers,
                    required: true,
                    where: {
                        [Op.and]: [
                            { cronAlertStatus: true },
                            { userAlertStatus: true }
                        ]
                    },
                    include: [{
                        model: AlertModes,
                        required: true,
                    }]
                }, {
                    model: PicLocation,
                    required: true,
                    where: {
                        locationId: { [Op.in]: locIds }
                    }
                }]
            });
        };

        const [ groupUsers, picUsers ] = await Promise.all([
            works.getGroupUsers(),
            works.getPicUsers()
        ]);
        
        const alertStackDatas = [];
        alarmHistories.forEach(alarm => {

            picUsers.forEach(user => {
                const isUserMatch = isRuleMatch(toUnderscoredPlain(alarm), user.alertUser.alertMode.rules);
                if(!isUserMatch) return;
                user.picLocations.forEach(loc => {
                    let isLocMatch = loc.locationId == alarm.rtu.locationId;
                    if(!isLocMatch)
                        return;
                    alertStackDatas.push({
                        alarmHistoryId: alarm.alarmHistoryId,
                        telegramChatId: user.userId,
                        status: "unsended",
                        createdAt: new Date()
                    });
                    logger.info("founded pic of alarms", {
                        alarmHistoryId: alarm.alarmHistoryId,
                        telegramUserId: user.id,
                        locationId: loc.locationId
                    });
                });
            });

            groupUsers.forEach(user => {
                const isUserMatch = isRuleMatch(toUnderscoredPlain(alarm), user.alertUser.alertMode.rules);
                if(!isUserMatch) return;

                let isLocMatch = false;
                if(user.level == "nasional")
                    isLocMatch = true;
                else if(user.level == "regional" && user.regionalId == alarm.rtu.regionalId)
                    isLocMatch = true;
                else if(user.level == "witel" && user.witelId == alarm.rtu.witelId)
                    isLocMatch = true;

                if(!isLocMatch)
                    return;
                alertStackDatas.push({
                    alarmHistoryId: alarm.alarmHistoryId,
                    telegramChatId: user.chatId,
                    status: "unsended",
                    createdAt: new Date()
                });
                logger.info("founded group of alarms", {
                    alarmHistoryId: alarm.alarmHistoryId,
                    telegramUserId: user.id
                });
            });
            
        });

        if(alertStackDatas.length < 1) {
            logger.info("no alert to write", { jobId, alarmIds });
            return;
        }

        await AlertStack.bulkCreate(alertStackDatas);
        logger.info("writing alert stack was done", { jobId, alertStackCount: alertStackDatas.length });

    } catch(err) {
        logger.info("failed to write alert stack", { jobId, alarmIds });
        logger.error(err);
    }
};

module.exports.syncAlarms = (witels, app = {}) => {
    const { watcher } = app;
    if(watcher)
        addDelay(watcher, 10000);
    const config = require("./config.json");

    return new Promise(async (resolve) => {

        const maxDbPool = Math.round(config.newosaseWatcher.maximumDbPool / config.newosaseWatcher.maximumThread);
        const sequelize = this.createSequelize({ max: maxDbPool });

        const logger = Logger.create({
            useStream: true,
            fileName: "newosase-watcher"
        });

        const witelIds = witels.map(witel => witel.id);
        logger.info("run alarms synchroniztion of witels", { witelIds });
        const witelsAlarmDatas = await this.getAlarmsOfWitels(witelIds, { sequelize, logger });

        const closeSync = async () => {

            await sequelize.close();
            logger.info("close alarms synchroniztion of witels", { witelIds });
            resolve();

        };
    
        const jobs = [];
        const onJobDone = (job) => {
            job.running = false;
            job.done = true;
            const { all, running, done } = this.getWitelThreadInfo(jobs);
            logger.info("witel's job is closed", {
                jobId: job.id,
                runningJob: running,
                doneJob: done,
                allJob: all,
            });

            if(done.count === all.count)
                closeSync();
        };

        witels.forEach(witel => {
            const job = this.createWitelThread(witel);

            job.onStart(async ({ jobId, closedAlarms, changedAlarms, newAlarms }) => {
                try {

                    const [ ca, result1, result2 ] = await Promise.all([
                        this.closeAlarms(closedAlarms, { logger, jobId, sequelize }),
                        this.updateAlarms(changedAlarms, { logger, jobId, sequelize }),
                        this.updateOrCreateAlarms(newAlarms, { logger, jobId, sequelize })
                    ]);

                    logger.info("alarms has been written", { result1, result2 });

                    const alarmIds = [ ...result1.alarmIds, ...result2.alarmIds ];
                    const alarmHistoryIds = [ ...result1.alarmHistoryIds, ...result2.alarmHistoryIds ];

                    job.alarmWrite({ alarmIds, alarmHistoryIds });

                } catch(err) {
                    job.error(err);
                }
            });

            job.onAlarmWrite(async ({ jobId, alarmIds, alarmHistoryIds }) => {
                try {

                    await this.writeAlertStack(witel, alarmIds, alarmHistoryIds, { logger, jobId, sequelize });
                    job.finish();

                } catch(err) {
                    job.error(err);
                }
            });
        
            job.onError(({ err }) => {
                logger.info("witel's job got error", { jobId: job.id });
                logger.error(err);
                job.finish();
            });
    
            job.onFinish(() => {
                try {

                    onJobDone(job);

                } catch(err) {
                    logger.info("witel's job got error", { jobId: job.id });
                    logger.error(err);
                    closeSync();
                }
            });
            
            jobs.push(job);
        });

        const workerDefineAlarmPath = path.resolve(__dirname, "./workers/worker-define-alarm.js");
        const workerDefineAlarmData = {
            loggerConfig: {
                threadId: logger.getThreadId(),
                options: logger.getOptions()
            },
            jobsData: jobs.map(job => {
                return { id: job.id, witel: job.witel.get({ plain: true }) };
            }),
            witelsAlarmDatas
        };
    
        const workerDefineAlarm = new Worker(
            workerDefineAlarmPath,
            { workerData: workerDefineAlarmData }
        );
    
        workerDefineAlarm.on("message", workerData => {
            const { jobId, closedAlarms, changedAlarms, newAlarms } = workerData;
            const index = jobs.findIndex(job => job.id == jobId);
            jobs[index].start({ closedAlarms, changedAlarms, newAlarms });
        });
    
        workerDefineAlarm.on("error", err => {
            throw err;
        });

    });
};

module.exports.watchNewosaseAlarmWitels = (witels) => {
    const errLogger = new ErrorLogger("alarmwatcher", "Cron watch-newosase-alarm");
    watch(async (watcher) => {
        try {
            await this.syncAlarms(witels, { watcher });
        } catch(err) {
            await errLogger.catch(err).logTo("-4092116808");
            throw err;
        }
    }, {
        onError: err => console.error(err)
    });
};

module.exports.groupAlerts = (alerts, alertGroupsTarget, app = {}) => {
    let { logger } = app;
    logger = Logger.getOrCreate(logger);
    logger.info("start to grouping alerts");

    const chatIdGroups = [];
    for(let i=0; i<alerts.length; i++) {
        
        let groupIndex = chatIdGroups.findIndex(group => group.chatId == alerts[i].telegramChatId);
        if(groupIndex < 0) {
            groupIndex = chatIdGroups.length;
            chatIdGroups.push({
                chatId: alerts[i].telegramChatId,
                alerts: [],
                alertsCount: 0
            });
        }

        chatIdGroups[groupIndex].alerts.push(alerts[i].get({ plain: true }));
        chatIdGroups[groupIndex].alertsCount++;

    }
    logger.info("alerts was grouped by chat ids", { chatIdGroupsCount: chatIdGroups.length });

    const targetCount = Math.min(alertGroupsTarget, chatIdGroups.length);
    const groups = [];
    let i = 0;
    while(i < targetCount) {
        groups.push({
            receivers: [ chatIdGroups[i] ],
            alertsCount: chatIdGroups[i].alertsCount
        });
        i++;
    }

    while(i < chatIdGroups.length) {
        let index = groups.findIndex(group => {
            const minAlertsCount = Math.min(...groups.map(item => item.alertsCount));
            return group.alertsCount === minAlertsCount;
        });
        groups[index].receivers.push(chatIdGroups[i]);
        groups[index].alertsCount += chatIdGroups[i].alertsCount;
        i++;
    }

    logger.info("alert groups was minimized", { groupsCount: groups.length });
    return groups;
};

module.exports.getAlertStack = async (app = {}) => {
    let { logger, sequelize } = app;
    logger = Logger.getOrCreate(logger);
    try {
    
        const {
            AlertStack, AlarmHistory, TelegramUser, TelegramPersonalUser,
            Rtu, Regional, Witel, Location, PicLocation
        } = useModel(sequelize);
    
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - 6);
        logger.info("reading unsended alert on stack", { createdAt: `>= ${ toDatetimeString(startDate) }` });

        const alerts = await AlertStack.findAll({
            where: {
                status: "unsended",
                createdAt: { [Op.gte]: startDate },
                // telegramChatId: "1931357638"
            },
            include: [{
                model: AlarmHistory,
                required: true,
                include: [{
                    model: Rtu,
                    required: true,
                    include: [{
                        model: Location,
                        include: [{
                            model: PicLocation,
                            include: [{
                                model: TelegramUser,
                                include: [ TelegramPersonalUser ]
                            }]
                        }]
                    }, {
                        model: Regional,
                        required: true
                    }, {
                        model: Witel,
                        required: true
                    }]
                }]
            }]
        });
        return alerts;

    } catch(err) {
        logger.error(err);
        return [];
    }
};

module.exports.setAlertAsSending = async (alertIds, app = {}) => {
    let { logger, sequelize } = app;
    logger = Logger.getOrCreate(logger);

    if(alertIds.length < 1) {
        logger.info("alerts is empty");
        return [];
    }
    try {

        const { AlertStack } = useModel(sequelize);
        logger.info("update alert status as sending", { alertIds });
        await AlertStack.update({ status: "sending" }, {
            where: {
                alertStackId: { [Op.in]: alertIds }
            }
        });

    } catch(err) {
        logger.error(err);
    }

};

module.exports.onAlertSended = async (alertId, app = {}) => {
    let { logger, sequelize } = app;
    logger = Logger.getOrCreate(logger);
    const { AlertStack } = useModel(sequelize);
    try {

        logger.info("update alert status as success", { alertId });
        await AlertStack.update({ status: "success" }, {
            where: { alertStackId: alertId }
        });

    } catch(err) {
        logger.error(err);
    }
};

module.exports.isTelegramErrorUserNotFound = (errDescription) => {
    const descrs = [
        "Forbidden: bot was kicked from the supergroup chat",
        "Bad Request: chat not found"
    ];
    for(let i=0; i<descrs.length; i++) {
        if(errDescription.indexOf(descrs[i]) >= 0) {
            i = descrs.length;
            return true;
        }
    }
    return false;
};

module.exports.onAlertUnsended = async (unsendedAlertIds, telegramErr, chatId, app = {}) => {
    let { logger, sequelize } = app;
    logger = Logger.getOrCreate(logger);
    try {

        const { AlertStack, AlertMessageError, TelegramUser, TelegramPersonalUser, PicLocation, AlertUsers } = useModel(sequelize);

        let works = [];
        works.push(() => {
            logger.info("changing back alert status as unsended", { alertIds: unsendedAlertIds });
            return AlertStack.update({ status: "unsended" }, {
                where: {
                    alertStackId: { [Op.in]: unsendedAlertIds }
                }
            });
        });

        if(telegramErr) {
            works.push(() => {
                logger.info("insert telegram error to AlertMessageError", { telegramErr });
                return AlertMessageError.create({ ...telegramErr, createdAt: new Date() });
            });
        }
        
        await Promise.all( works.map(work => work()) );

        const isUserNotFound = telegramErr && this.isTelegramErrorUserNotFound(telegramErr.description) ? true : false;
        if(!isUserNotFound || !chatId)
            return;

        const telgUser = await TelegramUser.findOne({
            where: { chatId }
        });
        logger.info("gotted telegram error user not found", { chatId, user: telgUser.get({ plain: true }) });
        if(!telgUser)
            return;

        works = [];

        if(telgUser.isPic) {
            works.push(() => {
                logger.info("delete user data from PicLocation", { userId: telgUser.id });
                return PicLocation.destroy({
                    where: { userId: telgUser.id }
                });
            });
        }

        if(telgUser.type == "private") {
            works.push(() => {
                logger.info("delete user data from TelegramPersonalUser", { userId: telgUser.id });
                return TelegramPersonalUser.destroy({
                    where: { userId: telgUser.id }
                });
            });
        }

        works.push(() => {
            logger.info("delete user data from AlertUsers", { telegramUserId: telgUser.id });
            return AlertUsers.destroy({
                where: { telegramUserId: telgUser.id }
            });
        });

        works.push(() => {
            logger.info("delete user data from TelegramUser", { id: telgUser.id });
            return TelegramUser.destroy({
                where: { id: telgUser.id }
            });
        });

        await Promise.all( works.map(work => work()) );

    } catch(err) {
        logger.error(err);
    }
};

module.exports.sendAlert = (app = {}) => {
    const { watcher } = app;
    if(watcher)
        addDelay(watcher, 10000);
    const config = require("./config.json");
    return new Promise(async (resolve) => {

        const sequelize = this.createSequelize({ max: config.telegramAlerting.maximumDbPool });
        const logger = Logger.create({
            useStream: true,
            fileName: "telegram-alerting"
        });
        
        const closeChecker = async () => {
            logger.info("alert checker was closed");
            await sequelize.close();
            resolve();
        };

        logger.info("run alert checker");
        const {
            AlertStack, AlarmHistory, TelegramUser, TelegramPersonalUser,
            Rtu, Regional, Witel, Location, PicLocation, AlertMessageError
        } = useModel(sequelize);

        const alerts = await this.getAlertStack({ logger, sequelize });
        if(alerts.length < 1) {
            logger.info("alerts is empty");
            closeChecker();
            return;
        }

        const alertIds = alerts.map(alert => alert.alertStackId);
        logger.info("setup alert stack", { alertsCount: alertIds.length, alertIds });
        
        const alertsGroupDatas = this.groupAlerts(alerts, config.telegramAlerting.maximumThread, { logger });
        await this.setAlertAsSending(alertIds, { logger, sequelize });

        const jobs = [];
        alertIds.forEach(alertId => jobs.push({ id: alertId, done: false, success: null }));

        const onAlertDone = () => {
            const all = { count: jobs.length, jobIds: [] };
            const done = { count: 0, jobIds: [] };
            const success = { count: 0, jobIds: [] };
            for(let i=0; i<jobs.length; i++) {
                all.jobIds.push(jobs[i].id);
                if(jobs[i].done) {
                    done.jobIds.push(jobs[i].id);
                    done.count++;
                }
                if(jobs[i].success) {
                    success.jobIds.push(jobs[i].id);
                    success.count++;
                }
            }

            logger.info("alert job is done", { all, done, success });
            if(done.count == all.count) {
                closeChecker();
            }
        };

        const workerPath = path.resolve(__dirname, "./workers/worker-telegram-alert.js");
        alertsGroupDatas.forEach(alertGroup => {

            const workerAlert = new Worker(workerPath, {
                workerData: {
                    loggerConfig: {
                        threadId: logger.getThreadId(),
                        options: logger.getOptions()
                    },
                    alertGroup
                }
            });

            workerAlert.on("message", async (workerData) => {
                const { success, alertStackId, unsendedAlertIds, telegramErr, retryTime, chatId } = workerData;
                if(success) {

                    await this.onAlertSended(alertStackId, { logger, sequelize });
                    const index = jobs.findIndex(item => item.id == alertStackId);
                    jobs[index].success = true;
                    jobs[index].done = true;
                    onAlertDone();
                    return;

                }
                
                if(telegramErr) {

                    if(retryTime)
                        addDelay(watcher, retryTime);
                    await this.onAlertUnsended(unsendedAlertIds, telegramErr, chatId, { logger, sequelize });
                    unsendedAlertIds.forEach(alertId => {
                        const index = jobs.findIndex(item => item.id == alertId);
                        jobs[index].success = false;
                        jobs[index].done = true;
                    });
                    onAlertDone();
                    return;

                }

                logger.info("error gotted in workerAlert.onMessage handler", { workerData });
                throw new Error("error gotted in workerAlert");
            });

            workerAlert.on("error", err => {
                throw err;
            });

        });

    });
};

module.exports.watchAlertStack = () => {
    const errLogger = new ErrorLogger("alertwatcher", "Cron watch-alert");
    watch(async (watcher) => {
        try {
            await this.sendAlert({ watcher });
        } catch(err) {
            await errLogger.catch(err).logTo("-4092116808");
            throw err;
        }
    }, {
        onError: err => console.error(err)
    });
};