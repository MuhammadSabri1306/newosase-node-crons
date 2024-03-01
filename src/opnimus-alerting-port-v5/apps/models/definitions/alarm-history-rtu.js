const { DataTypes, Model } = require("sequelize");

class AlarmHistoryRtu extends Model {}

const modelOptions = {
    modelName: "alarmHistoryRtu",
    tableName: "alarm-history-rtu",
    underscored: true,
    timestamps: false,
};

const fields = {
    alarmHistoryRtuId: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    rtuId: {
        type: DataTypes.STRING(40),
        allowNull: true
    },
    rtuSname: {
        type: DataTypes.STRING(25),
        allowNull: false
    },
    rtuStatus: {
        type: DataTypes.STRING(25),
        allowNull: false
    },
    isOpen: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    alertStartTime: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    openedAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    closedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    nextAlertAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
};

module.exports.AlarmHistoryRtu = AlarmHistoryRtu;
module.exports.alarmHistoryRtuFields = fields;
module.exports.alarmHistoryRtuModelOptions = modelOptions;

module.exports.useAlarmHistoryRtuModel = (sequelize) => {
    AlarmHistoryRtu.init(fields, { ...modelOptions, sequelize });
    return AlarmHistoryRtu;
};