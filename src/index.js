const Database = require("./helpers/newosase/database");
const workersRegionalPortSensors = require("./app/workers-regional-port-sensors");

const db = new Database();
db.runQuery("SELECT * FROM regional").then(({ results }) => {
    console.log("===== START TO FETCHING OPNIMUS PORT PER REGIONAL =====\n");
    results.forEach(regional => {
        workersRegionalPortSensors(regional);
    });
    console.log("\n===== WAITING FETCH PROCESS OPNIMUS PORT PER REGIONAL =====\n");
});