const path = require("path");
const winston = require("winston");
const util = require("util");
const DailyRotateFile = require("winston-daily-rotate-file");
const { createDbPool, closePool } = require("../core/mysql");
const { toDatetimeString } = require("../helpers/date");

class App {

    constructor(appId = null) {
        this.time = Date.now();
        if(appId) {
            const time = this.getTimeByAppId(appId);
            if(time) this.time = time;
        }

        this.date = new Date(this.time);
        this.dateStr = toDatetimeString(this.date);
        this.dbName = null;
        this.pool = null;

        this.events = {};
        this.delayTimes = [];

        this.isUsingWinstonLogger = false;

        this.useWinstonLogger({
            // console: true,
            stream: true
        });
        // this.useDevLogger();
        // this.useEmptyLogger();
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

    getAppId() {
        return `app-${ this.time }`;
    }

    getTimeByAppId(appId) {
        try {
            if(typeof appId != "string" || appId.indexOf("app-") !== 0)
                throw new Error(`App.id is not valid in App.getTimeByAppId(${ appId })`);
            const time = Number(appId.slice(4));
            return time;
        } catch(err) {
            this.logger.warn(err);
            return null;
        }
    }

    useDevLogger() {
        this.logger = {
            trace: console.log,
            debug: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error,
            fatal: console.error
        };
    }

    useEmptyLogger() {
        this.logger = {
            trace: (...args) => null,
            debug: (...args) => null,
            info: (...args) => null,
            warn: (...args) => null,
            error: (...args) => null,
            fatal: (...args) => null
        };
    }

    useWinstonLogger(config = {}) {
        this.isUsingWinstonLogger = true;
        const appId = this.getAppId();
        const logDir = path.resolve(__dirname, "logs");
        const formatter = this.logFormat;

        const utilFormatter = function() {
            return {
                transform: function(info, opts) {
                    const args = info[Symbol.for("splat")];
                    if(args)
                        info.message = util.format(info.message, ...args);
                    return info;
                }
            };
        };

        const transports = [];
        if(config.console)
            transports.push(new winston.transports.Console());

        if(config.stream) {
            const dailyRF = new DailyRotateFile({
                dirname: logDir,
                filename: "app-%DATE%.log",
                datePattern: "YYYY-MM-DD",
                zippedArchive: true,
                maxSize: "20m",
                maxFiles: "7d",
            });
            transports.push(dailyRF);
        }

        this.logger = winston.createLogger({
            level: "info",
            format: winston.format.combine(
                winston.format.errors({ stack: true }),
                winston.format.timestamp(),
                utilFormatter(),
                winston.format.printf(({ timestamp, level, message, stack }) => {
                    const dateTime = toDatetimeString( new Date(timestamp) );
                    return formatter({ appId, level, dateTime, message, stack });
                })
            ),
            transports,
        });
    }

    logFormat({ appId, level, dateTime, message, stack }) {
        let text = `[${ dateTime }] ${ appId }`;
        text += ` ${ level.toUpperCase() }: ${ message.replace("Error: ", "") }`;
        if(stack) {
            text += ` ${ stack.replace("Error: ", "") }`;
        }
        return text;
    }

    logProcess(description) {
        if(this.isUsingWinstonLogger) {
            this.logger.info(description);
            return;
        }

        const appId = this.getAppId();
        const level = "info";
        const dateTime = toDatetimeString(new Date());
        const text = this.logFormat({ appId, level, dateTime, message: description });
        this.logger.info(text);
    }

    logError(...args) {
        let err = null;
        const errArgs = [];
        args.forEach(arg => {
            if(arg instanceof Error)
                err = arg;
            else
                errArgs.push(arg);
        });
        
        if(this.isUsingWinstonLogger) {
            if(err) errArgs.push(err);
            this.logger.error(...errArgs);
            return;
        }

        const appId = this.getAppId();
        const level = "error";
        const dateTime = toDatetimeString(new Date());

        const stack = null;
        if(err) {
            errArgs.push(err.message);
            stack = err.stack;
        }

        const message = util.format(...errArgs);
        const text = this.logFormat({ appId, level, dateTime, message, stack });
        this.logger.error(text);
    }

    logDatabaseQuery(queries, description = "Run MySQL query", otherParams = {}) {
        const database = this.dbName;

        const appId = this.getAppId();
        const level = "info";
        const dateTime = toDatetimeString(new Date());

        if(!Array.isArray(queries)) {

            if(this.isUsingWinstonLogger) {
                this.logger.info(description, { database, ...otherParams, query: queries });
                return;
            }

            const text = this.logFormat({ appId, level, dateTime, message: description });
            this.logger.info(text, { database, ...otherParams, query: queries });
            return;

        }

        queries.forEach((query, index) => {

            const params = Array.isArray(otherParams) && otherParams.length > index ? otherParams[index] : otherParams;

            if(this.isUsingWinstonLogger) {
                this.logger.info(description, { database, ...params, query });
                return;
            }

            const text = this.logFormat({ appId, level, dateTime, message: description });
            this.logger.info(text, { database, ...otherParams, query });

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

    on(eventType, callback) {
        if(typeof eventType != "string")
            throw new Error("App.on(...args) first argument should be event type [String]");
        if(typeof callback != "function")
            throw new Error("App.on(...args) second argument should be callback [Function]");
        this.events[eventType] = callback;
    }

    commit(eventType, data = null) {
        if(typeof eventType != "string")
            throw new Error("App.commit(...args) first argument should be event type [String]");
        if(eventType in this.events) {
            if(data)
                this.events[eventType](data);
            else
                this.events[eventType]();
        } else {
            throw new Error(`event type '${ eventType }' is not registered yet before App.commit('${ eventType }', data?)`);
        }
    }

}

module.exports = App;