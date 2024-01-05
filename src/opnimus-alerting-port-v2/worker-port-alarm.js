const { parentPort, workerData } = require("worker_threads");
const logger = require("./logger");
const { useHttp } = require("./http");
const { logErrorWithFilter } = require("./log-error");

const { witel, jobQueueNumber } = workerData;

const newosaseBaseUrl = "https://newosase.telkom.co.id/api/v1";
const http = useHttp(newosaseBaseUrl);

const fetchPortSensorTest = async (witelId) => {
    logger.info(`Create newosase api request, witelId:${ witelId }`);
    if(witelId == 43) {
        
        const sampleApiData = require("./sample-data/newosase-port-alert.json");
        return sampleApiData.result.payload;

    }
    return [];
};

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

        logErrorWithFilter(`Error in ${ newosaseBaseUrl }/getrtuport, witelId:${ witelId }`, err);
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
    if(dbItem.rtu_sname != apiItem.rtu_sname)
        return false;
    if(dbItem.port_no != apiItem.no_port)
        return false;
    if(dbItem.port_unit != apiItem.units)
        return false;
    return true;
};

const createPortCategory = (apiData, dbData) => {
    const openAlarm = [];
    const closeAlarm = [];
    let hasMatches = false;
    let isMatch; let isNormal; let isChanged;

    for(let i=0; i<apiData.length; i++) {
        
        hasMatches = false;
        for(let j=0; j<dbData.length; j++) {
            
            isMatch = isPortMatch(apiData[i], dbData[j]);
            isChanged = isMatch && apiData[i].severity.name.toString().toLowerCase() != dbData[j].port_severity;
            isNormal = isChanged && apiData[i].severity.name.toString().toLowerCase() == "normal";

            if(isChanged) {
                closeAlarm.push(dbData[j]);
                if(!isNormal)
                    openAlarm.push(apiData[i]);
            }

            if(isMatch && !hasMatches)
                hasMatches = true;

        }

        if(!hasMatches)
            openAlarm.push(apiData[i]);
    }

    for(let x=0; x<dbData.length; x++) {
        
        hasMatches = false;
        for(let y=0; y<openAlarm.length; y++) {
            if( isPortMatch(openAlarm[y], dbData[x]) ) {
                hasMatches = true;
                y = openAlarm.length;
            }
        }

        if(!hasMatches)
            closeAlarm.push(dbData[x]);

    }

    return { openAlarm, closeAlarm };
};

const definePortAlarm = async ({ witelId, portList }) => {
    logger.info(`Starting opnimus port alarm thread, queue: ${ jobQueueNumber }`);
    
    const portStatusNew = await fetchPortSensor(witelId);
    const { openAlarm, closeAlarm } = createPortCategory(filterApiPortExclude(portStatusNew), portList);

    parentPort.postMessage({ witelId, openAlarm, closeAlarm });
    process.exit();
};

definePortAlarm(witel);