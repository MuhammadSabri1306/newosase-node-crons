const logger = require("./logger");
const TelegramText = require("../core/telegram-text");
const { extractDate } = require("../helpers/date");
const { toFixedNumber } = require("../helpers/number-format");
const { createQuery } = require("../core/mysql");
const { isRuleMatch } = require("./rules");
const { logErrorWithFilter } = require("./log-error");

module.exports.createPortAlarmQuery = (alarmIds) => {
    if(!Array.isArray(alarmIds) || alarmIds.length < 1)
        return null;
    let alarmPortQueryStr = "SELECT port.*, rtu.name AS rtu_name, rtu.location_id,"+
        " loc.location_name, rtu.datel_id, rtu.witel_id, wit.witel_name,"+
        " rtu.regional_id, reg.name AS regional_name, reg.divre_code AS regional_code"+
        " FROM alarm_port_status AS port"+
        " JOIN rtu_list AS rtu ON rtu.sname=port.rtu_sname"+
        " JOIN rtu_location AS loc ON loc.id=rtu.location_id"+
        " JOIN witel AS wit ON wit.id=rtu.witel_id"+
        " JOIN regional AS reg ON reg.id=rtu.regional_id"+
        " WHERE port.id IN (?)";
    return createQuery(alarmPortQueryStr, [alarmIds]);
};

const createAlarmPortUserQueryBackup = ({ regionalIds, witelIds, locationIds }) => {
    // user query
    const queryUserParams = [];
    const queryUserParamsBind = [];

    queryUserParams.push("(is_pic=? AND alert_status=? AND level=?)");
    queryUserParamsBind.push(0, 1, "nasional");

    if(regionalIds.length > 0) {
        queryUserParams.push("(is_pic=? AND alert_status=? AND level=? AND regional_id IN (?))");
        queryUserParamsBind.push(0, 1, "regional", regionalIds);
    }

    if(witelIds.length > 0) {
        queryUserParams.push("(is_pic=? AND alert_status=? AND level=? AND witel_id IN (?))");
        queryUserParamsBind.push(0, 1, "witel", witelIds);
    }

    const queryUserParamsStr = queryUserParams.join(" OR ");
    const queryUserStr = `SELECT * FROM telegram_user WHERE ${ queryUserParamsStr } ORDER BY regional_id, witel_id`;

    // pic query
    const queryPicStr = "SELECT user.* FROM telegram_user AS user"+
        " JOIN pic_location AS loc ON loc.user_id=user.id"+
        " WHERE user.is_pic=? AND user.alert_status=? AND loc.location_id IN (?)"+
        " GROUP BY user.id";
    const queryPicParamsBind = [1, 1, locationIds];

    return {
        user: createQuery(queryUserStr, queryUserParamsBind),
        pic: createQuery(queryPicStr, queryPicParamsBind)
    };
};

class RawQueryBuilder {
    constructor() {
        this.queries = [];
        this.params = [];
    }
    
    add(query, ...bindedParams) {
        let queryStr = null;
        if(typeof query == "function")
            queryStr = query();
        else if(typeof query == "string")
            queryStr = query;
        
        if(!queryStr || typeof queryStr != "string")
            return this;
        
        this.queries.push(queryStr);
        if(Array.isArray(bindedParams) && bindedParams.length > 0) {
            bindedParams.forEach(item => this.params.push(item));
        }

        return this;
    }
    
    buildQuery(callback) {
        const query = this.queries.length > 0 ? this.queries.join(" ") : "";
        const params = this.params;
        return callback(query, params);
    }
}

