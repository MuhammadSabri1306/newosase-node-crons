const dbConfig = require("../../env/database");
const { useOsasemobilePool } = require("../../pool/osasemobile");
const { toDatetimeString } = require("../../helpers/date");

const sampleRtuList = require("./sample-data/rtu-map.json");

module.exports.getRtuList = async () => {
    try {

        return sampleRtuList;

    } catch(err) {
        console.error(err);
        return [];
    }
};

module.exports.pushKwh = kwh => {
    return new Promise(resolve => {
        useOsasemobilePool((err, conn) => {
            if(err) {
                resolve({ success: false, result: null, error: err });
                return;
            }

            const query = "INSERT INTO kwh_counter_bck (rtu_kode, kwh_value, no_port, nama_port, tipe_port, satuan, timestamp)"+
                " VALUES (?, ?, ?, ?, ?, ?, ?)";
            const dataBind = [kwh.RTU_ID, kwh.VALUE, kwh.PORT, kwh.NAMA_PORT, kwh.TIPE_PORT, kwh.SATUAN, toDatetimeString(new Date())];
            
            conn.query(query, dataBind, (err, result) => {
                conn.release();
                if(err) {
                    resolve({ success: false, result: null, error: err });
                    return;
                }
                resolve({ success: true, result, error: null });
            });
        });
    });
};

module.exports.pushKwhList = kwhList => {
    const queryValuesArr = [];
    const dataBind = [];
    const currDateStr = toDatetimeString(new Date());

    for(let i=0; i<kwhList.length; i++) {
        queryValuesArr.push("(?, ?, ?, ?, ?, ?, ?)");
        dataBind.push(kwhList[i].RTU_ID, kwhList[i].VALUE, kwhList[i].PORT, kwhList[i].NAMA_PORT, kwhList[i].TIPE_PORT, kwhList[i].SATUAN, currDateStr);
    }

    const queryValues = queryValuesArr.join(", ");
    const query = "INSERT INTO kwh_counter_bck (rtu_kode, kwh_value, no_port, nama_port, tipe_port, satuan, timestamp)"+
        " VALUES "+queryValues;

    return new Promise(resolve => {
        useOsasemobilePool((err, conn) => {
            if(err) {
                resolve({ success: false, result: null, error: err });
                return;
            }
            
            conn.query(query, dataBind, (err, result) => {
                conn.release();
                if(err) {
                    resolve({ success: false, result: null, error: err });
                    return;
                }
                resolve({ success: true, result, error: null });
            });
        });
    });
};