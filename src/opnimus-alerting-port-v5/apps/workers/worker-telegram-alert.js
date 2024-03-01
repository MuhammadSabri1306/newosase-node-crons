const { parentPort, workerData } = require("worker_threads");
const { Logger } = require("../logger");
const { useTelegramBot, sendTelgAlerts } = require("../telegram-alert");

const { loggerConfig, alertGroup } = workerData;
const logger = Logger.initChildLogger(loggerConfig.threadId, loggerConfig.options);
logger.info("starting worker-telegram-alert", { alertGroup });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

(async () => {

    const bot = useTelegramBot();

    const jobs = alertGroup.receivers.map(({ chatId, messageThreadId, alerts }) => {
        const callback = result => parentPort.postMessage(result);
        return sendTelgAlerts(chatId, messageThreadId, alerts, { logger, bot, callback });
    });

    try {
        await Promise.all(jobs);
    } catch(err) {
        logger.error(err);
    }


})();