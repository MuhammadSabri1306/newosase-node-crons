const axios = require("axios");
const config = require("../../config");

const headers = {};
for(key in config.httpHeaders) {
    headers[key] = config.httpHeaders[key];
}

if(!config.httpHeaders.rejectUnauthorized)
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

module.exports = axios.create({
    baseURL: config.baseUrl,
    headers
});