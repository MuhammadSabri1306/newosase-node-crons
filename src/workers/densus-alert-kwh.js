const { parentPort, workerData } = require("worker_threads");
const { useDensusBot, config } = require("../bot/densusbot");
const TelegramText = require("../core/telegram-text");
const { toNumberText } = require("../helpers/number-format");
const telegramError = require("../helpers/telegram-error");
const { logger } = require("../helpers/logger");

const densusbot = useDensusBot();

const getValueText = (val, patternText = "{{VALUE}}", nullText = "-") => {
    if(val === null)
        return TelegramText.create().addBold(nullText).get();
    val = toNumberText(val);

    const pattern = new RegExp("\{\{VALUE\}\}", "g");
    return patternText.replace(pattern, val);
};

const getPercentText = (percent, nullText = "-") => {
    if(percent === null)
        return TelegramText.create(" ( ").addBold(nullText).addText(" )").get();

    const isNegative = percent < 0;
    const icon = isNegative ? "✅" : "⚠️";

    let percentText = toNumberText(percent);
    if(isNegative)
        percentText = percentText.slice(1);
    return TelegramText.create(` ( ${ icon } ${ percentText }%)`).get();
};

const buildMessage = row => {
    if(row.recipients.length < 1)
        return [];

    const telgText = TelegramText.create()
        .addBold("Report Konsumsi Listrik Daily").addLine()
        .addText(row.timestamp).addLine()
        .addText(`WILAYAH ${ row.witel_name } (${ row.exists_sto_count }/${ row.sto_count } monitored)`);

    const witelKwhTodayText = getValueText(row.kwh_curr_day, "{{VALUE}} KwH") + " " + getPercentText(row.kwh_percent_daily);
    const witelKwhYsdayText = getValueText(row.kwh_prev_day, "{{VALUE}} KwH");
    const witelKwhBillTodayText = getValueText(row.kwh_bill_curr_day, "Rp {{VALUE}}");
    const witelKwhBillYsdayText = getValueText(row.kwh_bill_prev_day, "Rp {{VALUE}}");

    telgText
        .addLine(2).addText("Kwh Total:").addLine()
        .addText("Hari ini: ").addText(witelKwhTodayText).addLine()
        .addText("Kemarin: ").addText(witelKwhYsdayText).addLine(2)
        .addText("Rupiah Total:").addLine()
        .addText("Hari ini: ").addText(witelKwhBillTodayText).addLine()
        .addText("Kemarin: ").addText(witelKwhBillYsdayText);

    row.sto.forEach(sto => {

        const stoKwhTodayText = getValueText(sto.kwh_curr_day, "{{VALUE}} KwH") + " " + getPercentText(sto.kwh_percent_daily);
        const stoKwhYsdayText = getValueText(sto.kwh_prev_day, "{{VALUE}} KwH");
        const stoKwhBillTodayText = getValueText(sto.kwh_bill_curr_day, "Rp {{VALUE}}");
        const stoKwhBillYsdayText = getValueText(sto.kwh_bill_prev_day, "Rp {{VALUE}}");

        telgText.addLine(2)
            .addText(`🏢 ${ sto.sto_name }`).addLine(2)
            .addText("Hari ini: ").addText(stoKwhTodayText).addLine()
            .addText("Kemarin: ").addText(stoKwhYsdayText).addLine()
            .addText("Estimasi Tagihan hari ini: ").addText(stoKwhBillTodayText).addLine()
            .addText("Estimasi Tagihan kemarin: ").addText(stoKwhBillYsdayText);

    });
    
    telgText.addLine(2).addText("Report To:").addLine()
        .addText("1. GM Witel Makassar").addLine()
        .addText("2. Manager Arnet Witel Makassar (@Dayat7)").addLine()
        .addText("3. GSD Sulsel").addLine()
        .addText("4. @Vayliant").addLine()
        .addText("5. @rifqifadhlillah93");

    // telgText.addLine(2).addText("Report To:").addLine();
    // const recipientTexts = [];
    const messageList = [];
    row.recipients.forEach(rcp => {
        const rcpChatId = rcp.telegram_data ? rcp.telegram_data.chat_id : null;
        messageList.push(rcpChatId);
    //     const rcpTexts = [];
    //     if(rcp.telegram_data?.first_name)
    //         rcpTexts.push(rcp.telegram_data.first_name);
    //     if(rcp.telegram_data?.last_name)
    //         rcpTexts.push(rcp.telegram_data.last_name);
    //     if(rcp.telegram_data.type != "private" && rcp.telegram_data?.group_descr)
    //         rcpTexts.push(rcp.telegram_data.group_descr);
    //     if(rcp.telegram_data?.username)
    //         rcpTexts.push(TelegramText.create("(").addMentionByUsername(rcp.telegram_data.username).addText(")").get());
    //     recipientTexts.push(rcpTexts.join(" "));
    });
    // telgText.addText(recipientTexts.join(", "));

    const result = messageList.map(recipientChatId => {
        return { recipientChatId, messageText: telgText.get() };
    });
    return result;

};

const alert = async (witelItem) => {
    const delayTime = config.alerts.kwhDaily.delayMessageTime
    const maxRetry = config.alerts.kwhDaily.maxRetry;
    const messageList = buildMessage(witelItem);

    let retryCount = 0;
    let i = 0;
    while(i < messageList.length) {
        try {
    
            const response = await densusbot.sendMessage(
                messageList[i].recipientChatId,
                messageList[i].messageText,
                { parse_mode: "Markdown" }
            );

            if(response.success) {

                retryCount = 0;
                i++;

            } else {

                const err = response.error;
                let timeout = delayTime;
                retryCount++;
                let retryTime = 0;

                if((err.code && err.description) && retryCount <= maxRetry)
                    retryTime = telegramError.catchRetryTime(err.description);
                
                if(retryTime > 0) {
                    timeout = (retryTime + 1) * 1000;
                } else {
                    retryCount = 0;
                    i++;
                }

            }
    
        } catch(err) {
            logger.error(err);
        }
    }

    parentPort.postMessage({ message: "Done" });
    process.exit();
};

alert(workerData);