const path = require("path");
const fs = require("fs");
const readline = require("readline");
const events = require("events");

const getCliOptions = (params = {}) => {
    const options = {};
    const args = process.argv.slice(2);
    args.forEach(arg => {
        Object.entries(params).forEach(([ key, config ]) => {

            if(config.type === Boolean && arg.indexOf(`--${ key }`)) {
                options[key] = true;
                return;
            }
    
            const regExp = `--${ key }=(.+)`;
            const match = arg.match(new RegExp(regExp));
            if(match) {

                let value = match[1];
                if(value.indexOf(",") < 0) {
                    if(config.type)
                        value = config.type(value);
                    options[key] = value;
                    return;
                }

                let values = value.split(",");
                if(config.type)
                    values =  values.map(item => config.type(item));
                options[key] = values;
                return;
            }

            if(config.isRequired)
                throw new Error(`CliOptions '${ key }' is required`);
    
        });
    });
    return options;
};

const options = getCliOptions({
    file: { type: String, isRequired: true }
});

// const logPath = path.resolve(__dirname, `../logs/app-${ options.date }.log`);
const logPath = path.resolve(__dirname, `../logs/${ options.file }`);
const readStream = fs.createReadStream(logPath);
const rl = readline.createInterface({
    input: readStream,
    crlfDelay: Infinity
});

const regExp = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (\S+) (\w+): (.*)$/;
const extractAppInfo = lineContent => {
    const matches = lineContent.match(regExp);
    if(!matches)
        return { content: lineContent };
    const [, dateTime, id, logLevel, content] = matches;
    return { dateTime, id, logLevel, content };
};

const searchAppStart = (lines) => {
    const lastIndex = lines.length - 1;
    if(lines[lastIndex] != "App is starting")
        return null;
    const app = extractAppInfo(lines[lastIndex - 1]);
    if(!app.id)
        return null;
    return app;
};

const searchAppEnd = (lines) => {
    const app = extractAppInfo(lines[lines.length - 1]);
    if(!app.id)
        return null;
    if(app.content != "App is closed")
        return null;
    return app;
};

const searchSuccessAlert = (lines) => {
    const app = extractAppInfo(lines[lines.length - 1]);
    if(!app.id)
        return null;
    if(app.content.indexOf("Update alert success status") !== 0)
        return null;
    return app;
};

const searchErrorAlert = (lines) => {
    const app = extractAppInfo(lines[lines.length - 1]);
    if(!app.id)
        return null;
    if(app.content.indexOf("Update alert unsended status") !== 0)
        return null;
    return app;
};

const tempLineContents = [];
const maxReadedLine = 100;

const loggedApps = {};
const printResult = () => {

    const list = Object.entries(loggedApps);
    if(list.length < 1) {
        console.error("There are no logged apps catched");
        return;
    }

    let fasterRun = null;
    let slowestRun = null;
    let largestAlert = null;
    let largestAlertSuccess = null;
    let largestAlertError = null;

    list.forEach(([ appId, item ]) => {

        if(!item.endAt)
            return;

        const startAt = new Date(item.startAt);
        const endAt = new Date(item.endAt);
        const timeDiff = endAt - startAt;

        if(!fasterRun || timeDiff < fasterRun.timeDiff) {
            fasterRun = { appId, ...item, timeDiff: `${ timeDiff / 1000 }s` };
        }

        if(!slowestRun || timeDiff > slowestRun.timeDiff) {
            slowestRun = { appId, ...item, timeDiff: `${ timeDiff / 1000 }s` };
        }

        if(!largestAlert || item.alertTotal > largestAlert.alertTotal) {
            largestAlert = { appId, ...item, timeDiff: `${ timeDiff / 1000 }s` };
        }

        if(!largestAlertSuccess || item.alertSuccess > largestAlertSuccess.alertSuccess) {
            largestAlertSuccess = { appId, ...item, timeDiff: `${ timeDiff / 1000 }s` };
        }

        if(!largestAlertError || item.alertError > largestAlertError.alertError) {
            largestAlertError = { appId, ...item, timeDiff: `${ timeDiff / 1000 }s` };
        }

    });

    console.log({
        fasterRun,
        slowestRun,
        largestAlert,
        largestAlertSuccess,
        largestAlertError
    });

};


let currLine = 0;
(async () => {
    try {

        console.info("Start to searching in log");
        rl.on("line", lineContent => {
            
            currLine++;
            console.info(`Reading line ${ currLine }`);

            if(tempLineContents.length >= maxReadedLine)
                tempLineContents.shift();
            tempLineContents.push(lineContent);

            const startApp = searchAppStart(tempLineContents);
            if(startApp) {
                const { id, dateTime } = startApp;
                loggedApps[id] = {
                    startAt: dateTime,
                    endAt: null,
                    alertSuccess: 0,
                    alertError: 0,
                    alertTotal: 0,
                };
            }

            const endApp = searchAppEnd(tempLineContents);
            if(endApp && endApp.id in loggedApps) {
                const { id, dateTime } = endApp;
                loggedApps[id].endAt = dateTime;
            }

            const appAlertSuccess = searchSuccessAlert(tempLineContents);
            if(appAlertSuccess && appAlertSuccess.id in loggedApps) {
                const { id } = appAlertSuccess;
                loggedApps[id].alertSuccess++;
                loggedApps[id].alertTotal++;
            }

            const appAlertError = searchErrorAlert(tempLineContents);
            if(appAlertError && appAlertError.id in loggedApps) {
                const { id } = appAlertError;
                loggedApps[id].alertError++;
                loggedApps[id].alertTotal++;
            }

            // if(currLine === 1177) {
            //     rl.close();
            // }

        });
        
        await events.once(rl, "close");
        console.info("\nLog has been searched completely");

        printResult();

    } catch(err) {
        console.error(err);
    }
})();