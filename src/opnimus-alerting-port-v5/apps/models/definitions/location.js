const { DataTypes, Model } = require("sequelize");

class Location extends Model {}

const modelOptions = {
    modelName: "location",
    tableName: "rtu_location",
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
    idM: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    locationName: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    locationSname: {
        type: DataTypes.STRING(5),
        allowNull: false
    },
    datelId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false
    },
};

module.exports.Location = Location;
module.exports.locationFields = fields;
module.exports.locationModelOptions = modelOptions;

module.exports.useLocationModel = (sequelize) => {
    Location.init(fields, { ...modelOptions, sequelize });
    return Location;
};