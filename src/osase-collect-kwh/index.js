const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const mysql = require("mysql");
const JobQueue = require("../core/job-queue");
const logger = require("./logger");
const dbConfig = require("../env/database");
const { toDatetimeString } = require("../helpers/date");
const rtuIgnoreList = require("./rtu-ignore.json");

const filterByIgnoredRtu = false;

const writeRtuIgnore = async (rtuListErr) => {
    const txtContent = JSON.stringify(rtuListErr);
    const filePath = path.resolve(__dirname, "rtu-ignore.json");
    try {
        await fs.writeFileSync(filePath, txtContent);
    } catch(err) {
        logger.error(err);
    }
};

const createWitelGroup = rtuList => {
    const witelGroup = {};
    let excludedIndex;

    for(let i=0; i<rtuList.length; i++) {
        
        if(filterByIgnoredRtu) {
            excludedIndex = rtuIgnoreList.findIndex(ignItem => {
                return rtuList[i].rtu_kode == ignItem.rtu_kode && rtuList[i].no_port == ignItem.no_port;
            });
            
            if(excludedIndex < 0) {
                if(!Array.isArray(witelGroup[rtuList[i].witel_kode]))
                    witelGroup[rtuList[i].witel_kode] = [];
                witelGroup[rtuList[i].witel_kode].push(rtuList[i]);
            }
        } else {
            if(!Array.isArray(witelGroup[rtuList[i].witel_kode]))
                witelGroup[rtuList[i].witel_kode] = [];
            witelGroup[rtuList[i].witel_kode].push(rtuList[i]);
        }
        
    }

    return Object.values(witelGroup);
};

const runDbQuery = (pool, ...args) => {
    return new Promise((resolve, reject) => {

        const callback = (conn, err, results) => {
            if(err) {
                reject(err);
                return;
            }
            resolve(results);
        };

        pool.getConnection((err, conn) => {
            conn.release();
            if(err)
                reject(err);
            else if(args.length > 1)
                conn.query(args[0], args[1], (err, results) => callback(conn, err, results));
            else
                conn.query(args[0], (err, results) => callback(conn, err, results));
        });

    });
};

const runWorkerGetOsasePort = (witelGroup, eachErrorCallback = null) => {
    return new Promise(resolve => {

        logger.info("Setup fetching osase api workers");
        const workerQueue = new JobQueue(10);
        workerQueue.setDelay(1000);

        witelGroup.forEach(witelRtuList => {
            workerQueue.registerWorker("osase-collect-kwh/worker-get-osase-port", { rtuList: witelRtuList });
        });
        
        const kwhList = [];
        const rtuListErr = [];
        workerQueue.onEachAfter(workerResult => {

            if(!Array.isArray(workerResult)) {
                logger.warn(workerResult);
                return;
            }

            workerResult.forEach(item => {
                if(item.kwhItem)
                    kwhList.push(item.kwhItem);
                else
                    rtuListErr.push(item.rtuItem);
            });

        });

        if(typeof eachErrorCallback == "function")
            workerQueue.onEachError(err => eachErrorCallback(err));

        workerQueue.onBeforeRun(() => {
            logger.info("Run fetching osase api workers");
        });

        workerQueue.onAfterRun(() => {
            logger.info("Fetching osase api workers run successfully");
            resolve({ kwhList, rtuListErr });
        });

        workerQueue.run();

    });
};

module.exports.main = async () => {
    logger.info("App is starting");

    try {

        logger.info("Creating a database connection");
        const pool = mysql.createPool(dbConfig.densus);

        logger.info(`Get rtu_map from database ${ dbConfig.densus.database }.rtu_map`);
        const rtuList = await runDbQuery(pool, "SELECT * FROM rtu_map");
        
        const witelGroup = createWitelGroup(rtuList);
        const { kwhList, rtuListErr } = await runWorkerGetOsasePort(witelGroup, err => {
            logger.error("Error when running worker worker-get-osase-port.js:", err);
        });

        if(kwhList.length < 1) {
            logger.info("Kwh List is empty, App has run successfully");
            logger.info("App has run successfully");
            return;
        }

        logger.info("Change database connection to osasemobile.");
        await runDbQuery(pool, `USE ${ dbConfig.osasemobile.database }`);

        const queryValuesArr = [];
        const dataBind = [];
        const currDateStr = toDatetimeString(new Date());

        for(let i=0; i<kwhList.length; i++) {
            queryValuesArr.push("(?, ?, ?, ?, ?, ?, ?)");
            dataBind.push(kwhList[i].RTU_ID, kwhList[i].VALUE, kwhList[i].PORT, kwhList[i].NAMA_PORT, kwhList[i].TIPE_PORT, kwhList[i].SATUAN, currDateStr);
        }

        const queryValues = queryValuesArr.join(", ");
        const insertQuery = "INSERT INTO kwh_counter_bck (rtu_kode, kwh_value, no_port, nama_port, tipe_port, satuan, timestamp)"+
            " VALUES "+queryValues;

        logger.info(`Insert kwh items to database ${ dbConfig.osasemobile.database }.kwh_counter_bck`);
        await runDbQuery(pool, insertQuery, dataBind);

        pool.end(() => {
            logger.info("App has run successfully");
        });


    } catch(err) {
        logger.error(err);
        pool.end(() => {
            logger.info("App has closed");
        });
    }
};

/*
 * Osase Collect KwH
 * Collecting osase kwh data to juan5684_osasemobile.kwh_counter_bck
 * Runs every Hour
 */
cron.schedule("0 0 * * * *", async () => {
    const startTime = toDatetimeString(new Date());
    console.info(`\n\nRunning cron Osase Collect KwH at ${ startTime }`);
    try {
        await this.main();
        const endTime = toDatetimeString(new Date());
        console.info(`\n\nCron Osase Collect KwH closed at ${ endTime }`);
    } catch(err) {
        console.error(err);
        const endTime = toDatetimeString(new Date());
        console.info(`\n\nCron Osase Collect KwH closed at ${ endTime }`);
    }
});