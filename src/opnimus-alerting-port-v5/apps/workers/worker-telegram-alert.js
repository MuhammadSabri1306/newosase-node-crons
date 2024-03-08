const { parentPort, workerData } = require("worker_threads");
const { Logger } = require("../logger");
const { useTelegramBot, sendTelgAlerts } = require("../telegram-alert");

const { loggerConfig, alertGroup } = workerData;
const logger = Logger.initChildLogger(loggerConfig.threadId, loggerConfig.options);
logger.info("starting worker-telegram-alert", { alertGroup });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const bot = useTelegramBot();

(async () => {

    const jobs = [];
    const maxRecvPeerJob = 2;
    const onAlertsDone = result => parentPort.postMessage(result);

    for(let i=0; i<alertGroup.receivers.length; i+=maxRecvPeerJob) {
        let receivers = alertGroup.receivers.slice(i, i + maxRecvPeerJob);
        try {
            await Promise.all(
                receivers.map(({ chatId, messageThreadId, alerts }) => {
                    return sendTelgAlerts(chatId, messageThreadId, alerts, { logger, bot, callback: onAlertsDone });
                })
            );
        } catch(err) {
            logger.error(err);
        }
    }

})();