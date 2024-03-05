const { catchRetryTime } = require("../../helpers/telegram-error");

const testCase1 = () => {
    const errDescr = "Too Many Requests: retry after 42";
    const result = catchRetryTime(errDescr);
    console.log(result * 1000 / 60 / );
};

testCase1();