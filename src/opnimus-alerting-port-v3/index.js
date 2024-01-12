const main = require("./main");
const { toDatetimeString } = require("../helpers/date");

const runCron = async () => {
    const startTime = toDatetimeString(new Date());
    console.info(`\n\nRunning cron Opnimus Alerting Port V3 at ${ startTime }`);

    let app;
    let delayTime = 0;

    const getDelayTime = appInstance => {
        appInstance.registerDelayTimes(1000);
        const timeTarget = appInstance.getBiggestDelayTimestamp() - Date.now();
        return timeTarget > 0 ? timeTarget : 2000;
    };

    const offTimer = (time) => {
        return new Promise(resolve => setTimeout(resolve, time));
    };

    while(true) {

        app = await main();
        delayTime = getDelayTime(app);
        if(delayTime) {
            console.info(`Waiting delay for ${ delayTime }ms`);
            await offTimer(delayTime);
        } else {
            throw new Error(`Delay Time is not defined, delayTime:${ delayTime }`);
        }

    }
};

const args = process.argv.slice(2);
if(args.length > 0) {

    if(args[0] == "cron") {
        runCron();
    } else if(args[0] == "app") {
        main();
    }

}