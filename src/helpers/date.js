const isDateObject = dateObj => dateObj && typeof dateObj.getFullYear === "function";

const extractDate = dateObj => {
    if(!isDateObject(dateObj))
        return null;
    return {
        year: dateObj.getFullYear(),
        month: String(dateObj.getMonth() + 1).padStart(2, '0'),
        day: String(dateObj.getDate()).padStart(2, '0'),
        hours: String(dateObj.getHours()).padStart(2, '0'),
        minutes: String(dateObj.getMinutes()).padStart(2, '0'),
        seconds: String(dateObj.getSeconds()).padStart(2, '0'),
    };
};

const toDatetimeString = dateObj => {
    if(!isDateObject(dateObj))
        return null;
    const { year, month, day, hours, minutes, seconds } = extractDate(dateObj);
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

module.exports = { isDateObject, extractDate, toDatetimeString };