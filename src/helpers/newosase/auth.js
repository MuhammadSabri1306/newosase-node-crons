const http = require("./http");
const { authParams } = require("../../config");
const dataFile = require("../data-file");

class Auth
{
    constructor() {
        this.token = null;
        this.readAuthData();
    }

    readAuthData() {
        const dataAuth = dataFile.read("auth");
        this.token = dataAuth.token;
    }

    writeAuthData() {
        const token = this.token;
        dataFile.write("auth", { token });
    }

    async regenerateToken() {
        try {
            const response = await http.post("/auth-service/apis/generate-jwt", authParams);
            if(response.data.result && response.data.result.token) {
                this.token = response.data.result.token;
                // this.writeAuthData();
                return;
            }

            console.warn(response.data);
        } catch(err) {
            if (err.toJSON)
                console.error(err.response.data, err.toJSON());
            else
                console.error(err);
        }
    }
}

module.exports = Auth;