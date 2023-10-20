const { parentPort, workerData } = require("worker_threads");
const { logger } = require("./index");
const { useHttp } = require("./http");

const { witel, jobQueueNumber } = workerData;

const newosaseBaseUrl = "https://newosase.telkom.co.id/api/v1";
const http = useHttp(newosaseBaseUrl);

const fetchPortSensor = async (witelId) => {
    logger.info(`Create newosase api request, witelId:${ witelId }`);
    try {

        const params = { isAlert: 1, witelId };
        const response = await http.get("/dashboard-service/dashboard/rtu/port-sensors", { params });
        if(response.data && response.data.result && response.data.result.payload) {
            logger.info(`Collecting newosase api response, witelId:${ witelId }`);
            return response.data.result.payload;
        }

        logger.warn(`No data provided in ${ newosaseBaseUrl }/getrtuport, witelId:${ witelId }`, response.data);
        return [];

    } catch(err) {

        logger.error(`Error in ${ newosaseBaseUrl }/getrtuport, witelId:${ witelId }`, err);
        return [];

    }
};

const filterApiPortExclude = portList => {
    const result = [];
    const c = {};
    for(let i=0; i<portList.length; i++) {

        c.hasName = portList[i].port_name ? true : false;
        c.hasValidCode = portList[i].no_port && portList[i].no_port !== "many" ? true : false;
        c.notDuplicated = result.findIndex(item => item.rtu_sname == portList[i].rtu_sname) < 0;

        if(c.hasName && c.hasValidCode && c.notDuplicated)
            result.push(portList[i]);
    }
    return result;
};

const isPortMatch = (apiItem, dbItem) => {
    if(dbItem.rtu_code != apiItem.rtu_sname)
        return false;
    if(dbItem.port != apiItem.no_port)
        return false;
    if(dbItem.unit != apiItem.units)
        return false;
    return true;
};

const createPortCategory = (apiData, dbData) => {
    const newPorts = [];
    const openedAlarm = [];
    const closedAlarm = [];

    dbData.forEach(item => {
        const currItem = apiData.find(apiItem => isPortMatch(apiItem, item));
        if(!currItem && item.state == 1) {
            closedAlarm.push(item);
        } else if(currItem && item.state != 1) {
            openedAlarm.push({
                newRow: currItem,
                oldRow: item
            });
        }
    });

    apiData.forEach(item => {
        const dataDbIndex = dbData.findIndex(dbItem => isPortMatch(item, dbItem));
        if(dataDbIndex < 0)
            newPorts.push(item);
    });

    return { newPorts, openedAlarm, closedAlarm };
};

const definePortAlarm = async ({ witelId, portList }) => {
    logger.info(`Starting opnimus port alarm thread, queue: ${ jobQueueNumber }`);
    
    const portStatusNew = await fetchPortSensor(witelId);
    const { newPorts, openedAlarm, closedAlarm } = createPortCategory(filterApiPortExclude(portStatusNew), portList);

    // logger.debug(portList.length, filterApiPortExclude(portStatusNew).length);
    parentPort.postMessage({ witelId, newPorts, openedAlarm, closedAlarm });
    process.exit();
    // console.log(witelId, portList);
};

definePortAlarm(witel);