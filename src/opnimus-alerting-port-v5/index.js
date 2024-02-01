const dbOpnimusNewConfig = require("../env/database/opnimus-new-migrated-2");
const { useSequelize, useModel } = require("./apps/models");
const { Logger } = require("./apps/logger");
const { toWitelGroups, watchNewosaseAlarmWitels, watchAlertStack } = require("./apps");

const sequelizeLogger = Logger.createWinstonLogger({
    fileName: "sequelize",
    // useConsole: true,
    // useStream: true,
});

const sequelize = useSequelize({
    ...dbOpnimusNewConfig,
    options: {
        logging: (msg) => {
            sequelizeLogger.info(`(sequelize:${ dbOpnimusNewConfig.database }) ${ msg }`);
        }
    }
});

const { Witel } = useModel(sequelize);
Witel.findAll().then(witels => {
    
    sequelize.close();

    const witelGroupTarget = Math.min(5, witels.length);
    const witelGroups = toWitelGroups(witels, witelGroupTarget);

    const loopingWitelGroups = async (group) => {
        while(true) {
            await processWitelGroups(group);
        }
    };
    
    witelGroups.forEach(group => loopingProcess(group));
    watchNewosaseAlarmWitels()

});

watchAlertStack();