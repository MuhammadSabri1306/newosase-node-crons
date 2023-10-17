const bunyan = require("bunyan");
const PrettyStream = require("bunyan-prettystream");
const fs = require("fs");

const loggerName = "Densus Node Crons";

module.exports.useLogger = () => {
    return bunyan.createLogger({
        name: loggerName,
        streams: [
            { level: "debug", path: "./logs/debug.log" },
            { level: "info", path: "./logs/info.log" },
            { level: "warn", path: "./logs/warn.log" },
            { level: "error", path: "./logs/error.log" }
        ]
    });
};

module.exports.useDevLogger = () => {
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

module.exports.useEmptyLogger = () => {
    return bunyan.createLogger({
        name: loggerName,
        streams: [{ level: "fatal", stream: process.stdout }]
    });
};

module.exports.readLogFile = level => {
    const logPathList = {
        "debug": "./logs/debug.log",
        "info": "./logs/info.log",
        "warn": "./logs/warn.log",
        "error": "./logs/error.log"
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