
const regExp = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (\S+) (\w+): (.*)$/;

module.exports.extractAppInfo = line => {
    const matches = line.match(regExp);
    if(!matches)
        return { content: line };
    const [, dateTime, id, logLevel, content] = matches;
    return { dateTime, id, logLevel, content };
};

module.exports.searchAppStart = (lines) => {
    const isMatch = app => app && app.content && app.content.indexOf("run alarms synchroniztion of witels") == 0;
    for(let i=0; i<lines.length; i++) {
        let app = this.extractAppInfo(lines[i]);
        if(isMatch(app)) {
            return app;
        }
    }
    return null;
};

module.exports.searchAppEnd = (lines) => {
    const isMatch = line => line.indexOf("close alarms synchroniztion of witels") == 0;
    let matchLine = null;

    for(let i=0; i<lines.length; i++) {
        if(isMatch(lines[i])) {
            matchLine = lines[i];
        }
    }

    if(!matchLine) return null;
    const app = this.extractAppInfo(matchLine);
    if(!app.id)
        return null;
    return app;
};

module.exports.searchErrorStart = (lines) => {
    const app = extractAppInfo(lines[lines.length - 1]);
    if(!app.id && app.logLevel == "ERROR")
        return app;
    return null;
};