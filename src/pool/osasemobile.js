const mysql = require("mysql");
const dbConfig = require("../env/database/osasemobile");

const pool = mysql.createPool({
    connectionLimit: 10,
    ...dbConfig
});

module.exports.useOsasemobilePool = callback => pool.getConnection(callback);