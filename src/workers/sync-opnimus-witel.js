const { parentPort, workerData } = require("worker_threads");
const updateDbWitel = require("../helpers/update-db-witel");

const opnimusLocations = workerData;
const formattedDataWitel = opnimusLocations.reduce((temp, item) => {

    if(temp.existsKey.indexOf(item.witel) < 0) {
        temp.dataWitel.push({
            id_witel: item.id_witel,
            witel: item.witel,
            id_regional: item.id_regional,
            regional: item.regional,
            sname_regional: item.sname_regional
        });
        temp.existsKey.push(item.witel);
    }

    return temp;

}, { dataWitel: [], existsKey: [] });

// console.log(formattedDataWitel.dataWitel.length);
// parentPort.postMessage(true);

updateDbWitel(formattedDataWitel.dataWitel)
    .then(() => {
        parentPort.postMessage(true);
    })
    .catch(err => console.error(err))
    .finally(() => process.exit());