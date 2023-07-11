const toCodeFormat = text => "```" + text + "```";

const newLine = text => "\n" + text;

const buildMessage = params => {
    const data = {
        title: params.title || "OPNIMUS ALERT",
        description: params.description || "",
        timestamp: params.timestamp || "-",
        regional: params.regional || "-",
        witel: params.witel || "-",
        location: params.location || "-",
        rtuCode: params.rtuCode || "-",
        nodeName: params.nodeName || "-",
        siteType: params.siteType || "-",
        portName: params.portName || "-",
        port: params.port || "-",
        value: params.value || "-",
        status: params.status || "-",
        pic: Array.isArray(params.pic) ? params.pic
            : typeof params.pic == "string" ? [params.pic]
            : []
    };

    let message = `⚡️ ${ data.title }⚡️`;
    message += newLine("Pada " + data.timestamp);
    message += newLine("");

    let detail = "";
    detail += newLine("7️⃣ Regional  : " + data.regional);
    detail += newLine("🏢 Witel     : " + data.witel);
    detail += newLine("🏬 Lokasi    : " + data.location);
    detail += newLine("🎛 RTU Name : " + data.rtuCode);
    detail += newLine("🏪 Node Name : " + data.nodeName);
    // detail += newLine("🔑 Tipe Site : " + data.siteType);
    detail += newLine("");
    detail += newLine("Port Alarm Detail:");
    detail += newLine("⚠️ Nama Port : " + data.portName);
    detail += newLine("🔌 Port      : " + data.port);
    detail += newLine("✴️ Value     : " + data.value);
    detail += newLine("🌋 Status    : " + data.status);
    detail += newLine("📅 Waktu     : " + data.timestamp);
    message += newLine(toCodeFormat(detail));

    message += newLine("");
    message += newLine("❕Mohon untuk segera melakukan Pengecekan port Lokasi Terimakasih.");
    message += newLine("Anda dapat mengetikan /alarm untuk mengecek alarm saat ini.");
    message += newLine("#OPNIMUS #PORTALARM #TR7");

    return message;

};

// `⚡️ PLN OFF: MALINO (RTU-MAL)⚡️ 
// Pada 2023-06-18 03:06:00 WIB 

// Terpantau PLN OFF dengan detail sebagai berikut:
// 7️⃣Regional  : DIVISI TELKOM REGIONAL VII
// 🏢Witel     : WITEL SULSEL 
// 🏬Lokasi    : MALINO (KANDATEL GOWA)
// 🎛Node Name : RTU-MAL (RTU STO MALINO)
// 🔑Tipe Site : STO

// Port Alarm Detail:
// ⚠️Nama Port : STATUS PLN MALINO
// 🔌Port      : D-01 Status PLN
// ✴️Value     : 1.00 ON/OFF 
// 🌋Status    : OFF (0d 0h 4m 0s)
// 📅Waktu     : 2023-06-18 03:06:00 WIB 

// PIC Lokasi ini adalah:  Hajir Paewai  Arif Firmansyah  Muh Rusli bastian bachtiar Bambang Supriadi Fanur  GuardTR7  Rusman Man Aswar Salam Acho MKS yoyon 

// ❕Mohon untuk segera melakukan Pengecekan port Lokasi Terimakasih.
// Anda dapat mengetikan /alarm untuk mengecek alarm saat ini.

// #OPNIMUS #PORTALARM #TR7`

module.exports = buildMessage;