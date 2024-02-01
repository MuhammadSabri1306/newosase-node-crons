const { DataTypes, Model } = require("sequelize");

class PicLocation extends Model {}

const modelOptions = {
    modelName: "picLocation",
    tableName: "pic_location",
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
    registId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    locationId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
};

module.exports.PicLocation = PicLocation;
module.exports.picLocationFields = fields;
module.exports.picLocationModelOptions = modelOptions;

module.exports.usePicLocationModel = (sequelize) => {
    PicLocation.init(fields, { ...modelOptions, sequelize });
    return PicLocation;
};