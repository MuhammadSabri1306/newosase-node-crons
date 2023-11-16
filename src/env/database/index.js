const defaultConfig = require("./default");
const osasemobile = require("./osasemobile");
const densus = require("./densus");
const densusBot = require("./densus-bot");
const opnimusNew = require("./opnimus-new");
const opnimusNewMigrated = require("./opnimus-new-migrated");

module.exports = {
    default: defaultConfig,
    osasemobile,
    densus,
    densusBot,
    opnimusNew,
    opnimusNewMigrated
};