const cron = require("node-cron");
const { syncOpnimusLocation, telegramAlertV3 } = require("./src/index");
const { toDatetimeString } = require("./src/helpers/date");

/*
 * Main Alert V3
 * Runs every 2 minutes
 */
cron.schedule("*/2 * * * *", () => {
    console.log("\n\nNewosase RTU's Alert (run on every 2 minute)");
    console.log(`Start at: ${ toDatetimeString(new Date()) }`);
    telegramAlertV3();
});

/*
 * Newosase RTU list watcher
 * Synchronize RTU list and location to opnimus_db_new
 * Runs every 00.00 WIB
 */
cron.schedule("0 0 * * *", () => {
    console.log("\n\nWatch Newosase location (run on every 24 o'clock)");
    console.log(`Start at: ${ toDatetimeString(new Date()) }`);
    syncOpnimusLocation().then(() =>  {
        console.log(`Finish at: ${ toDatetimeString(new Date()) }`);
    });
}, {
    timezone: "Asia/Jakarta"
});