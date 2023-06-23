const http = require("../helpers/newosase/http");

module.exports = async (callback) => {
    let data = {};
    try {
        const params = { limit: 1 };
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
    
    callback(data);
};