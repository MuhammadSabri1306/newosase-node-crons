const Database = require("./newosase/database");
const { toDatetimeString } = require("./date");
const { InsertQueryBuilder } = require("./mysql-query-builder");

const checkLocationIdM = id => id.toString().search(/[^0-9]/) >= 0;

module.exports = async (dataRtu) => {
    const db = new Database();
    try {

        const { results } = await db.runQuery({
            query: "SELECT * FROM rtu_list",
            autoClose: false
        });

        const updatedRow = [];
        const newRowWithId = [];
        const newRowWithIdM = [];

        dataRtu.forEach(item => {
            const currRtu = results.find(dbItem => {
                return dbItem.id == item.id || dbItem.id_m == item.id;
            });

            if(currRtu) {
                updatedRow.push({
                    oldData: currRtu,
                    newData: item
                });
            } else if(checkLocationIdM(item.id)) {
                newRowWithIdM.push(item);
            } else {
                newRowWithId.push(item);
            }
        });

        const currDateTime = toDatetimeString(new Date());

        if(updatedRow.length > 0) {
            for(let i=0; i<updatedRow.length; i++) {

                const { oldData, newData } = updatedRow[i];
                const useIdM = checkLocationIdM(newData.id);
                let query = "", bind = [];
    
                if(useIdM) {
                    query = "UPDATE rtu_list SET name=?, sname=?, location_id=?, datel_id=?, witel_id=?, regional_id=?, timestamp=? WHERE id_m=?";
                    bind = [newData.name, newData.sname, newData.location_id, newData.datel_id, newData.witel_id, newData.regional_id, currDateTime, oldData.id_m];
                } else {
                    query = "UPDATE rtu_list SET name=?, sname=?, location_id=?, datel_id=?, witel_id=?, regional_id=?, timestamp=? WHERE id=?";
                    bind = [newData.name, newData.sname, newData.location_id, newData.datel_id, newData.witel_id, newData.regional_id, currDateTime, oldData.id];
                }
    
                const autoClose = (newRowWithId.length < 1) && (newRowWithIdM.length < 1);
                console.log(autoClose);
                await db.runQuery({ query, bind, autoClose });

            }
        }

        if(newRowWithId.length > 0) {
            const queryDbWitel = new InsertQueryBuilder("rtu_list");
            queryDbWitel.addFields("id");
            queryDbWitel.addFields("name");
            queryDbWitel.addFields("sname");
            queryDbWitel.addFields("location_id");
            queryDbWitel.addFields("datel_id");
            queryDbWitel.addFields("witel_id");
            queryDbWitel.addFields("regional_id");
            queryDbWitel.addFields("timestamp");
            newRowWithId.forEach(item => {
                queryDbWitel.appendRow([item.id, item.name, item.sname, item.location_id, item.datel_id, item.witel_id, item.regional_id, currDateTime]);
            });

            await db.runQuery({
                query: queryDbWitel.getQuery(),
                bind: queryDbWitel.getBuiltBindData(),
                autoClose: newRowWithIdM.length < 1
            });
        }

        if(newRowWithIdM.length > 0) {
            const queryDbWitel2 = new InsertQueryBuilder("rtu_list");
            queryDbWitel2.addFields("id_m");
            queryDbWitel2.addFields("name");
            queryDbWitel2.addFields("sname");
            queryDbWitel2.addFields("location_id");
            queryDbWitel2.addFields("datel_id");
            queryDbWitel2.addFields("witel_id");
            queryDbWitel2.addFields("regional_id");
            queryDbWitel2.addFields("timestamp");
            newRowWithIdM.forEach(item => {
                queryDbWitel2.appendRow([item.id, item.name, item.sname, item.location_id, item.datel_id, item.witel_id, item.regional_id, currDateTime]);
            });

            await db.runQuery({
                query: queryDbWitel2.getQuery(),
                bind: queryDbWitel2.getBuiltBindData()
            });
        }

    } catch(err) {
        console.error(err);
    }
};