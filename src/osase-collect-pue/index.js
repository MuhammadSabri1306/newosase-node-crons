const axios = require("axios");
const cron = require("node-cron");
const JobQueue = require("../core/job-queue");
const logger = require("./logger");
const dbDensusConfig = require("../env/database/densus");
const { toDatetimeString } = require("../helpers/date");
const { toFixedNumber } = require("../helpers/number-format");
const { InsertQueryBuilder } = require("../helpers/mysql-query-builder");
const { createDbPool, closePool, executeQuery, createQuery } = require("../core/mysql");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
module.exports.useHttp = (baseURL, setConfig = null) => {
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

module.exports.getRegionalCodeNumber = regionalCode => {
    if(typeof regionalCode != "string")
        return null;
    if(regionalCode.length != 12)
        return null;
    if(regionalCode.slice(0, 5) != "TLK-r")
        return null;
    const result = regionalCode.slice(5, 6);
    return result ? Number(result) : result;
};

module.exports.handleRtuSnameConflict = (rtuSname, regionalNumber) => {
    let rtuPieces = rtuSname.split("-");
    if(rtuPieces.length < 2)
        return rtuSname;

    const stoCode = rtuPieces[ rtuPieces.length - 1 ];
    const divCode = `D${ regionalNumber }`;

    if(rtuPieces.length === 3) {
        if(rtuPieces[0] == "RTU00" && rtuPieces[1] == divCode)
            return rtuSname;
    }

    if(rtuPieces[0] != "RTU00")
        rtuPieces[0] = "RTU00";
    if(rtuPieces[1] != divCode)
        rtuPieces[1] = divCode;
    if(rtuPieces.length < 3)
        rtuPieces.push(stoCode);
    return rtuPieces.join("-");
};

const createDelay = ms => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

module.exports.fetchPue = async (rtu) => {

    if(!rtu) return null;
    const rtuSname = rtu.rtu_kode;
    const portNo = rtu.port_pue_v2;
    const regionalNumber = this.getRegionalCodeNumber(rtu.divre_kode);

    const baseUrl = "https://newosase.telkom.co.id/api/v1";
    const params = { searchRtuSname: rtuSname };
    const http = this.useHttp(baseUrl);

    let retryCount = 0;
    let infoText = `rtu:${ rtuSname } port:${ portNo }`;
    let result = null;

    logger.info(`Create osase api request, ${ infoText }`);
    while(retryCount < 2) {
        try {

            let response = await http.get("/dashboard-service/dashboard/rtu/port-sensors", { params });
            infoText = `url:${ http.getUri(response.config) }`;

            if(Array.isArray(response.data.result.payload) && response.data.result.payload.length > 0) {

                let portData = response.data.result.payload.find(item => {
                    return item.rtu_sname == rtuSname && item.no_port == portNo;
                });

                if(portData) {
                    result = portData
                    logger.info(`Collecting osase api response, ${ infoText }`);
                    retryCount = 2;
                }

            }

            if(!result) throw new Error("No data provided in osase api response");

        } catch(err) {

            err.message = `${ err.message } ${ infoText }`;
            logger.error(err);

            if(retryCount < 2) {
                await createDelay(1000);
                params.searchRtuSname = this.handleRtuSnameConflict(rtuSname, regionalNumber);
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

        const pueValue = typeof pue.value == "number" ? toFixedNumber(pue.value, 2) : pue.value;
        queryInsertPue.appendRow([
            rtuId, pue.rtu_sname, pueValue, pue.no_port, pue.port_name,
            pue.identifier, pue.units, toDatetimeString(new Date())
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
        const pue = await this.fetchPue(rtu);
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
        // await Promise.all( rtus.map(rtu => getRtuPue(pool, rtu)) );
        for(let i=0; i<rtus.length; i++) {
            await getRtuPue(pool, rtus[i]);
        }

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