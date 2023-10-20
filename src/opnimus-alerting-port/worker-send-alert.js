const { parentPort, workerData } = require("worker_threads");
const { logger } = require("./index");
const TelegramText = require("../core/telegram-text");
const { extractDate } = require("../helpers/date");
const { toFixedNumber } = require("../helpers/number-format");
const { useOpnimusNewBot } = require("../bot/opnimus-new");
const { catchRetryTime } = require("../helpers/telegram-error");

const { alert, jobQueueNumber } = workerData;
const opnimusNewBot = useOpnimusNewBot();

const getAlertIcon = (alert) => {
    const portName = alert.port_name.toUpperCase();
    if(portName == "STATUS PLN")
        return "⚡️";
    if(portName == "STATUS DEG")
        return "🔆";

    const portStatus = alert.port_status.toUpperCase();
    if(portStatus == "OFF")
        return "‼️";
    if(portStatus == "CRITICAL")
        return "❗️";
    if(portStatus == "WARNING")
        return "⚠️";
    if(portStatus == "SENSOR BROKEN")
        return "❌";
    
    return "⚡️";
};

const getAlertTitle = (alert) => {
    const icon = getAlertIcon(alert);

    if(alert.port_name == "Status PLN")
        return `${ icon } PLN OFF: ${ alert.location_name } (${ alert.rtu_code })${ icon }`;
    if(alert.port_name == "Status DEG")
        return `${ icon } GENSET ON: ${ alert.location_name } (${ alert.rtu_code })${ icon }`;

    const portStatus = alert.port_status.toUpperCase();
    return `${ icon } ${ alert.port_name } ${ portStatus }: ${ alert.location_name } (${ alert.rtu_code })${ icon }`;
};

const getAlertDescr = (alert) => {
    let alertText;

    if(alert.port_name == "Status PLN")
        alertText = "PLN OFF";
    else if(alert.port_name == "Status DEG")
        alertText = "GENSET ON";
    else {
        const portStatus = alert.port_status.toUpperCase();
        alertText = `${ alert.port_name } ${ portStatus }`;
    }

    return TelegramText.create("Terpantau ").addBold(alertText).addText(" dengan detail sebagai berikut:").get();
};

const getRegionalIcon = regionalCode => {
    if(regionalCode == "TLK-r1000000")
        return "1️⃣";
    if(regionalCode == "TLK-r2000000")
        return "2️⃣";
    if(regionalCode == "TLK-r3000000")
        return "3️⃣";
    if(regionalCode == "TLK-r4000000")
        return "4️⃣";
    if(regionalCode == "TLK-r5000000")
        return "5️⃣";
    if(regionalCode == "TLK-r6000000")
        return "6️⃣";
    if(regionalCode == "TLK-r7000000")
        return "7️⃣";
    return " ";
};

const getValueText = (alert) => {
    if(alert.port_value === null || alert.port_value === undefined)
        return "-";
    if(alert.port_unit == "ON/OFF")
        return alert.port_value == 1 ? "ON" : "OFF";
    
    const value = toFixedNumber(alert.port_value);
    return `${ value } ${ alert.port_unit }`;
};

const createAlertMessage = (alert) => {

    const alertIcon = getAlertIcon(alert);
    const title = getAlertTitle(alert);
    const descr = getAlertDescr(alert);

    const datetime = extractDate(new Date(alert.start_at));
    const datetimeStr = `${ datetime.day }-${ datetime.month }-${ datetime.year } ${ datetime.hours }:${ datetime.minutes } WIB`;
    
    const tregIcon = getRegionalIcon(alert.regional_code);
    const valueText = getValueText(alert);

    const msg = TelegramText.create(title).addLine()
        .addText("Pada "+datetimeStr).addLine(2)
        .addText(descr).addLine()
        .startCode()
        .addText(`${ tregIcon } Regional  : ${ alert.regional_name }`).addLine()
        .addText(`🏢 Witel     : ${ alert.witel_name }`).addLine()
        .addText(`🏬 Lokasi    : ${ alert.location_name }`).addLine()
        .addText(`🎛 RTU Name  : ${ alert.rtu_code }`).addLine()
        .addText(`🏪 Node Name : ${ alert.rtu_name }`).addLine()
        .endCode().addLine(2)
        .addText("Detail Port Alarm:").addLine()
        .startCode()
        .addText(`${ alertIcon } Nama Port : ${ alert.port_name }`).addLine()
        .addText(`🔌 Port      : ${ alert.port_code }`).addLine()
        .addText(`✴️ Value     : ${ valueText }`).addLine()
        .addText(`🌋 Status    : ${ alert.port_status }`).addLine()
        .addText(`📅 Waktu     : ${ datetimeStr }`).addLine()
        .endCode().addLine(2);

    if(Array.isArray(alert.pics) && alert.pics.length > 0) {
        msg.addBold("PIC Lokasi ini adalah:");
        alert.pics.forEach((pic, index) => {

            if(index > 0)
                msg.addText(",");
            msg.addText(" ");
            
            if(pic.full_name)
                msg.addMentionByUserId(pic.user_id, pic.full_name);
            else if(pic.first_name && pic.last_name)
                msg.addMentionByUserId(pic.user_id, `${ pic.first_name } ${ pic.last_name }`);
            else if(pic.username)
                msg.addMentionByUsername(pic.username)
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

const createDelay = time => {
    return new Promise((resolve) => setTimeout(resolve, time));
};

const sendAlert = async (alert) => {

    logger.info(`Build alert message, portId:${ alert.port_id }`);
    const alertMsg = createAlertMessage(alert);
    let retryCount = 0;
    let retryTime = 1000;
    let result;

    while(retryCount < 3) {
        
        logger.info(`Sending alert message, portId:${ alert.port_id }, retry:${ retryCount }`);

        // { result, error }
        result = await opnimusNewBot.sendMessage(alert.chat_id, alertMsg, { parse_mode: "Markdown" });
        retryCount++;

        if(result.success) {

            retryCount = 3;

        } else if(retryCount < 3) {

            if(result.error.code && result.error.description) {
                retryTime = catchRetryTime(result.error.description);
                if(retryTime > 0)
                    retryTime = (retryTime + 1) * 1000;
            }

            if(retryTime <= 0)
                retryTime = 1000;

            logger.error(`Failed to send alert message on portId:${ alert.port_id }, retry after:${ retryTime / 1000 }'s`);
            logger.error(result.error);
            await createDelay(retryTime);

        } else {

            logger.error(`Failed to send alert message, portId:${ alert.port_id }`, result.error);

        }

    }

    parentPort.postMessage({ alertId: alert.alert_id, ...result });
    process.exit();
};

sendAlert(alert);