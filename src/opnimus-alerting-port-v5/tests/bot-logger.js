const { ErrorLogger } = require("../apps/err-bot-logger");
const { watch, addDelay } = require("../apps/watcher");

const test = () => {

    const run = (app = {}) => {
        const { watcher } = app;

        console.log("add delay 1000ms");
        addDelay(watcher, 1000);

        console.log("throwing error");
        throw new Error("Oops you're throwing an error");
    };

    const errLogger = new ErrorLogger("alarmwatcher", "Test node cron telegram logger");

    watch(async (watcher) => {
        try {
            await run({ watcher });
        } catch(err) {
            await errLogger
                .catch(err)
                .logTo("-4092116808");
            throw err;
        }
    }, {
        onError: err => (console.log("test") || true) && console.error(err)
    });

};

test();