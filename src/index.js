// const testMessage = require("./app/test-message");
// const testAuth = require("./app/test-auth");
// const testGetDummy = require("./app/test-get-dummy");
const getPortSensors = require("./app/get-port-sensors");

// testMessage();
// testAuth();
// testGetDummy();
getPortSensors(dataPortSensor => {
    console.log(dataPortSensor);
});