const { Auth } = require("../helpers/newosase");

module.exports = () => {
    const newosaseAuth = new Auth();
    newosaseAuth.regenerateToken();
    console.log(newosaseAuth.token);
};