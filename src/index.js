const main = require("./app/main");
const syncOpnimusLocation = require("./app/sync-opnimus-location");
const telegramAlertV2 = require("./app/telegram-alert-v2");
const telegramAlertV3 = require("./app/telegram-alert-v3");

module.exports = { main, syncOpnimusLocation, telegramAlertV2, telegramAlertV3 };