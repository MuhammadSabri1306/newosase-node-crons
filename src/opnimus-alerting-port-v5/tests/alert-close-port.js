const dbOpnimusNewConfig = require("../../env/database/opnimus-new-migrated-2");
const { Op } = require("sequelize");
const { useSequelize, useModel } = require("../apps/models");
const { createAlertMessage, createTelgTextClosePort } = require("../apps/telegram-alert");
const { Telegraf } = require("telegraf");
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

    const chatId = "-1001940534866";
    const alertStackId = 165743;

    const alert = await AlertStack.findOne({
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
            // createdAt: { [Op.gte]: startDate },
            alertStackId
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

    const messageText = createTelgTextClosePort(alert.get({ plain: true }));
    console.log(messageText);
    
    // const bot = new Telegraf(configBot.token);
    // await bot.telegram.sendMessage(chatId, messageText, { parse_mode: "Markdown" });

    await sequelize.close();

};

testCase1();