const { DataTypes, Model } = require("sequelize");
const inflection = require("inflection");

class AlertStackRtu extends Model {}

const modelOptions = {
    modelName: "alertStackRtu",
    tableName: "alert_stack_rtu",
    underscored: true,
    indexes:[
        { unique: false, fields: [ inflection.underscore("alarmHistoryRtuId") ] }
    ],
    timestamps: false,
};

const fields = {
    alertStackRtuId: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    alarmHistoryRtuId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    alertType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "rtu-down"
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

module.exports.AlertStackRtu = AlertStackRtu;
module.exports.alertStackRtuFields = fields;
module.exports.alertStackRtuModelOptions = modelOptions;

module.exports.useAlertStackRtuModel = (sequelize) => {
    AlertStackRtu.init(fields, { ...modelOptions, sequelize });
    return AlertStackRtu;
};