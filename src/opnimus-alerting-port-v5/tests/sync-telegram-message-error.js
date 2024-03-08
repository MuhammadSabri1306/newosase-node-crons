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

    const { TelegramMessageError } = useModel(sequelize);

    console.log(`create table ${ TelegramMessageError.tableName }`);
    await TelegramMessageError.sync();

    // console.log(`alter table ${ TelegramMessageError.tableName }:add index`);
    // await TelegramMessageError.sync({ alter: true });

    await sequelize.close();

};

// testCase1();