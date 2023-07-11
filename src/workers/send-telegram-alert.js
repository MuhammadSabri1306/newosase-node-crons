const { parentPort, workerData } = require("worker_threads");
const { Telegraf } = require("telegraf");
const { botToken } = require("../config");
const ProcessSlot = require("../helpers/process-slot");
const updateDbMsg = require("../helpers/update-db-msg");
const storeDbAlertError = require("../helpers/store-db-alert-error");
const telegramError = require("../helpers/telegram-error");

const { regionalId, alert, telegramUser } = workerData;
const cycleTime = 10000;

const testWork = () => {

    const testPromise = (callback, isResolve = true) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                callback();
                if(isResolve)
                    resolve();
                else
                    reject(new Error("Promise reject."));
            }, 500);
        })
    }

    const app = new Telegraf(botToken);
    const msg = `⚡️ OPNIMUS ALERT⚡️
Pada 11-07-2023 14:40 WIB

7️⃣ Regional  : DIVISI REGIONAL 7 KAWASAN TIMUR INDONESIA
🏢 Witel     : WITEL MAKASSAR
🏬 Lokasi    : CLS KALUKUBODO
🎛 RTU Name : RTU00-D7-KLL
🏪 Node Name : RTU TLS CLS KALUKUBODO 1

Port Alarm Detail:
⚠️ Nama Port : AC Voltage T-N PLN
🔌 Port      : A-29 AC Voltage T-N PLN
✴️ Value     : null Volt AC
🌋 Status    : Critical
📅 Waktu     : 11-07-2023 14:40 WIB

❕Mohon untuk segera melakukan Pengecekan port Lokasi Terimakasih.
Anda dapat mengetikan /alarm untuk mengecek alarm saat ini.
#OPNIMUS #PORTALARM #TR7`;
    const testTelegram = numb => {
        return app.telegram.sendMessage("-978347278", msg, { parse_mode: "Markdown" });
    };
    
    const processSlot = new ProcessSlot(10);
    processSlot.setTimer({
        nextRunTimer: 1000,
        errorRetryTime: err => {
            if(err.description) {
                const sec = telegramError.catchRetryTime(err.description);
                if(sec < 1) {
                    console.log("no retry time, desc:" + err.description);
                    return 1000;
                }
                console.log(`retry time:${ sec }s`);
                return sec * 1000;
            }
        }
    });
    
    for(let i=1; i<=100; i++) {
        processSlot.addWork(() => testTelegram(i), {
            onSuccess: () => {
                console.log(i);
            },
            onError: err => {
                console.log("error", i);
            }
        });
    }
    
    processSlot.run({
        onStart: () => {
            console.log("\nMemulai proses");
        },
        onFinish: () => {
            console.log("Semua proses selesai");
        }
    });

};

const main = () => {
    const app = new Telegraf(botToken);
    
    const processSlot = new ProcessSlot(10);
    processSlot.setTimer({
        nextRunTimer: 1000,
        errorRetryTime: err => {
            if(err.description) {
                const sec = telegramError.catchRetryTime(err.description);
                if(sec < 1) {
                    console.log("no retry time, desc:" + err.description);
                    return 1000;
                }
                console.log(`retry time:${ sec }s`);
                return sec * 1000;
            }
            return 1000;
        }
    });

    alert.forEach(msg => {
        telegramUser.forEach(user => {

            processSlot.addWork(() => app.telegram.sendMessage(user.chat_id, msg.message, { parse_mode: "Markdown" }), {
                onSuccess: () => {
                    updateDbMsg(msg.id, "success");
                    console.log("success", user.chat_id, msg.message);
                },
                onError: err => {
                    if(err.code && err.description) {
                        storeDbAlertError(err.code, err.description, msg.id, user.id);
                    }
                }
            });

        });
    });
    
    processSlot.run({
        onFinish:() => {
            setTimeout(() => {
                parentPort.postMessage(regionalId);
            }, cycleTime);
        }
    });
};

// testWork();

if(alert.length < 1 || telegramUser.length < 1) {
    setTimeout(() => parentPort.postMessage(regionalId), 30000);
} else {
    main();
}