const fs = require("fs");
const path = require("path");

const config = {
    baseUrl: "https://newosase.telkom.co.id/api/v1",
    authFilePath: path.resolve(__dirname, "./data/auth.json"),
    authParams: {
        application: "Opnimus",
        token: "p5cUT_y5EzIWS4kcedLWAPwWyilVJMg3R6GEhGnUnUjFZKeeTO"
    }
};

const dataFilePath = {
    auth: path.resolve(__dirname, "./data/auth.json")
};

const readDataFile = key => {
    let data = null;
    if(!dataFilePath[key]) {
        console.error("File data key isn't exists, key:" + key);
        return data;
    }

    try {
        const jsonString = fs.readFileSync(config.authFilePath);
        data = JSON.parse(jsonString);
    } catch (err) {
        console.log(err);
    }

    return data;
};

const dataFile = {
    list: {
        auth: path.resolve(__dirname, "./data/auth.json")
    },
    read: key => {
        let data = null;
        const filePath = dataFile.list[key];
        if(!filePath) {
            console.error("File data key isn't exists, key:" + key);
            return data;
        }

        try {
            const jsonString = fs.readFileSync(filePath);
            data = JSON.parse(jsonString);
        } catch (err) {
            console.log(err);
        }

        return data;
    },
    write: (key, data) => {
        const filePath = dataFile.list[key];
        if(!filePath) {
            console.error("File data key isn't exists, key:" + key);
            return false;
        }

        try {
            const jsonString = JSON.stringify(data);
            fs.writeFileSync(filePath, jsonString, { flag: 'a' });
            return true;
        } catch (err) {
            console.log(err);
            return false;
        }
    }
};

class NewosaseAuth
{
    constructor() {
        this.token = null;
        this.readAuthData();
    }

    readAuthData() {
        const dataAuth = dataFile.read("auth");
        this.token = dataAuth.token;
    }
}

module.exports = { config, NewosaseAuth };