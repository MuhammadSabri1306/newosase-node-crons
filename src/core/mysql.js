const mysql = require("mysql");

module.exports.createDbPool = config => mysql.createPool(config);

module.exports.getConnection = (pool) => {
    const maxRetryCount = 1;
    let retryCount = 0;

    return new Promise((resolve, reject) => {

        const callbackLoop = () => {
            pool.getConnection((err, conn) => {
    
                if(!err) {
                    resolve(conn);
                    return;
                }
    
                if(err.fatal || retryCount >= maxRetryCount) {
                    reject(err);
                    return;
                }

                retryCount++;
                callbackLoop();
                
            });
        };
        
        callbackLoop();

    });
};

module.exports.executeQuery = (pool, callQuery) => {
    return new Promise(async (resolve, reject) => {
        try {

            const conn = await this.getConnection(pool);
            callQuery(conn, (err, results, fields) => {

                if(err) {
                    reject(err);
                    return;
                }
                
                conn.release();
                resolve({ err, results, fields });

            });

        } catch(err) {
            reject(err);
        }
    });
};

module.exports.selectRowQuery = (pool, callQuery) => {
    return new Promise(async (resolve, reject) => {
        try {

            const conn = await this.getConnection(pool);
            callQuery(conn, (err, results, fields) => {

                if(err) {
                    reject(err);
                    return;
                }
                
                conn.release();
                results = results.length > 0 ? results[0] : null;
                resolve({ err, results, fields });


            });

        } catch(err) {
            reject(err);
        }
    });
};