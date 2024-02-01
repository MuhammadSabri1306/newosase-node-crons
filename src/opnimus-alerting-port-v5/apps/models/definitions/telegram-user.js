const { DataTypes, Model } = require("sequelize");

class TelegramUser extends Model {}

const modelOptions = {
    modelName: "telegramUser",
    tableName: "telegram_user",
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
    chatId: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    userId: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    username: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    firstName: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    lastName: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    type: {
        type: DataTypes.ENUM,
        values: ["private", "group", "supergroup", "channel"],
        allowNull: false
    },
    isPic: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    registId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    picRegistId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    groupDescription: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    level: {
        type: DataTypes.ENUM,
        values: ["nasional", "regional", "witel"],
        allowNull: false
    },
    regionalId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    witelId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
};

module.exports.TelegramUser = TelegramUser;
module.exports.telegramUserFields = fields;
module.exports.telegramUserModelOptions = modelOptions;

module.exports.useTelegramUserModel = (sequelize) => {
    TelegramUser.init(fields, { ...modelOptions, sequelize });
    return TelegramUser;
};