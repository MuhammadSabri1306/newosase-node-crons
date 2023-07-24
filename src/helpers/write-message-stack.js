const getPortStatusById = require("./db-query/get-port-status-by-id");
const getAlertUserOnWitel = require("./db-query/get-alert-user-on-witel");
const storePortMessage = require("./db-query/store-port-message");
const { logger } = require("./logger");

const writeStack = async (portId, chatId) => {
    try {
        await storePortMessage(portId, chatId);
    } catch(err) {
        logger.error(err);
    }
};

module.exports = async (portIdList, regionalId, witelId, jobQueueNumber) => {
    try {

        const alertPort = await getPortStatusById(portIdList);
        const userList = await getAlertUserOnWitel(regionalId, witelId);

        for(let i=0; i<alertPort.length; i++) {
            for(let j=0; j<userList.length; j++) {
                await writeStack(alertPort[i].id, userList[j].chat_id);
            }
        }

        return true;

    } catch(err) {
        logger.log(`Failed to write alert on queue: ${ jobQueueNumber }`);
        logger.error(err);
        return false;
    }
};