const { parentPort, workerData } = require("worker_threads");
const updateDbLocation = require("../helpers/update-db-location");

const opnimusLocations = workerData;

updateDbLocation(opnimusLocations)
    .then(() => {
        parentPort.postMessage(true);
    })
    .catch(err => console.error(err))
    .finally(() => process.exit());