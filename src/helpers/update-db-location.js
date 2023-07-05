const Database = require("./newosase/database");
const { toDatetimeString } = require("./date");
const { InsertQueryBuilder } = require("./mysql-query-builder");

const checkLocationIdM = id => id.toString().search(/[^0-9]/) >= 0;

module.exports = async (dataLocation) => {
    const db = new Database();
    try {

        const { results } = await db.runQuery({
            query: "SELECT * FROM rtu_location",
            autoClose: false
        });

        const updatedRow = [];
        const newRowWithId = [];
        const newRowWithIdM = [];

        dataLocation.forEach(item => {
            const currLoc = results.find(dbItem => {
                return dbItem.id == item.id || dbItem.id_m == item.id;
            });

            if(currLoc) {
                updatedRow.push({
                    oldData: currLoc,
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
            updatedRow.forEach(async (item) => {
                const { oldData, newData } = item;
                const useIdM = checkLocationIdM(newData.id);
                let query = "", bind = [];

                if(useIdM) {
                    query = "UPDATE rtu_location SET location_name=?, location_sname=?, datel_id=?, timestamp=? WHERE id_m=?";
                    bind = [newData.name, newData.sname, newData.id_datel, currDateTime, oldData.id_m];
                } else {
                    query = "UPDATE rtu_location SET location_name=?, location_sname=?, datel_id=?, timestamp=? WHERE id=?";
                    bind = [newData.name, newData.sname, newData.id_datel, currDateTime, oldData.id];
                }

                const autoClose = (newRowWithId.length < 1) || (newRowWithIdM.length < 1);
                await db.runQuery({ query, bind, autoClose });
            });
        }

        if(newRowWithId.length > 0) {
            const queryDbLoc = new InsertQueryBuilder("rtu_location");
            queryDbLoc.addFields("id");
            queryDbLoc.addFields("location_name");
            queryDbLoc.addFields("location_sname");
            queryDbLoc.addFields("datel_id");
            queryDbLoc.addFields("timestamp");
            newRowWithId.forEach(item => {
                queryDbLoc.appendRow([item.id, item.name, item.sname, item.id_datel, currDateTime]);
            });

            await db.runQuery({
                query: queryDbLoc.getQuery(),
                bind: queryDbLoc.getBuiltBindData(),
                autoClose: newRowWithIdM.length < 1
            });
        }

        if(newRowWithIdM.length > 0) {
            const queryDbLoc2 = new InsertQueryBuilder("rtu_location");
            queryDbLoc2.addFields("id_m");
            queryDbLoc2.addFields("location_name");
            queryDbLoc2.addFields("location_sname");
            queryDbLoc2.addFields("datel_id");
            queryDbLoc2.addFields("timestamp");
            newRowWithIdM.forEach(item => {
                queryDbLoc2.appendRow([item.id, item.name, item.sname, item.id_datel, currDateTime]);
            });

            await db.runQuery({
                query: queryDbLoc2.getQuery(),
                bind: queryDbLoc2.getBuiltBindData()
            });
        }

    } catch(err) {
        console.error(err);
    }
};