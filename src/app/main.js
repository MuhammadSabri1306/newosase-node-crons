const { Worker, workerData } = require("worker_threads");
const path = require("path");
const Database = require("../helpers/newosase/database");

const createRegionalWorker = dataRegional => {
    return new Promise((resolve, reject) => {

        const workerPath = path.resolve(__dirname, "../workers/sync-rtu-port-status");
        const worker = new Worker(workerPath, {
            workerData: { dataRegional }
        });

        worker.on("message", divreCode => resolve(divreCode));
        worker.on("error", err => reject(err));
        worker.on("exit", (code) => {
            if(code !== 0)
                reject(new Error(`Worker on regional ${ dataRegional.divre_code } stopped with exit code ${code}`));
        });

    });
};

module.exports = async () => {
    console.log("\nmainApp is starting..");
    const db = new Database();

    try {

        const { results } = await db.runQuery("SELECT * FROM regional");
        // const { results } = await db.runQuery("SELECT * FROM regional WHERE id=2");
        for(let dataRegional of results) {
            await createRegionalWorker(dataRegional);
        }

    } catch(err) {
        console.error(err);
        console.log("\nmainApp is stopped running..");
    }
};