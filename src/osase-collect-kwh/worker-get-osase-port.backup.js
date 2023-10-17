const { parentPort, workerData } = require("worker_threads");
const { useHttp } = require("./http");
const { logger } = require("./index");

const osaseBaseUrl = "https://opnimus.telkom.co.id/api/osasenewapi";
const osaseToken = "xg7DT34vE7";
const { rtuItem } = workerData;

const http = useHttp(osaseBaseUrl);

const createDelay = multiplier => {
    return new Promise(resolve => {
        setTimeout(() => resolve(), multiplier * 5000);
    });
};

const fetch = async (rtuItem) => {
    const workerResult = { success: false, data: { rtuItem } };
    const params = {
        token: osaseToken,
        flag: 0,
        rtuid: rtuItem.rtu_kode,
        port: rtuItem.port_kwh
    };

    let retryCount = 0;
    let response;
    logger.info(`Create osase api request, rtu:${ rtuItem.rtu_kode } port:${ rtuItem.port_kwh }`);
    while(retryCount < 2) {
        try {

            response = await http.get("/getrtuport", { params });
            if(Array.isArray(response.data) && response.data.length > 0) {

                workerResult.success = true;
                workerResult.data.kwhItem = response.data[0];
                logger.info(`Collecting osase api response, rtu:${ rtuItem.rtu_kode } port:${ rtuItem.port_kwh }`);
                retryCount = 2;

            } else {

                logger.warn(`No data provided in ${ osaseBaseUrl }/getrtuport`);
                logger.warn(`rtu:${ rtuItem.rtu_kode } port:${ rtuItem.port_kwh }`);
                logger.debug(response.data);

                if(retryCount < 2) {
                    await createDelay(1);
                    retryCount++;
                    logger.info(`Re-create osase api request, rtu:${ rtuItem.rtu_kode } port:${ rtuItem.port_kwh }`);
                }

            }

        } catch(err) {
            logger.error(`Error in ${ osaseBaseUrl }/getrtuport`);
            logger.error(`rtu:${ rtuItem.rtu_kode } port:${ rtuItem.port_kwh }`);
            logger.error(err);

            if(retryCount < 2) {
                await createDelay(1);
                retryCount++;
                logger.info(`Re-create osase api request, rtu:${ rtuItem.rtu_kode } port:${ rtuItem.port_kwh }`);
            }
        }
    }

    parentPort.postMessage(workerResult);
    process.exit();
};

fetch(rtuItem);