const { useOpnimusNewBot } = require("../../bot/opnimus-new");
const { catchRetryTime } = require("../../helpers/telegram-error");
const { Worker, parentPort, workerData, isMainThread } = require("worker_threads");
const { Telegraf, TelegramError } = require("telegraf");

const opnimusNewBot = useOpnimusNewBot();

const main = () => {
    try {

        const worker = new Worker(__filename, {
            workerData: { chatId: "1931357638" }
        });
        
        worker.on("message", workerData => {
            if(workerData.success)
                console.log("success");
        });

        worker.on("error", err => console.error(err));

    } catch(err) {
        console.error(err);
    }
};

const workerJob = async () => {
    try {
        const result = await opnimusNewBot.sendMessage(workerData.chatId, "", { parse_mode: "Markdown" });
        if(!result.success) {
            throw result.error;
        }
        parentPort.postMessage({ success: true });
    } catch(err) {
        if(err instanceof TelegramError)
            console.error(err.description, err.code, JSON.stringify(err.response));
        parentPort.postMessage({ success: false, error: err });
    }
};

if(isMainThread)
    main();
else
    workerJob();