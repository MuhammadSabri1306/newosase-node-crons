const cron = require("node-cron");
const newosaseRtuAlert = require("./rtu-alert");

cron.schedule("* * * * *", () => {
    console.log("Newosase RTU's Alert (run on every minute)");

    const date = new Date();
    console.log(`${ date.getFullYear() }-${ date.getMonth() + 1 }-${ date.getDate() } ${ date.getHours() }:${ date.getMinutes() }:${ date.getSeconds() }`);

    newosaseRtuAlert();
    console.log('');
});