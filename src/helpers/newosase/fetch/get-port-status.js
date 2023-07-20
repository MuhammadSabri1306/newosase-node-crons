const http = require("../http");
const { logger } = require("../../logger");

module.exports = async (params) => {
    let data = null;
    try {
        const response = await http.get("/dashboard-service/dashboard/rtu/port-sensors", { params });
        if(response.data && response.data.result)
            data = response.data.result;
        else
            logger.debug(response.data);
    } catch(err) {
        if (err.toJSON)
            logger.error(err.response.data, err.toJSON());
        else
            logger.error(err);
    } finally {
        return data ? data.payload : null;
    }

};