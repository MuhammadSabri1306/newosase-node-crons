const App = require("./App");
const newosaseWatcher = require("./newosase-watcher");
const telegramAlerting = require("./telegram-alerting");
const { toDatetimeString } = require("../helpers/date");

const offTimer = (time) => {
    return new Promise(resolve => setTimeout(resolve, time));
};

const runNewosaseWatcherCron = async () => {
    const startTime = toDatetimeString(new Date());
    console.info(`\n\nRunning cron Opnimus Alerting Port V4:newosase-watcher at ${ startTime }`);

    let app;
    while(true) {

        app = new App(null, "newosase-watcher");
        await newosaseWatcher.main(app);
        await offTimer(2000);

    }
};

const runTelegramAlertingCron = async () => {
    const startTime = toDatetimeString(new Date());
    console.info(`\n\nRunning cron Opnimus Alerting Port V4:telegram-alerting at ${ startTime }`);

    let app;

    let delayTime = 0;
    const getDelayTime = appInstance => {
        appInstance.registerDelayTimes(1000);
        const timeTarget = appInstance.getBiggestDelayTimestamp() - Date.now();
        return timeTarget > 0 ? timeTarget : 2000;
    };

    while(true) {

        app = new App(null, "telegram-alerting");
        await telegramAlerting.main(app);
        delayTime = getDelayTime(app);
        if(delayTime) {
            console.info(`Waiting delay for ${ delayTime }ms`);
            await offTimer(delayTime);
        } else {
            throw new Error(`Delay Time is not defined, delayTime:${ delayTime }`);
            await offTimer(2000);
        }

    }
};

const runNewosaseWatcher = async () => {
    const app = new App(null, "newosase-watcher");
    await newosaseWatcher.main(app);
};

const runTelegramAlerting = async () => {
    const app = new App(null, "telegram-alerting");
    await telegramAlerting.main(app);
};

const args = process.argv.slice(2);
if(args.length > 0) {

    if(args[0] == "newosase-watcher") {
        if(args.length > 1 && args[1] == "cron") {
            runNewosaseWatcherCron();
        } else {
            runNewosaseWatcher();
        }
    } else if(args[0] == "telegram-alerting") {
        if(args.length > 1 && args[1] == "cron") {
            runTelegramAlertingCron();
        } else {
            runTelegramAlerting();
        }
    } else if(args[0] == "cron") {
        runNewosaseWatcherCron();
        runTelegramAlertingCron();
    }

}