const { Sequelize, Model } = require("sequelize");
const inflection = require("inflection");

const { useAlarmModel } = require("./definitions/alarm");
const { useAlarmHistoryModel } = require("./definitions/alarm-history");
const { useRegionalModel } = require("./definitions/regional");
const { useWitelModel } = require("./definitions/witel");
const { useRtuModel } = require("./definitions/rtu");
const { useAlertStackModel } = require("./definitions/alert-stack");
const { useAlertStackRtuModel } = require("./definitions/alert-stack-rtu");
const { useAlertModesModel } = require("./definitions/alert-modes");
const { useAlertUsersModel } = require("./definitions/alert-users");
const { useTelegramUserModel } = require("./definitions/telegram-user");
const { useTelegramPersonalUserModel } = require("./definitions/telegram-personal-user");
const { useLocationModel } = require("./definitions/location");
const { usePicLocationModel } = require("./definitions/pic-location");
const { useAlertMessageErrorModel } = require("./definitions/alert-message-error");
const { useAlarmHistoryRtuModel } = require("./definitions/alarm-history-rtu");

module.exports.useSequelize = (config = {}) => {
    const { database, host, user, password, options } = config;

    let sequelizeOptions = { host, dialect: "mysql" };
    if(options)
        sequelizeOptions = { ...sequelizeOptions, ...options };

    return new Sequelize(database, user, password, sequelizeOptions);
};

module.exports.useModel = (sequelize) => {
    /* Check Sequelize */

    if(!sequelize instanceof Sequelize)
        throw new Error(`useModel arg:sequelize is not instance of Sequelize, useModel(${ sequelize.toString() })`);

    /* Define model */

    const Alarm = useAlarmModel(sequelize);
    const AlarmHistory = useAlarmHistoryModel(sequelize);
    const AlarmHistoryRtu = useAlarmHistoryRtuModel(sequelize);
    const Regional = useRegionalModel(sequelize);
    const Witel = useWitelModel(sequelize);
    const Rtu = useRtuModel(sequelize);
    const AlertStack = useAlertStackModel(sequelize);
    const AlertStackRtu = useAlertStackRtuModel(sequelize);
    const AlertModes = useAlertModesModel(sequelize);
    const AlertUsers = useAlertUsersModel(sequelize);
    const TelegramUser = useTelegramUserModel(sequelize);
    const TelegramPersonalUser = useTelegramPersonalUserModel(sequelize);
    const Location = useLocationModel(sequelize);
    const PicLocation = usePicLocationModel(sequelize);
    const AlertMessageError = useAlertMessageErrorModel(sequelize);

    /* Define model's relationships */

    Regional.hasMany(Rtu, { foreignKey: "regionalId", targetKey: "id" });
    Regional.hasMany(Witel, { foreignKey: "regionalId", targetKey: "id" });

    Witel.hasMany(Rtu, { foreignKey: "witelId", targetKey: "id" });
    Witel.belongsTo(Regional, { foreignKey: "regionalId", targetKey: "id" });

    Rtu.belongsTo(Regional, { foreignKey: "regionalId", targetKey: "id" });
    Rtu.belongsTo(Witel, { foreignKey: "witelId", targetKey: "id" });
    Rtu.belongsTo(Location, { foreignKey: "locationId", targetKey: "id" });
    Rtu.hasMany(Alarm, { foreignKey: "rtuSname", sourceKey: "sname" });
    Rtu.hasMany(AlarmHistory, { foreignKey: "rtuSname", sourceKey: "sname" });
    Rtu.hasMany(AlarmHistoryRtu, { foreignKey: "rtuSname", sourceKey: "sname" });

    Alarm.hasMany(AlarmHistory, { foreignKey: "alarmId" });
    Alarm.belongsTo(Rtu, { foreignKey: "rtuSname", targetKey: "sname" });
    
    AlarmHistory.belongsTo(Alarm, { foreignKey: "alarmId", targetKey: "alarmId" });
    AlarmHistory.belongsTo(Rtu, { foreignKey: "rtuSname", targetKey: "sname" });
    AlarmHistory.hasMany(AlertStack, { foreignKey: "alarmHistoryId" });

    AlarmHistoryRtu.belongsTo(Rtu, { foreignKey: "rtuSname", targetKey: "sname" });
    AlarmHistoryRtu.hasMany(AlertStackRtu, { foreignKey: "alarmHistoryRtuId" });

    AlertModes.hasMany(AlertUsers, { foreignKey: "modeId", targetKey: "id" });
    AlertStack.belongsTo(AlarmHistory, { foreignKey: "alarmHistoryId", targetKey: "alarmHistoryId" });
    AlertStackRtu.belongsTo(AlarmHistoryRtu, { foreignKey: "alarmHistoryRtuId", targetKey: "alarmHistoryRtuId" });

    TelegramUser.hasOne(TelegramPersonalUser, { foreignKey: "userId", targetKey: "id" });
    TelegramUser.hasOne(AlertUsers, { foreignKey: "telegramUserId", targetKey: "id" });
    TelegramUser.hasMany(PicLocation, { foreignKey: "userId", targetKey: "id" });

    AlertUsers.belongsTo(AlertModes, { foreignKey: "modeId", targetKey: "id" });
    AlertUsers.belongsTo(TelegramUser, { foreignKey: "telegramUserId", targetKey: "id" });

    TelegramPersonalUser.belongsTo(TelegramUser, { foreignKey: "userId", targetKey: "id" });

    Location.hasMany(Rtu, { foreignKey: "locationId", targetKey: "id" });
    Location.hasMany(PicLocation, { foreignKey: "locationId", targetKey: "id" });

    PicLocation.belongsTo(TelegramUser, { foreignKey: "userId", targetKey: "id" });
    PicLocation.belongsTo(Location, { foreignKey: "locationId", targetKey: "id" });

    return {
        Alarm,
        AlarmHistory,
        AlarmHistoryRtu,
        AlertStack,
        AlertStackRtu,
        AlertModes,
        AlertUsers,
        AlertMessageError,
        TelegramUser,
        TelegramPersonalUser,
        Regional,
        Witel,
        Rtu,
        Location,
        PicLocation,
    };
};

module.exports.toUnderscoredPlain = (model, dataCaller = null) => {

    if(Array.isArray(model))
        return model.map(item => this.toUnderscoredPlain(item));

    if(!model instanceof Model)
        throw new Error(`model should be instance of sequelize Model in toUnderscoredPlain(model:${ model })`);

    const data = dataCaller ? dataCaller(model) : model.get({ plain: true });
    if(!data) return data;

    const extract = (key, value) => {
        const isObject = typeof value === "object";
        if(value && isObject) {
            const result = {};
            for(let k in value) {
                let [resultKey, resultValue] = extract(k, value[k]);
                result[resultKey] = resultValue;
            }
            if(Object.values(result).length > 0)
                return [inflection.underscore(key), result];
        }
        return [inflection.underscore(key), value];
    };

    const result = {};
    for(let dataKey in data) {
        let [key, value] = extract(dataKey, data[dataKey]);
        result[key] = value;
    }
    return result;

};