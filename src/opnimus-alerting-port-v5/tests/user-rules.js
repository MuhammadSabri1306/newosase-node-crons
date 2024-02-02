const dbOpnimusNewConfig = require("../../env/database/opnimus-new-migrated-2");
const { useSequelize, useModel, toUnderscoredPlain } = require("../apps/models");
const { Op } = require("sequelize");
const { isRuleMatch } = require("../apps/alert-mode");
const { Logger } = require("../apps/logger");

const writeAlertStack = async (witel, alarmIds, alarmHistoryIds, app = {}) => {
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
                console.log({
                    isUserMatch,
                    userRules: user.alertUser.alertMode.rules,
                    alarm: toUnderscoredPlain(alarm)
                });
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

        // await AlertStack.bulkCreate(alertStackDatas);
        // logger.info("writing alert stack was done", { jobId, alertStackCount: alertStackDatas.length });

    } catch(err) {
        logger.info("failed to write alert stack", { jobId, alarmIds });
        logger.error(err);
    }
};

const main = async () => {

    const sequelize = useSequelize(dbOpnimusNewConfig);
    const witelId = 254;
    const alarmIds = [1613, 876, 880];
    const alarmHistoryIds = [17610, 17608, 17609];

    const { Witel } = useModel(sequelize);
    const witel = await Witel.findOne({
        where: { id: witelId }
    });

    await writeAlertStack(witel, alarmIds, alarmHistoryIds, { sequelize });

    await sequelize.close();

};

main();