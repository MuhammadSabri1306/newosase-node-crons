const { Telegraf, TelegramError } = require("telegraf");
const { FetchError, AbortError } = require("node-fetch");
const configBot = require("../../env/bot/opnimus-new-bot");
const { Logger } = require("./logger");
const { Op } = require("sequelize");
const { useModel, toUnderscoredPlain } = require("./models");
const TelegramText = require("../../core/telegram-text");
const { isDateObject, toDatetimeString, extractDate, toDatesDiffString } = require("../../helpers/date");
const { catchRetryTime } = require("../../helpers/telegram-error");
const { toFixedNumber } = require("../../helpers/number-format");

module.exports.useTelegramBot = () => {
    return new Telegraf(configBot.token);
};

module.exports.isTelgErrUserNotFound = (errDescription) => {
    const descrs = [
        "Forbidden: bot was kicked from the supergroup chat",
        "Forbidden: bot was kicked from the group chat",
        "Bad Request: chat not found"
    ];
    for(let i=0; i<descrs.length; i++) {
        if(errDescription.indexOf(descrs[i]) >= 0) {
            i = descrs.length;
            return true;
        }
    }
    return false;
};

module.exports.getTelgAlertStackPort = async (app = {}) => {
    let { logger, sequelize } = app;
    logger = Logger.getOrCreate(logger);
    try {
    
        const {
            AlertStack, AlarmHistory, TelegramUser, TelegramPersonalUser,
            Rtu, Regional, Witel, Location, PicLocation
        } = useModel(sequelize);
    
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - 6);
        logger.info("reading unsended telegram alert on alert stack port", { createdAt: `>= ${ toDatetimeString(startDate) }` });

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
                status: "unsended",
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
        return alerts;

    } catch(err) {
        logger.error(err);
        return [];
    }
};

