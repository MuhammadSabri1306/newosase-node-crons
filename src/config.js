const path = require("path");

module.exports = {
    botToken: "6094309871:AAGM-ZsoaJqZC4RHjyEdVLm3mSSOwUjPf8E",
    baseUrl: "https://newosase.telkom.co.id/api/v1",
    basePath: path.resolve(__dirname, ".."),
    authParams: {
        application: "Opnimus",
        token: "p5cUT_y5EzIWS4kcedLWAPwWyilVJMg3R6GEhGnUnUjFZKeeTO"
    },
    httpHeaders: {
        "Accept": "application/json"
    },
    httpConfig: {
        rejectUnauthorized: false
    }
};