const { parentPort, workerData } = require("worker_threads");
const App = require("../App");
const { useOpnimusNewBot } = require("../../bot/opnimus-new");
const { toDatetimeString } = require("../../helpers/date");
const { catchRetryTime } = require("../../helpers/telegram-error");
const TelegramText = require("../../core/telegram-text");
const { extractDate } = require("../../helpers/date");
const { toFixedNumber } = require("../../helpers/number-format");

const { appId, stacks, picUsers, jobQueueNumber } = workerData;
const app = new App(appId);
const opnimusNewBot = useOpnimusNewBot();

const getStackPics = (stack, picUsers) => {
    while(i < picUsers.length) {
        if(picUsers[i].location_id == stack.location_id)
            stack.pics.push(picUsers[i]);
        i++;
    }
};

const getAlertIcon = (alarm) => {
    const portName = alarm.port_name.toUpperCase();
    if(portName == "STATUS PLN")
        return "⚡️";
    if(portName == "STATUS DEG")
        return "🔆";

    const portStatus = alarm.port_severity.toUpperCase();
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

const getAlertTitle = (alarm, icon) => {
    if(alarm.port_name == "Status PLN")
        return `${ icon } PLN OFF: ${ alarm.location_name } (${ alarm.rtu_sname })${ icon }`;
    if(alarm.port_name == "Status DEG")
        return `${ icon } GENSET ON: ${ alarm.location_name } (${ alarm.rtu_sname })${ icon }`;

    const portSeverity = alarm.port_severity.toUpperCase();
    return `${ icon } ${ alarm.port_name } ${ portSeverity }: ${ alarm.location_name } (${ alarm.rtu_sname })${ icon }`;
};

const getAlertDescr = (alarm) => {
    let alertText;

    if(alarm.port_name == "Status PLN")
        alertText = "PLN OFF";
    else if(alarm.port_name == "Status DEG")
        alertText = "GENSET ON";
    else {
        const portSeverity = alarm.port_severity.toUpperCase();
        alertText = `${ alarm.port_name } ${ portSeverity }`;
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

const getValueText = (alarm) => {
    if(alarm.port_value === null || alarm.port_value === undefined)
        return "-";
    if(alarm.port_unit == "ON/OFF")
        return alarm.port_value == 0 ? "ON" : "OFF";
    
    const value = toFixedNumber(alarm.port_value);
    return `${ value } ${ alarm.port_unit }`;
};

const createAlertMessage = (alarm) => {

    const pics = getStackPics(alarm);

    const alertIcon = getAlertIcon(alarm);
    const title = getAlertTitle(alarm, alertIcon);
    const descr = getAlertDescr(alarm);

    const datetime = extractDate( new Date(alarm.opened_at) );
    const datetimeStr = `${ datetime.day }-${ datetime.month }-${ datetime.year } ${ datetime.hours }:${ datetime.minutes } WIB`;
    
    const tregIcon = getRegionalIcon(alarm.regional_code);
    const valueText = getValueText(alarm);

    const msg = TelegramText.create(title).addLine()
        .addText("Pada "+datetimeStr).addLine(2)
        .addText(descr).addLine()
        .startCode()
        .addText(`${ tregIcon } Regional  : ${ alarm.regional_name }`).addLine()
        .addText(`🏢 Witel     : ${ alarm.witel_name }`).addLine()
        .addText(`🏬 Lokasi    : ${ alarm.location_name }`).addLine()
        .addText(`🎛 RTU Name  : ${ alarm.rtu_sname }`).addLine()
        .addText(`🏪 Node Name : ${ alarm.rtu_name }`).addLine()
        .endCode().addLine(2)
        .addText("Detail Port Alarm:").addLine()
        .startCode()
        .addText(`${ alertIcon } Nama Port : ${ alarm.port_name }`).addLine()
        .addText(`🔌 Port      : ${ alarm.port_no }`).addLine()
        .addText(`✴️ Value     : ${ valueText }`).addLine()
        .addText(`🌋 Status    : ${ alarm.port_severity }`).addLine()
        .addText(`📅 Waktu     : ${ datetimeStr }`).addLine()
        .endCode().addLine(2);

    if(Array.isArray(pics) && pics.length > 0) {
        msg.addBold("PIC Lokasi ini adalah:");
        pics.forEach((pic, index) => {

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

const sendAlert = async (stack, picUsers) => {
    try {

        app.logProcess(`Build alert message, alertId:${ stack.alert_id }`);
        const messageText = createAlertMessage;
    
        app.logProcess(`Sending alert message, alertId:${ stack.alert_id }`);
        const result = await opnimusNewBot.sendMessage(stack.alert_chat_id, messageText, { parse_mode: "Markdown" });

        if(!result.success)
            throw result.error;
    
        parentPort.postMessage({
            type: "data",
            data: { alertId: stack.alert_id, success: true }
        });

        app.logProcess(`Alert message sended successfully, alertId:${ stack.alert_id }`);

    } catch(err) {

        let retryTime = 0;
        if(err.code && err.description)
            retryTime = catchRetryTime(err.description);

        if(retryTime > 0) {

            parentPort.postMessage({
                type: "data",
                data: {
                    alertId: stack.alert_id,
                    success: false,
                    error: err,
                    retryTime: retryTime * 1000
                }
            });
            app.logProcess(`Failed to send alert message, alertId:${ stack.alert_id }, retryTime:${ retryTime }s`);

        } else {

            parentPort.postMessage({
                type: "data",
                data: {
                    alertId: stack.alert_id,
                    success: false,
                    error: err
                }
            });
            app.logProcess(`Failed to send alert message, alertId:${ stack.alert_id }`);

        }
        console.error(err);

    }


};

app.logProcess(`Starting telegram-alerting thread, queue:${ jobQueueNumber }, alarmId:(${ stacks.alert_id })\n`);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

(async () => {

    const workList = stacks.map(stack => {
        return sendAlert(stack, picUsers);
    });
    await Promise.all(workList);
    parentPort.postMessage({ type: "finish" });

})();