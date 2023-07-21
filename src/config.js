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
    },

    database: {
        opnimusNew: {
            host: "10.60.164.18",
            user: "admindb",
            password: "@Dm1ndb#2020",
            database: "juan5684_opnimus_new"
        }
    },

    alert: {
        // params: {},
        params: { regionalId: 2 },
        // params: { witelId: 43 },
        workerLevel: "witel", // rtu || witel || regional
        workerSlot: 20,
        delayTime: 1000,
        delayMessageTime: 1000,
        maxSend: 5,
        maxRetry: 3
    },

    logger: "nohup"
    
};