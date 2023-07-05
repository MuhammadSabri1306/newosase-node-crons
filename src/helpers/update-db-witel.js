const Database = require("./newosase/database");
const { toDatetimeString } = require("./date");
const { InsertQueryBuilder } = require("./mysql-query-builder");

module.exports = async (dataWitel) => {
    const db = new Database();
    try {

        const { results } = await db.runQuery({
            query: "SELECT * FROM witel",
            autoClose: false
        });

        const updatedWitel = [];
        const newWitel = [];

        dataWitel.forEach(item => {
            const currWitel = results.find(dbItem => {
                return dbItem.id == item.id_witel;
            });

            if(currWitel) {
                updatedWitel.push({
                    oldData: currWitel,
                    newData: item
                });
            } else {
                newWitel.push(item);
            }
        });

        const currDateTime = toDatetimeString(new Date());

        if(updatedWitel.length > 0) {
            updatedWitel.forEach(async (item) => {
                const { oldData, newData } = item;
                await db.runQuery({
                    query: "UPDATE witel SET witel_name=?, regional_id=?, timestamp=? WHERE id=?",
                    bind: [newData.witel, newData.id_regional, currDateTime, oldData.id],
                    autoClose: newWitel.length < 1
                });
            });
        }

        if(newWitel.length > 0) {
            const queryDbWitel = new InsertQueryBuilder("witel");
            queryDbWitel.addFields("id");
            queryDbWitel.addFields("witel_name");
            queryDbWitel.addFields("regional_id");
            queryDbWitel.addFields("timestamp");
            newWitel.forEach(item => {
                queryDbWitel.appendRow([item.id_witel, item.witel, item.id_regional, currDateTime]);
            });

            await db.runQuery({
                query: queryDbWitel.getQuery(),
                bind: queryDbWitel.getBuiltBindData()
            });
        }

    } catch(err) {
        console.error(err);
    }
};