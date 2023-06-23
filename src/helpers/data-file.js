const path = require("path");
const fs = require("fs");
const { basePath } = require("../config");

const dataFile = {
    list: {
        auth: path.resolve(basePath, "./data/auth.json")
    },
    read: key => {
        let data = {};
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

module.exports = dataFile;