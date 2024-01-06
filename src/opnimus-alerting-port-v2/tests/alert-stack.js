const dbConfig = require("../../env/database");
const { createDbPool, closePool, executeQuery, createQuery } = require("../../core/mysql");
const { createAlarmPortUserQuery } = require("../alerting");
const { isRuleMatch } = require("../rules");

const createAlertStack = (alarmPorts, alarmPortUsers, alarmPortPics) => {

    const alertStack = [];

    const pushAlertStack = (alarm, picList, chatId) => {
        const alarmId = alarm.id;
        const messageText = createAlertMessage(alarm, picList);
        alertStack.push({ alarmId, chatId, messageText });
    };

    const getAlarmPics = (alarmPortItem, alarmPortPics) => {
        const pics = []; let i = 0;
        while(i < alarmPortPics.length) {

            if(alarmPortPics[i].location_id == alarmPortItem.location_id)
                pics.push(alarmPortPics[i]);
            i++;

        }
        return pics;
    };

    const isUserRulesMatch = (alarmPort, user, errMesage) => {
        let isMatch = false;
        try {
            rules = user.rules;
            if(rules)
                isMatch = isRuleMatch(alarmPort, rules);
        } catch(err) {
            console.error(errMesage, user, alarmPort, err);
        } finally {
            return isMatch;
        }
    };

    const isUserMatch = (alarmPortItem, user) => {
        if(user.level == "nasional")
            return true;
        else if(user.level == "regional" && user.regional_id == alarmPortItem.regional_id)
            return true;
        else if(user.level == "witel" && user.witel_id == alarmPortItem.witel_id)
            return true;
        return false;
    };

    let picList;
    let hasAlarmUsers = false;
    let i = 0;
    let j = 0;

    while(i < alarmPorts.length) {

        hasAlarmUsers = false;

        // Set PICs per port
        picList = getAlarmPics(alarmPorts[i], alarmPortPics);

        // Push ports per pic
        j = 0;
        while(j < picList.length) {

            if( isUserRulesMatch(alarmPorts[i], picList[j], "Error when checking pic port rules") ) {
                console.info(`Push pic to alert stack, alarm_port_status.id:${ alarmPorts[i].id }, telegram_user.id:${ picList[j].id }`);
                pushAlertStack(alarmPorts[i], picList, picList[j].user_id);
                hasAlarmUsers = true;
            }
            j++;

        }

        // Push ports per user
        j = 0;
        while(j < alarmPortUsers.length) {
            if( isUserMatch(alarmPorts[i], alarmPortUsers[j]) ) {
                if( isUserRulesMatch(alarmPorts[i], alarmPortUsers[j], "Error when checking user port rules") ) {
                    console.info(`Push group to alert stack, alarm_port_status.id:${ alarmPorts[i].id }, telegram_user.id:${ alarmPortUsers[j].id }`);
                    pushAlertStack(alarmPorts[i], picList, alarmPortUsers[j].chat_id);
                    hasAlarmUsers = true;
                }
            }
            j++;
        }

        if(!hasAlarmUsers) {
            console.info(`Alarm has no users, alarm_port_status.id:${ alarmPorts[i].id }`);
        }

        i++;

    }

    return alertStack;
};

const extractAlarmPortAreaIds = (alarmPorts) => {
    const regionalIds = [];
    const witelIds = [];
    const locIds = [];
    for(let i=0; i<alarmPorts.length; i++) {


        if(regionalIds.indexOf(alarmPorts[i].regional_id) < 0)
            regionalIds.push(alarmPorts[i].regional_id);

        if(witelIds.indexOf(alarmPorts[i].witel_id) < 0)
            witelIds.push(alarmPorts[i].witel_id);

        if(locIds.indexOf(alarmPorts[i].location_id) < 0)
            locIds.push(alarmPorts[i].location_id);

    }
    return { regionalIds, witelIds, locationIds: locIds };
};

const main = async () => {
    const pool = createDbPool(dbConfig.opnimusNewMigrated2);
    try {

        const alarmPortsQuery = "SELECT port.*, rtu.name AS rtu_name, rtu.location_id,"+
            " loc.location_name, rtu.datel_id, rtu.witel_id, wit.witel_name, rtu.regional_id,"+
            " reg.name AS regional_name, reg.divre_code AS regional_code FROM alarm_port_status AS port"+
            " JOIN rtu_list AS rtu ON rtu.sname=port.rtu_sname JOIN rtu_location AS loc"+
            " ON loc.id=rtu.location_id JOIN witel AS wit ON wit.id=rtu.witel_id"+
            " JOIN regional AS reg ON reg.id=rtu.regional_id WHERE"+
            " port.id IN (2293848)";
            // " port.id IN (2293848, 2293849, 2293850, 2293851, 2293852)";
        const { results: alarmPorts } = await executeQuery(pool, alarmPortsQuery);
        console.log({ alarmPorts });

        const { regionalIds, witelIds, locationIds } = extractAlarmPortAreaIds(alarmPorts);
        const { user: alarmPortUserQuery, pic: alarmPortPicQuery } = createAlarmPortUserQuery({ regionalIds, witelIds, locationIds });

        const { results: alarmPortUsers } = await executeQuery(pool, alarmPortUserQuery);
        console.log({ alarmPortUsers });
        
        const { results: alarmPortPics } = await executeQuery(pool, alarmPortPicQuery);
        console.log({ alarmPortPics });

        const alertStack = createAlertStack(alarmPorts, alarmPortUsers, alarmPortPics);
        console.log({ alertStack });

    } catch(err) {
        console.error(err);
    } finally {
        await closePool(pool);
    }
};

main();