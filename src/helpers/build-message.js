const buildMessage = params => {
    const data = {
        title: params.title || "OPNIMUS ALERT",
        timestamp: params.timestamp || "-",
        regional: params.regional || "-",
        witel: params.witel || "-",
        location: params.location || "-",
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

    return `⚡️ ${ data.title }⚡️ 
Pada ${ data.timestamp }

Terpantau PLN OFF dengan detail sebagai berikut:
7️⃣ Regional  : ${ data.regional }
🏢 Witel     : ${ data.witel }
🏬 Lokasi    : ${ data.location }
🎛 Node Name : ${ data.nodeName }
🔑 Tipe Site : ${ data.siteType }

Port Alarm Detail:
⚠️ Nama Port : ${ data.portName }
🔌 Port      : ${ data.port }
✴️ Value     : ${ data.value }
🌋 Status    : ${ data.status }
📅 Waktu     : ${ data.timestamp } 

PIC Lokasi ini adalah:  ${ data.pic.join(" ") }

❕Mohon untuk segera melakukan Pengecekan port Lokasi Terimakasih.
Anda dapat mengetikan /alarm untuk mengecek alarm saat ini.

#OPNIMUS #PORTALARM #TR7`;

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