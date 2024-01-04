const fs = require("fs");
const logger = require("./logger");

module.exports.isBunyanActive = () => logger.streams ? true : false;

module.exports.isErrorExists = (err) => {
    if(!this.isBunyanActive())
        return false;

    try {

        const errLogPath = logger.streams.find(({ path }) => path.indexOf("error") >= 0).path;
        const logFileContent = fs.readFileSync(errLogPath, "utf8");
        const logRecords = logFileContent.split("\n");
        
        const matchedErr = logRecords.find(record => {
            if(record.trim().length === 0)
                return false;
            try {

                record = JSON.parse(record);
                const recordErr = (record.err ? record.err.message : record.err) || "";
                const recordMsg = record.msg || "";
    
                let matchedMsg = null;
                if(err.message.indexOf(recordMsg) === 0)
                    matchedMsg = recordMsg;
                else if(err.message.indexOf(recordErr) === 0)
                    matchedMsg = recordErr;
    
                if(!matchedMsg || matchedMsg.length < 1)
                    return false;
    
                const errMsg = err.message;
                const maxLength = Math.min(errMsg.length, matchedMsg.length);
                let matchedResult = "";
                for(let i=0; i<maxLength; i++) {
                    if(errMsg[i] !== matchedMsg[i])
                        break;
                    matchedResult += errMsg[i];
                }

                return matchedResult.split(" ").length > 3;

            } catch(err) {
                return false;
            }
        });

        return matchedErr ? true : false;

    } catch(err) {
        // console.error(err);
        return false;
    }
};

module.exports.logErrorWithFilter = (err) => {
    if(!this.isErrorExists(err)) {
        console.log("Error captured.");
        logger.error(err);
    }
};