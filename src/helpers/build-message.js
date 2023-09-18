const { extractDate } = require("./date");
const { toFixedNumber } = require("./number-format");
const TelMessage = require("./tel-message");

const getAlertTitle = params => {
    if(params.port_name == "Status PLN")
        return `⚡️ PLN OFF: ${ params.location_name } (${ params.rtu_code })⚡️`;
    if(params.port_name == "Status DEG")
        return `🔆 GENSET ON: ${ params.location_name } (${ params.rtu_code })🔆`;

    const portStatus = params.port_status.toUpperCase();
    if(portStatus == "OFF")
        return `‼️ ${ params.port_name } ${ portStatus }: ${ params.location_name } (${ params.rtu_code })‼️`;
    if(portStatus == "CRITICAL")
        return `❗️ ${ params.port_name } ${ portStatus }: ${ params.location_name } (${ params.rtu_code })❗️`;
    if(portStatus == "WARNING")
        return `⚠️ ${ params.port_name } ${ portStatus }: ${ params.location_name } (${ params.rtu_code })⚠️`;
    if(portStatus == "SENSOR BROKEN")
        return `❌ ${ params.port_name } ${ portStatus }: ${ params.location_name } (${ params.rtu_code })❌`;
    
    return "⚡️ OPNIMUS ALERT ⚡️";
};

const getAlertDescr = params => {
    if(params.port_name == "Status PLN")
        return "Terpantau " + TelMessage.toBoldText("PLN OFF") + " dengan detail sebagai berikut:";
    if(params.port_name == "Status DEG")
        return "Terpantau " + TelMessage.toBoldText("GENSET ON") + " dengan detail sebagai berikut:";

    const portStatus = params.port_status.toUpperCase();
    const alertText = TelMessage.toBoldText(params.port_name + " " + portStatus);
    return "Terpantau " + alertText + " dengan detail sebagai berikut:";
};

const getRegionalIcon = divreCode => {
    if(divreCode == "TLK-r1000000")
        return "1️⃣";
    if(divreCode == "TLK-r2000000")
        return "2️⃣";
    if(divreCode == "TLK-r3000000")
        return "3️⃣";
    if(divreCode == "TLK-r4000000")
        return "4️⃣";
    if(divreCode == "TLK-r5000000")
        return "5️⃣";
    if(divreCode == "TLK-r6000000")
        return "6️⃣";
    if(divreCode == "TLK-r7000000")
        return "7️⃣";
    return " ";
};

const getPicText = picList => {
    const picListText = picList.map(pic => {
        if(pic.first_name && pic.last_name) {
            return TelMessage.tag({
                userId: pic.user_id,
                text: `${ pic.first_name } ${ pic.last_name }`,
            });
        }

        if(pic.username) {
            return TelMessage.tag({ username: pic.username });
        }

        return TelMessage.tag({
            userId: pic.user_id,
            text: "Telegram User",
        });
    });

    return TelMessage.toBoldText("PIC Lokasi ini adalah: ") + picListText.join(" ");
};

module.exports = (data) => {

    const title = getAlertTitle(data);
    const descr = getAlertDescr(data);
    const datetime = extractDate(new Date(data.created_at));
    const datetimeStr = `${ datetime.day }-${ datetime.month }-${ datetime.year } ${ datetime.hours }:${ datetime.minutes } WIB`;
    const tregIcon = getRegionalIcon(data.divre_code);
    let valueText = "-";
    if(data.port_value !== null && data.port_value !== undefined)
        valueText = toFixedNumber(data.port_value);

    const mainMsg = new TelMessage(title);
    mainMsg.addLine("Pada " + datetimeStr);
    mainMsg.addLine();
    mainMsg.addLine(descr);

    const detailMsg = new TelMessage();
    detailMsg.addLine(tregIcon + " Regional  : " + data.divre_name);
    detailMsg.addLine("🏢 Witel     : " + data.witel_name);
    detailMsg.addLine("🏬 Lokasi    : " + data.location_name);
    detailMsg.addLine("🎛 RTU Name  : " + data.rtu_code);
    detailMsg.addLine("🏪 Node Name : " + data.rtu_name);
    detailMsg.addLine();
    detailMsg.addLine("Port Alarm Detail:");
    detailMsg.addLine("⚠️ Nama Port : " + data.port_name);
    detailMsg.addLine("🔌 Port      : " + data.port);
    detailMsg.addLine("✴️ Value     : " + valueText);
    detailMsg.addLine("🌋 Status    : " + data.port_status);
    detailMsg.addLine("📅 Waktu     : " + datetimeStr);
    mainMsg.addLine(detailMsg.toCodeFormat());

    if(Array.isArray(data.pic) && data.pic.length > 0) {
        const picText = getPicText(data.pic);
        mainMsg.addLine(picText);
        mainMsg.addLine();
    }
    
    mainMsg.addLine("❕Mohon untuk segera melakukan Pengecekan port Lokasi Terimakasih.");
    // mainMsg.addLine("Anda dapat mengetikan /alarm untuk mengecek alarm saat ini.");
    mainMsg.addLine("#OPNIMUS #PORTALARM");
    
    return mainMsg.getMessage();
};