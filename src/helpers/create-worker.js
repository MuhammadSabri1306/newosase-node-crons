const { Worker } = require("worker_threads");
const path = require("path");

module.exports = (name, workerPath, workerData) => {
    return new Promise((resolve, reject) => {

        workerPath = path.resolve(__dirname, "../workers/" + workerPath + ".js");
        const worker = new Worker(workerPath, { workerData });

        worker.on("message", data => resolve(data));
        worker.on("error", err => reject(err));
        worker.on("exit", (code) => {
            if(code !== 0)
                reject(new Error(`Worker ${ name } stopped with exit code ${code}`));
        });

    });
};