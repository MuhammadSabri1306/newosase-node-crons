const extractRulesKey = rules => {
	const regex = /{{\s*([^\s{}]+)\s*}}/g;
	const matches = [];
	let match;
  
	while((match = regex.exec(rules)) !== null) {
		portKeys.push({ key: match[1], mark: match[0] });
	}

	return matches;
};

const isUserMatch = (rules, port) => {
	const portKeys = extractRulesKey(rules);
	portKeys.forEach(({ key, mark }) => {
		let portKey = "null";
		if(port && key in port)
			portKey = `port.${ key }`;
		rules = rules.replaceAll(mark, portKey);
	});

	return eval(rules);
};

const defaultRules = "true";
const criticalRules = "{{ status }} && {{ value }} > 5";
const powerRules = "{{ status }}";

const ports = [
	{ status: false, value: 6 },
	{ status: false, value: 4 },
	{ status: true, value: 6 },
	{ status: true, value: 4 }
];

const users = [
	{ name: "User 1", mode: "default", rules: defaultRules },
	{ name: "User 2", mode: "critical", rules: criticalRules },
	{ name: "User 3", mode: "power", rules: powerRules }
];

const portAlarms = ports.map(port => {
	const alarmUsers = [];
	for(let i=0; i<users.length; i++) {
		if(isUserMatch(port, users[i].rules)) {
			alarmUsers.push(users[i]);
			i = users.length;
		}
	}
});

console.log(portAlarms);

// - Case 1: str = "{{ status }} && {{ value }}",
//   result = [{ key: "status", mark: {{ status }} }, { key: "value", mark: "{{ value }}" }]
// - Case 2: str = "{{ status }} && {{id}}",
//   result = [{ key: "status", mark: "{{ status }}" }, { key: "id", mark: "{{id}}" }]
// - Case 3: str = "{{name}} == 2",
//   result = [{ key: "name", mark: "{{name}}" }]
// - Case 4: str = "test" == 2", result = []