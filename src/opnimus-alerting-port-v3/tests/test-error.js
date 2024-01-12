

const logError = (...args) => {
    let err = null;
    const errArgs = [];
    args.forEach(arg => {
        if(arg instanceof Error)
            err = arg;
        else
            errArgs.push(arg);
    });
    if(err) errArgs.push(err);
    console.error(...errArgs);
}

(() => {
    try {
        throw Error("Test error");
    } catch(err) {
        logError("Ada error", err);
    }
})();