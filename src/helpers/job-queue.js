const { Worker } = require("worker_threads");
const path = require("path");

class JobQueue
{
    constructor(slotNum) {
        this.workers = [];
        this.completeWorkers = [];
        this.slotNum = slotNum;
        this.running = 0;

        this.delayTime = 0;
    }

    registerWorker(workerPath, data) {
        const worker = JSON.parse(JSON.stringify({
            path: path.resolve(__dirname, "../workers/" + workerPath + ".js"),
            data,
            params: {}
        }));
        this.workers.push(worker);
    }
  
    run() {
        for (let i = 0; i < Math.min(this.workers.length, this.slotNum); i++) {
            this.executeNextJob();
        }
    }

    setDelay(timeMs) {
        this.delayTime = timeMs;
    }
  
    executeNextJob() {
        if (!this.workers || this.workers.length === 0) {
            if (this.running === 0) {
                console.log("All jobs completed.");
            }
            return;
        }

        const currWorker = this.workers.shift();
        const worker = new Worker(currWorker.path, {
            workerData: currWorker.data
        });

        worker.on("message", () => {
            this.running--;
            this.completeWorkers.push(currWorker);
            
            if(this.delayTime)
                setTimeout(this.executeNextJob, this.delayTime);
            else
                this.executeNextJob();
        });

        this.running++;
    }
}

module.exports = JobQueue;