const dbOpnimusNewConfig = require("../env/database/opnimus-new-migrated-2");
const { useSequelize, useModel } = require("./apps/models");
const { Logger } = require("./apps/logger");
const { toWitelGroups, watchNewosaseAlarmWitels, watchAlertStack } = require("./apps");

const args = process.argv.slice(2);
if(args.length > 0 && args[0] == "watch-newosase-alarm") {

    const sequelizeLogger = Logger.createWinstonLogger({
        fileName: "sequelize",
        useConsole: true,
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
        witelGroups.forEach(groupItem => {
            watchNewosaseAlarmWitels(groupItem);
        });
    
    });

} else if(args.length > 0 && args[0] == "watch-alert") {

    watchAlertStack();

}