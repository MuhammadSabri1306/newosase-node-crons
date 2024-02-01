const { DataTypes, Model } = require("sequelize");

class Witel extends Model {}

const modelOptions = {
    modelName: "witel",
    tableName: "witel",
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
    witelName: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    witelCode: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    regionalId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false
    },
};

module.exports.Witel = Witel;
module.exports.witelFields = fields;
module.exports.witelModelOptions = modelOptions;

module.exports.useWitelModel = (sequelize) => {
    Witel.init(fields, { ...modelOptions, sequelize });
    return Witel;
};