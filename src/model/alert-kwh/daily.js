const dbConfig = require("../../env/database");
const mysql = require("mysql");
const { toDatetimeString } = require("../../helpers/date");

const conn = mysql.createConnection(dbConfig.densus);

const filterRecipients = (witelCode, telgUsers) => {
    const matches = [];
    const excluded = [];
    for(let i=0; i<telgUsers.length; i++) {
        if(telgUsers[i].witel_code == witelCode)
            matches.push(telgUsers[i]);
        else
            excluded.push(telgUsers[i]);
    }
    return { matches, excluded };
};

const formatRecipients = recipients => {
    return recipients.map(rcp => {
        try {
            rcp.telegram_data = JSON.parse(rcp.telegram_data);
            return rcp;
        } catch(err) {
            return rcp;
        }
    });
};

const getDbData = filterLowDateStr => {
    return new Promise(resolve => {
        conn.connect();
        let query = "SELECT divre_kode AS divre_code, divre_name, witel_kode AS witel_code, witel_name"+
            ", sto_kode AS sto_code, sto_name FROM master_sto_densus ORDER BY divre_code, witel_code, sto_name";
        
        conn.query(query, (err, stoList) => {
            if(err) throw err;

            query = "SELECT user.telegram_data, user.level, user.witel_id, witel.code AS witel_code"+
                " FROM telg_user_alert_kwh as alert"+
                " JOIN telg_user AS user ON user.id=alert.telg_user_id"+
                " JOIN witel ON witel.id=user.witel_id"+
                " WHERE alert.send_alert IS TRUE";

            conn.changeUser({ database: dbConfig.densusBot.database });
            conn.query(query, (err, telgUsers) => {
                if(err) throw err;

                query = "SELECT kwh.kwh_value, kwh.timestamp, rtu.witel AS witel_code, rtu.master_sto_kode AS sto_code"+
                    " FROM kwh_counter AS kwh JOIN rtu ON rtu.rtu_kode=kwh.rtu_kode WHERE timestamp>?";
                
                conn.changeUser({ database: dbConfig.osasemobile.database });
                conn.query(query, filterLowDateStr, (err, kwhData) => {
                    if(err) throw err;
                    resolve({ stoList, telgUsers, kwhData });
                });
            });
        });
    });
};

const toKwhBill = (kwhValue, date) => {
    const wbpStartDate = new Date(date);
    wbpStartDate.setHours(17, 0, 0, 0);

    const wbpEndDate = new Date(date);
    wbpEndDate.setHours(22, 0, 0, 0);
    
    const isWbp = date >= wbpStartDate && date <= wbpEndDate;

    // WBP Bill
    if(isWbp)
        return kwhValue * 1608.67;
    // LWBP Bill
    return kwhValue * 1090.78;
};

module.exports.connection = conn;
module.exports.get = async () => {
    try {

        const currDate = new Date();
        const currDateStr = toDatetimeString(currDate);
        const kwhPrice = 1250;

        const prevDate = new Date(currDate.getTime());
        prevDate.setDate(prevDate.getDate() - 1);
        
        const filterLowDate = new Date(prevDate.getTime());
        filterLowDate.setDate(filterLowDate.getDate() - 1);
        const filterLowDateStr = toDatetimeString(filterLowDate);
        let { stoList, telgUsers, kwhData } = await getDbData(filterLowDateStr);

        const result = [];
        stoList.forEach(sto => {

            let index = result.findIndex(witel => witel.witel_code == sto.witel_code);
            if(index < 0) {

                const recipients = filterRecipients(sto.witel_code, telgUsers);
                if(recipients.matches.length < 1)
                    return;

                if(recipients.excluded.length != telgUsers.length)
                    telgUsers = recipients.excluded;

                result.push({
                    divre_code: sto.divre_code,
                    divre_name: sto.divre_name,
                    witel_code: sto.witel_code,
                    witel_name: sto.witel_name,
                    sto_count: 0,
                    exists_sto_count: 0,
                    sto: [],
                    timestamp: currDateStr,
                    recipients: formatRecipients(recipients.matches),
                    kwh_curr_day: null,
                    kwh_prev_day: null,
                    kwh_bill_curr_day: null,
                    kwh_bill_prev_day: null,
                    kwh_percent_daily: null
                });
                index = result.length - 1;

            }

            const stoItem = {
                ...sto,
                is_kwh_exists: false,
                kwh_curr_day: null,
                kwh_prev_day: null,
                kwh_bill_curr_day: null,
                kwh_bill_prev_day: null,
                kwh_percent_daily: null
            };

            kwhData.forEach(kwh => {
                if(kwh.sto_code != sto.sto_code)
                    return null;

                const kwhDate = new Date(kwh.timestamp);
                const kwhBill = toKwhBill(kwh.kwh_value, kwhDate);
                const isKwhCurrDay = kwhDate.getTime() <= prevDate.getTime();
                
                if(isKwhCurrDay) {

                    if(stoItem.kwh_curr_day === null)
                        stoItem.kwh_curr_day = 0;
                    if(stoItem.kwh_bill_curr_day === null)
                        stoItem.kwh_bill_curr_day = 0;
                    if(result[index].kwh_curr_day === null)
                        result[index].kwh_curr_day = 0;
                    if(result[index].kwh_bill_curr_day === null)
                        result[index].kwh_bill_curr_day = 0;

                    stoItem.is_kwh_exists = true;
                    stoItem.kwh_curr_day += kwh.kwh_value;
                    stoItem.kwh_bill_curr_day += kwhBill;

                    result[index].kwh_curr_day += kwh.kwh_value;
                    result[index].kwh_bill_curr_day += kwhBill;

                } else {

                    if(stoItem.kwh_prev_day === null)
                        stoItem.kwh_prev_day = 0;
                    if(stoItem.kwh_bill_prev_day === null)
                        stoItem.kwh_bill_prev_day = 0;
                    if(result[index].kwh_prev_day === null)
                        result[index].kwh_prev_day = 0;
                    if(result[index].kwh_bill_prev_day === null)
                        result[index].kwh_bill_prev_day = 0;

                    stoItem.kwh_prev_day += kwh.kwh_value;
                    stoItem.kwh_bill_prev_day += kwhBill;

                    result[index].kwh_prev_day += kwh.kwh_value;
                    result[index].kwh_bill_prev_day += kwhBill;

                }

            });

            if(stoItem.kwh_curr_day !== null && stoItem.kwh_prev_day !== null) {
                stoItem.kwh_percent_daily = (stoItem.kwh_curr_day - stoItem.kwh_prev_day) / stoItem.kwh_curr_day * 100;
            }

            result[index].sto_count++;
            if(!stoItem.is_kwh_exists)
                return;

            result[index].sto.push(stoItem);
            result[index].exists_sto_count++;
            if(result[index].exists_sto_count > 0) {
                result[index].kwh_percent_daily = (result[index].kwh_curr_day - result[index].kwh_prev_day) / result[index].kwh_curr_day * 100
            }

        });

        return result;

    } catch(err) {
        console.error(err);
    }
};