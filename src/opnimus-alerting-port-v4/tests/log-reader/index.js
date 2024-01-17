const path = require("path");
const fs = require("fs");
const { useSftpClient } = require("./sftp");
const readline = require("readline");
const ReadLineInterface = require("./ReadLineInterfce");
const { extractAppInfo, searchAppStart, searchAppEnd } = require("./pattern");
const { toDatetimeString } = require("../../../helpers/date");

const fileName = "newosase-watcher-2024-01-17.log";
const logPath = path.resolve(__dirname, "../../logs/" + fileName);

const printErrorFromLocal = async () => {
    const readStream = fs.createReadStream(logPath);
    const rli = new ReadLineInterface(
        readline.createInterface({ input: readStream, crlfDelay: Infinity })
    );

    rli.onStart(() => {
        process.stdout.write(`Start to reading ${ fileName }\n`);
    });

    const loggedErrors = {};
    let errorAppId = null;
    rli.onLine(({ line, lineNumber, rl }) => {

        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write("Reading line " + lineNumber);

        const app = extractAppInfo(line);
        if(app.logLevel == "ERROR") {

            if(app.id != "app1705367659093") {
                const { id } = app;
                errorAppId = id;
                loggedErrors[id] = line;
            }


        } else if(!app.id && errorAppId && errorAppId in loggedErrors) {
            loggedErrors[errorAppId] += "\n" + line;
        } else {
            errorAppId = null;
        }

    });

    rli.onClose(({ lineNumber }) => {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write("Finish at line " + lineNumber);

        const contents = Object.values(loggedErrors);
        if(contents.length < 1) {
            process.stdout.write("\n\nNo errors founded");
        } else {
            contents.forEach(content => {
                process.stdout.write("\n\n" + content);
            });
        }
    })

    rli.startReading();
};

const copyErrorFromLocal = async () => {
    const readStream = fs.createReadStream(logPath);
    const rli = new ReadLineInterface(
        readline.createInterface({ input: readStream, crlfDelay: Infinity })
    );

    rli.onStart(() => {
        process.stdout.write(`Start to reading ${ fileName }\n`);
    });

    const loggedErrors = {};
    let errorAppId = null;
    rli.onLine(({ line, lineNumber, rl }) => {

        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write("Reading line " + lineNumber);

        const app = extractAppInfo(line);
        if(app.logLevel == "ERROR") {

            const { id } = app;
            errorAppId = id;
            loggedErrors[id] = line;


        } else if(!app.id && errorAppId && errorAppId in loggedErrors) {
            loggedErrors[errorAppId] += "\n" + line;
        } else {
            errorAppId = null;
        }

    });

    rli.onClose(({ lineNumber }) => {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write("Finish at line " + lineNumber);

        const contents = Object.values(loggedErrors);
        if(contents.length < 1) {
            process.stdout.write("\n\nNo errors founded");
        } else {

            const outputFilePath = path.resolve(__dirname, "output.log");
            const currDateTime = toDatetimeString(new Date());
            fs.appendFileSync(outputFilePath, `\n\n======================= ${ currDateTime } =======================`);
            contents.forEach(content => {
                fs.appendFileSync(outputFilePath, "\n\n" + content);
            });
            process.stdout.write("\n\nContents copied, count:" + contents.length);
        }
    });

    rli.startReading();
};

const printErrorFromRemote = async () => {
    const sftp = await useSftpClient();

    const sftpConfig = require("../../../../../../.vscode/sftp.json");
    const logPath = `${ sftpConfig.remotePath }/crons/node-crons/src/opnimus-alerting-port-v4/logs/${ fileName }`;

    const readStream = await sftp.createReadStream(logPath);
    const rli = new ReadLineInterface(
        readline.createInterface({ input: readStream, crlfDelay: Infinity })
    );

    rli.onStart(() => {
        process.stdout.write(`Start to reading ${ fileName }\n`);
    });

    const loggedErrors = {};
    let errorAppId = null;
    rli.onLine(({ line, lineNumber, rl }) => {

        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write("Reading line " + lineNumber);

        const app = extractAppInfo(line);
        if(app.logLevel == "ERROR") {

            if(app.id != "app1705367659093") {
                const { id } = app;
                errorAppId = id;
                loggedErrors[id] = line;
            }


        } else if(!app.id && errorAppId && errorAppId in loggedErrors) {
            loggedErrors[errorAppId] += "\n" + line;
        } else {
            errorAppId = null;
        }

    });

    rli.onClose(async ({ lineNumber }) => {

        await sftp.end();

        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write("Finish at line " + lineNumber);

        const contents = Object.values(loggedErrors);
        if(contents.length < 1) {
            process.stdout.write("\n\nNo errors founded");
        } else {
            contents.forEach(content => {
                process.stdout.write("\n\n" + content);
            });
        }
    });

    rli.startReading();
};

const copyErrorFromRemote = async () => {
    const sftp = await useSftpClient();

    const sftpConfig = require("../../../../../../.vscode/sftp.json");
    const logPath = `${ sftpConfig.remotePath }/crons/node-crons/src/opnimus-alerting-port-v4/logs/${ fileName }`;

    const readStream = await sftp.createReadStream(logPath);
    const rli = new ReadLineInterface(
        readline.createInterface({ input: readStream, crlfDelay: Infinity })
    );

    rli.onStart(() => {
        process.stdout.write(`Start to reading ${ fileName }\n`);
    });

    const loggedErrors = {};
    let errorAppId = null;
    rli.onLine(({ line, lineNumber, rl }) => {

        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write("Reading line " + lineNumber);

        const app = extractAppInfo(line);
        if(app.logLevel == "ERROR") {

            if(app.id != "app1705367659093") {
                const { id } = app;
                errorAppId = id;
                loggedErrors[id] = line;
            }


        } else if(!app.id && errorAppId && errorAppId in loggedErrors) {
            loggedErrors[errorAppId] += "\n" + line;
        } else {
            errorAppId = null;
        }

    });

    rli.onClose(async ({ lineNumber }) => {

        await sftp.end();

        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write("Finish at line " + lineNumber);

        const contents = Object.values(loggedErrors);
        if(contents.length < 1) {
            process.stdout.write("\n\nNo errors founded");
        } else {

            const outputFilePath = path.resolve(__dirname, "output.log");
            const currDateTime = toDatetimeString(new Date());
            fs.appendFileSync(outputFilePath, `\n\n======================= ${ currDateTime } =======================`);
            contents.forEach(content => {
                fs.appendFileSync(outputFilePath, "\n\n" + content);
            });
            process.stdout.write("\n\nContents copied, count:" + contents.length);
        }
    });

    rli.startReading();
};

const copyFromLocalByAppId = async () => {
    const searchAppId = "app1705474799978";
    const readStream = fs.createReadStream(logPath);
    const rli = new ReadLineInterface(
        readline.createInterface({ input: readStream, crlfDelay: Infinity })
    );

    const outputFilePath = path.resolve(__dirname, "output.log");
    const currDateTime = toDatetimeString(new Date());

    rli.onStart(() => {
        process.stdout.write(`Start to reading ${ fileName }\n`);
        fs.appendFileSync(outputFilePath, `\n\n======================= ${ currDateTime } =======================`);
    });

    let activedAppId = null;
    rli.onLine(({ line, lineNumber, rl }) => {

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

// printErrorFromLocal();
// printErrorFromRemote();

// copyErrorFromLocal();
// copyErrorFromRemote();

copyFromLocalByAppId();