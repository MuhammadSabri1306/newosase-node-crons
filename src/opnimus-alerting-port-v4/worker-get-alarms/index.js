const { parentPort, workerData } = require("worker_threads");
const axios = require("axios");
const App = require("../App");
const { toDatetimeString } = require("../../helpers/date");
const { useWitelModel, WitelModel, useGroupUserModel, GroupUserModel,
    usePicUserModel, PicUserModel, useAlarmModel, AlarmModel,
    useRtuModel, RtuModel } = require("../model");

const { appId, appName, witels, rtus, groupUsers, picUsers, oldAlarms, jobQueueNumber } = workerData;
const app = new App(appId, appName);

const newosaseBaseUrl = "https://newosase.telkom.co.id/api/v1";
const http = axios.create({
    baseURL: newosaseBaseUrl,
    headers: { "Accept": "application/json" }
});

const fetchPortSensor = async (witelId) => {
    app.logProcess("Create newosase api request", { witelId });
    try {

        const params = { isAlert: 1, witelId };
        const response = await http.get("/dashboard-service/dashboard/rtu/port-sensors", { params });
        if(response.data && response.data.result && response.data.result.payload) {
            app.logProcess("Collecting newosase api response", { witelId });
            return response.data.result.payload;
        }

        app.logProcess(`No data provided in ${ newosaseBaseUrl }/getrtuport`, {
            witelId,
            responseData: response.data
        });
        return [];

    } catch(err) {

        app.logProcess(`Error in ${ newosaseBaseUrl }/getrtuport`, { witelId });
        app.logError(err);
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

const getAlertUsers = (rtuSname, rtus, groupUsers, picUsers) => {
    const rtu = rtus.find(item => item.sname == rtuSname);
    if(!rtu) return [];

    const users = [];
    let i = 0;
    while(i < groupUsers.length) {
        if(groupUsers[i].level == "nasional")
            users.push({ chatId: groupUsers[i].chat_id, rules: groupUsers[i].rules });
        else if(groupUsers[i].level == "regional" && groupUsers[i].regional_id == rtu.regional_id)
            users.push({ chatId: groupUsers[i].chat_id, rules: groupUsers[i].rules });
        else if(groupUsers[i].level == "witel" && groupUsers[i].witel_id == rtu.witel_id)
            users.push({ chatId: groupUsers[i].chat_id, rules: groupUsers[i].rules });
        i++;
    }

    i = 0;
    while(i < picUsers.length) {
        if(picUsers[i].location_id == rtu.location_id)
            users.push({ chatId: picUsers[i].user_id, rules: picUsers[i].rules });
        i++;
    }

    return users;
};

const buildData = (apiData, dbData, rtus, groupUsers, picUsers, dateTime) => {
    const newAlarms = [];
    const updatedAlarms = [];
    const closedAlarms = [];
    const alerts = [];

    try {
        if(!dbData instanceof AlarmModel || !dbData.isList())
            throw new Error("dbData in buildData() is not instanceof AlarmModel");
        if(!rtus instanceof RtuModel || !rtus.isList())
            throw new Error("rtus in buildData() is not instanceof RtuModel");
        if(!groupUsers instanceof GroupUserModel || !groupUsers.isList())
            throw new Error("groupUsers in buildData() is not instanceof GroupUserModel");
        if(!picUsers instanceof PicUserModel || !picUsers.isList())
            throw new Error("picUsers in buildData() is not instanceof PicUserModel");
        dbData = dbData.get();
        rtus = rtus.get();
        groupUsers = groupUsers.get();
        picUsers = picUsers.get();

        let hasMatches = false;
        let isMatch; let isChanged;
    
        for(let i=0; i<apiData.length; i++) {
            
            hasMatches = false;
            for(let j=0; j<dbData.length; j++) {
                
                isMatch = isPortMatch(apiData[i], dbData[j]);
                isChanged = isMatch && apiData[i].severity.name.toString().toLowerCase() != dbData[j].port_severity;
    
                if(isChanged) {

                    updatedAlarms.push({
                        id: dbData[j].id,
                        data: {
                            port_value: apiData[i].value,
                            port_unit: apiData[i].units,
                            port_severity: apiData[i].severity.name.toString().toLowerCase()
                        }
                    });

                    getAlertUsers(apiData[i].rtu_sname, rtus, groupUsers, picUsers)
                        .forEach(user => {
                            alerts.push({
                                rtuSname: apiData[i].rtu_sname,
                                portNo: apiData[i].no_port,
                                user
                            });
                        });

                }
    
                if(isMatch && !hasMatches)
                    hasMatches = true;
    
            }
    
            if(!hasMatches) {
                
                newAlarms.push({
                    port_no: apiData[i].no_port,
                    port_name: apiData[i].port_name,
                    port_value: apiData[i].value,
                    port_unit: apiData[i].units,
                    port_severity: apiData[i].severity.name.toString().toLowerCase(),
                    type: apiData[i].result_type,
                    location: apiData[i].location,
                    rtu_sname: apiData[i].rtu_sname,
                    opened_at: dateTime
                });

                getAlertUsers(apiData[i].rtu_sname, rtus, groupUsers, picUsers)
                    .forEach(user => {
                        alerts.push({
                            rtuSname: apiData[i].rtu_sname,
                            portNo: apiData[i].no_port,
                            user
                        });
                    });

            }
        }
    
        for(let x=0; x<dbData.length; x++) {
            
            hasMatches = false;
            for(let y=0; y<apiData.length; y++) {
                if( isPortMatch(apiData[y], dbData[x]) ) {
                    hasMatches = true;
                    y = apiData.length;
                }
            }
    
            if(!hasMatches) {
                closedAlarms.push({
                    id: dbData[x].id,
                    data: {
                        port_severity: "normal",
                        closed_at: dateTime
                    }
                });
            }
    
        }

    } catch(err) {
        app.logError(err);
    } finally {
        return { newAlarms, updatedAlarms, closedAlarms, alerts };
    }
};

const getAlarmsOfWitel = (witel, alarms) => {
    const result = [];
    try {

        if(!witel instanceof WitelModel || witel.isList())
            throw new Error("witel in getAlarmsOfWitel() is not instanceof WitelModel item");
        if(!alarms instanceof AlarmModel || !alarms.isList())
            throw new Error("alarms in getAlarmsOfWitel() is not instanceof AlarmModel");
        witel = witel.get();
        alarms = alarms.get();

        for(let i=0; i<alarms.length; i++) {
            if(alarms[i].witel_id == witel.id)
                result.push(alarms[i]);
        }

    } catch(err) {
        app.logError(err);
    } finally {
        return result;
    }
};

const defineAlarm = async ({ witel, rtus, groupUsers, picUsers, oldAlarms }) => {
    
    const witelOldAlarms = getAlarmsOfWitel(useWitelModel(witel), useAlarmModel(oldAlarms));
    app.logProcess("Get witel's old alarm", {
        witelId: witel.id,
        oldAlarmsCount: witelOldAlarms.length,
        totalOldAlarmsCount: oldAlarms.length
    });

    let currAlarms = await fetchPortSensor(witel.id);
    currAlarms = filterApiPortExclude(currAlarms);
    const dateTime = toDatetimeString(new Date());
    
    app.logProcess("Split alarm status category", {
        witelId: witel.id,
        currAlarmsCount: currAlarms.length,
        oldAlarmsCount: witelOldAlarms.length
    });
    const { newAlarms, updatedAlarms, closedAlarms, alerts } = buildData(
        currAlarms,
        useAlarmModel(witelOldAlarms),
        useRtuModel(rtus),
        useGroupUserModel(groupUsers),
        usePicUserModel(picUsers),
        dateTime
    );

    parentPort.postMessage({
        type: "data",
        data: {
            witel,
            newAlarms,
            updatedAlarms,
            closedAlarms,
            alertMatches: alerts,
            dateTime
        }
    });
};

const witelIdsStr = witels.map(witel => witel.id).join(",");
app.logProcess(`Starting port-alarm thread, queue:${ jobQueueNumber }, witelIds:(${ witelIdsStr })`);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

(async () => {

    const workList = witels.map(witel => {
        return defineAlarm({ witel, rtus, groupUsers, picUsers, oldAlarms });
    });
    try {
        await Promise.all(workList);
    } catch(err) {
        app.logError(err);
    } finally {
        parentPort.postMessage({ type: "finish" });
    }

})();