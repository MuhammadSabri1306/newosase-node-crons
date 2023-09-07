const { logger } = require("../helpers/logger");
const JobQueue = require("../helpers/job-queue");
const getNewosaseLocation = require("../helpers/get-newosase-location");

module.exports = async () => {
    console.log("\nsync-opnimus-location is starting..");
    try {
        
        const dataLocations = await getNewosaseLocation();
        const workerQueue = new JobQueue(2);
        workerQueue.setDelay(1000);

        // Worker Witel
        // await createWorker("sync opnimus witel", "sync-opnimus-witel", dataLocations);
        
        // Worker Datel
        // await createWorker("sync opnimus datel", "sync-opnimus-datel", dataLocations);
        
        // Worker Location
        workerQueue.registerWorker("sync-opnimus-location", { dataLocations });
        // await createWorker("sync opnimus location", "sync-opnimus-location", dataLocations);
        
        // Worker RTU
        workerQueue.registerWorker("sync-opnimus-rtu", { dataLocations });
        // await createWorker("sync opnimus RTU", "sync-opnimus-rtu", dataLocations);

        workerQueue.onBeforeRun(() => logger.log("Start to sync opnimus location."));
        workerQueue.onAfterRun(() => logger.log("Finish sync opnimus location."));
        workerQueue.run();

    } catch(err) {
        console.error(err);
        console.log("\nsync-opnimus-location is stopped running..");
    }
};