const createWorker = require("../helpers/create-worker");
const Database = require("../helpers/newosase/database");
const readAlert = require("../helpers/read-alert");
// const got = require('got');
// got.emitter.setMaxListeners(20);

const workers = {};

const registerWorker = (key, name, filepath, data) => {
    workers[key] = {
        name,
        filepath,
        data,
        setData(key, value) {
            this.data[key] = value;
        },
        runWorker() {
            console.log("\n======== START ALERTING ========");
            createWorker(this.name, this.filepath, this.data)
                .then(() => {
                    console.log("========= END ALERTING =========");
                    this.runWorker();
                });
        }
    };
};

const run = async (regionalList) => {
    const db = new Database();
    try {
        const resultDbChat = await db.runQuery({
            query: "SELECT * FROM telegram_alarm_user WHERE alert=1",
            autoClose: false
        });

        const telegramUser = resultDbChat.results;

        regionalList.forEach(item => {
            const regionalId = item.id;
            readAlert(regionalId).then(alert => {
                if(!workers[regionalId])
                    registerWorker(regionalId,  "Send Telegram Alert", "send-telegram-alert", { regionalId, alert, telegramUser });
                else {
                    workers[regionalId].setData("alert", alert);
                    workers[regionalId].setData("telegramUser", telegramUser);
                }

                workers[regionalId].runWorker();
            });

        });
    } catch(err) {
        console.error(err);
    }
}

module.exports = async (regionalId = null) => {
    const db = new Database();
    let regionalList = [];

    try {
        if(!regionalId) {
            const { results } = await db.runQuery("SELECT * FROM regional");
            regionalList = results;
        } else {
            const { results } = await db.runQuery({
                query: "SELECT * FROM regional WHERE id=?",
                bind: [regionalId]
            });
            regionalList = results;
        }
    } catch(err) {
        console.error(err);
    } finally {
        run(regionalList);
    }
};