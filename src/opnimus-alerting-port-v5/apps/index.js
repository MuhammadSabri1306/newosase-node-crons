const EventEmitter = require("events");
const { Worker, workerData } = require("worker_threads");
const path = require("path");
const { Op } = require("sequelize");
const { useSequelize, useModel, toUnderscoredPlain } = require("./models");
const { Logger } = require("./logger");
const { watch, addDelay } = require("./watcher");
const defineAlarm = require("./define-alarm");
const telegramAlert = require("./telegram-alert");
const { ErrorLogger } = require("./err-bot-logger");
const { toDatetimeString } = require("../../helpers/date");
const dbOpnimusNewConfig = require("../../env/database/opnimus-new-migrated-2");

module.exports.createSequelize = (pool = null) => {
    const sequelizeLogger = Logger.createWinstonLogger({
        fileName: "sequelize",
        useStream: true,
        dirName: path.resolve(__dirname, "../logs")
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
        finish(data = {}) {
            const jobId = this.id;
            this.events.emit("finish", { ...data, jobId });
        },
        onStart(callback) {
            this.events.addListener("start", callback);
        },
        onFinish(callback) {
            this.events.addListener("finish", callback);
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

module.exports.getAlarmsOfWitels = defineAlarm.getAlarmsOfWitels;
module.exports.getRtuAlarmsOfWitels = defineAlarm.getRtuAlarmsOfWitels;
module.exports.getNotifiedClosedPortAlarms = defineAlarm.getNotifiedClosedPortAlarms;
module.exports.closeAlarms = defineAlarm.closeAlarms;
module.exports.updateAlarms = defineAlarm.updateAlarms;
module.exports.updateOrCreateAlarms = defineAlarm.updateOrCreateAlarms;
module.exports.closeRtuAlarms = defineAlarm.closeRtuAlarms;
module.exports.createRtuAlarms = defineAlarm.createRtuAlarms;
module.exports.writeAlertStack = defineAlarm.writeAlertStack;
module.exports.writeAlertStackRtuDown = defineAlarm.writeAlertStackRtuDown;

module.exports.syncAlarms = (witels, app = {}) => {
    const { watcher } = app;
    if(watcher)
        addDelay(watcher, 10000);
    const config = require("./config.json");

    return new Promise(async (resolve) => {

        // const maxDbPool = Math.round(config.newosaseWatcher.maximumDbPool / config.newosaseWatcher.maximumThread);
        // const sequelize = this.createSequelize({ max: maxDbPool });
        const sequelize = this.createSequelize({ max: config.newosaseWatcher.maximumDbPool });

        const logger = Logger.create({
            useStream: true,
            fileName: "newosase-watcher",
            dirName: path.resolve(__dirname, "../logs")
        });

        const witelIds = witels.map(witel => witel.id);
        logger.info("run alarms synchroniztion of witels", { witelIds });
        const [ witelsAlarmDatas, witelsRtuAlarmDatas ] = await Promise.all([
            this.getAlarmsOfWitels(witelIds, { sequelize, logger }),
            this.getRtuAlarmsOfWitels(witelIds, { sequelize, logger })
        ]);

        const closeSync = async () => {

            // await sequelize.close();
            logger.info("close alarms synchroniztion of witels", { witelIds });
            resolve();

        };
    
        const jobs = [];
        witels.forEach(witel => {
            const job = this.createWitelThread(witel);

            job.onStart(async ({ jobId, ...jobResult }) => {
                try {

                    const { closedAlarms, changedAlarms, newAlarms, closedRtuAlarms, newRtuAlarms } = jobResult;

                    const [ cp, closePortAlarms, openPortAlarms1, openPortAlarms2 ] = await Promise.all([
                        this.closeAlarms(closedAlarms, { logger, jobId, sequelize }),
                        this.getNotifiedClosedPortAlarms(closedAlarms, { logger, jobId, sequelize }),
                        this.updateAlarms(changedAlarms, { logger, jobId, sequelize }),
                        this.updateOrCreateAlarms(newAlarms, { logger, jobId, sequelize }),
                        this.closeRtuAlarms(closedRtuAlarms, { logger, jobId, sequelize }),
                        this.createRtuAlarms(newRtuAlarms, { logger, jobId, sequelize }),
                    ]);

                    logger.info("alarms has been written", { openPortAlarms1, openPortAlarms2 });

                    const openPortAlarmIds = [ ...openPortAlarms1.alarmIds, ...openPortAlarms2.alarmIds ];
                    const openPortAlarmHistoryIds = [ ...openPortAlarms1.alarmHistoryIds, ...openPortAlarms2.alarmHistoryIds ];

                    await Promise.all([
                        this.writeAlertStack(witel, openPortAlarmIds, openPortAlarmHistoryIds, "open-port", { logger, sequelize, jobId }),
                        this.writeAlertStack(witel, closePortAlarms.alarmIds, closePortAlarms.alarmHistoryIds, "close-port", { logger, sequelize, jobId }),
                        this.writeAlertStackRtuDown(witel, { logger, sequelize, jobId })
                    ]);

                } catch(err) {
                    logger.info("witel's job got error", { jobId });
                    logger.error(err);
                } finally {
                    job.finish();
                }
            });
    
            job.onFinish(({ jobId }) => {
                try {

                    job.running = false;
                    job.done = true;
                    const { all, running, done } = this.getWitelThreadInfo(jobs);
                    logger.info("witel's job is closed", {
                        jobId, runningJob: running, doneJob: done, allJob: all,
                    });

                    if(done.count === all.count)
                        closeSync();

                } catch(err) {
                    logger.info("witel's job got error", { jobId });
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
            witelsAlarmDatas,
            witelsRtuAlarmDatas
        };
    
        const workerDefineAlarm = new Worker(
            workerDefineAlarmPath,
            { workerData: workerDefineAlarmData }
        );
    
        workerDefineAlarm.on("message", workerData => {
            const { jobId, closedAlarms, changedAlarms, newAlarms, closedRtuAlarms, newRtuAlarms } = workerData;
            const index = jobs.findIndex(job => job.id == jobId);
            jobs[index].start({ closedAlarms, changedAlarms, newAlarms, closedRtuAlarms, newRtuAlarms });
        });
    
        workerDefineAlarm.on("error", err => {
            throw err;
        });

    });
};

module.exports.watchNewosaseAlarmWitels = (witels) => {
    const errLogger = new ErrorLogger("alarmwatcher", "NODE CRON watch-newosase-alarm");
    watch(async (watcher) => {
        await this.syncAlarms(witels, { watcher });
    }, {
        onError: async (err, continueLoop) => {
            console.error(err);
            console.info("sending error log");
            await errLogger.catch(err).logTo("-4092116808");
            console.info("continue loop");
            continueLoop();
        }
    });
};

module.exports.isTelegramErrorUserNotFound = telegramAlert.isTelegramErrorUserNotFound;
module.exports.getTelgAlertStack = telegramAlert.getTelgAlertStack;
module.exports.groupAlertStacks = telegramAlert.groupAlertStacks;
module.exports.setTelgAlertAsSending = telegramAlert.setTelgAlertAsSending;
module.exports.onTelgAlertSended = telegramAlert.onTelgAlertSended;
module.exports.onTelgAlertUnsended = telegramAlert.onTelgAlertUnsended;
module.exports.onTelgSendError = telegramAlert.onTelgSendError;

module.exports.sendTelegramAlert = (app = {}) => {
    const { watcher } = app;
    if(watcher)
        addDelay(watcher, 10000);
    const config = require("./config.json");
    return new Promise(async (resolve) => {

        const sequelize = this.createSequelize({ max: config.telegramAlerting.maximumDbPool });
        const logger = Logger.create({
            useStream: true,
            fileName: "telegram-alerting",
            dirName: path.resolve(__dirname, "../logs")
        });
        
        const closeChecker = async () => {
            logger.info("alert checker was closed");
            // await sequelize.close();
            resolve();
        };

        logger.info("run alert checker");
        const { portAlerts, rtuAlerts } = await this.getTelgAlertStack({ logger, sequelize });
        const totalAlertsCount = portAlerts.length + rtuAlerts.length;
        if(totalAlertsCount < 1) {
            logger.info("no alerts to send");
            closeChecker();
            return;
        }

        const alertsGroupDatas = this.groupAlertStacks(portAlerts, rtuAlerts, config.telegramAlerting.maximumThread, { logger });
        
        const portAlertIds = portAlerts.map(alert => alert.alertStackId);
        const rtuAlertIds = rtuAlerts.map(alert => alert.alertStackRtuId);
        await this.setTelgAlertAsSending(portAlertIds, rtuAlertIds, { logger, sequelize });
        logger.info("alert stack was setuped", { alertsCount: totalAlertsCount, portAlertIds, rtuAlertIds });

        const jobs = [];
        portAlertIds.forEach(alertId => jobs.push({ id: `port-${ alertId }`, done: false, success: false }));
        rtuAlertIds.forEach(alertId => jobs.push({ id: `rtu-${ alertId }`, done: false, success: false }));
        logger.info("job was setuped", { jobIds: jobs.map(item => item.id) });

        const getJobSummary = () => {
            const all = { count: jobs.length, jobIds: [] };
            const done = { count: 0, jobIds: [] };
            const success = { count: 0, jobIds: [] };
            const fail = { count: 0, jobIds: [] };
            for(let i=0; i<jobs.length; i++) {
                all.jobIds.push(jobs[i].id);
                if(jobs[i].done) {
                    done.jobIds.push(jobs[i].id);
                    done.count++;
                }
                if(jobs[i].success) {
                    success.jobIds.push(jobs[i].id);
                    success.count++;
                } else {
                    fail.jobIds.push(jobs[i].id);
                    fail.count++;
                }
            }
            return { all, done, success, fail };
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
                const { success, alert, chatId, telegramErr, retryTime } = workerData;

                let currJobId = null;
                if(alert.alertStackId !== undefined)
                    currJobId = `port-${ alert.alertStackId }`;
                if(alert.alertStackRtuId !== undefined)
                    currJobId = `rtu-${ alert.alertStackRtuId }`;

                if(success) {

                    await this.onTelgAlertSended(alert, { logger, sequelize });
                    try {
                        const index = jobs.findIndex(item => item.id == currJobId);
                        jobs[index].success = true;
                        jobs[index].done = true;
                    } catch(err) {
                        logger.info("error when updating job status as success", { jobId: currJobId, alert });
                        logger.error(err);
                        throw err;
                    }

                } else {

                    const unsendedPortAlertIds = [];
                    const unsendedRtuAlertIds = [];
                    for(let i=0; i<jobs.length; i++) {
                        if(!jobs[i].success) {
                            jobs[i].done = true;
                            let [jobType, alertId] = jobs[i].id.split("-");

                            if(jobType == "port")
                                unsendedPortAlertIds.push(alertId);
                            if(jobType == "rtu")
                                unsendedRtuAlertIds.push(alertId);
                        }
                    }

                    const errorHandlers = [];

                    errorHandlers.push(() => {
                        return this.onTelgAlertUnsended(
                            unsendedPortAlertIds,
                            unsendedRtuAlertIds,
                            { logger, sequelize }
                        );
                    });

                    if(telegramErr) {
                        if(retryTime)
                            addDelay(watcher, retryTime);
                        errorHandlers.push(() => this.onTelgSendError(telegramErr, chatId, { logger, sequelize }));
                    }

                    await Promise.all( errorHandlers.map(handle => handle()) );

                }

                const jobSummary = getJobSummary();
                logger.info("alert job is done", { jobId: currJobId, summary: jobSummary });

                if(!success && !telegramErr) {
                    logger.info("error thrown in workerAlert.onMessage handler", { workerData });
                    throw new Error("error thrown in workerAlert");
                }

                if(jobSummary.done.count == jobSummary.all.count)
                    closeChecker();

            });

            workerAlert.on("error", err => {
                logger.info("error thrown inside workerAlert");
                logger.error(err);
                throw err;
            });

        });

    });
};

module.exports.watchAlertStack = () => {
    const errLogger = new ErrorLogger("alertwatcher", "NODE CRON watch-alert");
    watch(async (watcher) => {
        await this.sendTelegramAlert({ watcher });
    }, {
        onError: async (err, continueLoop) => {
            console.error(err);
            console.info("sending error log");
            await errLogger.catch(err).logTo("-4092116808");
            console.info("continue loop");
            continueLoop();
        }
    });
};