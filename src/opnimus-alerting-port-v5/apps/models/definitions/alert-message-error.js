const { DataTypes, Model } = require("sequelize");

class AlertMessageError extends Model {}

const modelOptions = {
    modelName: "alertMessageError",
    tableName: "alert_message_error",
    underscored: true,
    timestamps: false,
};

const fields = {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    alertId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    errorCode: {
        type: DataTypes.STRING(3),
        allowNull: false
    },
    description: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    response: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
};

module.exports.AlertMessageError = AlertMessageError;
module.exports.alertMessageErrorFields = fields;
module.exports.alertMessageErrorModelOptions = modelOptions;

module.exports.useAlertMessageErrorModel = (sequelize) => {
    AlertMessageError.init(fields, { ...modelOptions, sequelize });
    return AlertMessageError;
};