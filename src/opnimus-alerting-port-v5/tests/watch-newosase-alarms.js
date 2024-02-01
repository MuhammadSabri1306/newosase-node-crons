const dbOpnimusNewConfig = require("../../env/database/opnimus-new-migrated-2");
const { useSequelize, useModel } = require("../apps/models");
const { Logger } = require("../apps/logger");
const { toWitelGroups, writeAlertStack, syncAlarms } = require("../apps");

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

const testWriteAlertStack = async () => {
    const { Witel } = useModel(sequelize);
    const witel = await Witel.findByPk(43);
    await writeAlertStack(witel, [1, 2, 3], { jobId: witel.id, sequelize });
    await sequelize.close();
};

const main = () => {
    const { Witel } = useModel(sequelize);
    Witel.findAll({
        where: { id: 43 }
    }).then(async (witels) => {
        await syncAlarms(witels);
        await sequelize.close();
    });
};

main();
// testWriteAlertStack();