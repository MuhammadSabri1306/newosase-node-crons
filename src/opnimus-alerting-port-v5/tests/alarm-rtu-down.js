const axios = require("axios");
const { Logger } = require("../apps/logger");
const { useSequelize, useModel } = require("../apps/models");
const { createNewosaseHttp, defineAlarms } = require("../apps/define-alarm");
const { toDatetimeString } = require("../../helpers/date");
const dbOpnimusNewConfig = require("../../env/database/opnimus-new-migrated-2");

// const extractData = (data, getter) => {
//     let result = null;
//     try {
//         result = getter(data);
//     } catch(err) {
//         console.
//     } finally {
//         return result;
//     }
// };

const fetchExpNewosaseRtuDown = async (app = {}) => {
    const { logger } = app;

    logger.info("get example rtu down from newosase");
    const http = createNewosaseHttp();

    let params = { isArea: "hide", level: 1, isChildren: "view", statusRtu: "off" };
    let response = await http.get("/parameter-service/mapview", { params });
    const rtuDownSname =  response.data.result[0].witel[0].rtu[0].rtu_sname;

    params = { isAlert: 1, searchRtuSname: rtuDownSname };
    response = await http.get("/dashboard-service/dashboard/rtu/port-sensors", { params });
    const ports = response.data.result.payload;

    for(let i=0; i<ports.length; i++) {
        if(ports[i].rtu_status == "off")
            return ports[i];
    }
    return null;
    
};

const testRtuDownAlarm = newRtuAlarms => {

    const insertedRtuSnames = [];
    const alarmHistoryRtuDatas = newRtuAlarms.map(item => {
        const currDate = new Date();
        const nextAlertDate = item.alertStartTime ? new Date(item.alertStartTime) : new Date(currDate);
        nextAlertDate.setMinutes( nextAlertDate.getMinutes() + 5 );
        insertedRtuSnames.push(item.rtuSname);

        console.log( toDatetimeString(nextAlertDate) );
        return {
            rtuId: item.rtuId,
            rtuSname: item.rtuSname,
            rtuStatus: item.rtuStatus,
            isOpen: true,
            alertStartTime: item.alertStartTime,
            openedAt: currDate,
            nextAlertAt: nextAlertDate
        };
    });
    // console.log(alarmHistoryRtuDatas);

};

const testCase1 = async () => {

    const logger = Logger.create({ useConsole: true });
    const sequelize = useSequelize({
        ...dbOpnimusNewConfig,
        options: {
            logging: false,
            timezone: "+07:00"
        }
    });
    
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const rtuDownPort = await fetchExpNewosaseRtuDown({ logger });
    if(!rtuDownPort) {
        logger.info("there are no one rtu down fetched", { rtuDownPort });
        return;
    }

    const prevAlarms = { portAlarms: [], rtuAlarms: [] };
    const { closedRtuAlarms, newRtuAlarms } = defineAlarms(prevAlarms, [ rtuDownPort ]);

    testRtuDownAlarm(newRtuAlarms);

};

testCase1();