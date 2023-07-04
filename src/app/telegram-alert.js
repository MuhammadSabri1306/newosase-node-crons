const { Database } = require("../helpers/newosase");
const { Telegraf } = require("telegraf");
const { botToken } = require("../config");
const buildMessage = require("../helpers/build-message");
const { toDatetimeString } = require("../helpers/date");

const app = new Telegraf(botToken);

const sendMessage = async (regionalId) => {
    const db = new Database();
    const sendedMsgIds = [];
    try {
        const resultDbChat = await db.runQuery({
            query: "SELECT * FROM telegram_alarm_user WHERE alert=1",
            autoClose: false
        });
        const chatIds = resultDbChat.results.map(item => item.chat_id);

        const queryDbMsg = "SELECT msg.id, msg.created_at, port.rtu_code, port.port, port.port_name, "
            + "port.value, port.unit, port.rtu_status, port.location, reg.name AS divre_name, "
            + "reg.divre_code, reg.sname FROM rtu_port_message AS msg "
            + "JOIN rtu_port_status AS port ON port.id=msg.status_id "
            + "JOIN regional AS reg ON reg.id=port.regional_id "
            + "WHERE sended=0 AND port.regional_id=?";

        const resultDbMsg = await db.runQuery({
            query: queryDbMsg,
            bind: [regionalId],
            autoClose: false
        });

        const dataMsg = resultDbMsg.results.map(item => {
            const id = item.id;
            const message = buildMessage({
                title: null,
                timestamp: toDatetimeString(new Date(item.created_at)),
                regional: item.divre_name,
                witel: null,
                location: item.location,
                nodeName: item.rtu_code,
                siteType: null,
                portName: item.port_name,
                port: item.port,
                value: item.value,
                status: item.rtu_status
            });

            return { id, message };
        });
        
        for(let i=0; i<dataMsg.length; i++) {

            const messageId = dataMsg[i].id;
            const message = dataMsg[i].message;
            for(let j=0; j<chatIds.length; j++) {

                const chatId = chatIds[j];
                await app.telegram.sendMessage(chatId, message);    
                
            }
            sendedMsgIds.push(messageId);

        }
        
    } catch(err) {
        console.error(err);
    }

    if(sendedMsgIds.length > 0) {
        try {
            await db.runQuery({
                query: "UPDATE rtu_port_message SET sended=1 WHERE id IN (?)",
                bind: [sendedMsgIds]
            });
        } catch(err) {
            console.error(err);
        }
    }
};

module.exports = sendMessage;