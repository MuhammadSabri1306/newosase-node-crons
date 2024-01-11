const path = require("path");
const fs = require("fs");
const readline = require("readline");
const events = require("events");
const { toDatetimeString } = require("../helpers/date");

const logTypes = [ "info", "debug", "error" ];

const args = process.argv.slice(2);
const options = {
    path: null,
    search: null,
    type: "info",
    startline: 1,
    maxline: null,
    output: false
};

args.forEach(arg => {
    Object.keys(options).forEach(key => {

        if(key == "output" && arg.indexOf(`--${ key }`)) {
            options[key] = true;
            return;
        }

        const regExp = `--${ key }=(.+)`;
        const match = arg.match(new RegExp(regExp));
        if(match)
            options[key] = match[1];

    });
});

if(!options.path)
    throw new Error("The arg --path<String> is required");
if(logTypes.indexOf(options.type) < 0)
    throw new Error("The arg --type<String> only retrieve 'info'|'debug'|'error'");

const logPath = path.resolve(__dirname, `../${ options.path }`);
const readStream = fs.createReadStream(logPath);
const rl = readline.createInterface({
    input: readStream,
    crlfDelay: Infinity
});

const { type: logType, startline: startLine } = options;
const maxLine = options.maxline ? Math.min(options.maxline, 50) : 10;
let currLine = 0;
let readedLinesCount = 0;

const bunyanFormatter = lineContent => {
    let text;
    let dateStr = null;
    try {

        const data = JSON.parse(lineContent);
        if(data.name !== undefined)
            delete data.name;
        if(data.hostname !== undefined)
            delete data.hostname;
        if(data.pid !== undefined)
            delete data.pid;
        if(data.level !== undefined)
            delete data.level;
        if(data.v !== undefined)
            delete data.v;

        if(data.time) {
            dateStr = toDatetimeString(new Date(data.time));
            delete data.time;
        }

        text = JSON.stringify(data);

    } catch(err) {
        text = lineContent;
    }

    if(text.length > 255)
        text = text.slice(0, 255) + " ...";
    if(dateStr)
        text = `${ dateStr } | ${ text }`;
    return text;
};

(async () => {
    try {

        console.info(`Start to searching in log from line ${ startLine }\n`);
        rl.on("line", (lineContent) => {
            
            currLine++;
            if(readedLinesCount >= maxLine) {
                rl.close();
            } else if(currLine >= startLine) {
                const doOutput = (options.search && lineContent.indexOf(options.search) >= 0) || !options.search;
                if(doOutput) {
                    console[logType](`[${ currLine }] ${ bunyanFormatter(lineContent) }`);
                    readedLinesCount++;
                }
            }
        });
        
        await events.once(rl, "close");
        console.info("\nLog has been searched completely");

    } catch(err) {
        console.error(err);
    }
})();