const Database = require("./helpers/newosase/database");
const workersRegionalPortSensors = require("./app/workers-regional-port-sensors");

const mainApp = async () => {
    console.log("mainApp is starting..");

    const db = new Database();
    try {
        const { results } = await db.runQuery("SELECT * FROM regional WHERE id=2")
        results.forEach(dataRegional => workersRegionalPortSensors(dataRegional));
    } catch(err) {
        console.error(err);
        console.log("mainApp is is stopped running..");
    }
};

module.exports = mainApp;

// mainApp();