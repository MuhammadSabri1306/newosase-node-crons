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
module.exports.writeAlertStackOpenPort = defineAlarm.writeAlertStackOpenPort;
module.exports.writeAlertStackClosePort = defineAlarm.writeAlertStackClosePort;
module.exports.writeAlertStackRtuDown = defineAlarm.writeAlertStackRtuDown;

module.exports.syncAlarms = (witels, app = {}) => {
    const { watcher, config } = app;
    if(watcher)
        addDelay(watcher, 10000);

    return new Promise(async (resolve, reject) => {

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

                    const [ cp, openPortAlarms1, openPortAlarms2 ] = await Promise.all([
                        this.closeAlarms(closedAlarms, { logger, jobId, sequelize }),
                        this.updateAlarms(changedAlarms, { logger, jobId, sequelize }),
                        this.updateOrCreateAlarms(newAlarms, { logger, jobId, sequelize }),
                        this.closeRtuAlarms(closedRtuAlarms, { logger, jobId, sequelize }),
                        this.createRtuAlarms(newRtuAlarms, { logger, jobId, sequelize }),
                    ]);

                    logger.info("alarms has been written", { openPortAlarms1, openPortAlarms2 });

                    const openPortAlarmIds = [ ...openPortAlarms1.alarmIds, ...openPortAlarms2.alarmIds ];
                    const openPortAlarmHistoryIds = [ ...openPortAlarms1.alarmHistoryIds, ...openPortAlarms2.alarmHistoryIds ];

                    await Promise.all([
                        this.writeAlertStackOpenPort(witel, openPortAlarmIds, openPortAlarmHistoryIds, { logger, jobId, sequelize }),
                        this.writeAlertStackClosePort(witel, closedAlarms, { logger, jobId, sequelize }),
                        this.writeAlertStackRtuDown(witel, { logger, jobId, sequelize })
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

            logger.info("error thrown inside workerDefineAlarm");
            logger.error(err);

            logger.info("add delay 60s then do rejection");
            addDelay(watcher, 60000);
            reject(err);

        });

    });
};

module.exports.watchNewosaseAlarmWitels = (witels) => {
    const config = require("./config.json");
    watch(
        async (watcher) => {
            await this.syncAlarms(witels, { watcher, config });
        }, {
            onError: async (err, continueLoop) => {
                console.error(err);
                continueLoop();
            }
        }
    );
};

module.exports.isTelegramErrorUserNotFound = telegramAlert.isTelegramErrorUserNotFound;
module.exports.getTelgAlertStack = telegramAlert.getTelgAlertStack;
module.exports.groupAlertStacks = telegramAlert.groupAlertStacks;
module.exports.setTelgAlertAsSending = telegramAlert.setTelgAlertAsSending;
module.exports.onTelgAlertSended = telegramAlert.onTelgAlertSended;
module.exports.onTelgAlertUnsended = telegramAlert.onTelgAlertUnsended;
module.exports.writeTelgMsgErr = telegramAlert.writeTelgMsgErr;
module.exports.writeTelgAlertException = telegramAlert.writeTelgAlertException;

module.exports.sendTelegramAlert = (app = {}) => {
    const { watcher, config } = app;
    const sequelize = this.createSequelize({ max: config.telegramAlerting.maximumDbPool });
    const logger = Logger.create({
        useStream: true,
        fileName: "telegram-alerting",
        dirName: path.resolve(__dirname, "../logs")
    });

    return new Promise(async (resolve) => {

        const closeChecker = async () => {
            logger.info("alert checker was closed");
            await sequelize.close();
            if(watcher)
                addDelay(watcher, 5000);
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

        const getJobIdByAlert = alert => {
            let jobId = null;
            if(alert.alertStackId !== undefined)
                jobId = `port-${ alert.alertStackId }`;
            else if(alert.alertStackRtuId !== undefined)
                jobId = `rtu-${ alert.alertStackRtuId }`;
            return jobId;
        };

        const getJobIndexByJobId = jobId => {
            return jobs.findIndex(item => item.id == jobId);
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
                const { success, alert, unsendedAlerts, telegramMessageError, telegramAlertException } = workerData;
                const isTelegramError = telegramMessageError || telegramAlertException ? true : false;

                if(success) {

                    await this.onTelgAlertSended(alert, { logger, sequelize });
                    let currJobId = null;
                    let currJobIndex = null;
                    try {
                        currJobId = getJobIdByAlert(alert);
                        currJobIndex = getJobIndexByJobId(currJobId);
                        jobs[currJobIndex].done = true;
                        jobs[currJobIndex].success = true;
                    } catch(err) {
                        logger.info("error when updating job status as success", { jobId: currJobId, jobIndex: currJobIndex, alert });
                        logger.error(err);
                        throw err;
                    }

                } else {

                    const unsendedJobIds = [];
                    const unsendedPortAlertIds = [];
                    const unsendedRtuAlertIds = [];
                    unsendedAlerts.port.forEach(alertId => {
                        unsendedJobIds.push(`port-${ alertId }`);
                        unsendedPortAlertIds.push(alertId);
                    });
                    unsendedAlerts.rtu.forEach(alertId => {
                        unsendedJobIds.push(`rtu-${ alertId }`);
                        unsendedRtuAlertIds.push(alertId);
                    });

                    for(let i=0; i<unsendedJobIds.length; i++) {
                        let jobIndex = null;
                        try {
                            jobIndex = getJobIndexByJobId(unsendedJobIds[i]);
                            jobs[jobIndex].done = true;
                        } catch(err) {
                            logger.info("error when updating job status as done", { jobId: unsendedJobIds[i], jobIndex, alert });
                            logger.error(err);
                            throw err;
                        }
                    }
                    
                    await this.onTelgAlertUnsended(unsendedPortAlertIds, unsendedRtuAlertIds, { logger, sequelize });

                    if(isTelegramError) {
                        if(telegramMessageError) {
                            await this.writeTelgMsgErr(telegramMessageError, { logger, sequelize });
                        }

                        if(telegramAlertException) {
                            this.writeTelgAlertException(telegramAlertException, { logger, sequelize });
                        }
                    }

                }

                const jobSummary = getJobSummary();
                if(alert) {
                    logger.info("alert job is done", { jobId: getJobIdByAlert(alert), summary: jobSummary });
                } else {
                    logger.info("alert job is done", { summary: jobSummary });
                }

                if(!success && !isTelegramError) {
                    logger.info("error thrown in workerAlert.onMessage handler", { workerData });
                    throw new Error("error thrown in workerAlert");
                }

                if(jobSummary.done.count == jobSummary.all.count)
                    closeChecker();

            });

            workerAlert.on("error", async (err) => {

                logger.info("error thrown inside workerAlert");
                logger.error(err);

                logger.info("close database connection");
                await sequelize.close();

                logger.info("add delay 60s then do rejection");
                addDelay(watcher, 60000);
                reject(err);

            });

        });

    });
};

module.exports.watchAlertStack = () => {
    const config = require("./config.json");
    watch(
        async (watcher) => {
            await this.sendTelegramAlert({ watcher, config });
        }, {
            onError: async (err, continueLoop) => {
                console.error(err);
                continueLoop();
            }
        }
    );
};