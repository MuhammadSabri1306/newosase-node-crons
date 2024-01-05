const path = require("path");
const fs = require("fs");
const logger = require("./logger");
const { logErrorWithFilter } = require("./log-error");

module.exports.extractRulesKey = rules => {
	const regex = /{{\s*([^\s{}]+)\s*}}/g;
	const matches = [];
	let match;
  
	while((match = regex.exec(rules)) !== null) {
		matches.push({ key: match[1], mark: match[0] });
	}

	return matches;
};

module.exports.isRuleMatch = (port, rules) => {
	const portKeys = this.extractRulesKey(rules);
	portKeys.forEach(({ key, mark }) => {
		let portKey = "null";
		if(port && key in port)
			portKey = `port.${ key }`;
		rules = rules.replaceAll(mark, portKey);
	});

	return eval(rules);
};

module.exports.externalRules = {};

module.exports.isRulesFileMatch = (port, rulesFile) => {
    let rulesChecker = null;
    try {
        if(typeof this.externalRules[rulesFile] == "function") {
            rulesChecker = this.externalRules[rulesFile];
        } else {
            const filePath = path.resolve(__dirname, `user-alerting-rules/${ rulesFile }.rules.js`);
            rulesChecker = require(filePath);
            this.externalRules[rulesFile] = rulesChecker;
        }
    } catch(err) {
        logErrorWithFilter("Failed to load external rules, false given", err);
        rulesChecker = port => false;
    }
    return rulesChecker(port);
};

module.exports.isPortUserMatch = (port, rules, applyRulesFile, rulesFile) => {
    applyRulesFile = Boolean(applyRulesFile);
    if(applyRulesFile)
        return this.isRuleMatch(port, rules);
    console.log(!applyRulesFile)
    return this.isRulesFileMatch(port, rulesFile);
}

const test = () => {

    const user = {
        name: "User 1",
        mode: "default",
        mode_id: 1,
        // rules: `{{ port_name }} == "Status PLN" || {{ port_name }} == "Status DEG"`,
        rules: null,
        apply_rules_file: 1,
        rules_file: "example"
    };
    
    const port = {
        id: 37251,
        port_no: "A-04",
        port_name: "Temperature Ruang Perangkat (NE)",
        port_value: 237.60000000000002,
        port_unit: "°C",
        port_severity: "critical",
        type: "port",
        location: "KOTA",
        rtu_sname: "RTU00-D2-KTX",
        rtu_status: "alert",
        is_closed: 0,
    };
    
    const isPassingRules = this.isPortUserMatch(port, user.rules, user.apply_rules_file, user.rules_file);
    console.log(isPassingRules);

};