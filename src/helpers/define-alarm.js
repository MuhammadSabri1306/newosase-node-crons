const isRawMatch = (dbItem, rawItem) => {
    if(dbItem.rtu_code != rawItem.rtu_sname)
        return false;
    if(dbItem.port != rawItem.no_port)
        return false;
    if(dbItem.unit != rawItem.units)
        return false;
    return true;
};

const isExclude = rawItem => {
    if(!rawItem.port_name)
        return true;
    if(!rawItem.no_port)
        return true;
    if(rawItem.no_port == "many")
        return true;
};

module.exports = (rawData, dataDbPort) => {
    const newPorts = [];
    const openedAlarm = [];
    const closedAlarm = [];

    rawData = rawData.filter(item => !isExclude(item));

    dataDbPort.forEach(item => {
        const currItem = rawData.find(rawItem => isRawMatch(item, rawItem));
        if(!currItem && item.state == 1) {
            closedAlarm.push(item);
        } else if(currItem && item.state != 1) {
            openedAlarm.push({
                newRow: currItem,
                oldRow: item
            });
        }
    });

    rawData.forEach(item => {
        const dataDbIndex = dataDbPort.findIndex(dbItem => isRawMatch(dbItem, item));
        if(dataDbIndex < 0)
            newPorts.push(item);
    });

    return { newPorts, openedAlarm, closedAlarm };
};