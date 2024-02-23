const path = require("path");
const fs = require("fs");
const readline = require("readline");
const ReadLineInterface = require("../ReadLineInterfce");
const { extractAppInfo, searchAppStart, searchAppEnd } = require("../pattern");

const fileName = "output.log";
const logPath = path.resolve(__dirname, "../" + fileName);

const readStream = fs.createReadStream(logPath);
const rli = new ReadLineInterface(
    readline.createInterface({ input: readStream, crlfDelay: Infinity })
);

(() => {
    return new Promise(resolve => {
        const lines = [];
        rli.onLine(({ line }) => lines.push(line));
        rli.startReading();
        rli.onClose(() => resolve(lines))
    })
})().then(lines => {

    const groupProcess = {
        witelIds: [],
        witels: {}
    };

    const appStart = searchAppStart(lines);
    const witelIdsJsonIndex = appStart.content.search(/(?<=witelIds:)\[[^\]]+\]/);
    const witelIdsJson = appStart.content.slice(witelIdsJsonIndex);
    groupProcess.witelIds = JSON.parse(witelIdsJson);

    for(let witelId of groupProcess.witelIds) {
        groupProcess.witels[witelId] = [];
    }

    let appErr = null;
    let errWitelId = null;
    for(let i=0; i<lines.length; i++) {

        let app = extractAppInfo(lines[i]);
        if(app.id) {
            if(app.logLevel == "ERROR") {

                appErr = app;
                let jobIdMatch = lines[i - 1].match(/jobId:(\d+)/);
                errWitelId = jobIdMatch[1];

            } else if(appErr) {

                groupProcess.witels[errWitelId].push(appErr);
                appErr = null;
                errWitelId = null;

            } else {

                let witelIdMatch = app.content.match(/witelId:(\d+)/);
                let jobIdMatch = app.content.match(/jobId:(\d+)/);
                let isAllWitelMatch = app.content.indexOf(", witelIds:") >= 0;
                if(witelIdMatch) {
                    let witelId = witelIdMatch[1];
                    groupProcess.witels[witelId].push(app);
                } else if(jobIdMatch) {
                    let witelId = jobIdMatch[1];
                    groupProcess.witels[witelId].push(app);
                } else if(isAllWitelMatch) {
                    for(let witelId of groupProcess.witelIds) {
                        groupProcess.witels[witelId].push(app);
                    }
                }

            }
        } else {

            if(appErr) {
                appErr.content += "\n" + app.content;
            }

        }

    }

    fs.appendFileSync(__filename, "\n\n// RESULT\n" + JSON.stringify(groupProcess, null, 2));

});