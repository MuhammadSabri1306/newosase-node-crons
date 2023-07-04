module.exports = (rawData, dataDbPort) => {
    const newPorts = [];
    const openedAlarm = [];
    const closedAlarm = [];

    rawData.forEach(item => {
        const dbItem = dataDbPort.find(portItem => {
            if(portItem.rtu_code != item.rtu_sname)
                return false;
            if(portItem.port != item.no_port)
                return false;
            if(portItem.unit != item.units)
                return false;
            return true;
        });

        const isSeverityNormal = item.severity.id === 1;
        const isPortStateOpen = dbItem ? Boolean(dbItem.state) : false;

        if(!dbItem) {
            
            newPorts.push(item);

        } else if(!isPortStateOpen && !isSeverityNormal) {
            
            openedAlarm.push({
                dataAlarm: item,
                portStatusId: dbItem.id
            });
        
        } else if(isPortStateOpen && isSeverityNormal) {

            closedAlarm.push({
                dataAlarm: item,
                portStatusId: dbItem.id
            });

        }
    });

    return { newPorts, openedAlarm, closedAlarm };
};