const cron = require("node-cron");
const { main } = require("./src/index");
const { toDatetimeString } = require("./src/helpers/date");

/*
 * Main Alarm
 * Running each 2 minutes
 */
cron.schedule("*/2 * * * *", () => {
    console.log("\n\nNewosase RTU's Alert (run on every 2 minute)");
    console.log(`Start at: ${ toDatetimeString(new Date()) }`);
    main().then(() =>  {
        console.log(`Finish at: ${ toDatetimeString(new Date()) }`);
    });
});

/*
 * Refresh RTU list in table rtu_list
 * Source from API newosase
 * Running each 2 minutes
 */