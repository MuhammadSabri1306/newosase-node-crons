const axios = require("axios");

module.exports = async () => {
    try {
        const response = await axios.get("https://juarayya.telkom.co.id/test-newosase/api/alert");
        console.log(response.data);
    } catch(err) {
        if (err.toJSON)
            console.error(err.response?.data, err.toJSON());
        else
            console.error(err);
    }
};