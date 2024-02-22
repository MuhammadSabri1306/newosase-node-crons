const { createDbPool, closePool, executeQuery, createQuery } = require("../../core/mysql");
const dbDensusConfig = require("../../env/database/densus");
const { getRtuList, fetchPue } = require("../index");
const { toFixedNumber } = require("../../helpers/number-format");

const getRtuPue = async (pool, rtu) => {
    try {

        if(!rtu.rtu_kode || !rtu.port_pue_v2)
            throw new Error("Cannot found OsaseV2 api params");
        const pue = await fetchPue(rtu);
        console.log({ rtu: rtu.rtu_kode, pue: pue ? toFixedNumber(pue.value, 2) : null });

    } catch(err) {
        console.error(err, { rtu });
    }
};

const main = async () => {

    const database = dbDensusConfig.database;
    const pool = createDbPool(dbDensusConfig);
    try {

        const rtus = await getRtuList(pool);
        await Promise.all( rtus.map(rtu => getRtuPue(pool, rtu)) );

    } catch(err) {
        console.error(err);
    } finally {
        await closePool(pool);
    }

};

main();