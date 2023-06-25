const Database = require("../helpers/newosase/database");

module.exports = () => {

    const db = new Database();
    return db.runQuery("SELECT * FROM regional");

};