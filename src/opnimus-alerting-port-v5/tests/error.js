const { ErrorLogger } = require("../apps/err-bot-logger");

const test = () => {
    return new Promise(resolve => {
        throw new Error("test error from promise");
    });
};

const test2 = async () => {

    const watchAlarmLogger = new ErrorLogger("alarmwatcher", "Cron watch-newosase-alarm");
    try {
        throw new Error("Test logging error in node");
    } catch(err) {
        await watchAlarmLogger.catch(err).logTo("-4092116808");
        throw err;
    }

};

const main = async () => {
    await test2();
};

main();