module.exports.createAlarmPortUserQuery = ({ regionalIds, witelIds, locationIds }) => {

    const queryUser = (new RawQueryBuilder())
        .add("SELECT user.*, mode.id AS mode_id, mode.rules, mode.apply_rules_file, mode.rules_file")
        .add("FROM alert_users as alert JOIN telegram_user as user ON user.id=alert.telegram_user_id")
        .add("JOIN alert_modes AS mode ON mode.id=alert.mode_id WHERE")
        .add("(alert.cron_alert_status=1 AND alert.user_alert_status=1) AND (")
        .add("(user.is_pic=0 AND level='nasional')")
        .add(
            (regionalIds.length < 1) ? null : "OR (user.is_pic=0 AND level='regional' AND user.regional_id IN (?))",
            regionalIds
        )
        .add(
            (witelIds.length < 1) ? null : "OR (user.is_pic=0 AND level='witel' AND user.witel_id IN (?))",
            witelIds
        )
        .add(") ORDER BY user.regist_id");
    const user = queryUser.buildQuery((query, params) => createQuery(query, params));

    const queryPic = (new RawQueryBuilder())
        .add("SELECT user.id, user.user_id, user.type, user.username, user.first_name, user.last_name,")
        .add("pers.nama AS full_name, pic.location_id, mode.id AS mode_id, mode.rules, mode.apply_rules_file,")
        .add("mode.rules_file FROM pic_location AS pic")
        .add("JOIN telegram_user AS user ON user.id=pic.user_id")
        .add("JOIN telegram_personal_user AS pers ON pers.user_id=pic.user_id")
        .add("JOIN alert_users as alert ON alert.telegram_user_id=user.id")
        .add("JOIN alert_modes AS mode ON mode.id=alert.mode_id")
        .add("WHERE user.is_pic=1 AND alert.cron_alert_status=1 AND alert.user_alert_status=1")
        .add(locationIds.length < 1 ? null : "AND pic.location_id IN (?)", locationIds)
        .add("ORDER BY user.pic_regist_id");
    const pic = queryPic.buildQuery((query, params) => createQuery(query, params));

    return { user, pic };
};

const getAlertIcon = (alarm) => {
    const portName = alarm.port_name.toUpperCase();
    if(portName == "STATUS PLN")
        return "⚡️";
    if(portName == "STATUS DEG")
        return "🔆";

    const portStatus = alarm.port_severity.toUpperCase();
    if(portStatus == "OFF")
        return "‼️";
    if(portStatus == "CRITICAL")
        return "❗️";
    if(portStatus == "WARNING")
        return "⚠️";
    if(portStatus == "SENSOR BROKEN")
        return "❌";
    
    return "⚡️";
};

const getAlertTitle = (alarm, icon) => {
    if(alarm.port_name == "Status PLN")
        return `${ icon } PLN OFF: ${ alarm.location_name } (${ alarm.rtu_sname })${ icon }`;
    if(alarm.port_name == "Status DEG")
        return `${ icon } GENSET ON: ${ alarm.location_name } (${ alarm.rtu_sname })${ icon }`;

    const portSeverity = alarm.port_severity.toUpperCase();
    return `${ icon } ${ alarm.port_name } ${ portSeverity }: ${ alarm.location_name } (${ alarm.rtu_sname })${ icon }`;
};

const getAlertDescr = (alarm) => {
    let alertText;

    if(alarm.port_name == "Status PLN")
        alertText = "PLN OFF";
    else if(alarm.port_name == "Status DEG")
        alertText = "GENSET ON";
    else {
        const portSeverity = alarm.port_severity.toUpperCase();
        alertText = `${ alarm.port_name } ${ portSeverity }`;
    }

    return TelegramText.create("Terpantau ").addBold(alertText).addText(" dengan detail sebagai berikut:").get();
};

const getRegionalIcon = regionalCode => {
    if(regionalCode == "TLK-r1000000")
        return "1️⃣";
    if(regionalCode == "TLK-r2000000")
        return "2️⃣";
    if(regionalCode == "TLK-r3000000")
        return "3️⃣";
    if(regionalCode == "TLK-r4000000")
        return "4️⃣";
    if(regionalCode == "TLK-r5000000")
        return "5️⃣";
    if(regionalCode == "TLK-r6000000")
        return "6️⃣";
    if(regionalCode == "TLK-r7000000")
        return "7️⃣";
    return " ";
};

