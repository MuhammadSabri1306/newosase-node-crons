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

        this.useDevLogger();
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
        };;
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

    logProcess(description) {
        const text = `\nrunId:${ this.time } | ${ toDatetimeString(new Date()) } | ${ description }`;
        this.logger.info(text);
    }

    logDatabaseQuery(queries, description = null, otherParams = {}) {
        const database = this.dbName;
        let text = `\nrunId:${ this.time } | ${ toDatetimeString(new Date()) }`;
        if(description)
            text += " | " + description;

        if(!Array.isArray(queries)) {
            this.logger.info(text, { database, ...otherParams, query: queries });
            return;
        }

        queries.forEach((query, index) => {
            const params = Array.isArray(otherParams) && otherParams.length > index ? otherParams[index] : otherParams;
            this.logger.info(text, { database, ...params, query });
        })
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