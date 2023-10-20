const axios = require("axios");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const httpHeaders = {
    "Accept": "application/json"
};

module.exports.useHttp = (baseURL, setConfig = null) => {
    const httpConfig = {
        baseURL,
        headers: httpHeaders
    };

    if(typeof setConfig == "function")
        httpConfig = setConfig(httpConfig);
    return axios.create(httpConfig);
};