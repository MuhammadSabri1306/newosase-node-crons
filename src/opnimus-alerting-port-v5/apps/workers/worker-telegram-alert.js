const { parentPort, workerData } = require("worker_threads");
const { Logger } = require("../logger");
const { useTelegramBot, sendAlerts } = require("../telegram-alert");

const { loggerConfig, alertGroup } = workerData;
const logger = new Logger(loggerConfig.threadId, loggerConfig.options);
const bot = useTelegramBot();

logger.info("starting worker-define-alarm", { alertGroup });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

(async () => {

    const jobs = alertGroup.receivers.map(({ chatId, alerts }) => {
        const callback = result => parentPort.postMessage(result);
        return sendAlerts(chatId, alerts, { logger, bot, callback });
    });

    try {
        await Promise.all(jobs);
    } catch(err) {
        logger.error(err);
    }


})();