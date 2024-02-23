const dbOpnimusNewConfig = require("../../env/database/opnimus-new-migrated-2");
const { useSequelize } = require("../apps/models");
const { QueryTypes } = require("sequelize");

const createSequelize = (pool = null) => {
    const sequelizeOptions = {
        ...dbOpnimusNewConfig,
        host: "localhost",
        database: dbOpnimusNewConfig.database,
        user: "root",
        password: "",
        options: {
            logging: false,
            timezone: "+07:00"
        }
    };

    if(pool)
        sequelizeOptions.options.pool = pool;

    return useSequelize(sequelizeOptions);
};

const testMultipleInstances = async () => {

    const run = (time) => {
        return new Promise(async (resolve) => {
    
            const sequelize = createSequelize({ max: 5 });

            await sequelize.authenticate();
            const data = await sequelize.query(
                "SELECT COUNT(*) AS connected_pool_count FROM information_schema.PROCESSLIST",
                { type: QueryTypes.SELECT }
            );
            console.log({ activePool: data[0].connected_pool_count });
    
            setTimeout(() => {
                sequelize.close().then(() => resolve());
            }, time);

        });
    };

    const times = [ 10000, 10000, 10000 ];
    await Promise.all( times.map(time => run(time)) );

};

(async () => {
    await testMultipleInstances();
    await testMultipleInstances();
})();