const { DataTypes, Model } = require("sequelize");
const inflection = require("inflection");

class AlertStack extends Model {}

const modelOptions = {
    modelName: "alertStack",
    tableName: "alert_stack",
    underscored: true,
    indexes:[
        { unique: false, fields: [ inflection.underscore("alarmHistoryId") ] }
    ],
    timestamps: false,
};

const fields = {
    alertStackId: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    alarmHistoryId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    alertType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "open-port"
    },
    telegramChatId: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM,
        values: ["unsended", "sending", "success"],
        allowNull: false,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    sendedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
};

module.exports.AlertStack = AlertStack;
module.exports.alertStackFields = fields;
module.exports.alertStackModelOptions = modelOptions;

module.exports.useAlertStackModel = (sequelize) => {
    AlertStack.init(fields, { ...modelOptions, sequelize });
    return AlertStack;
};