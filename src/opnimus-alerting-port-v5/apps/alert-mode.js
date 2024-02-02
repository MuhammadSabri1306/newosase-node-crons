
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
		rules = rules.replace(mark, portKey);
	});

	return eval(rules);

};