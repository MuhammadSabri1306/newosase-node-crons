const cron = require("node-cron");
const { syncOpnimusLocation, telegramAlertV3 } = require("./src/index");
const { logger } = require("./src/helpers/logger");

/*
 * Main Alert V3
 * Runs every 2 minutes
 */
cron.schedule("*/2 * * * *", () => {
    console.log("\n\n");
    logger.log("Newosase RTU's Alert (run on every 2 minute)");
    telegramAlertV3();
});

/*
 * Newosase RTU list watcher
 * Synchronize RTU list and location to opnimus_db_new
 * Runs every 00.00 WIB
 */
cron.schedule("0 0 * * *", () => {
    console.log("\n\n");
    logger.log("Watch Newosase location (run on every 24 o'clock)");
    syncOpnimusLocation();
}, {
    timezone: "Asia/Jakarta"
});