const { parentPort, workerData } = require("worker_threads");
const updateDbDatel = require("../helpers/update-db-datel");

const opnimusLocations = workerData;
const formattedData = opnimusLocations.reduce((temp, item) => {

    if(temp.existsKey.indexOf(item.datel) < 0) {
        temp.datel.push({
            id_datel: item.id_datel,
            datel: item.datel,
            id_witel: item.id_witel
        });
        temp.existsKey.push(item.datel);
    }

    return temp;

}, { datel: [], existsKey: [] });

updateDbDatel(formattedData.datel)
    .then(() => {
        parentPort.postMessage(true);
    })
    .catch(err => console.error(err))
    .finally(() => process.exit());