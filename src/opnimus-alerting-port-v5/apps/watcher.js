const EventEmitter = require("events");

class Watcher {

    constructor() {
        this.$events = null;
        this.$delayTimes = [];
    }

    static getOrCreate(watcher) {
        if(watcher instanceof Watcher)
            return watcher;
        return new Watcher();
    }

}

const setWatcherEvents = (watcher, { onBefore, onAfter, onDelay, onError }) => {
    watcher.$events = new EventEmitter();
    if(onBefore)
        watcher.$events.addListener("before", onBefore);
    if(onAfter)
        watcher.$events.addListener("after", onAfter);
    if(onDelay)
        watcher.$events.addListener("delay", onDelay);
    if(onError)
        watcher.$events.addListener("error", onError);
}

const getWatcherBiggestDelayTime = (watcher, defaultTime = 0) => {
    const timestamps = watcher.$delayTimes.map(item => item.resultTimestamp);
    const biggestTimestamp = Math.max(...timestamps);
    const time = biggestTimestamp - Date.now();
    return time > 0 ? time : defaultTime;
}

module.exports.Watcher = Watcher;

module.exports.watch = async (runWatcher, events = null) => {
    const watcher = new Watcher();
    if(events)
        setWatcherEvents(watcher, events);

    let run = true;
    while(run) {
        try {
            watcher.$events && watcher.$events.emit("before");
            await runWatcher(watcher);
            watcher.$events && watcher.$events.emit("after");
            
            const delayTime = getWatcherBiggestDelayTime(watcher);
            if(delayTime > 0) {
                watcher.$events && watcher.$events.emit("delay", delayTime);
                await new Promise(resolve => setTimeout(resolve, delayTime));
            }
        } catch(err) {
            watcher.$events && watcher.$events.emit("error", err);
            run = false;
        }
    }
};

module.exports.addDelay = (watcher, time) => {
    if(!watcher instanceof Watcher)
        throw new Error(`watcher expected as Watcher object in addDelay(watcher:${ watcher }, time:${ time })`);
    if(!Number.isInteger(time))
        throw new Error(`time expected as int number in addDelay(watcher:${ watcher }, time:${ time })`);

    const timestamp = Date.now();
    const resultTimestamp = timestamp + time;
    watcher.$delayTimes.push({ resultTimestamp, timestamp, time });
};