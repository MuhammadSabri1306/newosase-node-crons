const mysql = require("mysql");
const dbConfig = require("../env/database");

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
            if(err) {
                reject(err);
                return;
            }
            
            conn.release();
            if(args.length > 1)
                conn.query(args[0], args[1], (err, results) => callback(conn, err, results));
            else
                conn.query(args[0], (err, results) => callback(conn, err, results));
        });

    });
};

const main = async () => {

    const pool = mysql.createPool(dbConfig.opnimusNew);
    try {

        const oldKwhs = await runDbQuery(pool, "SELECT * FROM trial_kwhcounter_new");
        const newKwhs = oldKwhs.map(kwh => {
            const deltaValue = Math.round(kwh.delta_value * 100) / 100;
            return [deltaValue, kwh.id];
        });
        
        for(let i=0; i<newKwhs.length; i++) {
            await runDbQuery(pool, "UPDATE trial_kwhcounter_new SET delta_value=? WHERE id=?", newKwhs[i]);
        }

        pool.end(() => console.info("App has closed"));

    } catch(err) {
        console.error(err);
        pool.end(() => console.info("The Port isn't exists in api newosase. App has closed"));
    }
};

main();