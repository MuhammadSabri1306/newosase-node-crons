const axios = require("axios");
const cron = require("node-cron");
const JobQueue = require("../core/job-queue");
const logger = require("./logger");
const dbDensusConfig = require("../env/database/densus");
const { toDatetimeString } = require("../helpers/date");
const { InsertQueryBuilder } = require("../helpers/mysql-query-builder");
const {
    createDbPool,
    closePool,
    executeQuery,
    createQuery
} = require("../core/mysql");

module.exports.useHttp = (baseURL, setConfig = null) => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const headers = { "Accept": "application/json" };
    const httpConfig = { baseURL, headers };
    if(typeof setConfig == "function")
        httpConfig = setConfig(httpConfig);
    return axios.create(httpConfig);
};

module.exports.getRtuList = async (pool) => {
    const database = dbDensusConfig.database;
    try {

        const rtuListQueryStr = "SELECT * FROM rtu_map WHERE port_pue_v2 IS NOT NULL";
        logger.info("Get rtu list from database", { database, query: rtuListQueryStr });
        const { results: rtus } = await executeQuery(pool, rtuListQueryStr);
        return rtus;

    } catch(err) {
        logger.error(err);
        return [];
    }
};

module.exports.handleRtuSnameConflict = rtuSname => {
    let rtuPieces = rtuSname.split("-");
    if(rtuPieces.length < 2)
        return rtuSname;
    if(rtuPieces.length === 3) {
        if(rtuPieces[0] == "RTU00" && rtuPieces[1] == "D7")
            return rtuSname;
    }

    const stoCode = rtuPieces[ rtuPieces.length - 1 ];
    if(rtuPieces[0] != "RTU00")
        rtuPieces[0] = "RTU00";
    if(rtuPieces[1] != "D7")
        rtuPieces[1] = "D7";
    if(rtuPieces.length < 3)
        rtuPieces.push(stoCode);
    return rtuPieces.join("-");
};

const createDelay = ms => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

module.exports.fetchPue = async (rtuid, port) => { 

    const baseUrl = "https://opnimus.telkom.co.id/api/osasev2";
    const params = { token: "xg7DT34vE7", rtuid, port };

    const http = this.useHttp(baseUrl);

    let retryCount = 0;
    let response;
    let infoText = `rtu:${ rtuid } port:${ port }`;
    let result = null;
    
    logger.info(`Create osase api request, ${ infoText }`);
    while(retryCount < 2) {
        try {

            response = await http.get("/getrtuport", { params });
            infoText = `url:${ http.getUri(response.config) }`;
            if(Array.isArray(response.data) && response.data.length > 0) {

                result = response.data[0];
                logger.info(`Collecting osase api response, ${ infoText }`);
                retryCount = 2;

            } else {

                params.rtuid = this.handleRtuSnameConflict(rtuid);
                throw new Error(`No data provided in osase api response, ${ infoText }`);
                
            }

        } catch(err) {
            logger.error(`Error in ${ infoText }`);
            logger.error(err);

            if(retryCount < 2) {
                await createDelay(1000);
                logger.info(`Re-create osase api request, ${ infoText }`);
            }
            retryCount++;
        }
    }

    return result;

};

module.exports.insertPue = async (pool, rtuId, pue) => {
    if(!pue) return;
    const database = dbDensusConfig.database;
    try {

        const queryInsertPue = new InsertQueryBuilder("pue_counter_new");
        queryInsertPue.addFields("rtu_kode");
        queryInsertPue.addFields("osase_rtu_kode");
        queryInsertPue.addFields("pue_value");
        queryInsertPue.addFields("no_port");
        queryInsertPue.addFields("nama_port");
        queryInsertPue.addFields("tipe_port");
        queryInsertPue.addFields("satuan");
        queryInsertPue.addFields("timestamp");
        queryInsertPue.appendRow([
            rtuId, pue.RTU_ID, pue.VALUE, pue.PORT, pue.NAMA_PORT,
            pue.TIPE_PORT, pue.SATUAN, toDatetimeString(new Date())
        ]);

        const insertPueQueryStr = createQuery(queryInsertPue.getQuery(), queryInsertPue.getBuiltBindData());
        logger.info("Inser PUE value to database", { database, query: insertPueQueryStr });
        await executeQuery(pool, insertPueQueryStr);

    } catch(err) {
        logger.error(err);
    }
};

const getRtuPue = async (pool, rtu) => {
    try {

        if(!rtu.rtu_kode || !rtu.port_pue_v2)
            throw new Error("Cannot found OsaseV2 api params");
        const pue = await this.fetchPue(rtu.rtu_kode, rtu.port_pue_v2);
        await this.insertPue(pool, rtu.rtu_kode, pue);

    } catch(err) {
        logger.error(err, { rtu });
    }
};

module.exports.main = async () => {

    const database = dbDensusConfig.database;
    const pool = createDbPool(dbDensusConfig);
    try {

        const rtus = await this.getRtuList(pool);
        await Promise.all( rtus.map(rtu => getRtuPue(pool, rtu)) );

    } catch(err) {
        logger.error(err);
    } finally {
        await closePool(pool);
    }

};

/*
 * Osase Collect PUE
 * Runs every Hour
 */
module.exports.runCron = () => {
    cron.schedule("0 0 * * * *", async () => {
        const startTime = toDatetimeString(new Date());
        console.info(`\n\nRunning cron Osase Collect PUE at ${ startTime }`);
        try {
            await this.main();
            const endTime = toDatetimeString(new Date());
            console.info(`\n\nCron Osase Collect PUE closed at ${ endTime }`);
        } catch(err) {
            console.error(err);
            const endTime = toDatetimeString(new Date());
            console.info(`\n\nCron Osase Collect PUE closed at ${ endTime }`);
        }
    });
};

const executeCommand = (execute = false) => {
    if(!execute)
        return;
    const args = process.argv.slice(2);
    if(args[0] == "cron")
        this.runCron();
    else if(args[0] == "test")
        this.main();
};

executeCommand(true);