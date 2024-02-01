const { DataTypes, Model } = require("sequelize");

class AlertModes extends Model {}

const modelOptions = {
    modelName: "alertModes",
    tableName: "alert_modes",
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
    name: {
        type: DataTypes.STRING(10),
        allowNull: false
    },
    rules: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    title: {
        type: DataTypes.STRING(25),
        allowNull: false
    },
    description: {
        type: DataTypes.STRING(100),
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

module.exports.AlertModes = AlertModes;
module.exports.alertModesFields = fields;
module.exports.alertModesModelOptions = modelOptions;

module.exports.useAlertModesModel = (sequelize) => {
    AlertModes.init(fields, { ...modelOptions, sequelize });
    return AlertModes;
};