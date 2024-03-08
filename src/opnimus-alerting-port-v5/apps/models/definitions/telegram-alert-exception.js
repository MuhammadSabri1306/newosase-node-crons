const { DataTypes, Model } = require("sequelize");

class TelegramAlertException extends Model {}

const modelOptions = {
    modelName: "telegramAlertException",
    tableName: "telegram_alert_exception",
    underscored: true,
    timestamps: false,
};

const fields = {
    telegramAlertExceptionId: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    chatId: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    description: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    willDeletedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
};

module.exports.TelegramAlertException = TelegramAlertException;
module.exports.telegramAlertExceptionFields = fields;
module.exports.telegramAlertExceptionModelOptions = modelOptions;

module.exports.useTelegramAlertExceptionModel = (sequelize) => {
    TelegramAlertException.init(fields, { ...modelOptions, sequelize });
    return TelegramAlertException;
};