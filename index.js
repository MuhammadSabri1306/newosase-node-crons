const cron = require("node-cron");
const { main, syncOpnimusLocation } = require("./src/index");
const { toDatetimeString } = require("./src/helpers/date");

/*
 * Main Alarm
 * Runs every 2 minutes
 */
// cron.schedule("*/2 * * * *", () => {
//     console.log("\n\nNewosase RTU's Alert (run on every 2 minute)");
//     console.log(`Start at: ${ toDatetimeString(new Date()) }`);
//     main().then(() =>  {
//         console.log(`Finish at: ${ toDatetimeString(new Date()) }`);
//     });
// });

/*
 * Newosase RTU list watcher
 * Synchronize RTU list to opnimus_db_new
 * Runs every 00.00 WIB
 */
cron.schedule("* * * * *", () => {
    console.log("\n\nWatch Newosase location (run on every 1 minute)");
    console.log(`Start at: ${ toDatetimeString(new Date()) }`);
    syncOpnimusLocation().then(() =>  {
        console.log(`Finish at: ${ toDatetimeString(new Date()) }`);
    });
}, {
    timezone: "Asia/Jakarta"
});