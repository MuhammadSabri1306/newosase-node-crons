const mysql = require("mysql");

module.exports.createDbPool = config => mysql.createPool(config);

module.exports.closePool = pool => {
    return new Promise(resolve => {
        pool.end(() => resolve());
    });
};

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

const executeQueryV1 = (pool, callQuery) => {
    return new Promise(async (resolve, reject) => {
        try {

            const conn = await this.getConnection(pool);
            callQuery(conn, (err, results, fields) => {

                conn.release();
                if(err) {
                    reject(err);
                    return;
                }
                
                resolve({ err, results, fields });

            });

        } catch(err) {
            reject(err);
        }
    });
};

const changeQueryError = (err, queryStr) => {
    if(err.message !== undefined)
        err.message = `${ err.message }\nquery: ${ queryStr }`;
    return err;
};

const executeQueryV2 = (pool, queryStr) => {
    return new Promise(async (resolve, reject) => {
        try {

            const conn = await this.getConnection(pool);
            conn.query(queryStr, (err, results, fields) => {

                conn.release();
                if(err) {
                    reject(changeQueryError(err, queryStr));
                    return;
                }
                
                resolve({ err, results, fields });

            });

        } catch(err) {
            reject(changeQueryError(err, queryStr));
        }
    });
};

module.exports.executeQuery = executeQueryV2;

const selectRowQueryV1 = (pool, callQuery) => {
    return new Promise(async (resolve, reject) => {
        try {

            const conn = await this.getConnection(pool);
            callQuery(conn, (err, results, fields) => {

                conn.release();
                if(err) {
                    reject(err);
                    return;
                }
                
                results = results.length > 0 ? results[0] : null;
                resolve({ err, results, fields });


            });

        } catch(err) {
            reject(err);
        }
    });
};

const selectRowQueryV2 = (pool, queryStr) => {
    return new Promise(async (resolve, reject) => {
        try {

            const conn = await this.getConnection(pool);
            conn.query(queryStr, (err, results, fields) => {

                conn.release();
                if(err) {
                    reject(changeQueryError(err, queryStr));
                    return;
                }
                
                results = results.length > 0 ? results[0] : null;
                resolve({ err, results, fields });

            });

        } catch(err) {
            reject(changeQueryError(err, queryStr));
        }
    });
};

module.exports.selectRowQuery = selectRowQueryV2;

module.exports.selectRowCollumnQuery = (pool, collumnKey, queryStr) => {
    return new Promise(async (resolve, reject) => {
        try {

            const conn = await this.getConnection(pool);
            conn.query(queryStr, (err, results, fields) => {

                conn.release();
                if(err) {
                    reject(changeQueryError(err, queryStr));
                    return;
                }
                
                results = (results.length > 0 && results[0][collumnKey]) ? results[0][collumnKey] : null;
                resolve({ err, results, fields });

            });

        } catch(err) {
            reject(changeQueryError(err, queryStr));
        }
    });
};

module.exports.createQuery = mysql.format;