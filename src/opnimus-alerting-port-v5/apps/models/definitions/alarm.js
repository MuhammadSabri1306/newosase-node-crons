const { DataTypes, Model } = require("sequelize");

class Alarm extends Model {}

const modelOptions = {
    modelName: "alarm",
    tableName: "alarm",
    underscored: true,
    timestamps: false,
};

const fields = {
    alarmId: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
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
    isOpen: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
};

module.exports.Alarm = Alarm;
module.exports.alarmFields = fields;
module.exports.alarmModelOptions = modelOptions;

module.exports.useAlarmModel = (sequelize) => {
    Alarm.init(fields, { ...modelOptions, sequelize });
    return Alarm;
};