const { useHttp } = require("../../core/http");

const http = useHttp("https://opnimus.telkom.co.id/api/osasenewapi");
const osaseToken = "xg7DT34vE7";

const createDelay = time => {
    return new Promise(resolve => {
        setTimeout(() => resolve(), time);
    });
};

module.exports.getKwhData = async (rtuItem) => {
    try {
        const params = {
            token: osaseToken,
            flag: 0,
            rtuid: rtuItem.rtu_kode,
            port: rtuItem.port_kwh
        };
        const response = await http.get("/getrtuport", { params });
        if(Array.isArray(response.data) && response.data.length > 0) {
            const kwhItem = response.data[0];
            return { success: true, data: kwhItem };
        }
        console.warn(response.data);
        return { success: false, data: null };
    } catch(err) {
        console.error(err);
        return { success: false, data: null };
    }
};

module.exports.getKwhList = async (rtuList) => {

    const kwhList = []; const failedRtus = [];
    let i = 0; let response; let retryCount = 1;
    // console.log(rtuList)

    while(i < rtuList.length) {
        try {
            
            const params = { token: osaseToken, flag: 0, rtuid: rtuList[i].rtu_kode, port: rtuList[i].port_kwh };
            response = await http.get("/getrtuport", { params });
            if(Array.isArray(response.data) && response.data.length > 0) {
                const kwhItem = response.data[0];
                kwhList.push(kwhItem);
                i++;
            } else if(retryCount <= 3) {
                console.log(`No data provided in /getrtuport, rtu:${ rtuList[i].rtu_kode } port:${ rtuList[i].port_kwh }`);
                console.log(`retryCount:${ retryCount } retryDelay:${ retryCount * 5000 }`);
                await createDelay(retryCount * 5000);
                retryCount++;
            } else {
                failedRtus.push(rtuList[i]);
                i++;
                retryCount = 1;
            }

        } catch(err) {
            console.error(err);
            if(retryCount <= 3) {
                console.log(`Error in /getrtuport, rtu:${ rtuList[i].rtu_kode } port:${ rtuList[i].port_kwh }`);
                console.error(err);
                console.log(`retryCount:${ retryCount } retryDelay:${ retryCount * 5000 }`);
                await createDelay(retryCount * 5000);
                retryCount++;
            } else {
                failedRtus.push(rtuList[i]);
                i++;
                retryCount = 1;
            }
        }

        console.log(`kwhList.length:${ kwhList.length } failedRtus.length:${ failedRtus.length }`);
    }

    return { kwhList, failedRtus };

};