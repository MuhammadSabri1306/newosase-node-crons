const { logErrorWithFilter } = require("../log-error");

const main = async () => {
    try {

        const data = null;
        const test = data.test;
        // throw new Error("Error when running worker worker-port-alarm.js");

    } catch(err) {

        // console.error(err);
        await logErrorWithFilter(err);

    }
};

main();