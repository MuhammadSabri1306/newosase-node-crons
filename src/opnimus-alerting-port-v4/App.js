const path = require("path");
const winston = require("winston");
const util = require("util");
const DailyRotateFile = require("winston-daily-rotate-file");
const { createDbPool, closePool } = require("../core/mysql");
const { toDatetimeString } = require("../helpers/date");
const EventEmitter = require("events");

class App extends EventEmitter {

    constructor(appId = null, appName = null) {
        super();
        this.appId = appId || `app${ Date.now() }`;
        this.appName = appName || "app";
        this.dbName = null;
        this.pool = null;

        this.events = {};
        this.delayTimes = [];

        this.isUsingWinstonLogger = false;

        this.useWinstonLogger({
            // console: true,
            stream: true
        });
    }

    useDbPool(dbConfig) {
        this.dbName = dbConfig.database;
        this.logProcess("Creating a database pool");
        this.pool = createDbPool({ ...dbConfig, multipleStatements: true });
    }

    async closeDbPool() {
        try {
            await closePool(this.pool);
        } catch(err) {
            this.logger.error(err);
        }
    }

    getTimeByAppId(appId) {
        try {
            if(typeof appId != "string" || appId.indexOf("app-") !== 0)
                throw new Error(`App.id is not valid in App.getTimeByAppId(${ appId })`);
            const time = Number(appId.slice(3));
            return time;
        } catch(err) {
            this.logger.warn(err);
            return null;
        }
    }

    useWinstonLogger(config = {}) {
        this.isUsingWinstonLogger = true;
        const appId = this.appId;
        const appName = this.appName;
        const logDir = path.resolve(__dirname, "logs");

        const transports = [];
        if(config.console)
            transports.push(new winston.transports.Console());

        if(config.stream) {
            const dailyRF = new DailyRotateFile({
                dirname: logDir,
                filename: appName + "-%DATE%.log",
                datePattern: "YYYY-MM-DD",
                zippedArchive: true
            });
            transports.push(dailyRF);
        }

        this.logger = winston.createLogger({
            level: "info",
            format: winston.format.combine(
                winston.format.errors({ stack: true }),
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message, stack }) => {
                    const dateTime = toDatetimeString( new Date(timestamp) );
                    let text = `[${ dateTime }] ${ appId }`;
                    text += ` ${ level.toUpperCase() }: ${ message }`;
                    if(stack)
                        text += `\n${ stack }`;
                    return text;
                })
            ),
            transports,
        });
    }

    logProcess(description, data = {}) {
        const dataStr = Object.entries(data).map(([ key, val ]) => `${ key }:${ JSON.stringify(val) }`);
        const text = [ description, ...dataStr ].join(", ");
        this.logger.info(text);
    }

    logError(err) {
        this.logger.error(err);
    }

    logDatabaseQuery(queries, description = "Run MySQL query", otherParams = {}) {
        const database = this.dbName;

        if(!Array.isArray(queries)) {
            this.logProcess(description, { database, ...otherParams, query: queries });
            return;
        }

        queries.forEach((query, index) => {

            const params = Array.isArray(otherParams) && otherParams.length > index ? otherParams[index] : otherParams;
            this.logProcess(description, { database, ...params, query });

        });
    }

    registerDelayTimes(time) {
        const timestamp = Date.now();
        const resultTimestamp = timestamp + time;
        this.delayTimes.push({ resultTimestamp, timestamp, time });
    }

    getBiggestDelayTimestamp() {
        const timestamps = this.delayTimes.map(item => item.resultTimestamp);
        return Math.max(...timestamps);
    }

}

module.exports = App;