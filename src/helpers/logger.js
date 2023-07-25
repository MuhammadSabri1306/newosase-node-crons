const config = require("../config");
const { toDatetimeString } = require("./date");

const buildOutput = statements => {
    let outputStr = "";
    statements.forEach(stm => outputStr += ` ${ stm }`);
    return outputStr;
};

const defaultLog = (...statements) => {
    const dateStr = toDatetimeString(new Date());
    statements.unshift(dateStr);

    const outputStr = buildOutput(statements);
    console.log(outputStr);
};

const errorLog = (...statements) => {
    const dateStr = toDatetimeString(new Date());
    statements.unshift(dateStr);

    const outputStr = buildOutput(statements);
    console.error(outputStr);
    if(statements.length > 1)
        console.error(statements[1]);
};

const debugLog = obj => {
    const statements = [];
    for(let key in obj) {
        statements.push(`${ key }: ${ obj[key] }`);
    }
    const outputStr = "\n" + buildOutput(statements) + "\n";
    console.log(outputStr);
};

const defaultLogger = {
    log: defaultLog,
    error: errorLog,
    debug: debugLog
};

const nohupLogger = {
    log: defaultLog,
    error: errorLog,
    debug: debugLog
};

const createLogger = (type = "default") => {
    if(type == "nohup")
        return nohupLogger;
    return defaultLogger;
};

let logger;
switch(config.logger) {
    case "nohup": logger = nohupLogger;
    default: logger = defaultLogger;
}

module.exports.defaultLogger = defaultLogger;
module.exports.nohupLogger = nohupLogger;
module.exports.createLogger = createLogger;
module.exports.logger = logger;