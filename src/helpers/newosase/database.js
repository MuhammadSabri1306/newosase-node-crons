const mysql = require("mysql");
const { database } = require("../../config");

class Database
{
    constructor(dbKey = "opnimusNew") {
        this.setupDb(dbKey);
        this.log = [];
        this.conn = null;
        this.query = null;
        this.success = false;
        this.connected = false;
    }

    setupDb(dbKey) {
        if(!database[dbKey]) {
            console.error("Unknown database target to use!");
            return;
        }

        this.db_config = database[dbKey];
    }

    pushLog() {
        const connection = this.conn;
        const databaseConfig = this.db_config;
        const query = this.query;
        const success = this.success;

        this.log.push({
            connection,
            databaseConfig,
            query,
            success,
            timestamp: new Date().toLocaleString()
        });
    }

    close() {
        if(!this.connected)
            return;
        this.conn.end(err => {
            if(err)
                console.error("Error closing the database connection: ", err);
            else
                this.connected = false;
        });
    }

    runQuery(config) {
        if(typeof config == "string") {
            config = {
                query: config,
                autoClose: true
            };
        }

        if(config.databaseKey)
            this.setupDb(config.databaseKey);
        if(config.autoClose !== false)
            config.autoClose = true;

        if(config.query && config.bind)
            this.query = mysql.format(config.query, config.bind);
        else if(config.query)
            this.query = config.query;

        if(!this.conn || config.databaseKey)
            this.conn = mysql.createConnection(this.db_config);

        return new Promise((resolve, reject) => {
            if(!this.connected) {
                this.conn.connect(error => {
                    if(!error) {
                        this.connected = true;
                        return;
                    }
                    console.error("Error connecting to the database: ", error);
                    reject(error);
                });
            }
    
            this.conn.query(this.query, (error, results, fields) => {
                if(error) {
    
                    this.success = false;
                    console.error("Error executing the query: ", error);
                    reject(error);
    
                } else {
    
                    this.success = true;
                    resolve({ results, fields });
                    
                }
                
                this.pushLog();
                if(config.autoClose)
                    this.close();
            });
        });
    }
}

module.exports = Database;