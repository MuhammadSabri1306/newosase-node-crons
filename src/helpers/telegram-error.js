
module.exports.catchRetryTime = (errorDescr) => {
    const matchStr = errorDescr.match(/(?<=retry after )\d+/);
    if(matchStr && matchStr.length > 0)
        return Number(matchStr[0]);
    return 0;
};

/*
 * Telegram's api error documented on https://github.com/TelegramBotAPI/errors
 */

module.exports.getErrRetryTime = (errorDescr) => this.catchRetryTime(errorDescr);

module.exports.isErrUser = (errorDescr) => {
    const keywords = [
        "chat not found",
        "user not found",
        "user is deactivated",
        "bot was kicked",
        "bot was blocked",
    ];
    for(let i=0; i<keywords.length; i++) {
        if(errorDescr.indexOf(keywords[i]) >= 0) {
            i = keywords.length;
            return true;
        }
    }
    return false;
};

module.exports.isErrMsgThread = errorDescr => {
    const keyword = "message thread not found";
    return errorDescr.indexOf(keyword) >= 0;
};