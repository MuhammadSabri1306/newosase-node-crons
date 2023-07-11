const Database = require("./newosase/database");
const buildMessage = require("./build-message");
const { extractDate } = require("./date");
const { SelectQueryBuilder } = require("./mysql-query-builder");
const { toFixedNumber } = require("./number-format");

const readAlert = async (regionalId) => {
    const db = new Database();
    try {

        const queryDbMsg = new SelectQueryBuilder("rtu_port_message AS msg");
        queryDbMsg.join("rtu_port_status AS port", "port.id=msg.status_id");
        queryDbMsg.join("rtu_list AS rtu", "rtu.sname=port.rtu_code");
        queryDbMsg.join("rtu_location AS loc", "loc.id=rtu.location_id");
        queryDbMsg.join("datel", "datel.id=rtu.datel_id");
        queryDbMsg.join("witel", "witel.id=rtu.witel_id");
        queryDbMsg.join("regional AS reg", "reg.id=rtu.regional_id");

        queryDbMsg.addFields("msg.id");
        queryDbMsg.addFields("msg.created_at");
        queryDbMsg.addFields("port.port");
        queryDbMsg.addFields("port.port_name");
        queryDbMsg.addFields("port.value AS port_value");
        queryDbMsg.addFields("port.unit AS port_unit");
        queryDbMsg.addFields("port.rtu_status");
        queryDbMsg.addFields("port.port_status");
        queryDbMsg.addFields("rtu.name AS rtu_name");
        queryDbMsg.addFields("rtu.sname AS rtu_code");
        queryDbMsg.addFields("loc.location_name");
        queryDbMsg.addFields("loc.location_sname");
        queryDbMsg.addFields("datel.datel_name");
        queryDbMsg.addFields("witel.witel_name");
        queryDbMsg.addFields("reg.divre_code");
        queryDbMsg.addFields("reg.name AS divre_name");

        queryDbMsg.where("sended!=?", "success");
        queryDbMsg.where("port.regional_id=?", regionalId);

        const resultDbMsg = await db.runQuery({
            query: queryDbMsg.getQuery(),
            bind: queryDbMsg.getBuiltBindData(),
            autoClose: false
        });

        const dataMsg = resultDbMsg.results.map(item => {
            const id = item.id;
            // let statusState = null;
            let title = null, description = null;

            if(item.port_name == "Status DEG" && item.port_value == 1){
                
                // statusState = "GENSET ON";
                title = `🔆 GENSET ON: ${ item.location_name } (${ item.rtu_code })🔆`;
                description = "Terpantau GENSET ON dengan detail sebagai berikut:";

            } else if(item.port_name == "Status PLN" && item.port_value == 1) {
                
                // statusState = "PLN OFF";
                title = `⚡️ PLN OFF: ${ item.location_name } (${ item.rtu_code })⚡️`;
                description = "Terpantau PLN OFF dengan detail sebagai berikut:";

            }

            const datetime = extractDate(new Date(item.created_at));
            const timestamp = `${ datetime.day }-${ datetime.month }-${ datetime.year } ${ datetime.hours }:${ datetime.minutes } WIB`;

            const message = buildMessage({
                title,
                description,
                timestamp,
                regional: item.divre_name,
                witel: item.witel_name,
                location: item.location_name,
                rtuCode: item.rtu_code,
                nodeName: item.rtu_name,
                siteType: null,
                portName: item.port_name,
                port: `${ item.port } ${ item.port_name }`,
                value: `${ item.port_value ? toFixedNumber(item.port_value) : null } ${ item.port_unit }`,
                status: item.port_status
            });

            return { id, message };
        });
        
        return dataMsg;
        
    } catch(err) {
        console.error(err);
    }
};

module.exports = readAlert;