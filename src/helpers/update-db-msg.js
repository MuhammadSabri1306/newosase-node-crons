const Database = require("./newosase/database");

module.exports = async (id, status) => {
    const db = new Database();
    try {
        await db.runQuery({
            query: "UPDATE rtu_port_message SET sended=? WHERE id=?",
            bind: [status, id]
        });
    } catch(err) {
        console.error(err);
    }
};