const dbOpnimusNewConfig = require("../../env/database/opnimus-new-migrated-2");
const path = require("path");
const { useSequelize, useModel } = require("./models");
const { Op } = require("sequelize");
const { Logger } = require("./logger");
const { watch, addDelay } = require("./watcher");
const EventEmitter = require("events");
const { Worker } = require("worker_threads");

module.exports.createSequelize = (pool = null) => {
    const sequelizeLogger = Logger.createWinstonLogger({
        fileName: "sequelize",
        useStream: true,
    });

    const sequelizeOptions = {
        // ...dbOpnimusNewConfig,
        host: "localhost",
        database: dbOpnimusNewConfig.database,
        user: "root",
        password: "",
        options: {
            logging: (msg) => {
                const database = dbOpnimusNewConfig.database;
                sequelizeLogger.info(`(sequelize:${ database }) ${ msg }`);
            }
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
        return [];
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

        works.push(async () => {
            logger.info("write changed alarms to AlarmHistory model", { jobId, alarmIds });
            return AlarmHistory.bulkCreate(newHistoryDatas);
        });

        await Promise.all( works.map(work => work()) );
        return alarmIds;

    } catch(err) {
        logger.error(err);
        return [];
    }
};

module.exports.updateOrCreateAlarms = async (newAlarms, app = {}) => {
    let { logger, jobId, sequelize } = app;
    logger = Logger.getOrCreate(logger);
    
    if(newAlarms.length < 1) {
        logger.info("newAlarms is empty", { jobId });
        return [];
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
                    await AlarmHistory.create({
                        alarmId: existsAlarm.alarmId, alarmType, portId, portNo, portName, portValue, portUnit,
                        portSeverity, portDescription, portIdentifier, portMetrics, rtuId, rtuSname, rtuStatus,
                        alertStartTime: alertStartTime || null, openedAt: new Date()
                    });

                    return existsAlarm.alarmId;

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
                    await AlarmHistory.create({
                        alarmId: insertedAlarm.alarmId, alarmType, portId, portNo, portName, portValue, portUnit,
                        portSeverity, portDescription, portIdentifier, portMetrics, rtuId, rtuSname, rtuStatus,
                        alertStartTime: alertStartTime || null, openedAt: new Date()
                    });

                    return insertedAlarm.alarmId;

                });
            }

        });

        const alarmIds = await Promise.all( works.map(work => work()) );
        return alarmIds;

    } catch(err) {
        logger.error(err);
        return [];
    }
};

