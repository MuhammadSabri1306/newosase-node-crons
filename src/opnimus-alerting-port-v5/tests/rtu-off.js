const dbOpnimusNewConfig = require("../../env/database/opnimus-new-migrated-2");
const { useSequelize, useModel } = require("../apps/models");
const { Model, Op } = require("sequelize");
const { createAlertMessage } = require("../apps/telegram-alert");
const { Telegraf } = require("telegraf");
const configBot = require("../../env/bot/opnimus-new-bot");
const { toDatetimeString } = require("../../helpers/date");

const createTable = async () => {

    const sequelize = useSequelize({
        ...dbOpnimusNewConfig,
        options: {
            logging: false,
            timezone: "+07:00"
        }
    });

    const { AlarmHistoryRtu, AlertStackRtu } = useModel(sequelize);
    await AlarmHistoryRtu.sync();
    await AlertStackRtu.sync();

    await sequelize.close();

};

const getDownRtus1 = async (sequelize) => {

    const { Alarm, AlarmHistory, Rtu, Regional, Witel, Location } = useModel(sequelize);

    const endDate = new Date();
    endDate.setMinutes(endDate.getMinutes() - 30);
    
    const alarmHistoriesRtu = await AlarmHistory.findAll({
        attributes: [
            "rtuId",
            "rtuSname",
            "rtuStatus",
            [sequelize.literal(`(SELECT alert_start_time FROM ${ AlarmHistory.tableName } AS hist WHERE hist.rtu_id = ${ AlarmHistory.name }.rtu_id AND hist.alarm_history_id = MAX(${ AlarmHistory.name }.alarm_history_id))`), "alertStartTime"],
            [sequelize.literal(`(SELECT opened_at FROM ${ AlarmHistory.tableName } AS hist WHERE hist.rtu_id = ${ AlarmHistory.name }.rtu_id AND hist.alarm_history_id = MAX(${ AlarmHistory.name }.alarm_history_id))`), "openedAt"],
        ],
        where: {
            rtuStatus: "off",
            [Op.or]: [{
                alertStartTime: { [Op.lte]: endDate.getTime() }
            }, {
                alertStartTime: null,
                openedAt: { [Op.lte]: toDatetimeString(endDate) }
            }]
        },
        include: [{
            model: Alarm,
            required: true,
            attributes: [],
            where: {
                isOpen: true,
            },
        }, {
            model: Rtu,
            required: true,
            attributes: [],
            where: {
                regionalId: 2
            }
        }],
        group: [
            "rtuId", "rtuSname", "rtuStatus"
        ]
    });

    const downRtusData = alarmHistoriesRtu.map(alarmHistoryRtu => {
        const { alertStartTime, openedAt, ...item } = alarmHistoryRtu.get({ plain: true });
        item.downedAt = alertStartTime ? new Date(alertStartTime) : openedAt;
        return item;
    });

    await sequelize.close();
    return downRtusData;
};

const getDownRtus2 = async (sequelize) => {

    const { Alarm, AlarmHistory, Rtu, Regional, Witel, Location } = useModel(sequelize);

    const endDate = new Date();
    endDate.setMinutes(endDate.getMinutes() - 30);

    const downRtus = await Rtu.findAll({
        where: {
            regionalId: 2,
        },
        include: [{
            model: AlarmHistory,
            required: true,
            attributes: ["rtuSname", "rtuStatus", "alertStartTime", "openedAt", "alarmHistoryId"],
            where: {
                closedAt: null,
                [Op.or]: [
                    { alertStartTime: { [Op.lte]: endDate.getTime() } },
                    { alertStartTime: null, openedAt: { [Op.lte]: toDatetimeString(endDate) } }
                ]
            },
            order: [
                [ "alarmHistoryId", "DESC" ]
            ],
            limit: 1
        }]
    });
    return downRtus;

    const downRtusData = downRtus.map((result, rtu) => {
        let { alarmHistories, ...item } = rtu;

        const alarmHistory = alarmHistories[0];
        for(let histKey in alarmHistory) {
            item[histKey] = alarmHistory[histKey];
        }

        result.push(item);
        return result;
    }, []);

    await sequelize.close();
    return downRtusData;
};

const getDownRtus3 = async (sequelize) => {

    const { Alarm, AlarmHistory, Rtu, Regional, Witel, Location } = useModel(sequelize);

    const endDate = new Date();
    endDate.setMinutes(endDate.getMinutes() - 30);

    const alarmHistoryRtus = await AlarmHistory.findAll({
        attributes: [
            [ sequelize.fn("max", sequelize.col("alarm_history_id")), "alarmHistoryId" ],
            "rtuId"
        ],
        where: {
            [Op.or]: [{
                alertStartTime: { [Op.lte]: endDate.getTime() }
            }, {
                alertStartTime: null,
                openedAt: { [Op.lte]: toDatetimeString(endDate) }
            }]
        },
        include: [{
            model: Alarm,
            required: true,
            attributes: [],
            where: {
                rtuStatus: "off",
                isOpen: true,
            }
        }, {
            model: Rtu,
            required: true,
            attributes: [],
            where: {
                regionalId: 2
            }
        }],
        group: [ "rtuId" ]
    });

    if(alarmHistoryRtus.length < 0)
        return alarmHistoryRtus;

    const alarmHistoryIds = alarmHistoryRtus.map(item => item.alarmHistoryId);
    const downRtus = await AlarmHistory.findAll({
        attributes: [
            "rtuId", "rtuSname", "rtuStatus", "alertStartTime", "openedAt"
        ],
        where: {
            alarmHistoryId: alarmHistoryIds
        },
        include: [{
            model: Rtu,
            required: true,
        }]
    });

    await sequelize.close();
    return downRtus;

};

const getDownRtus4 = async (sequelize) => {

    const { AlarmHistoryRtu, Rtu, Location, Witel, Regional } = useModel(sequelize);

    const currDate = new Date();
    const alarmHistoryRtus = await AlarmHistoryRtu.findAll({
        where: {
            isOpen: true,
            nextAlertAt: {
                [Op.gte]: currDate
            }
        },
        include: [{
            model: Rtu,
            required: true,
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

    return alarmHistoryRtus;

};

const main = async () => {

    const sequelize = useSequelize({
        ...dbOpnimusNewConfig,
        options: {
            logging: console.log,
            timezone: "+07:00"
        }
    });

    const { Rtu } = useModel(sequelize);

    const downRtus = await getDownRtus4(sequelize);
    if(downRtus.length < 1) {
        console.log(downRtus)
    } else {
        downRtus.forEach(item => {
            if(item instanceof Model)
                console.log( item.get({ plain: true }) );
            else
                console.log(item);
        });
    }

};

// createTable();
// main();