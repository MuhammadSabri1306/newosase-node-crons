const { parentPort, workerData } = require("worker_threads");
const { numb } = workerData;

console.log(numb);
parentPort.postMessage({
    numb
});
process.exit();