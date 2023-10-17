const { Worker } = require("worker_threads");
const path = require("path");

class JobQueue
{
    constructor(slotNum) {
        this.workers = [];
        this.completeWorkers = [];
        this.slotNum = slotNum;
        this.running = 0;
        this.activeQueueNumber = 0;

        this.delayTime = 0;
        this.isComplete = false;
        this.beforeRunCallback = null;
        this.afterRunCallback = null;
        this.eachAfterCallback = null;
    }

    registerWorker(workerPath, data) {
        const worker = JSON.parse(JSON.stringify({
            path: path.resolve(__dirname, "../" + workerPath + ".js"),
            data,
            params: {}
        }));
        this.workers.push(worker);
    }

    onBeforeRun(callback) {
        if(typeof callback == "function")
            this.beforeRunCallback = callback;
    }

    onAfterRun(callback) {
        if(typeof callback == "function")
            this.afterRunCallback = callback;
    }

    onEachAfter(callback) {
        if(typeof callback == "function")
            this.eachAfterCallback = callback;
    }

    run() {
        if(this.beforeRunCallback)
            this.beforeRunCallback();

        for (let i = 0; i < Math.min(this.workers.length, this.slotNum); i++) {
            this.executeNextJob();
        }
    }

    setDelay(timeMs) {
        this.delayTime = timeMs;
    }
  
    executeNextJob() {
        if (!this.workers || this.workers.length === 0) {
            if (this.running === 0 && !this.isComplete) {
                if(this.afterRunCallback)
                    this.afterRunCallback();
                this.isComplete = true;
            }
            return;
        }

        const currWorker = this.workers.shift();
        this.activeQueueNumber++;
        const jobQueueNumber = this.activeQueueNumber;
        
        const worker = new Worker(currWorker.path, {
            workerData: { ...currWorker.data, jobQueueNumber }
        });

        worker.on("message", resultData => {
            this.running--;
            this.completeWorkers.push(currWorker);
            
            if(typeof this.eachAfterCallback == "function")
                this.eachAfterCallback(resultData);
            
            if(this.delayTime)
                setTimeout(this.executeNextJob.bind(this), this.delayTime);
            else
                this.executeNextJob();
        });

        this.running++;
    }
}

module.exports = JobQueue;