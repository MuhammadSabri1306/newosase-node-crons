const bunyan = require("bunyan");
const PrettyStream = require("bunyan-prettystream");
const path = require("path");
const fs = require("fs");

const loggerName = "Opnimus Alerting Port";

const getLogFilePath = level => {
    const filePath = path.resolve(__dirname, `logs/${ level }.log`);
    return filePath;
};

const useLogger = () => {
    return bunyan.createLogger({
        name: loggerName,
        streams: [
            { level: "debug", path: getLogFilePath("debug") },
            { level: "info", path: getLogFilePath("info") },
            { level: "warn", path: getLogFilePath("warn") },
            { level: "error", path: getLogFilePath("error") }
        ]
    });
};

const useDevLogger = () => {
    const prettyStdOut = new PrettyStream();
    prettyStdOut.pipe(process.stdout);

    return bunyan.createLogger({
        name: loggerName,
        streams: [
            { level: "trace", type: "raw", stream: prettyStdOut },
            //   { level: "debug", type: "raw", stream: prettyStdOut },
            { level: "info", type: "raw", stream: prettyStdOut },
            { level: "warn", type: "raw", stream: prettyStdOut },
            { level: "error", type: "raw", stream: prettyStdOut },
            { level: "fatal", type: "raw", stream: prettyStdOut }
        ]
    });
};

const useDevLogger2 = () => {
    return {
        trace: (...args) => console.log(...args),
        info: (...args) => console.info(...args),
        warn: (...args) => console.warn(...args),
        error: (...args) => console.error(...args),
        fatal: (...args) => console.error(...args)
    };
};

const useEmptyLogger = () => {
    return bunyan.createLogger({
        name: loggerName,
        streams: [{ level: "fatal", stream: process.stdout }]
    });
};

const readLogFile = level => {
    const logPathList = {
        "debug": getLogFilePath("debug"),
        "info": getLogFilePath("info"),
        "warn": getLogFilePath("warn"),
        "error": getLogFilePath("error")
    };

    const logFilePath = logPathList[level];
    const logFileContent = fs.readFileSync(logFilePath, "utf8");
    const logRecords = logFileContent.split("\n");
    
    const prettyStdOut = new PrettyStream();
    prettyStdOut.pipe(process.stdout);

    const logger = bunyan.createLogger({
        name: loggerName,
        streams: [
            { level: "debug", type: "raw", stream: prettyStdOut },
            { level: "info", type: "raw", stream: prettyStdOut },
            { level: "warn", type: "raw", stream: prettyStdOut },
            { level: "error", type: "raw", stream: prettyStdOut }
        ]
    });

    logRecords.forEach((record, index) => {
        try {
            
            if(record.trim().length === 0)
                return;
            const parsedRecord = JSON.parse(record);
            logger[level](parsedRecord, parsedRecord.msg);
        } catch (err) {
            console.error(`Error parsing log record in line number ${ index + 1 }:`, err);
        }
    });
};

// this.readLogFile("warn");
module.exports = useLogger();
// module.exports = useDevLogger2();