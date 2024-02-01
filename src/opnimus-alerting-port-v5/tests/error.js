
const test = () => {
    return new Promise(resolve => {
        throw new Error("test error from promise");
    });
};

const main = async () => {
    await test();
};

main();