const { DataTypes, Model } = require("sequelize");
const inflection = require("inflection");

class TelegramMessageError extends Model {}

const modelOptions = {
    modelName: "telegramMessageError",
    tableName: "telegram_message_error",
    underscored: true,
    indexes:[
        { unique: false, fields: [ inflection.underscore("alertStackId") ] },
        { unique: false, fields: [ inflection.underscore("alertStackRtuId") ] },
    ],
    timestamps: false,
};

const fields = {
    telegramMessageErrorId: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
    },
    alertStackId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    alertStackRtuId: {
        type: DataTypes.INTEGER,
        allowNull: true
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

module.exports.TelegramMessageError = TelegramMessageError;
module.exports.telegramMessageErrorFields = fields;
module.exports.telegramMessageErrorModelOptions = modelOptions;

module.exports.useTelegramMessageErrorModel = (sequelize) => {
    TelegramMessageError.init(fields, { ...modelOptions, sequelize });
    return TelegramMessageError;
};