const Database = require("./helpers/newosase/database");
const workersRegionalPortSensors = require("./app/workers-regional-port-sensors");

const mainApp = () => {
    console.log("mainApp is starting..");

    const db = new Database();
    db.runQuery("SELECT * FROM regional WHERE id=2")
        .then(({ results }) => {
            results.forEach(dataRegional => workersRegionalPortSensors(dataRegional))
        })
        .catch(err => {
            console.error(err);
            console.log("mainApp is is stopped running..");
        });
};

mainApp();