const mysql = require('mysql');

class Database {

    constructor(config) {
        this.__config = config;
        this.connection = null;
        this.name = config.database;
        this.results = null;
        this.fields = null;
    }

    getConfig() {
        return this.__config;
    }

    setConnection(conn) {
        this.connection = conn;
    }

    getConnection() {
        if(!this.connection)
            this.connection = mysql.createConnection(this.getConfig());
        return this.connection;
    }

    changeConnection(options) {
        return new Promise((resolve, reject) => {
            this.getConnection().changeUser(options, err => {
                if(err)
                    reject(err);
                else
                    resolve();
            });
        });
    }

    query(sql, values = null) {
        return new Promise((resolve, reject) => {

            this.getConnection().connect();

            const callback = (error, results, fields) => {
                this.results = results;
                this.fields = fields;
                if(error) {
                    reject(error);
                } else {
                    resolve({ results, fields });
                }
            };
            
            if(values === null) {
                this.getConnection().query(sql, callback);
            } else {
                this.getConnection().query(sql, values, callback);
            }
        });
    }
}

module.exports.Database = Database;

module.exports.defineDatabase = config => {
    return () => new Database(config);
};