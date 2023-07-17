const config = require("../config");
const JobQueue = require("../helpers/job-queue");
const getRtuList = require("../helpers/db-query/get-rtu-list");


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
    const params = defineParams(argKey, argVal);
    try {

        const rtuList = await getRtuList(params);
        const workerQueue = new JobQueue(config.alert.workerSlot);
        workerQueue.setDelay(config.alert.delayTime);
        
        rtuList.forEach(data => {
            workerQueue.registerWorker("alert", {
                level: params.level,
                workData: data
            });
        });
        
        workerQueue.run();

    } catch(err) {
        console.error(err);
    }
};