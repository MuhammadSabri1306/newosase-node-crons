const dbConfig = require("../../env/database");
const { createDbPool, closePool, executeQuery, createQuery } = require("../../core/mysql");

const logErrorToDb = async (pool, err) => {

    // console.log(err.message);
    console.log(err.stack);

    // err.message, err.stack

};

const main = async () => {
    const pool = createDbPool(dbConfig.opnimusNewMigrated2);
    try {

        const data = null;
        const test = data.test;

    } catch(err) {

        // console.error(err);
        await logErrorToDb(pool, err);

    } finally {
        await closePool(pool);
    }
};

main();