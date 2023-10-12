// @ts-nocheck

module.exports.toIdrCurrency = numb => {
	let numberStr = parseFloat(numb);
    numberStr = numberStr.toString();
	const split = numberStr.split(".");
	const left = split[0].length % 3;
	let result = split[0].substr(0, left);
	const digit = split[0].substr(left).match(/\d{3}/gi);

	if(digit){
		const separator = left ? "." : "";
		result += separator + digit.join(".");
	}

	result = split[1] != undefined ? result + "," + split[1] : result;
	return result;
};

module.exports.toFixedNumber = (numb, numbBehindComma = 2) => {
	numb = Number(numb);
	return (numb.toString().length > numbBehindComma + 1) ? numb.toFixed(numbBehindComma) : numb.toString();
};

module.exports.toNumberText = (numb, decimalLimit = 2) => {
	let numberStr = numb.toString();
	const isNegative = numberStr.startsWith("-");
	if(isNegative)
		numberStr = numberStr.substring(1);
  
	const hasDecimal = numberStr.includes(".");
	if(hasDecimal) {
		const decimalPart = numberStr.split(".")[1];
		const notNullIndex = decimalPart.search(/[1-9]/) + 1;
		if(notNullIndex > decimalLimit)
			decimalLimit = notNullIndex;
		if(decimalPart.length > decimalLimit)
			numberStr = parseFloat(numberStr).toFixed(decimalLimit);
	}
  
	const split = numberStr.split(".");
	const left = split[0].length % 3;
	let result = split[0].substr(0, left);
	const digit = split[0].substr(left).match(/\d{3}/g);
  
	if(digit) {
	  const separator = left ? "." : "";
	  result += separator + digit.join(".");
	}
  
	result = split[1] !== undefined ? result + "," + split[1] : result;
	if(isNegative)
		result = "-" + result;
  
	return result;
};

module.exports.toZeroLeading = (numb, maxDigit) => {
	numb = Number(numb).toString();
	
	if(numb.length >= maxDigit)
		return numb;
	
	for(let i=0; i<(maxDigit-numb.length); i++) {
		numb = "0" + numb;
	}
	return numb;
};

module.exports.toRoman = num => {
	num = Number(num);
	const romanNumerals = [
		{ value: 1000, symbol: "M" },
		{ value: 900, symbol: "CM" },
		{ value: 500, symbol: "D" },
		{ value: 400, symbol: "CD" },
		{ value: 100, symbol: "C" },
		{ value: 90, symbol: "XC" },
		{ value: 50, symbol: "L" },
		{ value: 40, symbol: "XL" },
		{ value: 10, symbol: "X" },
		{ value: 9, symbol: "IX" },
		{ value: 5, symbol: "V" },
		{ value: 4, symbol: "IV" },
		{ value: 1, symbol: "I" }
	];
	  
	let result = "";
	for(let i=0; i<romanNumerals.length; i++) {
		while (num >= romanNumerals[i].value) {
			result += romanNumerals[i].symbol;
			num -= romanNumerals[i].value;
		}
	}
	return result;
};