module.exports.writeAlertStack = async (witel, alarmIds, app = {}) => {
    let { logger, jobId, sequelize } = app;
    logger = Logger.getOrCreate(logger);

    if(alarmIds.length < 1) {
        logger.info("no alarms to write as alerts", { jobId });
        return;
    }

    try {

        const works = {};
        const { AlarmHistory, TelegramUser, AlertUsers, Rtu, PicLocation, AlertStack } = useModel(sequelize);

        works.getAlarms = () => {
            logger.info("get alarms to write as alert", { jobId, alarmIds });
            return AlarmHistory.findAll({
                where: {
                    alarmId: { [Op.in]: [1, 2, 3] }
                },
                include: [{
                    model: Rtu,
                    required: true
                }]
            });
        };

        works.getGroupUsers = () => {
            logger.info("get telegram groups of alarms", { jobId, alarmIds });
            return TelegramUser.findAll({
                where: {
                    [Op.and]: [
                        { isPic: false },
                        {
                            [Op.or]: [
                                { level: "nasional" },
                                { level: "regional", regionalId: 2 },
                                { level: "witel", witelId: 43 },
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
                    }
                }]
            });
        };

        works.getPicUsers = () => {
            logger.info("get telegram user of alarm pics", { jobId, alarmIds });
            return TelegramUser.findAll({
                where: {
                    [Op.and]: [
                        { isPic: true },
                        {
                            [Op.or]: [
                                { level: "nasional" },
                                { level: "regional", regionalId: 2 },
                                { level: "witel", witelId: 43 },
                            ]
                        }
                    ]
                },
                order: [ "picRegistId" ],
                include: [{
                    model: AlertUsers,
                    required: true,
                    where: {
                        [Op.and]: [
                            { cronAlertStatus: true },
                            { userAlertStatus: true }
                        ]
                    }
                }, {
                    model: PicLocation,
                    required: true
                }]
            });
        };

        const [ alarms, groupUsers, picUsers ] = await Promise.all([
            works.getAlarms(),
            works.getGroupUsers(),
            works.getPicUsers()
        ]);
        
        const alertStackDatas = [];
        alarms.forEach(alarm => {

            picUsers.forEach(user => {
                user.picLocations.forEach(loc => {
                    if(loc.locationId == alarm.rtu.locationId) {
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
                    }
                })
            });

            groupUsers.forEach(user => {
                let isMatch = false;
                if(user.level == "nasional")
                    isMatch = true;
                else if(user.level == "regional" && user.regionalId == alarm.rtu.regionalId)
                    isMatch = true;
                else if(user.level == "witel" && user.witelId == alarm.rtu.witelId)
                    isMatch = true;
                if(isMatch) {
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
                }
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
        witels.forEach(witel => {
            const job = this.createWitelThread(witel);

            job.onStart(async ({ jobId, closedAlarms, changedAlarms, newAlarms }) => {
                try {

                    const [ ca, alarmIds1, alarmIds2 ] = await Promise.all([
                        this.closeAlarms(closedAlarms, { logger, jobId, sequelize }),
                        this.updateAlarms(changedAlarms, { logger, jobId, sequelize }),
                        this.updateOrCreateAlarms(newAlarms, { logger, jobId, sequelize })
                    ]);

                    job.alarmWrite({ alarmIds: [ ...alarmIds1, ...alarmIds2 ] });

                } catch(err) {
                    job.error(err);
                }
            });

            job.onAlarmWrite(async ({ jobId, alarmIds }) => {
                try {

                    await this.writeAlertStack(witel, alarmIds, { logger, jobId, sequelize });
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
                    logger.info("witel's job is closed", { jobId: job.id });
                    job.running = false;
                    job.done = true;
                    const hasUnfinishedJobs = jobs.findIndex(item => !item.done) >= 0;
                    if(!hasUnfinishedJobs)
                        closeSync();
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
    watch(async (watcher) => {
        await this.syncAlarms(witels, { watcher });
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

    // const leftCount = chatIdGroups.length - groups.length;
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

    const {
        AlertStack, AlarmHistory, TelegramUser, TelegramPersonalUser,
        Rtu, Regional, Witel, Location, PicLocation
    } = useModel(sequelize);

    const startDate = new Date();
    startDate.setHours(startDate.getHours() - 6);

    const alerts = await AlertStack.findAll({
        where: {
            status: "unsended",
            // createdAt: { [Op.gte]: startDate }
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

    if(alerts.length < 1) {
        logger.info("alerts is empty");
        return [];
    }

    const alertIds = alerts.map(alert => alert.alertStackId);
    logger.info("update alert status as sending", { alertIds });
    await AlertStack.update({ status: "sending" }, {
        where: {
            alertStackId: { [Op.in]: alertIds }
        }
    });

    return alerts;
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

        const startDate = new Date();
        startDate.setHours(startDate.getHours() - 6);

        const alerts = await this.getAlertStack({ logger, sequelize });
        if(alerts.length < 1) {
            closeChecker();
            return;
        }
        
        const alertsGroupDatas = this.groupAlerts(alerts, config.telegramAlerting.maximumThread, { logger });
        const workerAlertingPath = path.resolve(__dirname, "./workers/worker-telegram-alert.js");
        const jobs = [];

        alertsGroupDatas.forEach((alertGroup, index) => {

            jobs.push(false);
            const workerAlerting = new Worker(workerAlertingPath, {
                workerData: {
                    loggerConfig: {
                        threadId: logger.getThreadId(),
                        options: logger.getOptions()
                    },
                    groupIndex: index,
                    alertGroup
                }
            });
        
            workerAlerting.on("message", async (workerData) => {

                const { groupIndex, success, alertStackId, unsendedAlertIds, chatId, telegramErr, retryTime } = workerData;

                if(groupIndex) {
                    jobs[groupIndex] = true;
                    if(jobs.findIndex(isJobFinish => !isJobFinish) < 0) {
                        closeChecker();
                        return;
                    }
                }

                if(success) {
                    logger.info("update alert status as success", { alertStackId });
                    await AlertStack.update({ status: "success" }, {
                        where: { alertStackId }
                    });
                    return;
                }

                if(unsendedAlertIds && unsendedAlertIds.length > 0) {
                    logger.info("changing back unsended alert", { unsendedAlertIds });
                    await AlertStack.update({ status: "unsended" }, {
                        where: {
                            alertStackId: { [Op.in]: unsendedAlertIds }
                        }
                    });
                }

                if(!telegramErr) {
                    logger.info("error catched from worker-telegram-alert", { workerData });
                    throw new Error(`error catched from worker-telegram-alert`);
                    closeChecker();
                    return;
                }

                if(retryTime) addDelay(watcher, retryTime);
                await AlertMessageError.create(telegramErr);
                // tambahkan pengecekan chatId tidak valid

            });
        
            workerAlerting.on("error", err => {
                throw err;
            });

        });

    });
};

module.exports.watchAlertStack = () => {
    watch(async (watcher) => {
        await this.sendAlert({ watcher });
    }, {
        onError: err => console.error(err)
    });
};