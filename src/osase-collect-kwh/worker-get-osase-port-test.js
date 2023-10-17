const { parentPort, workerData } = require("worker_threads");

const osaseBaseUrl = "https://opnimus.telkom.co.id/api/osasenewapi";
const osaseToken = "xg7DT34vE7";
const { rtuItem } = workerData;

const createDelay = () => {
    return new Promise(resolve => {
        setTimeout(() => resolve(), 300);
    });
};

const fetch = async (rtuItem) => {
    const workerResult = { success: false, data: { rtuItem } };
    try {
        await createDelay();
    } catch(err) {

    } finally {
        parentPort.postMessage(workerResult);
        process.exit();
    }

}

fetch(rtuItem);