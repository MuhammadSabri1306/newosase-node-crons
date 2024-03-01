const isDateObject = dateObj => dateObj && typeof dateObj.getFullYear === "function";

const extractDate = (dateObj, asString = true) => {
    if(!isDateObject(dateObj))
        return null;

    let year = dateObj.getFullYear();
    let month = dateObj.getMonth() + 1;
    let day = dateObj.getDate();
    let hours = dateObj.getHours();
    let minutes = dateObj.getMinutes();
    let seconds = dateObj.getSeconds();

    if(asString) {
        year = String(year);
        month = String(month).padStart(2, '0');
        day = String(day).padStart(2, '0');
        hours = String(hours).padStart(2, '0');
        minutes = String(minutes).padStart(2, '0');
        seconds = String(seconds).padStart(2, '0');
    }

    return { year, month, day, hours, minutes, seconds };
};

const toDatetimeString = dateObj => {
    if(!isDateObject(dateObj))
        return null;
    const { year, month, day, hours, minutes, seconds } = extractDate(dateObj);
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const getTotalDaysInMonth = (date) => {
    let monthNumber = null;
    let year = null;

    if(isDateObject(date)) {
        monthNumber = date.getMonth() + 1;
        year = date.getFullYear();
    } else if(Number.isInteger(date)) {
        monthNumber = date;
        year = (new Date()).getFullYear();
    } else {
        throw new Error(`the args[0] should be a <Date> date or <int>monthNumber, ${ date } given`);
    }

    const lastDayOfMonth = new Date(year, monthNumber, 0);
    const totalDays = lastDayOfMonth.getDate();
    return totalDays;
}

const getDatesDiff = (date1, date2) => {
    if(!isDateObject(date1) || !isDateObject(date2))
        return null;

    const diffInMs = Math.abs(date2 - date1);
    const diffDate = new Date(diffInMs);
    return {
        year: diffDate.getUTCFullYear() - 1970,
        month: diffDate.getUTCMonth(),
        day: diffDate.getUTCDate() - 1,
        hours: diffDate.getUTCHours(),
        minutes: diffDate.getUTCMinutes(),
        seconds: diffDate.getUTCSeconds() + (diffDate.getUTCMilliseconds() / 1000)
    };

};

const toDatesDiffString = (date1, date2, defaultText = "null") => {
    const dateDiff = getDatesDiff(date1, date2);
    if(!dateDiff)
        return defaultText;
    const results = [];

    if(dateDiff.year || dateDiff.month) {
        const yearDecimal = ((dateDiff.year * 12) + dateDiff.month) / 12;
        let [baseYearStr, decYearStr] = yearDecimal.toFixed(2).split(".");
        if(decYearStr === "00")
            decYearStr = "";
        else if(decYearStr.slice(1) === "0")
            decYearStr = `.${ decYearStr.slice(0, 1) }`;
        else
            decYearStr = `.${ decYearStr }`;
        results.push(`${ baseYearStr }${ decYearStr }y`)
    }

    if(dateDiff.day) results.push(`${ dateDiff.day }d`);
    if(dateDiff.hours) results.push(`${ dateDiff.hours }h`);
    if(dateDiff.minutes) results.push(`${ dateDiff.minutes }m`);
    if(dateDiff.seconds) results.push(`${ dateDiff.seconds }s`);

    return results.length > 0 ? results.join(" ") : "0s";
};

module.exports = { isDateObject, extractDate, toDatetimeString, getDatesDiff, toDatesDiffString };