const { botToken } = require("../config");
const buildMessage = require("../helpers/build-message");
const { Telegraf } = require("telegraf");

module.exports = () => {
    const app = new Telegraf(botToken);
    const chatId = "1931357638";
    const message = buildMessage({
        title: "PLN OFF: MALINO (RTU-MAL)",
        timestamp: "2023-06-18 03:06:00 WIB",
        regional: "DIVISI TELKOM REGIONAL VII",
        witel: "WITEL SULSEL",
        location: "MALINO (KANDATEL GOWA)",
        nodeName: "RTU-MAL (RTU STO MALINO)",
        siteType: "STO",
        portName: "STATUS PLN MALINO",
        port: "D-01 Status PLN",
        value: "1.00 ON/OFF",
        status: "OFF (0d 0h 4m 0s)",
        pic: "Arif Firmansyah",
    });
    
    app.telegram
        .sendMessage(chatId, message)
        .then(response => console.log(response));
};
