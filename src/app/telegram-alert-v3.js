const config = require("../config");
const JobQueue = require("../helpers/job-queue");
const getRtuList = require("../helpers/db-query/get-rtu-list");
const { logger } = require("../helpers/logger");

const defineParams = (argKey, argVal) => {
    let definedConfig = {};

    if(argKey !== null && argVal !== null) {
        definedConfig[argKey] = argVal;
    } else {
        for(let key in config.alert.params) {
            definedConfig[key] = config.alert.params[key];
        }
    }

    if(definedConfig.witelId)
        return { level: "witel", witelId: definedConfig.witelId };
    if(definedConfig.regionalId)
        return { level: "regional", regionalId: definedConfig.regionalId };
    return { level: null };
};

module.exports = async (argKey = null, argVal = null) => {
    // const params = defineParams(argKey, argVal);
    const params = { level: null }; // nasional
    try {

        const witelList = await getRtuList(params); // group by witel
        const workerQueue = new JobQueue(config.alert.workerSlot);
        workerQueue.setDelay(config.alert.delayTime);
        
        witelList.forEach(data => {
            workerQueue.registerWorker("alert", {
                level: params.level,
                workData: data
            });
        });

        workerQueue.onBeforeRun(() => logger.log("Thread queue started."));
        workerQueue.onAfterRun(() => logger.log("All thread queue completed."));
        workerQueue.run();

    } catch(err) {
        logger.error(err);
    }
};