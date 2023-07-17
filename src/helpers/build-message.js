const { extractDate } = require("./date");
const { toFixedNumber } = require("./number-format");

class TelMessage
{
    constructor(text = null) {
        this.lines = [];
        if(text)
            this.lines.push(text);
    }

    addLine(text = "") {
        this.lines.push(text);
    }

    getMessage() {
        return this.lines.join("\n");
    }

    toCodeFormat() {
        const text = this.getMessage();
        return "```" + text + "```";
    }
}

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
        return "Terpantau PLN OFF dengan detail sebagai berikut:";
    if(params.port_name == "Status DEG")
        return "Terpantau GENSET ON dengan detail sebagai berikut:";

    const portStatus = params.port_status.toUpperCase();
    return `Terpantau ${ params.port_name } ${ portStatus } dengan detail sebagai berikut:`;
};

module.exports = (data) => {

    const title = getAlertTitle(data);
    const descr = getAlertDescr(data);
    const datetime = extractDate(new Date(item.created_at));
    const datetimeStr = `${ datetime.day }-${ datetime.month }-${ datetime.year } ${ datetime.hours }:${ datetime.minutes } WIB`;
    const valueText = data.port_value ? `${ toFixedNumber(data.port_value) } ${ data.port_unit }` : "-";

    const mainMsg = new TelMessage(title);
    mainMsg.addLine("Pada " + datetimeStr);
    mainMsg.addLine();
    mainMsg.addLine(descr);

    const detailMsg = new TelMessage();
    detailMsg.addLine("7️⃣ Regional : " + data.divre_name);
    detailMsg.addLine("🏢 Witel : " + data.witel_name);
    detailMsg.addLine("🏬 Lokasi : " + data.location_name);
    detailMsg.addLine("🎛 RTU Name : " + data.rtu_code);
    detailMsg.addLine("🏪 Node Name : " + data.rtu_name);
    detailMsg.addLine();
    detailMsg.addLine("Port Alarm Detail:");
    detailMsg.addLine("⚠️ Nama Port : " + data.port_name);
    detailMsg.addLine("🔌 Port : " + data.port);
    detailMsg.addLine("✴️ Value : " + valueText);
    detailMsg.addLine("🌋 Status : " + data.port_status);
    detailMsg.addLine("📅 Waktu : " + datetimeStr);
    mainMsg.addLine(detailMsg.toCodeFormat());
    
    detailMsg.addLine();
    mainMsg.addLine("❕Mohon untuk segera melakukan Pengecekan port Lokasi Terimakasih.");
    mainMsg.addLine("Anda dapat mengetikan /alarm untuk mengecek alarm saat ini.");
    mainMsg.addLine("#OPNIMUS #PORTALARM");
    
    return mainMsg.getMessage();
};