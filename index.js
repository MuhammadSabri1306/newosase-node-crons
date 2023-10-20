const cron = require("node-cron");
// const { syncOpnimusLocation, telegramAlertV3 } = require("./src/index");
// const densusAlertKwh = require("./src/app/alert-kwh");
const osaseCollectKwh = require("./src/osase-collect-kwh");
const opnimusAlertingPort = require("./src/opnimus-alerting-port");

/*
 * Main Alert V3
 * Runs every 1 minutes
 */
// cron.schedule("* * * * *", () => {
//     console.log("\n\n");
//     logger.log("Newosase RTU's Alert (run on every minute)");
//     telegramAlertV3();
// });

/*
 * Newosase RTU list watcher
 * Synchronize RTU list and location to opnimus_db_new
 * Runs every 00.00 WIB
 */
// cron.schedule("0 0 * * *", () => {
//     console.log("\n\n");
//     logger.log("Watch Newosase location (run on every 24 o'clock)");
//     syncOpnimusLocation();
// }, {
//     timezone: "Asia/Jakarta"
// });

/*
 * Densus Alert Kwh
 * Send Telegram Message contains Kwh daily usage
 * Runs every 09.00 WIB
 */
// cron.schedule("0 9 * * *", () => {
//     console.log("\n\n");
//     logger.log("Running cron Densus Alert Kwh every 9 o'clock");
//     densusAlertKwh();
// }, {
//     scheduled: true,
//     timezone: "Asia/Jakarta"
// });


/*
 * Osase Collect KwH
 * Collecting osase kwh data to juan5684_osasemobile.kwh_counter_bck
 * Runs every Hour
 */
cron.schedule("0 0 * * * *", () => {
    console.log("\n\nRunning cron Osase Collect KwH every hour");
    osaseCollectKwh.main();
});

/*
 * Opnimus Alerting Port
 * Runs every minutes
 */
cron.schedule("* * * * *", () => {
    console.log("\n\nRunning cron Ports Alert (run on every minute)");
    opnimusAlertingPort.main();
});