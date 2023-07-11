const { parentPort, workerData } = require("worker_threads");
const syncRegionalPort = require("../app/sync-regional-port");
const telegramAlert = require("../app/telegram-alert");
// const readAlert = require("../app/read-alert");

const { dataRegional } = workerData;

const alertTo = (user, messageList) => {};

syncRegionalPort(dataRegional)
    .then(async (data) => {
        const { regionalId } = data;
        try {
            // await telegramAlert(regionalId);
            // const { alert, telegramUser } = readAlert(regionalId);
            parentPort.postMessage(dataRegional.divre_code);
        } catch(err) {
            console.log("\nFailed to sendMessage on regional: " + dataRegional.divre_code);
            console.error(err);
        }
    })
    .catch(err => {
        console.log("\nError when sync RTU Port on regional: " + dataRegional.divre_code);
        console.error(err);
    })
    .finally(() => process.exit());