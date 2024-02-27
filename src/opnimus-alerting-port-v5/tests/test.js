const dbOpnimusNewConfig = require("../../env/database/opnimus-new-migrated-2");
const { useSequelize, useModel } = require("../apps/models");
const { createAlertMessage } = require("../apps/telegram-alert");
const { Telegraf } = require("telegraf");
const configBot = require("../../env/bot/opnimus-new-bot");

const main = async () => {

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

main();