const getValueText = (alarm) => {
    if(alarm.port_value === null || alarm.port_value === undefined)
        return "-";
    if(alarm.port_unit == "ON/OFF")
        return alarm.port_value == 0 ? "ON" : "OFF";
    
    const value = toFixedNumber(alarm.port_value);
    return `${ value } ${ alarm.port_unit }`;
};

const createAlertMessage = (alarm, pics) => {

    const alertIcon = getAlertIcon(alarm);
    const title = getAlertTitle(alarm, alertIcon);
    const descr = getAlertDescr(alarm);

    const datetime = extractDate(new Date(alarm.opened_at));
    const datetimeStr = `${ datetime.day }-${ datetime.month }-${ datetime.year } ${ datetime.hours }:${ datetime.minutes } WIB`;
    
    const tregIcon = getRegionalIcon(alarm.regional_code);
    const valueText = getValueText(alarm);

    const msg = TelegramText.create(title).addLine()
        .addText("Pada "+datetimeStr).addLine(2)
        .addText(descr).addLine()
        .startCode()
        .addText(`${ tregIcon } Regional  : ${ alarm.regional_name }`).addLine()
        .addText(`🏢 Witel     : ${ alarm.witel_name }`).addLine()
        .addText(`🏬 Lokasi    : ${ alarm.location_name }`).addLine()
        .addText(`🎛 RTU Name  : ${ alarm.rtu_sname }`).addLine()
        .addText(`🏪 Node Name : ${ alarm.rtu_name }`).addLine()
        .endCode().addLine(2)
        .addText("Detail Port Alarm:").addLine()
        .startCode()
        .addText(`${ alertIcon } Nama Port : ${ alarm.port_name }`).addLine()
        .addText(`🔌 Port      : ${ alarm.port_no }`).addLine()
        .addText(`✴️ Value     : ${ valueText }`).addLine()
        .addText(`🌋 Status    : ${ alarm.port_severity }`).addLine()
        .addText(`📅 Waktu     : ${ datetimeStr }`).addLine()
        .endCode().addLine(2);

    if(Array.isArray(pics) && pics.length > 0) {
        msg.addBold("PIC Lokasi ini adalah:");
        pics.forEach((pic, index) => {

            if(index > 0)
                msg.addText(",");
            msg.addText(" ");
            
            if(pic.full_name)
                msg.addMentionByUserId(pic.user_id, pic.full_name);
            else if(pic.first_name && pic.last_name)
                msg.addMentionByUserId(pic.user_id, `${ pic.first_name } ${ pic.last_name }`);
            else if(pic.username)
                msg.addMentionByUsername(pic.username)
            else
                msg.addMentionByUserId(pic.user_id, "Tanpa Nama");

        });
        msg.addLine(2);
    }

    msg.addText("❕Mohon untuk segera melakukan pengecekan port lokasi, terima kasih. ")
        .addText("Anda juga dapat mengetikan /alarm untuk mengecek alarm saat ini.").addLine()
        .addText("#OPNIMUS #PORTALARM");
    return msg.get();

};

module.exports.createAlertStack = (alarmPorts, alarmPortUsers, alarmPortPics) => {

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
            logErrorWithFilter(errMesage, user, alarmPort, err);
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
                logger.info(`Push pic to alert stack, alarm_port_status.id:${ alarmPorts[i].id }, telegram_user.id:${ picList[j].id }`);
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
                    logger.info(`Push group to alert stack, alarm_port_status.id:${ alarmPorts[i].id }, telegram_user.id:${ alarmPortUsers[j].id }`);
                    pushAlertStack(alarmPorts[i], picList, alarmPortUsers[j].chat_id);
                    hasAlarmUsers = true;
                }
            }
            j++;
        }

        if(!hasAlarmUsers) {
            logger.info(`Alarm has no users, alarm_port_status.id:${ alarmPorts[i].id }`);
        }

        i++;

    }

    return alertStack;
};