const { parentPort, workerData } = require("worker_threads");
const { useHttp } = require("./http");
const logger = require("./logger");

const osaseBaseUrl = "https://opnimus.telkom.co.id/api/osasenewapi";
const osaseToken = "xg7DT34vE7";
const { rtuList } = workerData;

const http = useHttp(osaseBaseUrl);

const createDelay = multiplier => {
    return new Promise(resolve => {
        setTimeout(() => resolve(), multiplier * 5000);
    });
};

const fetchOsaseKwhPort = async (rtuItem) => {

    const params = {
        token: osaseToken,
        flag: 0,
        rtuid: rtuItem.rtu_kode,
        port: rtuItem.port_kwh
    };

    let retryCount = 0;
    let response;
    const result = { success: false, kwh: null };
    
    logger.info(`Create osase api request, rtu:${ rtuItem.rtu_kode } port:${ rtuItem.port_kwh }`);
    while(retryCount < 2) {
        try {

            response = await http.get("/getrtuport", { params });
            if(Array.isArray(response.data) && response.data.length > 0) {

                result.success = true;
                result.kwh = response.data[0];
                logger.info(`Collecting osase api response, rtu:${ rtuItem.rtu_kode } port:${ rtuItem.port_kwh }`);
                retryCount = 2;

            } else {

                logger.warn(`No data provided in ${ osaseBaseUrl }/getrtuport`);
                logger.warn(`rtu:${ rtuItem.rtu_kode } port:${ rtuItem.port_kwh }`);
                logger.trace(response.data);

                if(retryCount < 2) {
                    await createDelay(1);
                    logger.info(`Re-create osase api request, rtu:${ rtuItem.rtu_kode } port:${ rtuItem.port_kwh }`);
                }
                
                retryCount++;
                
            }

        } catch(err) {
            logger.error(`Error in ${ osaseBaseUrl }/getrtuport`);
            logger.error(`rtu:${ rtuItem.rtu_kode } port:${ rtuItem.port_kwh }`);
            logger.error(err);

            if(retryCount < 2) {
                await createDelay(1);
                logger.info(`Re-create osase api request, rtu:${ rtuItem.rtu_kode } port:${ rtuItem.port_kwh }`);
            }
            retryCount++;
        }
    }

    return result;

};

const getOsaseKwhPorts = async (rtuList) => {
    
    const results = [];
    const errList = [];
    let response;
    let retryCount = 0;
    let i = 0;

    while(i < rtuList.length) {
        try {

            response = await fetchOsaseKwhPort(rtuList[i]);
            results.push({
                rtuItem: rtuList[i],
                kwhItem: response.kwh
            });

        } catch(err) {
            // logger.error("Failed ");
        } finally {
            i++;
        }
    }

    parentPort.postMessage(results);
    process.exit();

};

getOsaseKwhPorts(rtuList);