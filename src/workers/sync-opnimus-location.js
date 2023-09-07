const { parentPort, workerData } = require("worker_threads");
const updateDbLocation = require("../helpers/update-db-location");
const { logger } = require("../helpers/logger");

const { dataLocations, jobQueueNumber } = workerData;
const run = async () => {
    logger.log(`Starting sync-opnimus-location:location thread, queue: ${ jobQueueNumber }`);
    try {
        await updateDbLocation(dataLocations);
        parentPort.postMessage(true);
        process.exit();
    } catch(err) {
        logger.error(err);
        process.exit();
    }
};

run();