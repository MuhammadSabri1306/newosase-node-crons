const { DataTypes, Model } = require("sequelize");

class AlarmHistory extends Model {}

const modelOptions = {
    modelName: "alarmHistory",
    tableName: "alarm_history",
    underscored: true,
    indexes:[
        { unique: false, fields:["alarmId"] }
    ],
    timestamps: false,
};

const fields = {
    alarmHistoryId: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    alarmId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    alarmType: {
        type: DataTypes.STRING(10),
        allowNull: true
    },
    portId: {
        type: DataTypes.STRING(40),
        allowNull: false
    },
    portNo: {
        type: DataTypes.STRING(10),
        allowNull: false
    },
    portName: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    portValue: {
        type: DataTypes.DOUBLE,
        allowNull: true
    },
    portUnit: {
        type: DataTypes.STRING(25),
        allowNull: false
    },
    portSeverity: {
        type: DataTypes.STRING(25),
        allowNull: false
    },
    portDescription: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    portIdentifier: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    portMetrics: {
        type: DataTypes.STRING(50),
        allowNull: true
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
};

module.exports.AlarmHistory = AlarmHistory;
module.exports.alarmHistoryFields = fields;
module.exports.alarmHistoryModelOptions = modelOptions;

module.exports.useAlarmHistoryModel = (sequelize) => {
    AlarmHistory.init(fields, { ...modelOptions, sequelize });
    return AlarmHistory;
};