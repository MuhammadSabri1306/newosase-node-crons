const { parentPort, workerData } = require("worker_threads");
const updateDbRtu = require("../helpers/update-db-rtu");

const opnimusLocations = workerData;
const formattedData = opnimusLocations.reduce((temp, location) => {

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

updateDbRtu(formattedData.rtu)
    .then(() => {
        parentPort.postMessage(true);
    })
    .catch(err => console.error(err))
    .finally(() => process.exit());