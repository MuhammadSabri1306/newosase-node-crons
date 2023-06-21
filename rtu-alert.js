const { NewosaseAuth } = require("./core");

const run = () => {
    const newosaseAuth = new NewosaseAuth();
    console.log(newosaseAuth.token);
};

module.exports = run;