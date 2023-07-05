const Database = require("./newosase/database");
const { toDatetimeString } = require("./date");
const { InsertQueryBuilder } = require("./mysql-query-builder");

module.exports = async (dataDatel) => {
    const db = new Database();
    try {

        const { results } = await db.runQuery({
            query: "SELECT * FROM datel",
            autoClose: false
        });

        const updatedDatel = [];
        const newDatel = [];

        dataDatel.forEach(item => {
            const currDatel = results.find(dbItem => {
                return dbItem.id == item.id_datel;
            });

            if(currDatel) {
                updatedDatel.push({
                    oldData: currDatel,
                    newData: item
                });
            } else {
                newDatel.push(item);
            }
        });

        const currDateTime = toDatetimeString(new Date());

        if(updatedDatel.length > 0) {
            updatedDatel.forEach(async (item) => {
                const { oldData, newData } = item;
                await db.runQuery({
                    query: "UPDATE datel SET datel_name=?, witel_id=?, timestamp=? WHERE id=?",
                    bind: [newData.datel, newData.id_witel, currDateTime, oldData.id],
                    autoClose: newDatel.length < 1
                });
            });
        }

        if(newDatel.length > 0) {
            const queryDbDatel = new InsertQueryBuilder("datel");
            queryDbDatel.addFields("id");
            queryDbDatel.addFields("datel_name");
            queryDbDatel.addFields("witel_id");
            queryDbDatel.addFields("timestamp");
            newDatel.forEach(item => {
                queryDbDatel.appendRow([item.id_datel, item.datel, item.id_witel, currDateTime]);
            });

            await db.runQuery({
                query: queryDbDatel.getQuery(),
                bind: queryDbDatel.getBuiltBindData()
            });
        }

    } catch(err) {
        console.error(err);
    }
};