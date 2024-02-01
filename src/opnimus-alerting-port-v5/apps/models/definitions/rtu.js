const { DataTypes, Model } = require("sequelize");

class Rtu extends Model {}

const modelOptions = {
    modelName: "rtu",
    tableName: "rtu_list",
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
    uuid: {
        type: DataTypes.STRING(40),
        allowNull: true
    },
    idM: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    sname: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    locationId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    datelId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    witelId: {
        type: DataTypes.INTEGER,
        allowNull: false
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

module.exports.Rtu = Rtu;
module.exports.rtuFields = fields;
module.exports.rtuModelOptions = modelOptions;

module.exports.useRtuModel = (sequelize) => {
    Rtu.init(fields, { ...modelOptions, sequelize });
    return Rtu;
};