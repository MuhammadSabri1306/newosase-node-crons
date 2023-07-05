const http = require("./newosase/http");
const updateDbWitel = require("./update-db-witel");

module.exports = async () => {
    let data = null;
    try {
        const response = await http.get("/admin-service/locations");
        if(response.data && response.data.result)
            data = response.data.result;
        else
            console.warn(response.data);
    } catch(err) {
        if (err.toJSON)
            console.error(err.response.data, err.toJSON());
        else
            console.error(err);
    }

    return data ? data.locations : null;
};