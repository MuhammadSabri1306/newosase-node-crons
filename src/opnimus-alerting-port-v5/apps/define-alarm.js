const axios = require("axios");
const { Op } = require("sequelize");
const { useModel, toUnderscoredPlain } = require("./models");
const { Logger } = require("./logger");
const { isRuleMatch } = require("./alert-mode");
const { toDatetimeString } = require("../../helpers/date");

module.exports.isRtuDown = rtuStatus => rtuStatus.toString().toLowerCase() == "off";
module.exports.hasPlnRules = (userRule) => isRuleMatch({ port_name: "Status PLN" }, userRule);
module.exports.hasGensetRules = (userRule) => isRuleMatch({ port_name: "Status DEG" }, userRule);

module.exports.getAlarmsOfWitels = async (witelIds, app = {}) => {
    let { sequelize, logger } = app;
    logger = Logger.getOrCreate(logger);
    logger.info("get alarms of witels", { witelIds });

    const witelAlarms = {};
    try {

        const { Alarm, Rtu } = useModel(sequelize);
        const alarms = await Alarm.findAll({
            where: {
                isOpen: true,
            },
            include: [{
                model: Rtu,
                required: true,
                where: {
                    witelId: { [Op.in]: witelIds }
                }
            }]
        });

        alarms.forEach(alarm => {
            const witelId = alarm.rtu.witelId;
            if(!Array.isArray(witelAlarms[witelId]))
                witelAlarms[witelId] = [];
            witelAlarms[witelId].push(alarm.get({ plain: true }));
        });

    } catch(err) {
        logger.error(err);
    } finally {
        return witelAlarms;
    }
};

module.exports.getRtuAlarmsOfWitels = async (witelIds, app = {}) => {
    let { sequelize, logger } = app;
    logger = Logger.getOrCreate(logger);
    logger.info("get RTU alarms of witels", { witelIds });

    const witelRtuAlarms = {};
    try {

        const { AlarmHistoryRtu, Rtu } = useModel(sequelize);
        const rtuAlarms = await AlarmHistoryRtu.findAll({
            where: {
                isOpen: true
            },
            include: [{
                model: Rtu,
                required: true,
                where: {
                    witelId: { [Op.in]: witelIds }
                }
            }]
        });

        rtuAlarms.forEach(alarm => {
            const witelId = alarm.rtu.witelId;
            if(!Array.isArray(witelRtuAlarms[witelId]))
                witelRtuAlarms[witelId] = [];
            witelRtuAlarms[witelId].push(alarm.get({ plain: true }));
        });

    } catch(err) {
        logger.error(err);
    } finally {
        return witelRtuAlarms;
    }
};

module.exports.getNotifiedClosedPortAlarms = async (closedAlarms, app = {}) => {
    let { logger, jobId, sequelize } = app;
    logger = Logger.getOrCreate(logger);

    const alarmIds = [];
    const alarmHistoryIds = [];
    if(closedAlarms.length < 1) {
        logger.info("no closed alarms to notified");
        return { alarmIds, alarmHistoryIds };
    }
    try {

        const { Alarm, AlarmHistory } = useModel(sequelize);
        const closedAlarmIds = closedAlarms.map(item => item.alarmId);

        logger.info("get closed alarms to notified", { jobId, alarmIds });
        const closedAlarmGroups = await AlarmHistory.findAll({
            attributes: [
                "alarmId",
                [sequelize.literal("MAX(alarm_history_id)"), "alarmHistoryId"]
            ],
            where: {
                alarmId: { [Op.in]: closedAlarmIds },
                portName: { [Op.in]: ["Status PLN", "Status DEG"] }
            },
            group: "alarmId"
        });

        for(let i=0; i<closedAlarmGroups.length; i++) {
            alarmIds.push(closedAlarmGroups[i].alarmId);
            alarmHistoryIds.push(closedAlarmGroups[i].alarmHistoryId);
        }

    } catch(err) {
        logger.error(err);
    } finally {
        return { alarmIds, alarmHistoryIds };
    }
};

