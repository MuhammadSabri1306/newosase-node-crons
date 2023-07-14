const { Telegraf } = require("telegraf");
const config = require("../config");
const ProcessSlot = require("./process-slot");
const updatePortMessage = require("./db-query/update-port-message");
const storeAlertError = require("./db-query/store-alert-error");

const bot = new Telegraf(config.botToken);

const delayNextAlert = time => {
    return new Promise((resolve) => setTimeout(resolve, time));
};

// const sendAlert = async (chatId, msg) => {
//     const maxRetry = config.alert.maxRetry;
//     let retryCount = 0;
//     while (retryCount <= maxRetry) {
//         try {

//             await bot.telegram.sendMessage(chatId, msg, { parse_mode: "Markdown" });
//             return { success: true };

//         } catch(err) {
    
//             let timeout = 1000;
//             console.error(err);
//             if(err.description) {
//                 const retryTime = telegramError.catchRetryTime(err.description);
//                 if(retryTime < 1) {
//                     console.log("no retry time, desc:" + err.description);
//                 } else {
//                     console.log(`retry time:${ retryTime }s`);
//                     timeout = retryTime * 1000;
//                 }
//             }
    
//             if(retryCount === maxRetry) {
//                 console.error(`Failed to send message. Retry ${ retryCount + 1 }/${ maxRetry }`);
//                 return { success: false, error: err }
//             }

//             retryCount++;
//             await delayNextAlert(timeout);
    
//         }
//     }
// };

// module.exports = async (alerts) => {
//     console.log(alerts.length)

//     for(let index=0; index<alerts.length; alerts++) {
//         const currAlert = alerts[index];
//         try {

//             const result = await sendAlert(currAlert.user.chat_id, currAlert.message);
//             console.log(alerts.length, result)

//             if(result.success) {
//                 await updatePortMessage(currAlert.messageId, "success");
//             } else {
//                 const errCode = result.error && result.error.code ? result.error.code : null;
//                 const errDesc = result.error && result.error.description ? result.error.description : null;
//                 if(errCode && errDesc)
//                     await storeAlertError(errCode, errDesc, currAlert.messageId, currAlert.user.id);
//                 else
//                     console.error(result.error);
//             }

//         } catch(err) {
//             console.error(err);
//         }

//     }
// };

module.exports = async (alerts, onFinish) => {
    // const processSlot = new ProcessSlot(10);
    // processSlot.setTimer({
    //     nextRunTimer: 1000,
    //     errorRetryTime: err => {
    //         if(err.description) {
    //             const sec = telegramError.catchRetryTime(err.description);
    //             if(sec < 1) {
    //                 console.log("no retry time, desc:" + err.description);
    //                 return 1000;
    //             }
    //             console.log(`retry time:${ sec }s`);
    //             return (sec * 1000) + 1000;
    //         }
    //         return 1000;
    //     }
    // });

    // alerts.forEach(({ user, message, messageId }) => {
    //     processSlot.addWork(() => bot.telegram.sendMessage(user.chat_id, message, { parse_mode: "Markdown" }), {
    //         onSuccess: () => {
    //             // updateDbMsg(messageId, "success");
    //             updatePortMessage(messageId, "success");
    //             console.log("success", user.chat_id, messageId);
    //         },
    //         onError: err => {
    //             if(err.code && err.description) {
    //                 // storeDbAlertError(err.code, err.description, messageId, user.id);
    //                 storeAlertError(err.code, err.description, messageId, user.id);
    //             }
    //             console.log("error", user.chat_id, messageId);
    //         }
    //     });
    // });

    // processSlot.run({ onFinish });

    const defaultTimeout = 1000;
    const maxRetry = config.alert.maxRetry;
    let retryCount = 0;
    let i = 0;

    let telErrorCount = 0;

    while(i<alerts.length) {
        const currAlert = alerts[i];
        try {

            await bot.telegram.sendMessage(currAlert.user.chat_id, currAlert.message, { parse_mode: "Markdown" });
            await updatePortMessage(currAlert.messageId, "success");

            retryCount = 0;
            i++;

        } catch(err) {

            let timeout = defaultTimeout;
            retryCount++;

            if(!err.code && !err.description) {

                console.error(err);

            } else if(retryCount <= maxRetry) {

                const retryTime = telegramError.catchRetryTime(err.description);
                if(retryTime > 0) {
                    timeout = (retryTime + 1000) * 1000;
                    console.error(`retry time:${ retryTime }s`);
                } else {
                    console.error(`default retry time:${ retryTime }s`);
                }

            } else {
                
                console.error(`Failed to send message. Retry ${ retryCount + 1 }/${ maxRetry }`);
                await storeAlertError(err.code, err.description, messageId, user.id);
                retryCount = 0;
                i++;
                telErrorCount++;
                
            }
            await delayNextAlert(timeout);
            
        }
    }

    onFinish();
};