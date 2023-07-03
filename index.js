const cron = require("node-cron");
const mainApp = require("./src/index");
const { toDatetimeString } = require("./src/helpers/date");

cron.schedule("*/2 * * * *", async () => {
    console.log("\n\nNewosase RTU's Alert (run on every 2 minute)");
    console.log(`Start at: ${ toDatetimeString(new Date()) }`);

    // newosaseRtuAlert();
    await mainApp();
    console.log(`Finish at: ${ toDatetimeString(new Date()) }`);
});