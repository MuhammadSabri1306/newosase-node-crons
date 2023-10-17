const fs = require("fs");
const path = require("path");
const mysql = require("mysql");
const JobQueue = require("../core/job-queue");
const { useLogger, useDevLogger, useEmptyLogger } = require("./logger");
const dbConfig = require("../env/database");
const { toDatetimeString } = require("../helpers/date");
const rtuIgnoreList = require("./rtu-ignore.json");

// const logger = useDevLogger();
const logger = useLogger();
// const logger = useEmptyLogger();
module.exports.logger = logger;

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

const main = () => {
    logger.info("App is starting");
    logger.info("Creating a database connection");
    const conn = mysql.createConnection(dbConfig.densus);

    const onFetchSuccess = kwhList => {

        if(kwhList.length < 1) {
            logger.info("Kwh List is empty, App has run successfully");
            logger.info("App has run successfully");
            process.exit();
            return;
        }

        logger.info("Change database connection to osasemobile.");
        conn.changeUser({ database: dbConfig.osasemobile.database }, err => {

            if(err) return logger.error(err);

            const queryValuesArr = [];
            const dataBind = [];
            const currDateStr = toDatetimeString(new Date());
    
            for(let i=0; i<kwhList.length; i++) {
                queryValuesArr.push("(?, ?, ?, ?, ?, ?, ?)");
                dataBind.push(kwhList[i].RTU_ID, kwhList[i].VALUE, kwhList[i].PORT, kwhList[i].NAMA_PORT, kwhList[i].TIPE_PORT, kwhList[i].SATUAN, currDateStr);
            }
        
            const queryValues = queryValuesArr.join(", ");
            const query = "INSERT INTO kwh_counter_bck (rtu_kode, kwh_value, no_port, nama_port, tipe_port, satuan, timestamp)"+
                " VALUES "+queryValues;
    
            logger.info(`Insert kwh items to database ${ dbConfig.osasemobile.database }.kwh_counter_bck`);
            conn.query(query, dataBind, err => {
                if(err)
                    logger.error(err);
                else
                    logger.info("App has run successfully");
                process.exit();
            });

        });

    };

    logger.info(`Get rtu_map from database ${ dbConfig.densus.database }.rtu_map`);
    conn.query("SELECT * FROM rtu_map WHERE divre_kode='TLK-r7000000'", (err, rtuList) => {
        if(err) return logger.error(err);

        const witelGroup = createWitelGroup(rtuList);
        const kwhList = [];
        const rtuListErr = [];

        logger.info("Setup fetching osase api workers");
        const workerQueue = new JobQueue(10);
        workerQueue.setDelay(1000);

        witelGroup.forEach(witelRtuList => {
            workerQueue.registerWorker("osase-collect-kwh/worker-get-osase-port", { rtuList: witelRtuList });
        });

        workerQueue.onEachAfter(workerResult => {

            if(!Array.isArray(workerResult)) {
                logger.warn(workerResult);
                return;
            }

            workerResult.forEach(item => {
                console.log(item.rtuItem);
                if(item.kwhItem)
                    kwhList.push(item.kwhItem);
                else
                    rtuListErr.push(item.rtuItem);
            });

        });

        workerQueue.onBeforeRun(() => {
            logger.info("Run fetching osase api workers");
        });

        workerQueue.onAfterRun(() => {
            logger.info("Fetching osase api workers run successfully");
            onFetchSuccess(kwhList);
        });

        workerQueue.run();

    });
};

module.exports.main = main;
// main();