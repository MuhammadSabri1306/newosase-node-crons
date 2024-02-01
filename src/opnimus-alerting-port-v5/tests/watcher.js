const { watch, addDelay } = require("../apps/watcher");

const getTimeStr = () => {

    const date = new Date();
    const h = date.getHours().toString().padStart(2, "0");
    const m = date.getMinutes().toString().padStart(2, "0");
    const s = date.getSeconds().toString().padStart(2, "0");
    return `${ h }:${ m }:${ s }`;

};

const testCases = {
    test1: (watcher) => {
        
        console.log( getTimeStr() );
        addDelay(watcher, 1000);
    },
    test2: (watcher) => {
        return new Promise(resolve => {
            console.log( getTimeStr() );
            addDelay(watcher, 1000);
            setTimeout(resolve, 2000);
        });
    },
    test3: async (watcher) => {
        addDelay(watcher, 2000);
        await new Promise(resolve => {
            console.log( getTimeStr() );
            setTimeout(resolve, 1000);
        });
    },
};

const main = () => {

    const testName = "test3";
    watch(testCases[testName], {
        onBefore: () => console.log(`running ${ testName }`),
        onAfter: () => console.log(`${ testName } is done`),
        onDelay: delayTime => console.log(`waiting delay ${ delayTime }ms`)
    });
};

main();