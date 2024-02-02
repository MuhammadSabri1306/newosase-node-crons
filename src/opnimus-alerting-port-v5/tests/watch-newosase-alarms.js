const dbOpnimusNewConfig = require("../../env/database/opnimus-new-migrated-2");
const { useSequelize, useModel } = require("../apps/models");
const { Op } = require("sequelize");
const { Logger } = require("../apps/logger");
const { createSequelize, syncAlarms } = require("../apps");
const path = require("path");
const { watch, addDelay } = require("../apps/watcher");
const { Worker } = require("worker_threads");

const updateOrCreateAlarms = async (newAlarms = [], app = {}) => {
    let { logger, jobId, sequelize } = app;
    logger = Logger.getOrCreate(logger);

    const result = { alarmIds: [], alarmHistoryIds: [] };
    if(newAlarms.length < 1) {
        logger.info("newAlarms is empty", { jobId });
        return result;
    }

    try {

        const { Alarm, AlarmHistory } = useModel(sequelize);
        const portIds = newAlarms.map(alarm => alarm.portId);
        const existsAlarms = await Alarm.findAll({
            where: {
                portId: { [Op.in]: portIds }
            }
        });

        const works = [];
        newAlarms.forEach(alarm => {

            const existsAlarm = existsAlarms.find(item => item.portId == alarm.portId);
            const isAlarmExists = existsAlarm ? true : false;

            const {
                alarmType, portId, portNo, portName, portValue, portUnit, portSeverity, portDescription,
                portIdentifier, portMetrics, rtuId, rtuSname, rtuStatus, alertStartTime
            } = alarm;

            if(isAlarmExists) {
                works.push(async () => {

                    const alarmData = {
                        alarmType, portId, portNo, portName, portValue, portUnit, portSeverity,
                        portDescription, portIdentifier, portMetrics, rtuId, rtuSname, rtuStatus,
                        isOpen: true
                    };

                    logger.info("update opened alarm in Alarm model", { jobId, alarmId: existsAlarm.alarmId });
                    const alarm = await Alarm.findOne({
                        where: { alarmId: 306 }
                    });

                    logger.info("insert opened alarm in AlarmHistory model", { jobId, alarmId: existsAlarm.alarmId });
                    const alarmHistory = await AlarmHistory.findOne({
                        where: { alarmHistoryId: 11835 }
                    });

                    return { alarmId: alarm.alarmId, alarmHistoryId: alarmHistory.alarmHistoryId };

                });
            } else {
                works.push(async () => {

                    const alarmData = {
                        alarmType, portId, portNo, portName, portValue, portUnit, portSeverity,
                        portDescription, portIdentifier, portMetrics, rtuId, rtuSname, rtuStatus,
                        isOpen: true, createdAt: new Date()
                    };

                    logger.info("insert opened alarm in Alarm model", { jobId, portId: alarm.portId });
                    const insertedAlarm = await Alarm.findOne({
                        where: { alarmId: 306 }
                    });

                    logger.info("insert opened alarm in AlarmHistory model", { jobId, alarmId: insertedAlarm.alarmId });
                    const alarmHistory = await AlarmHistory.findOne({
                        where: { alarmHistoryId: 11835 }
                    });

                    return { alarmId: insertedAlarm.alarmId, alarmHistoryId: alarmHistory.alarmHistoryId };

                });
            }

        });

        const workResults = await Promise.all( works.map(work => work()) );
        workResults.forEach(({ alarmId, alarmHistoryId }) => {
            result.alarmIds.push(alarmId);
            result.alarmHistoryIds.push(alarmHistoryId);
        });

        return result;

    } catch(err) {
        logger.error(err);
        return result;
    }
};

const updateAlarms = async (changedAlarms = [], app = {}) => {
    let { logger, jobId, sequelize } = app;
    logger = Logger.getOrCreate(logger);
    
    if(changedAlarms.length < 1) {
        logger.info("changedAlarms is empty", { jobId });
        return { alarmIds: [], alarmHistoryIds: [] };
    }

    try {

        const { Alarm, AlarmHistory } = useModel(sequelize);
        const works = [];

        const alarmIds = [];
        const newHistoryDatas = [];
        changedAlarms.forEach(({ alarmId, data }) => {
            alarmIds.push(alarmId);
            const {
                alarmType, portId, portNo, portName, portValue, portUnit, portSeverity, portDescription,
                portIdentifier, portMetrics, rtuId, rtuSname, rtuStatus, alertStartTime
            } = data;

            works.push(async () => {
                const alarmData = {
                    alarmType, portId, portNo, portName, portValue, portUnit, portSeverity,
                    portDescription, portIdentifier, portMetrics, rtuId, rtuSname, rtuStatus
                };
                logger.info("update changed alarm in Alarm model", { jobId, alarmId });
                // return Alarm.update(alarmData, {
                //     where: { alarmId }
                // });
                return null;
            });

            newHistoryDatas.push({
                alarmId, alarmType, portId, portNo, portName, portValue, portUnit, portSeverity,
                portDescription, portIdentifier, portMetrics, rtuId, rtuSname, rtuStatus,
                alertStartTime: alertStartTime || null, openedAt: new Date()
            });
        });

        await Promise.all( works.map(work => work()) );

        logger.info("write changed alarms to AlarmHistory model", { jobId, alarmIds });
        const alarmHistories = await AlarmHistory.bulkCreate(newHistoryDatas);
        const alarmHistoryIds = alarmHistories.map(item => item.alarmHistoryId);

        return { alarmIds, alarmHistoryIds };

    } catch(err) {
        logger.error(err);
        return { alarmIds: [], alarmHistoryIds: [] };
    }
};

const main = async () => {
    const sequelize = createSequelize();
    const { Alarm } = useModel(sequelize);

    const test = await updateOrCreateAlarms([1], { sequelize });
    console.log(test);

    sequelize.close();
};

main();