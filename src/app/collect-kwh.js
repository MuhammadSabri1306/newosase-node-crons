const JobQueue = require("../helpers/job-queue");
const modelDb = require("../model/collect-kwh/db");

module.exports = async () => {
    try {

        const rtuList = await modelDb.getRtuList();

        const workerQueue = new JobQueue(1);
        workerQueue.setDelay(1000);
        workerQueue.registerWorker("collect-rtu-kwh", { rtuList });

        // workerQueue.onEachAfter(item => {
        //     if(item && item.rtuItem && item.success === false) {
        //         workerQueue.registerWorker("collect-rtu-kwh", item.rtuItem);
        //     }
        // });

        workerQueue.run();

    } catch(err) {
        // logger.error(err);
    }
};