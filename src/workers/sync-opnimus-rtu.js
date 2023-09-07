const { parentPort, workerData } = require("worker_threads");
const updateDbRtu = require("../helpers/update-db-rtu");
const { logger } = require("../helpers/logger");

const { dataLocations, jobQueueNumber } = workerData;
const formattedData = dataLocations.reduce((temp, location) => {

    location.rtus.forEach(rtuItem => {
        if(temp.existsKey.indexOf(rtuItem.id) < 0) {
            temp.rtu.push({
                id: rtuItem.id,
                name: rtuItem.name,
                sname: rtuItem.sname,
                location_id: location.id,
                datel_id: location.id_datel,
                witel_id: location.id_witel,
                regional_id: location.id_regional,
            });
            temp.existsKey.push(rtuItem.id);
        }
    });

    return temp;

}, { rtu: [], existsKey: [] });

const run = async () => {
    logger.log(`Starting sync-opnimus-location:rtu thread, queue: ${ jobQueueNumber }`);
    try {
        await updateDbRtu(formattedData.rtu);
        parentPort.postMessage(true);
        process.exit();
    } catch(err) {
        logger.error(err);
        process.exit();
    }
};

run();