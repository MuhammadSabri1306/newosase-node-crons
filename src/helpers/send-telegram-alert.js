const { Telegraf } = require("telegraf");
const config = require("../config");
const updatePortMessage = require("./db-query/update-port-message");
const storeAlertError = require("./db-query/store-alert-error");
const telegramError = require("./telegram-error");
const { logger } = require("../helpers/logger");

const bot = new Telegraf(config.botToken);

const delayNextAlert = time => {
    return new Promise((resolve) => setTimeout(resolve, time));
};

const sendTelegramMessage = async (chatId, message) => {
    try {
        await bot.telegram.sendMessage(chatId, message, { parse_mode: "Markdown" });
        return { success: true };
    } catch(error) {
        return { success: false, error };
    }
};

module.exports = async (alerts, onFinish) => {

    const defaultTimeout = config.alert.delayMessageTime;
    const maxRetry = config.alert.maxRetry;
    let retryCount = 0;
    let i = 0;

    while(i<alerts.length) {
        const currAlert = alerts[i];
        try {

            const result = await sendTelegramMessage(currAlert.alert.chat_id, currAlert.message);
            if(result.success) {

                await updatePortMessage(currAlert.alert.id, "success");
                retryCount = 0;
                i++;

            } else {

                const err = result.error;
                let timeout = defaultTimeout;
                retryCount++;
    
                if(!err.code && !err.description) {
    
                    logger.error(err);
    
                } else if(retryCount <= maxRetry) {
    
                    logger.error(`Failed to send message. Retry ${ retryCount - 1 }/${ maxRetry }`);
    
                    if(err.code && err.description) {
                        const retryTime = telegramError.catchRetryTime(err.description);
                        if(retryTime > 0) {
                            timeout = (retryTime + 1) * 1000;
                            logger.error(`retry time:${ retryTime }s`);
                        } else {
                            logger.error(`retry time uncatched, desc: ${ err.description }`);
                        }
                    } else {
                        logger.error(err);
                    }
    
                } else {
                    
                    logger.error(`Failed to send message. Retry ${ retryCount - 1 }/${ maxRetry }`);
                    if(err.description)
                        logger.error(`desc: ${ err.description }`);
                    else
                        logger.error(err);
    
                    await updatePortMessage(currAlert.alert.id, "unsended");
                    if(err.code && err.description)
                        await storeAlertError(err.code, err.description, currAlert.alert.id, currAlert.alert.chat_id);
    
                    retryCount = 0;
                    i++;
                    
                }
                await delayNextAlert(timeout);

            }


        } catch(error) {

            logger.error(error);

        }
    }

    onFinish();
};