const { DataTypes, Model } = require("sequelize");

class Regional extends Model {}

const modelOptions = {
    modelName: "regional",
    tableName: "regional",
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
        type: DataTypes.STRING(100),
        allowNull: false
    },
    sname: {
        type: DataTypes.STRING(3),
        allowNull: false
    },
    divreCode: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false
    },
};

module.exports.Regional = Regional;
module.exports.regionalFields = fields;
module.exports.regionalModelOptions = modelOptions;

module.exports.useRegionalModel = (sequelize) => {
    Regional.init(fields, { ...modelOptions, sequelize });
    return Regional;
};