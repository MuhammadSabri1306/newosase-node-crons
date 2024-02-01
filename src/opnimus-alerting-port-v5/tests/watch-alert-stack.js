const dbOpnimusNewConfig = require("../../env/database/opnimus-new-migrated-2");
const { useSequelize, useModel } = require("../apps/models");
const { Logger } = require("../apps/logger");
const { alertChecker } = require("../apps");

const sequelizeLogger = Logger.createWinstonLogger({
    fileName: "sequelize",
    // useConsole: true,
    // useStream: true,
});

const sequelize = useSequelize({
    host: "localhost",
    database: dbOpnimusNewConfig.database,
    user: "root",
    password: "",
    options: {
        logging: (msg) => {
            sequelizeLogger.info(`(sequelize:${ dbOpnimusNewConfig.database }) ${ msg }`);
        }
    }
});

const main = async () => {
    await alertChecker();
};

main();