module.exports.getTelgAlertStackRtu = async (app = {}) => {
    let { logger, sequelize } = app;
    logger = Logger.getOrCreate(logger);
    try {
    
        const {
            AlertStackRtu, AlarmHistoryRtu, TelegramUser, TelegramPersonalUser,
            Rtu, Regional, Witel, Location, PicLocation
        } = useModel(sequelize);
    
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - 6);
        logger.info("reading unsended telegram alert on alert stack RTU", { createdAt: `>= ${ toDatetimeString(startDate) }` });

        const alerts = await AlertStackRtu.findAll({
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
                createdAt: { [Op.gte]: startDate },
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
        return alerts;

    } catch(err) {
        logger.error(err);
        return [];
    }
};

module.exports.getTelgAlertStack = async (app = {}) => {
    let { logger } = app;
    logger = Logger.getOrCreate(logger);
    try {

        const [ portAlerts, rtuAlerts ] = await Promise.all([
            await this.getTelgAlertStackPort(app),
            await this.getTelgAlertStackRtu(app),
        ]);

        if(portAlerts.length < 1)
            logger.info("port alerts is empty");
        if(rtuAlerts.length < 1)
            logger.info("RTU alerts is empty");
        return { portAlerts, rtuAlerts };

    } catch(err) {
        logger.error(err);
        return { portAlerts: [], rtuAlerts: [] };
    }
};

module.exports.groupAlertStacks = (portAlerts, rtuAlerts, alertGroupsTarget, app = {}) => {
    let { logger } = app;
    logger = Logger.getOrCreate(logger);
    logger.info("start to grouping alerts");

    const alerts = [];
    for(let i=0; i<portAlerts.length; i++) {
        alerts.push( portAlerts[i].get({ plain: true }) );
    }
    for(let i=0; i<rtuAlerts.length; i++) {
        alerts.push( rtuAlerts[i].get({ plain: true }) );
    }

    const chatIdGroups = [];
    for(let i=0; i<alerts.length; i++) {
        
        let groupIndex = chatIdGroups.findIndex(group => group.chatId == alerts[i].telegramChatId);
        if(groupIndex < 0) {
            groupIndex = chatIdGroups.length;
            chatIdGroups.push({
                chatId: alerts[i].telegramChatId,
                messageThreadId: alerts[i].telegramMessageThreadId,
                alerts: [],
                alertsCount: 0
            });
        }

        chatIdGroups[groupIndex].alerts.push( alerts[i] );
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

    while(i < chatIdGroups.length) {
        let index = groups.findIndex(group => {
            const minAlertsCount = Math.min(...groups.map(item => item.alertsCount));
            return group.alertsCount === minAlertsCount;
        });
        groups[index].receivers.push(chatIdGroups[i]);
        groups[index].alertsCount += chatIdGroups[i].alertsCount;
        i++;
    }

    logger.info("alert groups was minimized", { groupsCount: groups.length, target: alertGroupsTarget });
    return groups;
};

module.exports.setTelgAlertAsSending = async (portAlertIds, rtuAlertIds, app = {}) => {
    let { logger, sequelize } = app;
    logger = Logger.getOrCreate(logger);
    try {

        const { AlertStack, AlertStackRtu } = useModel(sequelize);
        const jobs = [];

        if(portAlertIds.length > 0) {
            jobs.push(() => {
                logger.info("update port telegram alert status as sending", { portAlertIds });
                return AlertStack.update({ status: "sending" }, {
                    where: {
                        alertStackId: { [Op.in]: portAlertIds }
                    }
                });
            });
        }

        if(rtuAlertIds.length > 0) {
            jobs.push(() => {
                logger.info("update RTU telegram alert status as sending", { rtuAlertIds });
                return AlertStackRtu.update({ status: "sending" }, {
                    where: {
                        alertStackId: { [Op.in]: rtuAlertIds }
                    }
                });
            });
        }

    } catch(err) {
        logger.error(err);
    }
};

module.exports.onTelgAlertSended = async (alert, app = {}) => {
    let { logger, sequelize } = app;
    logger = Logger.getOrCreate(logger);
    try {

        const { alertStackId, alertStackRtuId, alertType } = alert;
        if(alertStackId !== undefined) {
            
            const { AlertStack } = useModel(sequelize);
            logger.info("update telegram port alert status as success", { alertStackId });
            await AlertStack.update({ status: "success" }, {
                where: { alertStackId }
            });

        } else if(alertStackRtuId !== undefined) {
            
            const { AlertStackRtu } = useModel(sequelize);
            logger.info("update telegram RTU alert status as success", { alertStackRtuId });
            await AlertStack.update({ status: "success" }, {
                where: { alertStackRtuId }
            });

        } else {
            throw new Error("alert type is not valid, update alert status to success was aborted");
        }

    } catch(err) {
        logger.error(err);
    }
};

module.exports.onTelgAlertUnsended = async (portAlertIds, rtuAlertIds, app = {}) => {
    let { logger, sequelize } = app;
    logger = Logger.getOrCreate(logger);

    if(portAlertIds.length < 1 && rtuAlertIds.length < 1) {
        logger.info("no alerts id was given");
        return;
    }

    try {
        const { AlertStack, AlertStackRtu } = useModel(sequelize);
        const works = [];
        if(portAlertIds.length > 0) {
            works.push(() => {
                logger.info("changing back port alert status as unsended", { jobAlertIds: portAlertIds });
                return AlertStack.update({ status: "unsended" }, {
                    where: {
                        alertStackId: { [Op.in]: portAlertIds },
                        status: "sending"
                    }
                });
            });
        }

        if(rtuAlertIds.length > 0) {
            works.push(() => {
                logger.info("changing back RTU alert status as unsended", { jobAlertIds: rtuAlertIds });
                return AlertStackRtu.update({ status: "unsended" }, {
                    where: {
                        alertStackRtuId: { [Op.in]: rtuAlertIds },
                        status: "sending"
                    }
                });
            });
        }
        
        await Promise.all( works.map(work => work()) );

    } catch(err) {
        logger.error(err);
    }
};

module.exports.onTelgSendError = async (telegramErr, chatId, app = {}) => {
    let { logger, sequelize } = app;
    logger = Logger.getOrCreate(logger);
    try {

        if(!telegramErr)
            throw new Error(`telegramError expect AlertMessageError model's data, ${ telegramErr } given`);

        const { AlertMessageError, TelegramUser, TelegramPersonalUser, PicLocation, AlertUsers } = useModel(sequelize);

        let works = [];
        works.push(() => {
            logger.info("insert telegram error to AlertMessageError", { telegramErr });
            return AlertMessageError.create({ ...telegramErr, createdAt: new Date() });
        });

        const isUserNotFound = telegramErr && this.isTelgErrUserNotFound(telegramErr.description) ? true : false;
        let telgUser = null;
        if(isUserNotFound && chatId) {
            telgUser = await TelegramUser.findOne({
                where: { chatId }
            });
        }

        if(isUserNotFound && !telgUser) {
            logger.info(
                "telegram error user not found was thrown but cannot get the user data in database",
                { telegramErr, chatId, telgUser }
            );
        } else if(isUserNotFound) {

            logger.info("telegram error user not found was thrown", { chatId, telgUser: telgUser.get({ plain: true }) });

            if(telgUser.isPic) {
                works.push(() => {
                    logger.info("delete user data from PicLocation", { userId: telgUser.id });
                    return PicLocation.destroy({
                        where: { userId: telgUser.id }
                    });
                });
            }

            if(telgUser.type == "private") {
                works.push(() => {
                    logger.info("delete user data from TelegramPersonalUser", { userId: telgUser.id });
                    return TelegramPersonalUser.destroy({
                        where: { userId: telgUser.id }
                    });
                });
            }

            works.push(() => {
                logger.info("delete user data from AlertUsers", { telegramUserId: telgUser.id });
                return AlertUsers.destroy({
                    where: { telegramUserId: telgUser.id }
                });
            });

            works.push(() => {
                logger.info("delete user data from TelegramUser", { id: telgUser.id });
                return TelegramUser.destroy({
                    where: { id: telgUser.id }
                });
            });
            
        }

        await Promise.all( works.map(work => work()) );

    } catch(err) {
        logger.error(err);
    }
};

module.exports.isOffPort = (alarm) => {
    return alarm.portUnit.toLowerCase() == "off";
};

module.exports.isBinerPort = (alarm) => {
    const binerUnits = [ 'on/off', 'open/close' ];
    return binerUnits.indexOf(alarm.portUnit.toLowerCase()) >= 0;
};

module.exports.isPlnPort = (alarm) => {
    if(!this.isBinerPort(alarm))
        return false;
    const portNameKey = (alarm.portName || "").toLowerCase();
    return portNameKey == "status pln";
};

module.exports.isGensetPort = (alarm) => {
    if(!this.isBinerPort(alarm))
        return false;
    const portNameKey = (alarm.portName || "").toLowerCase();
    return portNameKey == "status deg";
};

module.exports.isTemperaturePort = (alarm) => {
    const portNameKey = (alarm.portName || "").toLowerCase();
    return portNameKey.indexOf("temperature") >= 0;
};

module.exports.getAlarmIcon = (alarm) => {
    if(this.isPlnPort(alarm))
        return "⚡️";
    if(this.isGensetPort(alarm))
        return "🔆";
    if(this.isTemperaturePort(alarm))
        return "🌡️";

    const portStatus = alarm.portSeverity.toLowerCase();
    if(portStatus == "off")
        return "‼️";
    if(portStatus == "critical")
        return "❗️";
    if(portStatus == "warning")
        return "⚠️";
    if(portStatus == "sensor broken")
        return "❌";
    
    return "";
};

module.exports.getAlertTitle = (alarm, location) => {
    const portSeverity = alarm.portSeverity.toUpperCase();
    return `${ alarm.portName } ${ portSeverity }: ${ location.locationName } (${ alarm.rtuSname })`;
};

module.exports.getAlertDescr = (alarm) => {
    const portSeverity = alarm.portSeverity.toUpperCase();
    let alertText = `${ alarm.portName } ${ portSeverity }`;
    return TelegramText.create("Terpantau ")
        .addBold(alertText)
        .addText(" dengan detail sebagai berikut:")
        .get();
};

module.exports.getRegionalNumber = regional => {
    const fields = [];
    if(regional) {
        if(regional.divreCode) fields.push(regional.divreCode)
        if(regional.sname) fields.push(regional.sname)
        if(regional.name) fields.push(regional.name)
    }

    for(let i=0; i<fields.length; i++) {
        if(typeof fields[i] == "string") {
            let match = fields[i].match(/[1-9]/);
            if(match) {
                i = fields.length;
                return Number(match[0]);
            }
        }
    }

    return null;
};

module.exports.getRegionalIcon = (regional) => {
    const regionalNumber = this.getRegionalNumber(regional);
    if(regionalNumber === 1) return "1️⃣";
    if(regionalNumber === 2) return "2️⃣";
    if(regionalNumber === 3) return "3️⃣";
    if(regionalNumber === 4) return "4️⃣";
    if(regionalNumber === 5) return "5️⃣";
    if(regionalNumber === 6) return "6️⃣";
    if(regionalNumber === 7) return "7️⃣";
    return " ";
};

module.exports.getValueText = (alarm) => {
    if(alarm.portValue === null || alarm.portValue === undefined)
        return "-";

    if(this.isOffPort(alarm) || this.isPlnPort(alarm))
        return Boolean(Number(alarm.portValue)) ? "OFF" : "ON";
    if(this.isBinerPort(alarm))
        return Boolean(Number(alarm.portValue)) ? "ON" : "OFF";
    
    const value = toFixedNumber(alarm.portValue);
    return `${ value } ${ alarm.portUnit }`;
};

module.exports.extractPortAlertData = (alertData) => {
    const { alarmHistory: alarmHistoryData, ...alert } = alertData;
    const { rtu: rtuData, ...alarmHistory } = alarmHistoryData;
    const { location: locationData, regional, witel, ...rtu } = rtuData;
    const { picLocations: picLocationsData, ...location } = locationData;

    const pics = picLocationsData.map(picLocationData => {
        const { telegramUser: telegramUserData, ...picLocation } = picLocationData;
        const { telegramPersonalUser, ...telegramUser } = telegramUserData;
        return { picLocation, telegramUser, telegramPersonalUser };
    });
    return { alert, alarmHistory, rtu, location, witel, regional, pics: pics || [] };
};

module.exports.extractRtuAlertData = (alertData) => {
    const { alarmHistoryRtu: alarmHistoryData, ...alert } = alertData;
    const { rtu: rtuData, ...alarmHistoryRtu } = alarmHistoryRtuData;
    const { location: locationData, regional, witel, ...rtu } = rtuData;
    const { picLocations: picLocationsData, ...location } = locationData;

    const pics = picLocationsData.map(picLocationData => {
        const { telegramUser: telegramUserData, ...picLocation } = picLocationData;
        const { telegramPersonalUser, ...telegramUser } = telegramUserData;
        return { picLocation, telegramUser, telegramPersonalUser };
    });
    return { alert, alarmHistoryRtu, rtu, location, witel, regional, pics: pics || [] };
};

module.exports.createTelgTextOpenPort = (alertItem) => {
    
    const { alarmHistory, rtu, regional, witel, location, pics } = this.extractPortAlertData(alertItem);

    const alarmIcon = this.getAlarmIcon(alarmHistory);
    const title = this.getAlertTitle(alarmHistory, location);
    const descr = this.getAlertDescr(alarmHistory);

    let openedAt = alarmHistory.alertStartTime || alarmHistory.openedAt;
    if(!isDateObject(openedAt))
        openedAt = new Date(openedAt);
    const datetime = extractDate(openedAt);
    const datetimeStr = `${ datetime.day }-${ datetime.month }-${ datetime.year } ${ datetime.hours }:${ datetime.minutes } WIB`;

    const tregIcon = this.getRegionalIcon(regional);
    const valueText = this.getValueText(alarmHistory);

    const msg = TelegramText.create(`${ alarmIcon } ${ title }${ alarmIcon }`).addLine()
        .addText("Pada "+datetimeStr).addLine(2)
        .addText(descr).addLine()
        .startCode()
        .addText(`${ tregIcon } Regional   : ${ regional.name }`).addLine()
        .addText(`🏢 Witel      : ${ witel.witelName }`).addLine()
        .addText(`🏬 Lokasi     : ${ location.locationName }`).addLine()
        .addText(`🎛 RTU Name   : ${ alarmHistory.rtuSname }`).addLine()
        .addText(`🏪 Node Name  : ${ rtu.name }`).addLine()
        .endCode().addLine(2)
        .addText("Detail Port Alarm:").addLine()
        .startCode()
        .addText(`${ alarmIcon } Nama Port  : ${ alarmHistory.portName }`).addLine()
        .addText(`📖 Port Descr : ${ alarmHistory.portDescription }`).addLine()
        .addText(`🔌 Port       : ${ alarmHistory.portNo }`).addLine()
        .addText(`✴️ Value      : ${ valueText }`).addLine()
        .addText(`🌋 Status     : ${ alarmHistory.portSeverity }`).addLine()
        .addText(`📅 Waktu      : ${ datetimeStr }`).addLine()
        .endCode().addLine(2);

    if(Array.isArray(pics) && pics.length > 0) {
        msg.addBold("PIC Lokasi ini adalah:");
        pics.forEach((pic, index) => {

            const { picLocation, telegramUser: user, telegramPersonalUser: personal } = pic;
            if(index > 0)
                msg.addText(",");
            msg.addText(" ");
            
            if(personal.nama)
                msg.addMentionByUserId(user.userId, personal.nama);
            else if(user.firstName || user.lastName)
                msg.addMentionByUserId(user.userId, [user.firstName, user.lastName].filter(item => item ? true : false).join(" "));
            else if(pic.username)
                msg.addMentionByUserId(user.userId, user.username);
            else
                msg.addMentionByUserId(pic.user_id, "Tanpa Nama");

        });
        msg.addLine(2);
    }

    msg.addText("❕Mohon untuk segera melakukan pengecekan port lokasi, terima kasih. ")
        .addText("Anda juga dapat mengetikan /alarm untuk mengecek alarm saat ini.").addLine()
        .addText("#OPNIMUS #PORTALARM");
    return msg.get();

};

module.exports.createTelgTextClosePort = (alertItem) => {
    
    const { alarmHistory, rtu, regional } = this.extractPortAlertData(alertItem);

    let title = "null";
    if(this.isPlnPort(alarmHistory))
        title = "PLN ON";
    else if(this.isGensetPort(alarmHistory))
        title = "Genset OFF";

    let openedAt = alarmHistory.alertStartTime || alarmHistory.openedAt;
    if(!isDateObject(openedAt))
        openedAt = new Date(openedAt);
    const datetime = extractDate(openedAt);
    const datetimeStr = `${ datetime.day }-${ datetime.month }-${ datetime.year } ${ datetime.hours }:${ datetime.minutes } WIB`;

    let durationText = "null";
    if(alarmHistory.closedAt) {
        let closedAt = alarmHistory.closedAt;
        if(!isDateObject(closedAt))
            closedAt = new Date(closedAt);
        durationText = toDatesDiffString(openedAt, closedAt, "null");
    }

    const regionalNumber = this.getRegionalNumber(regional);

    const msg = TelegramText.create("✅ ")
        .addBold( title.toUpperCase() ).addLine()
        .addText(`${ datetimeStr } ${ alarmHistory.rtuSname } (${ rtu.name }) ${ title } (${ durationText })`).addLine(2)
        .addText(`#OPNIMUS #TR${ regionalNumber } #${ title.replace(" ", "").toUpperCase() }`);
    return msg.get();

};

module.exports.createTelgTextRtuDown = (alertItem) => {
    
    const { alarmHistoryRtu, rtu, regional, witel, location, pics } = this.extractRtuAlertData(alertItem);

    let openedAt = alarmHistoryRtu.alertStartTime || alarmHistoryRtu.openedAt;
    if(!isDateObject(openedAt))
        openedAt = new Date(openedAt);
    const datetime = extractDate(openedAt);
    const datetimeStr = `${ datetime.day }-${ datetime.month }-${ datetime.year } ${ datetime.hours }:${ datetime.minutes } WIB`;
    
    const tregNumber = this.getRegionalNumber(regional);
    const tregIcon = this.getRegionalIcon(regional);

    const msg = TelegramText.create()
        .addText("🚨").addBold(`Alarm: ${ alarmHistoryRtu.rtuSname } >30 Menit!`).addText("🚨").addLine()
        .addItalic(`Pada ${ datetimeStr }`).addLine(2)
        .addText("Terpantau").addBold(" RTU DOWN ").addText("lebih dari 30 Menit dengan detail:").addLine()
        .startCode()
        .addText(`${ tregIcon } Regional  : ${ regional.name }`).addLine()
        .addText(`🏢 Witel     : ${ witel.witelName }`).addLine()
        .addText(`🏬 Lokasi    : ${ location.locationName }`).addLine()
        .addText(`🏪 Node Name : ${ rtu.name }`).addLine()
        .addText("❌Tipe Alarm : RTU DOWN Lebih dari 30 Menit").addLine()
        .addText(`📅 Waktu     : ${ datetimeStr }`)
        .endCode().addLine(2);

    if(Array.isArray(pics) && pics.length > 0) {
        msg.addBold("PIC Lokasi ini adalah:");
        pics.forEach((pic, index) => {

            const { picLocation, telegramUser: user, telegramPersonalUser: personal } = pic;
            if(index > 0)
                msg.addText(",");
            msg.addText(" ");
            
            if(personal.nama)
                msg.addMentionByUserId(user.userId, personal.nama);
            else if(user.firstName || user.lastName)
                msg.addMentionByUserId(user.userId, [user.firstName, user.lastName].filter(item => item ? true : false).join(" "));
            else if(pic.username)
                msg.addMentionByUserId(user.userId, user.username);
            else
                msg.addMentionByUserId(pic.user_id, "Tanpa Nama");

        });
        msg.addLine(2);
    }

    msg.addText(" ❕Mohon untuk segera melakukan Pengecekan lokasi karena status RTU Down,")
        .addText(" berikut rekomendasi saran yang bisa diberikan:")
        .newLine().startCode()
        .addText("📌Cek Catuan RTU baik LAN atau Power").addLine()
        .addText("📌Cek melalui /rtu di OPNIMUS apakah hanya flicker atau bukan").addLine()
        .addText("📌Restart RTU apabila masih terkendala")
        .endCode().addLine(2)
        .addText(`#OPNIMUS #PORTALARM #TR${ tregNumber }`);
    return msg.get();

};

module.exports.createTelgAlertMessage = (alert) => {
    if(alert.alertType == "open-port") {
        return this.createTelgTextOpenPort(alert);
    } else if(alert.alertType == "close-port") {
        return this.createTelgTextClosePort(alert);
    } else if(alert.alertType == "rtu-down") {
        return this.createTelgTextRtuDown(alert);
    } else {
        throw new Error(`alertType is not valid, given ${ alert.alertType }`);
    }
};

module.exports.sendTelgAlerts = async (chatId, messageThreadId, alerts, app = {}) => {
    let { logger, bot, callback } = app;
    logger = Logger.getOrCreate(logger);

    let lastAlert = null;
    const sendedAlerts = { port: [], rtu: [] };
    try {
        let i = 0;
        while(i < alerts.length) {

            lastAlert = {};
            if(alerts[i].alertStackId !== undefined)
                lastAlert.alertStackId = alerts[i].alertStackId;
            if(alerts[i].alertStackRtuId !== undefined)
                lastAlert.alertStackRtuId = alerts[i].alertStackRtuId;
            lastAlert.alertType = alerts[i].alertType;

            let messageText = this.createTelgAlertMessage(alerts[i]);

            let reqOptions = { parse_mode: "Markdown" };
            if(messageThreadId) reqOptions.message_thread_id = messageThreadId;
            await bot.telegram.sendMessage(chatId, messageText, reqOptions);
            logger.info("alert message was sended", { chatId, ...lastAlert });

            if(lastAlert.alertStackId !== undefined)
                sendedAlerts.port.push(lastAlert.alertStackId);
            if(lastAlert.alertStackRtuId !== undefined)
                sendedAlerts.rtu.push(lastAlert.alertStackRtuId);

            callback && callback({
                success: true,
                alert: lastAlert,
                chatId
            });

            i++;
            
        }
    } catch(err) {

        const unsendedAlerts = { port: [], rtu: [] };
        for(let i=0; i<alerts.length; i++) {
            if(alerts[i].alertStackId !== undefined) {
                if(sendedAlerts.port.indexOf(alerts[i].alertStackId) < 0)
                    unsendedAlerts.port.push(alerts[i].alertStackId);
            } else if(alerts[i].alertStackRtuId !== undefined) {
                if(sendedAlerts.rtu.indexOf(alerts[i].alertStackRtuId) < 0)
                    unsendedAlerts.rtu.push(alerts[i].alertStackRtuId);
            }
        }
        
        if(err instanceof TelegramError) {
            const retryTime = catchRetryTime(err.description);
            logger.info("failed to send alert message", {
                chatId,
                retryTime,
                alert: lastAlert,
                unsendedAlerts
            });

            logger.error(err);
            callback && callback({
                success: false,
                alert: lastAlert,
                unsendedAlerts,
                telegramErrData: {
                    chatId,
                    telegramErr: {
                        alertId: lastAlert.alertStackId || lastAlert.alertStackRtuId,
                        description: err.description,
                        errorCode: err.code,
                        response: JSON.stringify(err.response)
                    },
                    retryTime: retryTime * 1000
                }
            });
        } else if(err instanceof FetchError || err instanceof  AbortError) {
            logger.info("error to fetching telegram api", {
                chatId,
                alert: lastAlert,
                unsendedAlerts
            });
            logger.error(err);
            callback && callback({
                success: false,
                unsendedAlerts
            });
        } else {
            logger.info("uncaught error was thrown when sending alerts", {
                chatId,
                alert: lastAlert,
                unsendedAlerts
            });
            logger.error(err);
            throw err;
        }
    }
};