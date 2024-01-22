const { parentPort, workerData } = require("worker_threads");

const createSamplePromise = (time, callback) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => callback({ resolve, reject }), time);
    });
};

const case1 = async () => {
    await createSamplePromise(500, ({ resolve }) => resolve());
};