const { Database, http } = require("../helpers/newosase");
const { Telegraf } = require("telegraf");
const { botToken } = require("../config");
const buildMessage = require("../helpers/build-message");
const { extractDate, toDatetimeString } = require("../helpers/date");
const { SelectQueryBuilder, InsertQueryBuilder } = require("../helpers/mysql-query-builder");
const { toFixedNumber } = require("../helpers/number-format");

const app = new Telegraf(botToken);

const sendMessage = async (regionalId) => {
    const db = new Database();
    const sendedMsgIds = [];

    const successMsgIds = [];
    const warningMsgIds = [];
    const errorMsgIds = [];

    let dataMsg = [];
    let alarmUserData = [];
    const alarmErrorData = [];

    try {
        const resultDbChat = await db.runQuery({
            query: "SELECT * FROM telegram_alarm_user WHERE alert=1",
            autoClose: false
        });

        const chatIds = resultDbChat.results.map(item => item.chat_id);
        alarmUserData = resultDbChat.results;

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

        dataMsg = resultDbMsg.results.map(item => {
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
                nodeName: `${ item.rtu_code } (${ item.rtu_name })`,
                siteType: null,
                portName: item.port_name,
                port: `${ item.port } ${ item.port_name }`,
                value: `${ item.port_value ? toFixedNumber(item.port_value) : null } ${ item.port_unit }`,
                status: item.port_status
            });

            return { id, message };
        });
        
        // for(let i=0; i<dataMsg.length; i++) {

        //     const messageId = dataMsg[i].id;
        //     const message = dataMsg[i].message;
        //     for(let j=0; j<chatIds.length; j++) {

        //         const chatId = chatIds[j];
        //         await app.telegram.sendMessage(chatId, message, { parse_mode: "Markdown" });
        //         // await http.get(`https://api.telegram.org/bot${ botToken }/sendmessage?chat_id=${ chatId }&parse_mode=markdown&text=${ message }`);

        //     }
        //     sendedMsgIds.push(messageId);

        // }
        
    } catch(err) {
        console.error(err);
    }

    const totalUser = alarmUserData.length;
    dataMsg.forEach(msgItem => {
        let sendedUser = 0;
        alarmUserData.forEach(async (userItem) => {
            try {
                await app.telegram.sendMessage(userItem.chat_id, msgItem.message, { parse_mode: "Markdown" });
                sendedUser++;
            } catch(err) {
                if(err.code && err.description) {
                    alarmErrorData.push({
                        errorCode: err.code,
                        description: err.description,
                        messageId: msgItem.id,
                        alarmUserId: userItem.id
                    });
                } else {
                    console.error(err);
                }
            }

            if(sendedUser < 1)
                errorMsgIds.push(msgItem.id);
            else if(sendedUser < totalUser)
                warningMsgIds.push(msgItem.id);
            else
                successMsgIds.push(msgItem.id);
        });
    });

    // if(sendedMsgIds.length > 0) {
        // try {
        //     await db.runQuery({
        //         query: "UPDATE rtu_port_message SET sended=1 WHERE id IN (?)",
        //         bind: [sendedMsgIds]
        //     });
        // } catch(err) {
        //     console.error(err);
        // }
    // }

    console.log(alarmErrorData.length)
    if(alarmErrorData.length > 0) {
        const queryDbError = new InsertQueryBuilder("telegram_alarm_error");
        queryDbError.addFields("error_code");
        queryDbError.addFields("description");
        queryDbError.addFields("message_id");
        queryDbError.addFields("alarm_user_id");

        alarmErrorData.forEach(({ errorCode, description, messageId, alarmUserId }) => {
            queryDbError.appendRow([errorCode, description, messageId, alarmUserId]);
        });

        console.log(queryDbError.getQuery(), queryDbError.getBuiltBindData());
        try {
            await db.runQuery({
                query: queryDbError.getQuery(),
                bind: queryDbError.getBuiltBindData(),
                autoClose: false
            });
        } catch(err) {
            console.error(err);
        }
    }

    if(errorMsgIds.length > 0) {
        try {
            await db.runQuery({
                query: "UPDATE rtu_port_message SET sended=? WHERE id IN (?)",
                bind: ["error", sendedMsgIds],
                autoClose: (warningMsgIds.length < 1) && (successMsgIds.length < 1)
            });
        } catch(err) {
            console.error(err);
        }
    }

    if(warningMsgIds.length > 0) {
        try {
            await db.runQuery({
                query: "UPDATE rtu_port_message SET sended=? WHERE id IN (?)",
                bind: ["warning", sendedMsgIds],
                autoClose: successMsgIds.length < 1
            });
        } catch(err) {
            console.error(err);
        }
    }

    if(successMsgIds.length > 0) {
        try {
            await db.runQuery({
                query: "UPDATE rtu_port_message SET sended=? WHERE id IN (?)",
                bind: ["success", sendedMsgIds]
            });
        } catch(err) {
            console.error(err);
        }
    }
};

module.exports = sendMessage;