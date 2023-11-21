const dbConfig = require("../env/database");
const { createDbPool, executeQuery, selectRowQuery,
    selectRowCollumnQuery, createQuery } = require("../core/mysql");
const apiData = require("./sample-data/newosase-port-alert.json");

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

    return { openAlarm, closeAlarm };
};

const main = async () => {
    
    const pool = createDbPool({
        ...dbConfig.opnimusNewMigrated,
        multipleStatements: true
    });
    
    try {

        const portListQueryStr = "SELECT alarm.*, rtu.location_id, rtu.datel_id, rtu.witel_id, rtu.regional_id"+
            " FROM alarm_port_status AS alarm JOIN rtu_list AS rtu ON rtu.sname=alarm.rtu_sname"+
            " WHERE alarm.is_closed=0";
        const { results: portList } = await executeQuery(pool, portListQueryStr);
        const portStatusNew = apiData.result.payload;
        const { openAlarm, closeAlarm } = createPortCategory(filterApiPortExclude(portStatusNew), portList);
        console.log({ openAlarm, closeAlarm });

    } catch(err) {
        console.error(err);
    } finally {
        pool.end();
    }
};

main();