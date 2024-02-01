const { Sequelize } = require("sequelize");
const { useAlarmModel } = require("./definitions/alarm");
const { useAlarmHistoryModel } = require("./definitions/alarm-history");
const { useRegionalModel } = require("./definitions/regional");
const { useWitelModel } = require("./definitions/witel");
const { useRtuModel } = require("./definitions/rtu");
const { useAlertStackModel } = require("./definitions/alert-stack");
const { useAlertModesModel } = require("./definitions/alert-modes");
const { useAlertUsersModel } = require("./definitions/alert-users");
const { useTelegramUserModel } = require("./definitions/telegram-user");
const { useTelegramPersonalUserModel } = require("./definitions/telegram-personal-user");
const { useLocationModel } = require("./definitions/location");
const { usePicLocationModel } = require("./definitions/pic-location");
const { useAlertMessageErrorModel } = require("./definitions/alert-message-error");

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
    const Regional = useRegionalModel(sequelize);
    const Witel = useWitelModel(sequelize);
    const Rtu = useRtuModel(sequelize);
    const AlertStack = useAlertStackModel(sequelize);
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
    Rtu.hasMany(Alarm, { foreignKey: "rtuSname", targetKey: "sname" });
    Rtu.belongsTo(Location, { foreignKey: "locationId", targetKey: "id" });

    Alarm.hasMany(AlarmHistory, { foreignKey: "alarmId" });
    Alarm.belongsTo(Rtu, { foreignKey: "rtuSname", targetKey: "sname" });
    
    AlarmHistory.belongsTo(Alarm, { foreignKey: "alarmId", targetKey: "alarmId" });
    AlarmHistory.belongsTo(Rtu, { foreignKey: "rtuSname", targetKey: "sname" });
    AlarmHistory.hasMany(AlertStack, { foreignKey: "alarmHistoryId", targetKey: "alarmHistoryId" });

    AlertStack.belongsTo(AlarmHistory, { foreignKey: "alarmHistoryId", targetKey: "alarmHistoryId" });

    AlertModes.hasMany(AlertUsers, { foreignKey: "modeId", targetKey: "id" });

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
        Regional,
        Witel,
        Rtu,
        AlertStack,
        AlertModes,
        AlertUsers,
        TelegramUser,
        TelegramPersonalUser,
        Location,
        PicLocation,
        AlertMessageError,
    };
};