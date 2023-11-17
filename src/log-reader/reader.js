const bunyan = require("bunyan");
const PrettyStream = require("bunyan-prettystream");
const path = require("path");
const fs = require("fs");

const loggerName = "Log Reader";

const readLogFile = level => {
    const logFilePath = path.resolve(__dirname, "input.log");
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

const formatLogForFile = (record) => {
    // const logDate = new Date(record.time).toISOString();
    const dateOptions = {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hourCycle: "h24"
    };
    const dateStr = new Intl.DateTimeFormat('en-ID', dateOptions).format(new Date(record.time));

    const isError = record.err ? true : false;
    if(!isError)
        return `[${ dateStr }]\n${ record.msg }\n\n`;
    
    return `\n\n[${ dateStr }]\n${ record.err.message }\n${ record.err.stack }`;
};
  
const prettyfyLogFile = (level) => {
    const inputPath = path.resolve(__dirname, 'input.log');
    const outputPath = path.resolve(__dirname, 'output.log');
    const inputContent = fs.readFileSync(inputPath, 'utf8');
    const logRecords = inputContent.split('\n');
  
    const logStream = fs.createWriteStream(outputPath, { flags: 'a' });
  
    const logger = bunyan.createLogger({
      name: loggerName,
      streams: [{ level, stream: logStream }],
    });
  
    logRecords.forEach((record, index) => {
      try {
        if (record.trim().length === 0) return;
        const parsedRecord = JSON.parse(record);
        const formattedLogForFile = formatLogForFile(parsedRecord);
        logStream.write(formattedLogForFile);
        // logger[level](parsedRecord, parsedRecord.msg);
      } catch (err) {
        console.error(`Error parsing log record in line number ${index + 1}:`, err);
      }
    });
  
    logStream.end();
};

// readLogFile("error");
prettyfyLogFile("error");