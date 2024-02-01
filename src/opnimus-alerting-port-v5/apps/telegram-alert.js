const { Telegraf, TelegramError } = require("telegraf");
const configBot = require("../../env/bot/opnimus-new-bot");
const { Logger } = require("./logger");
const TelegramText = require("../../core/telegram-text");
const { toDatetimeString } = require("../../helpers/date");
const { catchRetryTime } = require("../../helpers/telegram-error");
const { extractDate } = require("../../helpers/date");
const { toFixedNumber } = require("../../helpers/number-format");

module.exports.useTelegramBot = () => {
    return new Telegraf(configBot.token);
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
    const portIdfKey = (alarm.portIdentifier || "").toLowerCase();
    return portIdfKey == "st_pln";
};

module.exports.isGensetPort = (alarm) => {
    if(!this.isBinerPort(alarm))
        return false;
    const portIdfKey = (alarm.portIdentifier || "").toLowerCase();
    return portIdfKey == "st_deg";
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

module.exports.getRegionalIcon = (regional) => {
    if(regional.divreCode == "TLK-r1000000")
        return "1️⃣";
    if(regional.divreCode == "TLK-r2000000")
        return "2️⃣";
    if(regional.divreCode == "TLK-r3000000")
        return "3️⃣";
    if(regional.divreCode == "TLK-r4000000")
        return "4️⃣";
    if(regional.divreCode == "TLK-r5000000")
        return "5️⃣";
    if(regional.divreCode == "TLK-r6000000")
        return "6️⃣";
    if(regional.divreCode == "TLK-r7000000")
        return "7️⃣";
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

module.exports.extractAlertData = (alertData) => {
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

module.exports.createAlertMessage = (alertItem) => {
    
    const { alert, alarmHistory, rtu, regional, witel, location, pics } = this.extractAlertData(alertItem);

    const alarmIcon = this.getAlarmIcon(alarmHistory);
    const title = this.getAlertTitle(alarmHistory, location);
    const descr = this.getAlertDescr(alarmHistory);

    let openedAt = alarmHistory.alertStartTime || alarmHistory.openedAt;
    if(typeof openedAt.getFullYears != "function")
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

module.exports.sendAlerts = async (chatId, alerts, app = {}) => {
    let { logger, bot, callback } = app;
    logger = Logger.getOrCreate(logger);

    const successedAlertIds = [];
    let i = 0;
    try {
        while(i < alerts.length) {

            let messageText = this.createAlertMessage(alerts[i]);
            await bot.telegram.sendMessage(chatId, messageText, { parse_mode: "Markdown" });
            logger.info("alert message was sended", { chatId, alertStackId: alerts[i].alertStackId });

            callback && callback({
                success: true,
                alertStackId: alerts[i].alertStackId,
                chatId
            });

            successedAlertIds.push(alerts[i].alertStackId);
            i++;
            
        }
    } catch(err) {

        const unsendedAlertIds = [];
        for(let j=0; j<alerts.length; j++) {
            if(successedAlertIds.indexOf(alerts[j].alertStackId) < 0)
                unsendedAlertIds.push(alerts[j].alertStackId);
        }
        
        if(err instanceof TelegramError) {
            const retryTime = catchRetryTime(err.description);
            logger.info("failed to send alert message", {
                alertStackId: alerts[i].alertStackId,
                chatId,
                retryTime,
                unsendedAlertIds
            });

            logger.error(err);
            callback && callback({
                success: false,
                unsendedAlertIds,
                chatId,
                telegramErr: {
                    alertId: alerts[i].alertStackId,
                    description: err.description,
                    errorCode: err.code,
                    response: JSON.stringify(err.response)
                },
                retryTime: retryTime * 1000
            });
        } else {
            logger.info("failed to send alert message", {
                chatId,
                alertStackId: alerts[i].alertStackId,
                unsendedAlertIds
            });
            logger.error(err);
            callback && callback({
                success: false,
                unsendedAlertIds,
                chatId
            });
        }
    }
};