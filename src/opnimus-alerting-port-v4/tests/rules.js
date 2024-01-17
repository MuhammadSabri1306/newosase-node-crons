const testRules = [
    "true",
    '{{ port_name }} == "DC Voltage Battere Starter DEG 24 V" || {{ port_name }} == "DC Voltage Battere Starter DEG 12 V"|| {{ port_name }} == "DC Voltage Rectifier" || {{ port_name }} == "Temperature Ruang Perangkat (NE)"',
    '{{ port_name }} == "Status PLN" || {{ port_name }} == "Status DEG"'
];

testRules.forEach(rules => {
    const portKeys = extractRulesKey(rules);
    portKeys.forEach(({ key, mark }) => {
        let portKey = "null";
        portKey = `port.${ key }`;
        // rules = rules.replace(new RegExp(mark, "g"), portKey);
        rules = rules.replace(mark, portKey);
    });
    console.log(rules);
});