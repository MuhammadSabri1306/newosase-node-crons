const { http, Database } = require("../helpers/newosase");

module.exports = async (regional) => {
    let data = {};
    try {
        const params = { regionalId: regional.id };
        const response = await http.get("/dashboard-service/dashboard/rtu/port-sensors", { params });
        if(response.data && response.data.result)
            data = response.data.result;
        else
            console.warn(response.data);
    } catch(err) {
        if (err.toJSON)
            console.error(err.response?.data, err.toJSON());
        else
            console.error(err);
    }
    
    const alertData = data.payload && data.payload.filter(item => {
        // If severity is Normal, return false
        if(item.severity && item.severity.id)
            return item.severity.id !== 1;

        // If severity can't defined, return true
        return true;
    });

    alertData.forEach(item => {
        console.log(item, item.severity);
    });
};