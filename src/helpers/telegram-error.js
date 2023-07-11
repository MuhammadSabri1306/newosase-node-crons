const catchRetryTime = desc => {
    const matchStr = desc.match(/(?<=retry after )\d+/);
    if(matchStr.length < 1)
        return 0;
    return Number(matchStr[0]);
};

module.exports = { catchRetryTime };