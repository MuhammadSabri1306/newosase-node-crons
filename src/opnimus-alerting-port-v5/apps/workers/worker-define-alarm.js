const { parentPort, workerData } = require("worker_threads");
const { Logger } = require("../logger");
const { getNewosaseAlarms, filterNewosaseAlarms, defineAlarms } = require("../define-alarm");

const createJobs = (jobs, witelsAlarmDatas, witelsRtuAlarmDatas, app = {}) => {
    let { logger } = app;
    logger = Logger.getOrCreate(logger);

    return jobs.map(job => {
        return async () => {
            const jobId = job.id;
            const witelId = job.witel.id;

            const prevPortAlarms = witelId in witelsAlarmDatas ? witelsAlarmDatas[witelId] : [];
            if(!Array.isArray(prevPortAlarms)) {
                throw new Error(`expecting prevPortAlarms is is array, retrieved ${ typeof prevPortAlarms }`);
            }

            const prevRtuAlarms = witelId in witelsRtuAlarmDatas ? witelsRtuAlarmDatas[witelId] : [];
            if(!Array.isArray(prevRtuAlarms)) {
                throw new Error(`expecting prevRtuAlarms is is array, retrieved ${ typeof prevRtuAlarms }`);
            }

            const prevAlarms = { portAlarms: prevPortAlarms, rtuAlarms: prevRtuAlarms };

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

            const resultAlarms = defineAlarms(prevAlarms, currAlarms, app);
            const { closedAlarms, changedAlarms, newAlarms, closedRtuAlarms, newRtuAlarms } = resultAlarms;
            logger.info("alarms was defined", {
                jobId,
                witelId,
                closedAlarmsCount: closedAlarms.length,
                changedAlarmsCount: changedAlarms.length,
                newAlarmsCount: newAlarms.length,
                closedRtuAlarmsCount: closedRtuAlarms.length,
                newRtuAlarmsCount: newRtuAlarms.length,
            });

            parentPort.postMessage({ jobId, closedAlarms, changedAlarms, newAlarms, closedRtuAlarms, newRtuAlarms });
        };
    });
};

const { loggerConfig, jobsData, witelsAlarmDatas, witelsRtuAlarmDatas } = workerData;
const logger = Logger.initChildLogger(loggerConfig.threadId, loggerConfig.options);

const witelIds = jobsData.map(job => job.witel.id);
logger.info("starting worker-define-alarm", { witelIds });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const witelJobs = createJobs(jobsData, witelsAlarmDatas, witelsRtuAlarmDatas, { logger });
Promise.all( witelJobs.map(run => run()) );