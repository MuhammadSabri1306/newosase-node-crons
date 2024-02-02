const { DataTypes, Model } = require("sequelize");

class TelegramPersonalUser extends Model {}

const modelOptions = {
    modelName: "telegramPersonalUser",
    tableName: "telegram_personal_user",
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
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    nama: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    telp: {
        type: DataTypes.STRING(18),
        allowNull: false
    },
    instansi: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    unit: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    isOrganik: {
        type: DataTypes.BOOLEAN,
        allowNull: false
    },
    nik: {
        type: DataTypes.STRING(50),
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

module.exports.TelegramPersonalUser = TelegramPersonalUser;
module.exports.telegramPersonalUserFields = fields;
module.exports.telegramPersonalUserModelOptions = modelOptions;

module.exports.useTelegramPersonalUserModel = (sequelize) => {
    TelegramPersonalUser.init(fields, { ...modelOptions, sequelize });
    return TelegramPersonalUser;
};