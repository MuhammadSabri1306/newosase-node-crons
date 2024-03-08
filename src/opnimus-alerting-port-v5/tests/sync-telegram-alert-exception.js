const { useSequelize, useModel } = require("../apps/models");
const dbOpnimusNewConfig = require("../../env/database/opnimus-new-migrated-2");

const testCase1 = async () => {

    const sequelize = useSequelize({
        ...dbOpnimusNewConfig,
        options: {
            logging: false,
            timezone: "+07:00"
        }
    });

    const { TelegramAlertException } = useModel(sequelize);

    console.log(`create table ${ TelegramAlertException.tableName }`);
    await TelegramAlertException.sync();

    // console.log(`alter table ${ TelegramAlertException.tableName }:add index`);
    // await TelegramAlertException.sync({ alter: true });

    await sequelize.close();

};

// testCase1();