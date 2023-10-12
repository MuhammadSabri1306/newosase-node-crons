const JobQueue = require("../helpers/job-queue");
const configAlert = require("../env/bot/densus-bot/alerts");

const modelAlertKwhDaily = require("../model/alert-kwh/daily");

module.exports = async () => {
    try {

        const alertKwhDaily = await modelAlertKwhDaily.get();
        modelAlertKwhDaily.connection.end();

        const workerQueue = new JobQueue(configAlert.kwhDaily.workerSlot);
        workerQueue.setDelay(configAlert.kwhDaily.delayTime);

        for(let i=0; i<alertKwhDaily.length; i++) {
            workerQueue.registerWorker("densus-alert-kwh", alertKwhDaily[i]);
        }

        workerQueue.run();

    } catch(err) {
        // logger.error(err);
    }
};