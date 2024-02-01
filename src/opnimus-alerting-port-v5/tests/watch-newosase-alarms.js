const dbOpnimusNewConfig = require("../../env/database/opnimus-new-migrated-2");
const { useSequelize, useModel } = require("../apps/models");
const { Op } = require("sequelize");
const { Logger } = require("../apps/logger");
const { createSequelize, getAlarmsOfWitels, getWitelThreadInfo, createWitelThread } = require("../apps");
const path = require("path");
const { watch, addDelay } = require("../apps/watcher");
const { Worker } = require("worker_threads");

const testAlertStack = async (witel, alarmIds, alarmHistoryIds, app = {}) => {
    let { logger, jobId, sequelize } = app;
    logger = Logger.getOrCreate(logger);

    if(alarmIds.length < 1) {
        logger.info("no alarms to write as alerts", { jobId });
        return;
    }

    try {

        
        const works = {};
        const { AlarmHistory, TelegramUser, AlertUsers, Rtu, PicLocation, AlertStack } = useModel(sequelize);

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
                    }
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
                    }
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

const main = async () => {

    const sequelize = createSequelize();
    const { Witel } = useModel(sequelize);
    const witel = await Witel.findOne({
        where: { id: 23 }
    });

    await testAlertStack(witel, [ 303 ], [ 341 ], { sequelize });
    sequelize.close();

};

main();