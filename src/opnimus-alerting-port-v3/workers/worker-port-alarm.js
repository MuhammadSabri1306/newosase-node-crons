const { parentPort, workerData } = require("worker_threads");
const axios = require("axios");
const App = require("../App");
const { toDatetimeString } = require("../../helpers/date");

const { appId, witels, groupUsers, picUsers, oldAlarms, jobQueueNumber } = workerData;
const app = new App(appId);

const newosaseBaseUrl = "https://newosase.telkom.co.id/api/v1";
const http = axios.create({
    baseURL: newosaseBaseUrl,
    headers: { "Accept": "application/json" }
});

const fetchPortSensor = async (witelId) => {
    app.logProcess(`Create newosase api request, witelId:${ witelId }`);
    try {

        const params = { isAlert: 1, witelId };
        const response = await http.get("/dashboard-service/dashboard/rtu/port-sensors", { params });
        if(response.data && response.data.result && response.data.result.payload) {
            app.logProcess(`Collecting newosase api response, witelId:${ witelId }`);
            return response.data.result.payload;
        }

        console.warn(`No data provided in ${ newosaseBaseUrl }/getrtuport, witelId:${ witelId }`, response.data);
        return [];

    } catch(err) {

        console.error(`Error in ${ newosaseBaseUrl }/getrtuport, witelId:${ witelId }`, err);
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
    return { openAlarm, closeAlarm };

    try {
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
            for(let y=0; y<apiData.length; y++) {
                if( isPortMatch(apiData[y], dbData[x]) ) {
                    hasMatches = true;
                    y = apiData.length;
                }
            }
    
            if(!hasMatches)
                closeAlarm.push(dbData[x]);
    
        }

    } catch(err) {
        console.error(err);
    } finally {
        return { openAlarm, closeAlarm };
    }
};

const getAlarmsOfWitel = (witel, alarms) => {
    const result = [];
    for(let i=0; i<alarms.length; i++) {
        if(alarms[i].witel_id == witel.id)
            result.push(alarms[i]);
    }
    return result;
};

const getUsersOfWitel = (witel, groups, pics) => {
    const picUsers = [];
    for(let i=0; i<pics.length; i++) {
        if(pics[i].location_witel_id == witel.id)
            picUsers.push(pics);
    }

    const groupUsers = [];
    for(let i=0; i<groups.length; i++) {
        if(groups[i].level == "nasional")
            groupUsers.push(groups);
        else if(groups[i].level == "regional" && groups[i].regional_id == witel.regional_id)
            groupUsers.push(groups);
        else if(groups[i].level == "witel" && groups[i].witel_id == witel.id)
            groupUsers.push(groups);
    }

    return { groups: picUsers, pics: groupUsers };
};

const joinWitelsData = (witelList, oldAlarms, groups, pics) => {
    try {

        const witelsCapt = {};
        const witelsGroup = [];
        witelList.forEach((witel, witelIndex) => {

            const alarms = getAlarmsOfWitel(witel, oldAlarms);
            const { groupUsers, picUsers } = getUsersOfWitel(witel, { groups, pics });
    
            const index = witelIndex % maxGroupItems;
            if(witelsGroup.length <= index)
                witelsGroup.push({});
    
            const key = witel.id;
            witelsCapt[key] = { witel, alarms, groupUsers, picUsers };
            witelsGroup[index][key] = { witel, alarms, groupUsers, picUsers };

        });
        return { witelsGroup, witelsCapt };
        
    } catch(err) {
        console.error(err);
        return [];
    }
};

const defineAlarm = async ({ witel, groupUsers, picUsers, oldAlarms }) => {

    const witelOldAlarms = getAlarmsOfWitel(witel, oldAlarms);
    const witelUsers = getUsersOfWitel(witel, groupUsers, picUsers);
    const witelGroupUsers = witelUsers.groups;
    const witelPicUsers = witelUsers.pics;

    const newAlarms = await fetchPortSensor(witel.id);
    const dateTime = toDatetimeString(new Date());
    const { openAlarm, closeAlarm } = createPortCategory(filterApiPortExclude(newAlarms), witelOldAlarms);

    parentPort.postMessage({
        type: "data",
        data: {
            witel,
            groupUsers: witelGroupUsers,
            picUsers: witelPicUsers,
            openAlarm,
            closeAlarm,
            dateTime
        }
    });
};

const witelList = Object.values(witels);
const witelIdsStr = witelList.map(witel => witel.id).join(",");
app.logProcess(`Starting port-alarm thread, queue:${ jobQueueNumber }, witelIds:(${ witelIdsStr })\n`);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

(async () => {

    const workList = witelList.map(witel => {
        return defineAlarm({ witel, groupUsers, picUsers, oldAlarms });
    });
    await Promise.all(workList);
    parentPort.postMessage({ type: "finish" });

})();