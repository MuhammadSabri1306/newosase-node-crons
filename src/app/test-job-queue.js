const JobQueue = require("../helpers/job-queue");
const config = require("../config");

module.exports = () => {
    const workerQueue = new JobQueue(config.alert.workerSlot);
    workerQueue.setDelay(config.alert.delayTime);
    
    for(let i=1; i<=49; i++) {
        workerQueue.registerWorker("test-job", {
            numb: i
        });
    }

    workerQueue.run();
};