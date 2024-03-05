const dbOpnimusNewConfig = require("../../env/database/opnimus-new-migrated-2");
const { Op } = require("sequelize");
const { Telegraf } = require("telegraf");
const { useSequelize, useModel } = require("../apps/models");
const { useTelegramBot, sendTelgAlerts, createAlertMessage } = require("../apps/telegram-alert");
const { Logger } = require("../apps/logger");
const configBot = require("../../env/bot/opnimus-new-bot");

const testCase1 = async () => {

    const sequelize = useSequelize({
        ...dbOpnimusNewConfig,
        options: {
            logging: false,
            timezone: "+07:00"
        }
    });

    const {
        AlertStack, AlarmHistory, TelegramUser, TelegramPersonalUser,
        Rtu, Regional, Witel, Location, PicLocation
    } = useModel(sequelize);

    const chatId = "1931357638";
    const alarmHistoryId = 816952;

    const alarmHistory = await AlarmHistory.findOne({
        where: { alarmHistoryId },
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
    });
    await sequelize.close();

    const alarmHistoryData = alarmHistory.get({ plain: true });
    const messageText = createAlertMessage({ alarmHistory: alarmHistoryData });
    
    const bot = new Telegraf(configBot.token);
    await bot.telegram.sendMessage(chatId, messageText, { parse_mode: "Markdown" });

};

const testCase2 = async () => {

    const sequelize = useSequelize({
        ...dbOpnimusNewConfig,
        options: {
            logging: false,
            timezone: "+07:00"
        }
    });

    const { Alarm, AlarmHistory } = useModel(sequelize);
    const alarmIds = [ 1604, 3507 ];

    const alarmHistories = await AlarmHistory.findAll({
        attributes: [
            "alarmId",
            [sequelize.literal("MAX(alarm_history_id)"), "alarmHistoryId"]
        ],
        where: { alarmId: alarmIds },
        group: "alarmId"
    });

    const result = alarmHistories.map(item => ({ alarmId: item.alarmId, alarmHistoryId: item.alarmHistoryId }));
    console.log(result);

    await Promise.all(alarmIds.map(async (alarmId) => {
        const alarmHistory = await AlarmHistory.findOne({
            where: { alarmId },
            order: [
                [ "alarmHistoryId", "DESC" ]
            ],
            limit: 1
        });
        console.log({ alarmId: alarmHistory.alarmId, alarmHistoryId: alarmHistory.alarmHistoryId });
    }));

    await sequelize.close();

};


const testCase3 = async () => {

    const sequelize = useSequelize({
        ...dbOpnimusNewConfig,
        options: {
            logging: false,
            timezone: "+07:00"
        }
    });

    const {
        AlertStack, AlarmHistory, TelegramUser, TelegramPersonalUser,
        Rtu, Regional, Witel, Location, PicLocation
    } = useModel(sequelize);

    const startDate = new Date("2024-03-01 15:41:38");

    const alerts = await AlertStack.findAll({
        attributes: {
            include: [
                [
                    sequelize.literal(
                        `(SELECT ${ TelegramUser.tableName }.message_thread_id FROM ${ TelegramUser.tableName }` +
                        ` WHERE ${ TelegramUser.tableName }.chat_id=telegramChatId)`
                    ),
                    "telegramMessageThreadId"
                ]
            ]
        },
        where: {
            // status: "unsended",
            createdAt: { [Op.gte]: startDate },
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

    alerts.forEach(item => console.log( item.get({ plain: true }) ));

    await sequelize.close();

};

const testCase4 = async () => {

    const logger = Logger.create({ useConsole: true });
    const sequelize = useSequelize({
        ...dbOpnimusNewConfig,
        options: {
            logging: false,
            timezone: "+07:00"
        }
    });

    const telegramChatId = "-1001940534866";

    const {
        AlertStackRtu, AlarmHistoryRtu, TelegramUser, TelegramPersonalUser,
        Rtu, Regional, Witel, Location, PicLocation
    } = useModel(sequelize);

    const alert = await AlertStackRtu.findOne({
        attributes: {
            include: [
                [
                    sequelize.literal(
                        `(SELECT ${ TelegramUser.tableName }.message_thread_id FROM ${ TelegramUser.tableName }` +
                        ` WHERE ${ TelegramUser.tableName }.chat_id=telegramChatId)`
                    ),
                    "telegramMessageThreadId"
                ]
            ]
        },
        where: {
            status: "unsended",
            // createdAt: { [Op.gte]: startDate },
            telegramChatId
        },
        include: [{
            model: AlarmHistoryRtu,
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

    // console.log(alert.get({ plain: true }));
    const chatId = alert.telegramChatId;
    const messageThreadId = alert.telegramMessageThreadId;
    const alerts = [ alert.get({ plain: true }) ];

    const bot = useTelegramBot();
    const callback = result => console.log(result);
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    await sendTelgAlerts(chatId, messageThreadId, alerts, { logger, bot, callback });

    await sequelize.close();

};

// testCase1();
// testCase2();
// testCase3();
testCase4();