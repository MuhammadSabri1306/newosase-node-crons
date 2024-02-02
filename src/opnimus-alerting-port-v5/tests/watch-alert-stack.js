const dbOpnimusNewConfig = require("../../env/database/opnimus-new-migrated-2");
const { useSequelize, useModel } = require("../apps/models");
const { Op } = require("sequelize");
const { Logger } = require("../apps/logger");
const { watch, addDelay } = require("../apps/watcher");
const path = require("path");
const { Worker } = require("worker_threads");
const { createSequelize, groupAlerts } = require("../apps");

const getAlertStack = async (app = {}) => {
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

    return alerts;
};

const sendAlert = (app = {}) => {
    const { watcher } = app;
    if(watcher)
        addDelay(watcher, 10000);
    const config = require("../apps/config.json");
    return new Promise(async (resolve) => {

        const sequelize = createSequelize({ max: config.telegramAlerting.maximumDbPool });
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

        const alerts = await getAlertStack({ logger, sequelize });
        if(alerts.length < 1) {
            closeChecker();
            return;
        }
        
        const alertsGroupDatas = groupAlerts(alerts, config.telegramAlerting.maximumThread, { logger });
        const workerAlertingPath = path.resolve(__dirname, "./worker-telegram-alert.js");
        console.log(workerAlertingPath)
        // const jobs = [];

        // alertsGroupDatas.forEach((alertGroup, index) => {

        //     jobs.push(false);
        //     const workerAlerting = new Worker(workerAlertingPath, {
        //         workerData: {
        //             loggerConfig: {
        //                 threadId: logger.getThreadId(),
        //                 options: logger.getOptions()
        //             },
        //             groupIndex: index,
        //             alertGroup
        //         }
        //     });
        
        //     workerAlerting.on("message", async (workerData) => {

        //         const {
        //             groupIndex, success, alertStackId, unsendedAlertIds,
        //             chatId, telegramErr, retryTime
        //         } = workerData;

        //         if(groupIndex) {
        //             jobs[groupIndex] = true;
        //             if(jobs.findIndex(isJobFinish => !isJobFinish) < 0) {
        //                 closeChecker();
        //                 return;
        //             }
        //         }

        //         if(success) {
        //             logger.info("update alert status as success", { alertStackId });
        //             await AlertStack.update({ status: "success" }, {
        //                 where: { alertStackId }
        //             });
        //             return;
        //         }

        //         if(unsendedAlertIds && unsendedAlertIds.length > 0) {
        //             logger.info("changing back unsended alert", { unsendedAlertIds });
        //             await AlertStack.update({ status: "unsended" }, {
        //                 where: {
        //                     alertStackId: { [Op.in]: unsendedAlertIds }
        //                 }
        //             });
        //         }

        //         if(telegramErr) {
        //             if(retryTime) addDelay(watcher, retryTime);
        //             await AlertMessageError.create(telegramErr);
        //             // tambahkan pengecekan chatId tidak valid
        //         }

        //     });
        
        //     workerAlerting.on("error", err => {
        //         throw err;
        //     });

        // });

    });
};

sendAlert();