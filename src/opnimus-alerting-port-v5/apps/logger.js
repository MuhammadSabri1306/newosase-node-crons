const path = require("path");
const winston = require("winston");
const util = require("util");
const DailyRotateFile = require("winston-daily-rotate-file");
const { toDatetimeString } = require("../../helpers/date");

class Logger {

    constructor(threadId, options) {
        this.$threadId = threadId;
        this.$options = options;

        const { useConsole, useStream, fileName, dirName } = options;
        this.$log = Logger.createWinstonLogger({ threadId, useConsole, useStream, fileName, dirName });
    }

    static create(options = {}) {
        const threadId = `thread-${ Date.now() }`;
        const { useConsole, useStream, fileName, dirName } = options;
        return new Logger(threadId, { useConsole, useStream, fileName, dirName });
    }

    static getOrCreate(logger) {
        if(logger instanceof Logger)
            return logger;
        return Logger.create({ useConsole: true });
    }

    static generateChildThreadId() {
        const currentTime = Date.now();
        return currentTime.toString(16);
    }

    createChildLogger(childThreadId = null) {
        if(!childThreadId)
            childThreadId = Logger.generateChildThreadId();
        const threadId = `${ this.$threadId }-${ childThreadId }`;
        return new Logger(threadId, this.$options);
    }

    static initChildLogger(threadId, options) {
        const parentLogger = new Logger(threadId, options);
        return parentLogger.createChildLogger();
    }

    static createWinstonLogger({ threadId, useConsole, useStream, fileName, dirName }) {

        if(!dirName)
            dirName = path.resolve(__dirname, "../logs");

        const format = winston.format.combine(
            winston.format.errors({ stack: true }),
            winston.format.timestamp(),
            winston.format.printf(({ timestamp, level, message, stack }) => {
                const dateTime = toDatetimeString( new Date(timestamp) );
                let text = `[${ dateTime }]`;
                if(threadId) text += ` ${ threadId }`;
                text += ` ${ level.toUpperCase() }: ${ message }`;
                if(stack) text += `\n${ stack }`;
                return text;
            })
        );

        const transports = [];
        if(useConsole)
            transports.push(new winston.transports.Console());
        if(useStream) {
            const dailyRF = new DailyRotateFile({
                dirname: dirName,
                filename: `${ fileName }-%DATE%.log`,
                datePattern: "YYYY-MM-DD",
                zippedArchive: true
            });
            transports.push(dailyRF);
        }

        return winston.createLogger({ level: "info", format, transports });

    }

    getThreadId() {
        return this.$threadId;
    }

    getOptions() {
        return this.$options;
    }

    info(description, data = {}) {
        const dataStr = Object.entries(data).map(([ key, val ]) => `${ key }:${ JSON.stringify(val) }`);
        const text = [ description, ...dataStr ].join(", ");
        this.$log.info(text);
    }

    error(err) {
        this.$log.error(err);
    }

}

module.exports.Logger = Logger;