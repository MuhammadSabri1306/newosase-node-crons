const App = require("../App");

const app = new App();
// app.useWinstonLogger();

try {

    app.logProcess("Testing logger");
    app.logDatabaseQuery(["SELECT 1", "SELECT 2"]);
    app.logDatabaseQuery("SELECT 3", "Testing logging query", { id: 1 });

    throw new Error("Test error");

} catch(err) {

    app.logError("Error description", { id: 1 }, err);

}

