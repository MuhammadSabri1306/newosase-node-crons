const path = require("path");
const fs = require("fs");

const getTestParams = async () => {
    try {

        const paramsPath = path.resolve(__dirname, "params.json");
        const content = await fs.promises.readFile(paramsPath);
        const params = JSON.parse(content);
        return params;

    } catch(err) {
        console.error(err);
        return null;
    }
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
        app.logError(err);
    } finally {
        return { openAlarm, closeAlarm };
    }
};

const main = async () => {
    
    const params = await getTestParams();
    const dbData = params.dbData;
    const apiData = params.apiData.result.payload;
    
    const result = createPortCategory(apiData, dbData);
    console.log(result);

};

main();