module.exports.closeAlarms = async (closedAlarms, app = {}) => {
    let { logger, jobId, sequelize } = app;
    logger = Logger.getOrCreate(logger);
    
    if(closedAlarms.length < 1) {
        logger.info("closedAlarms is empty", { jobId });
        return;
    }

    try {

        const { Alarm, AlarmHistory } = useModel(sequelize);
        const alarmIds = closedAlarms.map(item => item.alarmId);
        
        const updateAlarmWork = () => {
            logger.info("update closed alarms in Alarm model", { jobId, alarmIds });
            return Alarm.update({ isOpen: false, portSeverity: "normal" }, {
                where: {
                    alarmId: { [Op.in]: alarmIds }
                }
            });
        };

        const updateAlarmHistoryWork = () => {
            logger.info("update closed alarms in AlarmHistory model", { jobId, alarmIds });
            return AlarmHistory.update({ closedAt: new Date() }, {
                where: {
                    alarmId: { [Op.in]: alarmIds }
                }
            });
        }

        await Promise.all([
            updateAlarmWork(),
            updateAlarmHistoryWork()
        ]);

    } catch(err) {
        logger.error(err);
    }
};

module.exports.updateAlarms = async (changedAlarms, app = {}) => {
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
                return Alarm.update(alarmData, {
                    where: { alarmId }
                });
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

module.exports.updateOrCreateAlarms = async (newAlarms, app = {}) => {
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
                    await Alarm.update(alarmData, {
                        where: { alarmId: existsAlarm.alarmId }
                    });

                    logger.info("insert opened alarm in AlarmHistory model", { jobId, alarmId: existsAlarm.alarmId });
                    const alarmHistory = await AlarmHistory.create({
                        alarmId: existsAlarm.alarmId, alarmType, portId, portNo, portName, portValue, portUnit,
                        portSeverity, portDescription, portIdentifier, portMetrics, rtuId, rtuSname, rtuStatus,
                        alertStartTime: alertStartTime || null, openedAt: new Date()
                    });

                    return { alarmId: existsAlarm.alarmId, alarmHistoryId: alarmHistory.alarmHistoryId };

                });
            } else {
                works.push(async () => {

                    const alarmData = {
                        alarmType, portId, portNo, portName, portValue, portUnit, portSeverity,
                        portDescription, portIdentifier, portMetrics, rtuId, rtuSname, rtuStatus,
                        isOpen: true, createdAt: new Date()
                    };

                    logger.info("insert opened alarm in Alarm model", { jobId, portId: alarm.portId });
                    const insertedAlarm = await Alarm.create(alarmData);

                    logger.info("insert opened alarm in AlarmHistory model", { jobId, alarmId: insertedAlarm.alarmId });
                    const alarmHistory = await AlarmHistory.create({
                        alarmId: insertedAlarm.alarmId, alarmType, portId, portNo, portName, portValue, portUnit,
                        portSeverity, portDescription, portIdentifier, portMetrics, rtuId, rtuSname, rtuStatus,
                        alertStartTime: alertStartTime || null, openedAt: new Date()
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

module.exports.closeRtuAlarms = async (closedRtuAlarms, app = {}) => {
    let { logger, jobId, sequelize } = app;
    logger = Logger.getOrCreate(logger);
    
    if(closedRtuAlarms.length < 1) {
        logger.info("closedRtuAlarms is empty", { jobId });
        return;
    }

    try {

        const { AlarmHistoryRtu } = useModel(sequelize);
        const alarmHistoryRtuIds = closedRtuAlarms.map(item => item.alarmHistoryRtuId);

        logger.info("update closed RTU alarms in AlarmHistoryRtu model", { jobId, alarmHistoryRtuIds });
        await AlarmHistoryRtu.update({ isOpen: false }, {
            where: {
                alarmHistoryRtuId: { [Op.in]: alarmHistoryRtuIds }
            }
        });

    } catch(err) {
        logger.error(err);
    }
};

module.exports.createRtuAlarms = async (newRtuAlarms, app = {}) => {
    let { logger, jobId, sequelize } = app;
    logger = Logger.getOrCreate(logger);

    if(newRtuAlarms.length < 1) {
        logger.info("newRtuAlarms is empty", { jobId });
        return;
    }

    try {

        const { AlarmHistoryRtu, Rtu } = useModel(sequelize);

        const insertedRtuSnames = [];
        const alarmHistoryRtuDatas = newRtuAlarms.map(item => {
            const currDate = new Date();
            const nextAlertDate = item.alertStartTime ? new Date(item.alertStartTime) : new Date(currDate);
            nextAlertDate.setMinutes( nextAlertDate.getMinutes() + 5 );
            insertedRtuSnames.push(item.rtuSname);
            return {
                rtuId: item.rtuId,
                rtuSname: item.rtuSname,
                rtuStatus: item.rtuStatus,
                isOpen: true,
                alertStartTime: item.alertStartTime,
                openedAt: currDate,
                nextAlertAt: nextAlertDate
            };
        });

        logger.info("insert new RTU alarms in AlarmHistoryRtu model", { jobId, insertedRtuSnames });
        await AlarmHistoryRtu.bulkCreate(alarmHistoryRtuDatas);

    } catch(err) {
        logger.error(err);
    }
};

module.exports.getTelegramGroupTarget = async (regionalIds, witelIds, app = {}) => {
    let { logger, sequelize } = app;
    logger = Logger.getOrCreate(logger);

    let groupUsers = [];
    try {

        if(!Array.isArray(regionalIds))
            throw new Error(`regionalIds should be array, ${ typeof regionalIds } given`);
        if(!Array.isArray(witelIds))
            throw new Error(`witelIds should be array, ${ typeof witelIds } given`);

        const { TelegramUser, AlertUsers, AlertModes } = useModel(sequelize);
        groupUsers = await TelegramUser.findAll({
            where: {
                [Op.and]: [
                    { isPic: false },
                    {
                        [Op.or]: [
                            { level: "nasional" },
                            { level: "regional", regionalId: { [Op.in]: regionalIds } },
                            { level: "witel", witelId: { [Op.in]: witelIds } },
                        ]
                    }
                ]
            },
            order: [ "registId", "regionalId", "witelId" ],
            include: [{
                model: AlertUsers,
                required: true,
                where: {
                    [Op.and]: [
                        { cronAlertStatus: true },
                        { userAlertStatus: true }
                    ]
                },
                include: [{
                    model: AlertModes,
                    required: true,
                }]
            }]
        });

    } catch(err) {
        logger.error(err);
    } finally {
        return groupUsers;
    }
};

module.exports.getPicTelegramTarget = async (locIds, app = {}) => {
    let { logger, sequelize } = app;
    logger = Logger.getOrCreate(logger);

    let picUsers = [];
    try {

        if(!Array.isArray(locIds))
            throw new Error(`locIds should be array, ${ typeof locIds } given`);

        const { TelegramUser, AlertUsers, AlertModes, PicLocation } = useModel(sequelize);
        picUsers = await TelegramUser.findAll({
            where: { isPic: true },
            order: [ "picRegistId" ],
            include: [{
                model: AlertUsers,
                required: true,
                where: {
                    [Op.and]: [
                        { cronAlertStatus: true },
                        { userAlertStatus: true }
                    ]
                },
                include: [{
                    model: AlertModes,
                    required: true,
                }]
            }, {
                model: PicLocation,
                required: true,
                where: {
                    locationId: { [Op.in]: locIds }
                }
            }]
        });

    } catch(err) {
        logger.error(err);
    } finally {
        return picUsers;
    }
};

module.exports.extractAlarmsLevel = (alarms) => {
    const regionalIds = [];
    const witelIds = [];
    const locIds = [];

    for(let i=0; i<alarms.length; i++) {
        let regionalId = alarms[i].rtu.regionalId;
        if(regionalIds.indexOf(regionalId) < 0)
            regionalIds.push(regionalId);

        let witelId = alarms[i].rtu.witelId;
        if(witelIds.indexOf(witelId) < 0)
            witelIds.push(witelId);

        let locId = alarms[i].rtu.locationId;
        if(locIds.indexOf(locId) < 0)
            locIds.push(locId);
    }

    return { regionalIds, witelIds, locIds };
};

module.exports.writeAlertStack = async (witel, alarmIds, alarmHistoryIds, alertType = null, app = {}) => {
    let { logger, jobId, sequelize } = app;
    logger = Logger.getOrCreate(logger);

    if(alarmIds.length < 1) {
        logger.info("no alarms to write as alerts", { jobId, alertType });
        return;
    }

    try {

        const { AlarmHistory, Rtu, AlertStack } = useModel(sequelize);

        logger.info("get alarms to write as telegram alert", { jobId, alertType, alarmIds });
        const alarmHistories = await AlarmHistory.findAll({
            where: {
                alarmHistoryId: { [Op.in]: alarmHistoryIds },
            },
            include: [{
                model: Rtu,
                required: true
            }]
        });

        const { regionalIds,  witelIds,  locIds } = this.extractAlarmsLevel(alarmHistories);
        const works = {};

        works.getGroupUsers = () => {
            logger.info("get telegram groups of alarms", { jobId, alertType, alarmIds });
            return this.getTelegramGroupTarget(regionalIds, witelIds, { logger, sequelize });
        };

        works.getPicUsers = () => {
            logger.info("get telegram user of alarm pics", { jobId, alertType, alarmIds });
            return this.getPicTelegramTarget(locIds, { logger, sequelize });
        };

        const [ groupUsers, picUsers ] = await Promise.all([
            works.getGroupUsers(),
            works.getPicUsers()
        ]);
        
        const alertStackDatas = [];
        alarmHistories.forEach(alarm => {

            picUsers.forEach(user => {
                const isUserMatch = isRuleMatch(toUnderscoredPlain(alarm), user.alertUser.alertMode.rules);
                if(!isUserMatch) return;
                user.picLocations.forEach(loc => {
                    let isLocMatch = loc.locationId == alarm.rtu.locationId;
                    if(!isLocMatch)
                        return;
                    alertStackDatas.push({
                        alarmHistoryId: alarm.alarmHistoryId,
                        alertType,
                        telegramChatId: user.userId,
                        status: "unsended",
                        createdAt: new Date()
                    });
                    logger.info("founded pic of alarms", {
                        alertType,
                        alarmHistoryId: alarm.alarmHistoryId,
                        telegramUserId: user.id,
                        locationId: loc.locationId
                    });
                });
            });

            groupUsers.forEach(user => {
                const isUserMatch = isRuleMatch(toUnderscoredPlain(alarm), user.alertUser.alertMode.rules);
                if(!isUserMatch) return;

                let isLocMatch = false;
                if(user.level == "nasional")
                    isLocMatch = true;
                else if(user.level == "regional" && user.regionalId == alarm.rtu.regionalId)
                    isLocMatch = true;
                else if(user.level == "witel" && user.witelId == alarm.rtu.witelId)
                    isLocMatch = true;

                if(!isLocMatch)
                    return;
                alertStackDatas.push({
                    alarmHistoryId: alarm.alarmHistoryId,
                    alertType,
                    telegramChatId: user.chatId,
                    status: "unsended",
                    createdAt: new Date()
                });
                logger.info("founded group of alarms", {
                    alertType,
                    alarmHistoryId: alarm.alarmHistoryId,
                    telegramUserId: user.id
                });
            });
            
        });

        if(alertStackDatas.length < 1) {
            logger.info("no telegram alert to write", { jobId, alertType, alarmIds });
            return;
        }

        await AlertStack.bulkCreate(alertStackDatas);
        logger.info("writing telegram alert stack was done", { jobId, alertType, alertStackCount: alertStackDatas.length });

    } catch(err) {
        logger.info("failed to write alert stack", { jobId, alertType, alarmIds });
        logger.error(err);
    }
};

module.exports.writeAlertStackOpenPort = (witel, alarmIds, alarmHistoryIds, app = {}) => {
    return this.writeAlertStack(witel, alarmIds, alarmHistoryIds, "open-port", app);
};

module.exports.writeAlertStackClosePort = async (witel, closedAlarms, app = {}) => {
    const { alarmIds, alarmHistoryIds } = await this.getNotifiedClosedPortAlarms(closedAlarms, app);
    await this.writeAlertStack(witel, alarmIds, alarmHistoryIds, "close-port", app);
};

module.exports.writeAlertStackRtuDown = async (witel, app = {}) => {
    let { logger, jobId, sequelize } = app;
    logger = Logger.getOrCreate(logger);
    try {

        const { AlarmHistoryRtu, Rtu, Location, Witel, Regional, AlertStackRtu } = useModel(sequelize);

        const currDate = new Date();

        logger.info("get rtu alarms to write as RTU down alert", { jobId, searchDate: toDatetimeString(currDate) });
        const alarmHistoryRtus = await AlarmHistoryRtu.findAll({
            where: {
                isOpen: true,
                nextAlertAt: { [Op.lte]: currDate }
            },
            include: [{
                model: Rtu,
                required: true,
                where: { witelId: witel.id },
                include: [{
                    model: Location
                }, {
                    model: Regional,
                    required: true
                }, {
                    model: Witel,
                    required: true
                }]
            }]
        });

        if(alarmHistoryRtus.length < 1) {
            logger.info("no rtu alarms to write as RTU down alerts", { jobId });
            return;
        }

        const { regionalIds,  witelIds,  locIds } = this.extractAlarmsLevel(alarmHistoryRtus);
        const works = {};

        works.getGroupUsers = () => {
            logger.info("get telegram groups of RTU down alarms", { jobId });
            return this.getTelegramGroupTarget(regionalIds, witelIds, { logger, sequelize });
        };

        works.getPicUsers = () => {
            logger.info("get telegram user of RTU down alarm pics", { jobId });
            return this.getPicTelegramTarget(locIds, { logger, sequelize });
        };

        const [ groupUsers, picUsers ] = await Promise.all([
            works.getGroupUsers(),
            works.getPicUsers()
        ]);
        
        const alertStackDatas = [];
        const updatedAlarmIds = [];
        alarmHistoryRtus.forEach(alarm => {

            updatedAlarmIds.push(alarm.alarmHistoryRtuId);

            picUsers.forEach(user => {
                const isUserMatch = this.hasPlnRules(user.alertUser.alertMode.rules);
                if(!isUserMatch) return;
                user.picLocations.forEach(loc => {
                    let isLocMatch = loc.locationId == alarm.rtu.locationId;
                    if(!isLocMatch)
                        return;
                    alertStackDatas.push({
                        alarmHistoryRtuId: alarm.alarmHistoryRtuId,
                        alertType: "rtu-down",
                        telegramChatId: user.userId,
                        status: "unsended",
                        createdAt: new Date()
                    });
                    logger.info("founded pic of RTU down alarms", {
                        alarmHistoryRtuId: alarm.alarmHistoryRtuId,
                        telegramUserId: user.id,
                        locationId: loc.locationId
                    });
                });
            });

            groupUsers.forEach(user => {
                const isUserMatch = this.hasPlnRules(user.alertUser.alertMode.rules);
                if(!isUserMatch) return;

                let isLocMatch = false;
                if(user.level == "nasional")
                    isLocMatch = true;
                else if(user.level == "regional" && user.regionalId == alarm.rtu.regionalId)
                    isLocMatch = true;
                else if(user.level == "witel" && user.witelId == alarm.rtu.witelId)
                    isLocMatch = true;

                if(!isLocMatch)
                    return;
                alertStackDatas.push({
                    alarmHistoryRtuId: alarm.alarmHistoryRtuId,
                    alertType: "rtu-down",
                    telegramChatId: user.chatId,
                    status: "unsended",
                    createdAt: new Date()
                });
                logger.info("founded group of RTU down alarms", {
                    alarmHistoryRtuId: alarm.alarmHistoryRtuId,
                    telegramUserId: user.id
                });
            });
            
        });

        if(alertStackDatas.length < 1) {
            logger.info("no RTU down alert to write", { jobId });
            return;
        }

        logger.info("writing RTU down alert stack", { jobId, alertStackCount: alertStackDatas.length });
        await AlertStackRtu.bulkCreate(alertStackDatas);

        logger.info("remove RTU down nextAlertAt", { jobId, updatedAlarmIds });
        await AlarmHistoryRtu.update({ nextAlertAt: null }, {
            where: {
                alarmHistoryRtuId: { [Op.in]: updatedAlarmIds }
            }
        });

        logger.info("writing RTU down alert stack was done", { jobId, alertStackCount: alertStackDatas.length });

    } catch(err) {
        logger.info("failed to write RTU down alert stack", { jobId });
        logger.error(err);
    }
};

module.exports.newosaseBaseUrl = "https://newosase.telkom.co.id/api/v1";

module.exports.createNewosaseHttp = () => {
    const baseURL = this.newosaseBaseUrl;
    return axios.create({
        baseURL,
        headers: { "Accept": "application/json" }
    });
};

let http = null;
module.exports.getNewosaseAlarms = async (witelId, app = {}) => {
    let { logger } = app;
    logger = Logger.getOrCreate(logger);

    logger.info("start to fetching newosase", { witelId });
    const newosaseBaseUrl = this.newosaseBaseUrl;
    const params = { isAlert: 1, witelId };
    
    try {
        if(!http) http = this.createNewosaseHttp();
        const response = await http.get("/dashboard-service/dashboard/rtu/port-sensors", { params });
        if(response.data && response.data.result && response.data.result.payload) {
            logger.info("Collecting newosase api response", { witelId });
            return response.data.result.payload;
        }

        logger.info("No data provided in newosase response", {
            baseUrl: `${ newosaseBaseUrl }/dashboard-service/dashboard/rtu/port-sensors`,
            params,
            responseData: response.data
        });

        return [];
    } catch(err) {
        const errData = {
            baseUrl: `${ newosaseBaseUrl }/dashboard-service/dashboard/rtu/port-sensors`,
            params
        };
        if(err.response && err.response.data)
            errData.responseData = err.response.data;

        logger.info("Error thrown when fetching newosase api", errData);
        logger.error(err);
        return [];
    }
};

module.exports.filterNewosaseAlarms = (newosaseAlarms) => {
    const result = [];
    const isValid = (alarm) => {
        if(!alarm.port_name || !alarm.no_port)
            return false;
        if(alarm.no_port === "many")
            return false;
        if(alarm.value === null)
            return false;
        if(alarm.no_port.indexOf("A-") === 0 && alarm.value === 0)
            return false;

        const duplicatedIndex = result.findIndex(item => item.id === alarm.id);
        if(duplicatedIndex >= 0)
            return false;

        return true;
    };

    for(let i=0; i<newosaseAlarms.length; i++) {
        if(isValid(newosaseAlarms[i]))
            result.push(newosaseAlarms[i]);
    }

    return result;
};

module.exports.isAlarmPortMatch = (prevAlarm, currAlarms) => {
    return currAlarms.id == prevAlarm.portId;
};

module.exports.isAlarmRtuMatch = (prevAlarm, currAlarms) => {
    return currAlarms.rtu_id == prevAlarm.rtuId && currAlarms.rtu_sname == prevAlarm.rtuSname;
};

module.exports.defineAlarms = (prevAlarms, currPortAlarms) => {
    const closedAlarms = [];
    const changedAlarms = [];
    const newAlarms = [];
    const closedRtuAlarms = [];
    const newRtuAlarms = [];
    const { portAlarms: prevPortAlarms, rtuAlarms: prevRtuAlarms } = prevAlarms;

    for(let i=0; i<currPortAlarms.length; i++) {

        let hasMatches = false;
        for(let j=0; j<prevPortAlarms.length; j++) {

            let isMatch = this.isAlarmPortMatch(prevPortAlarms[j], currPortAlarms[i]);
            let isChanged = isMatch && currPortAlarms[i].severity.name.toString().toLowerCase() != prevPortAlarms[j].portSeverity;

            if(isChanged) {

                changedAlarms.push({
                    alarmId: prevPortAlarms[j].alarmId,
                    data: {
                        alarmType: currPortAlarms[i].result_type,
                        portId: currPortAlarms[i].id,
                        portNo: currPortAlarms[i].no_port,
                        portName: currPortAlarms[i].port_name,
                        portValue: currPortAlarms[i].value,
                        portUnit: currPortAlarms[i].units,
                        portSeverity: currPortAlarms[i].severity.name.toString().toLowerCase(),
                        portDescription: currPortAlarms[i].description,
                        portIdentifier: currPortAlarms[i].identifier,
                        portMetrics: currPortAlarms[i].metrics,
                        rtuId: currPortAlarms[i].rtu_id,
                        rtuSname: currPortAlarms[i].rtu_sname,
                        rtuStatus: currPortAlarms[i].rtu_status.toLowerCase(),
                        alertStartTime: currPortAlarms[i].alert_start_time
                    }
                });
            }

            if(isMatch && !hasMatches)
                hasMatches = true;

        }

        if(!hasMatches) {
            newAlarms.push({
                alarmType: currPortAlarms[i].result_type,
                portId: currPortAlarms[i].id,
                portNo: currPortAlarms[i].no_port,
                portName: currPortAlarms[i].port_name,
                portValue: currPortAlarms[i].value,
                portUnit: currPortAlarms[i].units,
                portSeverity: currPortAlarms[i].severity.name.toString().toLowerCase(),
                portDescription: currPortAlarms[i].description,
                portIdentifier: currPortAlarms[i].identifier,
                portMetrics: currPortAlarms[i].metrics,
                rtuId: currPortAlarms[i].rtu_id,
                rtuSname: currPortAlarms[i].rtu_sname,
                rtuStatus: currPortAlarms[i].rtu_status.toLowerCase(),
                alertStartTime: currPortAlarms[i].alert_start_time
            });
        }

        if(this.isRtuDown(currPortAlarms[i].rtu_status)) {
            let hasRtuMatches = false;
            for(let k=0; k<prevRtuAlarms.length; k++) {
                let isRtuMatch = this.isAlarmRtuMatch(prevRtuAlarms[k], currPortAlarms[i]);
                if(isRtuMatch) {
                    hasRtuMatches = true;
                    k = prevRtuAlarms.length;
                }
            }

            let isRtuExists = false;
            if(!hasRtuMatches) {
                for(let l=0; l<newRtuAlarms.length; l++) {
                    if(newRtuAlarms[l].rtuSname == currPortAlarms[i].rtu_sname) {
                        isRtuExists = true;
                        l = newRtuAlarms.length;
                    }
                }
            }

            if(!hasRtuMatches && !isRtuExists) {
                newRtuAlarms.push({
                    rtuId: currPortAlarms[i].rtu_id,
                    rtuSname: currPortAlarms[i].rtu_sname,
                    rtuStatus: currPortAlarms[i].rtu_status.toLowerCase(),
                    alertStartTime: currPortAlarms[i].alert_start_time
                });
            }
        }

    }

    for(let x=0; x<prevPortAlarms.length; x++) {
        let hasMatches = false;
        for(let y=0; y<currPortAlarms.length; y++) {
            if(this.isAlarmPortMatch(prevPortAlarms[x], currPortAlarms[y])){
                hasMatches = true;
                y = currPortAlarms.length
            }
        }
        if(!hasMatches) {
            closedAlarms.push({
                alarmId: prevPortAlarms[x].alarmId
            });
        }
    }

    for(let m=0; m<prevRtuAlarms.length; m++) {
        let hasRtuMatches = false;
        for(let n=0; n<currPortAlarms.length; n++) {
            if(this.isAlarmRtuMatch(prevRtuAlarms[m], currPortAlarms[n])){
                hasRtuMatches = true;
                n = currPortAlarms.length
            }
        }
        if(!hasRtuMatches) {
            closedRtuAlarms.push({
                alarmHistoryRtuId: prevRtuAlarms[m].alarmHistoryRtuId
            });
        }
    }

    return { closedAlarms, changedAlarms, newAlarms, closedRtuAlarms, newRtuAlarms };
};