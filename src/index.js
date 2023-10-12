const syncOpnimusLocation = require("./app/sync-opnimus-location");
const telegramAlertV3 = require("./app/telegram-alert-v3");
const densusAlertKwh = require("./app/alert-kwh");

module.exports = { syncOpnimusLocation, telegramAlertV3, densusAlertKwh };