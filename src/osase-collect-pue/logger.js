const bunyan = require("bunyan");
const path = require("path");
const fs = require("fs");

const loggerName = "Osase Collect PUE";

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
    return {
        trace: (...args) => console.log(...args),
        debug: (...args) => console.log(...args),
        info: (...args) => console.info(...args),
        warn: (...args) => console.warn(...args),
        error: (...args) => console.error(...args),
        fatal: (...args) => console.error(...args)
    };
};

module.exports = useLogger();
// module.exports = useDevLogger();