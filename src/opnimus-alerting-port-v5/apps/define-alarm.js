const { Logger } = require("./logger");
const axios = require("axios");
const { toDatetimeString } = require("../../helpers/date");

const newosaseBaseUrl = "https://newosase.telkom.co.id/api/v1";
const http = axios.create({
    baseURL: newosaseBaseUrl,
    headers: { "Accept": "application/json" }
});

module.exports.getNewosaseAlarms = async (witelId, app = {}) => {
    let { logger } = app;
    logger = Logger.getOrCreate(logger);

    logger.info("start to fetching newosase", { witelId });
    const params = { isAlert: 1, witelId };
    
    try {
        const response = await http.get("/dashboard-service/dashboard/rtu/port-sensors", { params });
        if(response.data && response.data.result && response.data.result.payload) {
            logger.info("Collecting newosase api response", { witelId });
            return response.data.result.payload;
        }

        logger.info("No data provided in newosase response", {
            baseUrl: `${ newosaseBaseUrl }/dashboard-service/dashboard/rtu/port-sensors`,
            params,
            responseData: response.data
        });

        return [];
    } catch(err) {
        const errData = {
            baseUrl: `${ newosaseBaseUrl }/dashboard-service/dashboard/rtu/port-sensors`,
            params
        };
        if(err.response && err.response.data)
            errData.responseData = err.response.data;

        logger.info("Error thrown when fetching newosase api", errData);
        logger.error(err);
        return [];
    }
};

module.exports.filterNewosaseAlarms = (newosaseAlarms) => {
    const result = [];
    const isValid = (alarm) => {
        if(!alarm.port_name || !alarm.no_port)
            return false;
        if(alarm.no_port === "many")
            return false;
        if(alarm.value === null)
            return false;
        if(alarm.no_port.indexOf("A-") === 0 && alarm.value === 0)
            return false;

        const duplicatedIndex = result.findIndex(item => item.id === alarm.id);
        if(duplicatedIndex >= 0)
            return false;

        return true;
    };

    for(let i=0; i<newosaseAlarms.length; i++) {
        if(isValid(newosaseAlarms[i]))
            result.push(newosaseAlarms[i]);
    }

    return result;
};

module.exports.isAlarmPortMatch = (prevAlarm, currAlarms) => {
    return currAlarms.id == prevAlarm.portId;
};

module.exports.defineAlarms = (prevAlarms, currAlarms) => {
    const closedAlarms = [];
    const changedAlarms = [];
    const newAlarms = [];

    for(let i=0; i<currAlarms.length; i++) {

        let hasMatches = false;
        for(let j=0; j<prevAlarms.length; j++) {

            let isMatch = this.isAlarmPortMatch(prevAlarms[j], currAlarms[i]);
            let isChanged = isMatch && currAlarms[i].severity.name.toString().toLowerCase() != prevAlarms[j].portSeverity;

            if(isChanged) {
                changedAlarms.push({
                    alarmId: prevAlarms[j].alarmId,
                    data: {
                        alarmType: currAlarms[i].result_type,
                        portId: currAlarms[i].id,
                        portNo: currAlarms[i].no_port,
                        portName: currAlarms[i].port_name,
                        portValue: currAlarms[i].value,
                        portUnit: currAlarms[i].units,
                        portSeverity: currAlarms[i].severity.name.toString().toLowerCase(),
                        portDescription: currAlarms[i].description,
                        portIdentifier: currAlarms[i].identifier,
                        portMetrics: currAlarms[i].metrics,
                        rtuId: currAlarms[i].rtu_id,
                        rtuSname: currAlarms[i].rtu_sname,
                        rtuStatus: currAlarms[i].rtu_status.toLowerCase(),
                        alertStartTime: currAlarms[i].alert_start_time
                    }
                });
            }

            if(isMatch && !hasMatches)
                hasMatches = true;

        }

        if(!hasMatches) {
            newAlarms.push({
                alarmType: currAlarms[i].result_type,
                portId: currAlarms[i].id,
                portNo: currAlarms[i].no_port,
                portName: currAlarms[i].port_name,
                portValue: currAlarms[i].value,
                portUnit: currAlarms[i].units,
                portSeverity: currAlarms[i].severity.name.toString().toLowerCase(),
                portDescription: currAlarms[i].description,
                portIdentifier: currAlarms[i].identifier,
                portMetrics: currAlarms[i].metrics,
                rtuId: currAlarms[i].rtu_id,
                rtuSname: currAlarms[i].rtu_sname,
                rtuStatus: currAlarms[i].rtu_status.toLowerCase(),
                alertStartTime: currAlarms[i].alert_start_time
            });
        }

    }

    for(let x=0; x<prevAlarms.length; x++) {
        
        let hasMatches = false;
        for(let y=0; y<currAlarms.length; y++) {
            if(this.isAlarmPortMatch(prevAlarms[x], currAlarms[y])){
                hasMatches = true;
                y = currAlarms.length
            }
        }

        if(!hasMatches) {
            closedAlarms.push({
                alarmId: prevAlarms[x].alarmId
            });
        }

    }

    return { closedAlarms, changedAlarms, newAlarms };
};