const { DataTypes, Model } = require("sequelize");

class AlertUsers extends Model {}

const modelOptions = {
    modelName: "alertUsers",
    tableName: "alert_users",
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
    telegramUserId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    modeId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    cronAlertStatus: {
        type: DataTypes.ENUM,
        values: ["0", "1"],
        allowNull: false,
        get() {
            const value = this.getDataValue("cronAlertStatus");
            return value == true;
        },
        set(value) {
            this.setDataValue("cronAlertStatus", Number(value).toString());
        }
    },
    userAlertStatus: {
        type: DataTypes.ENUM,
        values: ["0", "1"],
        allowNull: false,
        get() {
            const value = this.getDataValue("userAlertStatus");
            return value == true;
        },
        set(value) {
            this.setDataValue("userAlertStatus", Number(value).toString());
        }
    },
    isPivotGroup: {
        type: DataTypes.ENUM,
        values: ["0", "1"],
        allowNull: false,
        get() {
            const value = this.getDataValue("isPivotGroup");
            return value == true;
        },
        set(value) {
            this.setDataValue("isPivotGroup", Number(value).toString());
        }
    },
    pivotLevel: {
        type: DataTypes.ENUM,
        values: ["nasional", "regional", "witel"],
        allowNull: false
    },
    pivotId: {
        type: DataTypes.INTEGER,
        allowNull: false
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

module.exports.AlertUsers = AlertUsers;
module.exports.alertUsersFields = fields;
module.exports.alertUsersModelOptions = modelOptions;

module.exports.useAlertUsersModel = (sequelize) => {
    AlertUsers.init(fields, { ...modelOptions, sequelize });
    return AlertUsers;
};