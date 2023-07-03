const http = require("../helpers/newosase/http");

module.exports = async (params) => {
    let data = null;
    try {
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

    return data ? data.payload : null;
};