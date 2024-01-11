// const mysql = require("mysql");
// const { createDbPool, closePool, executeQuery } = require("../../core/mysql");
const mysql = require("mysql2");

/*
 * - Checking mysql's thread count: SHOW STATUS WHERE `variable_name` = 'Threads_connected'
 * - Checking mysql's maximum thread count: SHOW VARIABLES LIKE 'max_connections';
 * 
 */

const dbConfig = {
    host: "localhost",
    user: "root",
    password: "",
    database: "opnimusv2_discord"
};

const executeConQuery = (connection, query) => {
    return new Promise(resolve => {
        connection.query(query, (err, results) => {
            if(err)
                throw new Error(err);
            resolve(results);
        });
    });
};

const testConThreadCount = async () => {
    console.log("Test thread count using createConnection()");
    for(let i=0; i<10; i++) {
        let connection = mysql.createConnection(dbConfig);
    }
};

const testPoolThreadCount = async () => {
    console.log("Test thread count using createPool()");
    for(let i=0; i<10; i++) {
        let pool = mysql.createPool({ ...dbConfig, connectionLimit: 10 });
    }
};

const testPoolThreadWithQueries = async () => {
    console.log("Test thread count using createPool() with queries");
    let pool = mysql.createPool({ ...dbConfig, connectionLimit: 10 }).promise();
    for(let i=0; i<10; i++) {
        let rows = await pool.query("SELECT 1");
    }
    // pool.end();
};

// testConThreadCount();
// testPoolThreadCount();
testPoolThreadWithQueries();