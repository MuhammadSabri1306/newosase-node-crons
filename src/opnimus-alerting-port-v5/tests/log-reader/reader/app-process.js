const path = require("path");
const fs = require("fs");
const readline = require("readline");
const ReadLineInterface = require("../ReadLineInterfce");
const { extractAppInfo, searchAppStart, searchAppEnd } = require("../pattern");
const { toDatetimeString } = require("../../../../helpers/date");

const fileName = "newosase-watcher-2024-02-06.log";
const logPath = path.resolve(__dirname, "../../../logs/" + fileName);
const outputFilePath = path.resolve(__dirname, "../output.log");

module.exports = () => {

    const searchAppId = "thread-1707155618324";
    const readStream = fs.createReadStream(logPath);
    const rli = new ReadLineInterface(
        readline.createInterface({ input: readStream, crlfDelay: Infinity })
    );

    const currDateTime = toDatetimeString(new Date());
    rli.onStart(() => {
        process.stdout.write(`Start to reading ${ fileName }\n`);
        fs.appendFileSync(outputFilePath, `\n\n======================= ${ currDateTime } =======================`);
    });

    let activedAppId = null;
    rli.onLine(({ line, lineNumber, rl }) => {

        if(lineNumber < 226887)
            return;

        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write("Reading line " + lineNumber);

        const app = extractAppInfo(line);
        if(app.id == searchAppId) {
            activedAppId = app.id;
        } else if(app.id && app.id != searchAppId) {
            activedAppId = null;
        }

        if(activedAppId == searchAppId) {
            fs.appendFileSync(outputFilePath, "\n\n" + line);
        }

    });

    rli.onClose(({ lineNumber }) => {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write("Finish at line " + lineNumber);
    });

    rli.startReading();

};