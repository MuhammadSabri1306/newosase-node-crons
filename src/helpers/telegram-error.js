const catchRetryTime = desc => {
    const matchStr = desc.match(/(?<=retry after )\d+/);
    if(matchStr && matchStr.length > 0)
        return Number(matchStr[0]);
    return 0;
};

module.exports = { catchRetryTime };