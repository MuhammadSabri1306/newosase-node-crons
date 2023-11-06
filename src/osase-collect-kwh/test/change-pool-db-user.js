const mysql = require("mysql");
const dbConfig = require("../../env/database");

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
            if(args.length > 1)
                conn.query(args[0], args[1], (err, results) => callback(conn, err, results));
            else
                conn.query(args[0], (err, results) => callback(conn, err, results));
        });

    });
};

const changeDbUser = (pool, config) => {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, conn) => {

            if(err) {
                reject(err);
                return;
            }

            conn.changeUser(config, err => {
                if(err)
                    reject(err);
                else
                    resolve();
            });

        });
    });
};

const main = async () => {
    try {

        const pool = mysql.createPool(dbConfig.densus);
        const rtuList = await runDbQuery(pool, "SELECT * FROM rtu_map LIMIT 1");
        console.log(rtuList);

        console.log(dbConfig.osasemobile.database);
        await runDbQuery(pool, `USE ${ dbConfig.osasemobile.database }`);
        const kwhList = await runDbQuery(pool, "SELECT * FROM kwh_counter_bck LIMIT 1");
        console.log(kwhList);

        pool.end(() => {
            console.info("App has run successfully");
        });

    } catch(err) {
        console.error(err);
        pool.end(() => {
            console.info("App has run successfully");
        });
    }
};

main();