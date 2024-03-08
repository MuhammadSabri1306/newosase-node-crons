const { Op } = require("sequelize");
const { useSequelize, useModel } = require("../apps/models");
const { Logger } = require("../apps/logger");
const { groupAlertStacks } = require("../apps/telegram-alert");
const dbOpnimusNewConfig = require("../../env/database/opnimus-new-migrated-2");

const testCase1 = async () => {

    const logger = Logger.create({ useConsole: true });
    const sequelize = useSequelize({
        ...dbOpnimusNewConfig,
        options: {
            logging: false,
            timezone: "+07:00"
        }
    });

    const {
        AlertStack, AlarmHistory, AlertStackRtu, AlarmHistoryRtu, TelegramUser,
        TelegramPersonalUser, Rtu, Regional, Witel, Location, PicLocation
    } = useModel(sequelize);

    const portAlerts = await AlertStack.findAll({
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
        }],
        order: [
            [ "alertStackId", "DESC" ]
        ],
        limit: 100
    });

    const rtuAlerts = await AlertStackRtu.findAll({
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
        }],
        order: [
            [ "alertStackRtuId", "DESC" ]
        ],
        limit: 100
    });

    const result = groupAlertStacks(portAlerts, rtuAlerts, 15, { logger });
    result.forEach(group => {
        const r = {
            receiversCount: group.receivers.length,
            alertCount: group.alertsCount
        };
        console.log(r);
    });

    await sequelize.close();

};

testCase1();