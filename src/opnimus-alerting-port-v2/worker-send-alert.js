const { parentPort, workerData } = require("worker_threads");
const logger = require("./logger");
const { useOpnimusNewBot } = require("../bot/opnimus-new");
const { catchRetryTime } = require("../helpers/telegram-error");
const { logErrorWithFilter } = require("./log-error");

const { alert, jobQueueNumber } = workerData;
const opnimusNewBot = useOpnimusNewBot();

const createDelay = time => new Promise((resolve) => setTimeout(resolve, time));

const sendAlert = async (alert) => {

    logger.info(`Build alert message, alertId:${ alert.alertId }`);
    let retryCount = 0;
    let retryTime = 1000;
    let result;

    while(retryCount < 3) {
        
        logger.info(`Sending alert message, alertId:${ alert.alertId }, retry:${ retryCount }`);

        // { result, error }
        result = await opnimusNewBot.sendMessage(alert.chatId, alert.messageText, { parse_mode: "Markdown" });
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

            await createDelay(retryTime);

        } else {

            logErrorWithFilter(
                `Failed to send alert message, alertId:${ alert.alertId }, lastRetryTime:${ retryTime }ms`,
                result.error
            );

        }

    }

    parentPort.postMessage({ alertId: alert.alertId, ...result });
    process.exit();
};

sendAlert(alert);