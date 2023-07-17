const { Telegraf } = require("telegraf");
const config = require("../config");
const ProcessSlot = require("./process-slot");
const updatePortMessage = require("./db-query/update-port-message");
const storeAlertError = require("./db-query/store-alert-error");

const bot = new Telegraf(config.botToken);

const delayNextAlert = time => {
    return new Promise((resolve) => setTimeout(resolve, time));
};

module.exports = async (alerts, onFinish) => {

    const defaultTimeout = 1000;
    const maxRetry = config.alert.maxRetry;
    let retryCount = 0;
    let i = 0;

    while(i<alerts.length) {
        const currAlert = alerts[i];
        try {

            await updatePortMessage(currAlert.messageId, "sending");
            await bot.telegram.sendMessage(currAlert.user.chat_id, currAlert.message, { parse_mode: "Markdown" });
            await updatePortMessage(currAlert.messageId, "success");

            retryCount = 0;
            i++;

        } catch(err) {

            let timeout = defaultTimeout;
            retryCount++;

            if(!err.code && !err.description) {

                console.error(err);

            } else if(retryCount <= maxRetry) {

                const retryTime = telegramError.catchRetryTime(err.description);
                if(retryTime > 0) {
                    timeout = (retryTime + 1000) * 1000;
                    console.error(`retry time:${ retryTime }s`);
                } else {
                    console.error(`default retry time:${ retryTime }s`);
                }

            } else {
                
                console.error(`Failed to send message. Retry ${ retryCount + 1 }/${ maxRetry }`);
                await updatePortMessage(currAlert.messageId, "unsended");
                await storeAlertError(err.code, err.description, currAlert.messageId, currAlert.user.id);
                retryCount = 0;
                i++;
                
            }
            await delayNextAlert(timeout);
            
        }
    }

    onFinish();
};