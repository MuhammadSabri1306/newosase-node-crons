const { parentPort, workerData } = require("worker_threads");
const { Logger } = require("../logger");
const { getNewosaseAlarms, filterNewosaseAlarms, defineAlarms } = require("../define-alarm");

const createJobs = (jobs, witelsAlarmDatas, app = {}) => {
    let { logger } = app;
    logger = Logger.getOrCreate(logger);

    return jobs.map(async (job) => {

        const jobId = job.id;
        const witelId = job.witel.id;

        const prevAlarms = witelId in witelsAlarmDatas ? witelsAlarmDatas[witelId] : [];
        if(!Array.isArray(prevAlarms)) {
            throw new Error(`expecting prevAlarms is is array, retrieved ${ typeof prevAlarms }`);
        }

        const newosaseAlarms = await getNewosaseAlarms(witelId, app);
        let currAlarms = newosaseAlarms;
        if(newosaseAlarms.length > 0) {
            currAlarms = filterNewosaseAlarms(newosaseAlarms);
            logger.info("newosase alarms was filtered", {
                witelId,
                count: newosaseAlarms.length,
                resultCount: currAlarms.length
            });
        }

        logger.info("start do defining alarms", {
            witelId,
            prevAlarmsCount: prevAlarms.length,
            currAlarm: newosaseAlarms.length
        });

        const { closedAlarms, changedAlarms, newAlarms } = defineAlarms(prevAlarms, currAlarms, app);
        logger.info("alarms was defined", {
            jobId,
            witelId,
            closedAlarmsCount: closedAlarms.length,
            changedAlarmsCount: changedAlarms.length,
            newAlarmsCount: newAlarms.length
        });

        parentPort.postMessage({ jobId, closedAlarms, changedAlarms, newAlarms });

    });
};

const { loggerConfig, jobsData, witelsAlarmDatas } = workerData;
const logger = new Logger(loggerConfig.threadId, loggerConfig.options);

const witelIds = jobsData.map(job => job.witel.id);
logger.info("starting worker-define-alarm", { witelIds });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const witelJobs = createJobs(jobsData, witelsAlarmDatas, { logger });
Promise.all(witelJobs);