const createWorker = require("../helpers/create-worker");
const getNewosaseLocation = require("../helpers/get-newosase-location");

module.exports = async () => {
    console.log("\nsync-opnimus-location is starting..");
    try {
        
        const dataLocations = await getNewosaseLocation();

        // Worker Witel
        // await createWorker("sync opnimus witel", "sync-opnimus-witel", dataLocations);
        
        // Worker Datel
        await createWorker("sync opnimus datel", "sync-opnimus-datel", dataLocations);

    } catch(err) {
        console.error(err);
        console.log("\nsync-opnimus-location is stopped running..");
    }
};