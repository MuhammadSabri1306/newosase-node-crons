
const regExp = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (\S+) (\w+): (.*)$/;

module.exports.extractAppInfo = line => {
    const matches = line.match(regExp);
    if(!matches)
        return { content: line };
    const [, dateTime, id, logLevel, content] = matches;
    return { dateTime, id, logLevel, content };
};

module.exports.searchAppStart = (lines) => {
    const lastIndex = lines.length - 1;
    if(lines[lastIndex] != "App is starting")
        return null;
    const app = this.extractAppInfo( lines[lastIndex - 1] );
    if(!app.id)
        return null;
    return app;
};

module.exports.searchAppEnd = (lines) => {
    const app = this.extractAppInfo( lines[lines.length - 1] );
    if(!app.id)
        return null;
    if(app.content != "App is closed")
        return null;
    return app;
};

module.exports.searchErrorStart = (lines) => {
    const app = extractAppInfo(lines[lines.length - 1]);
    if(!app.id && app.logLevel == "ERROR")
        return app;
    return null;
};