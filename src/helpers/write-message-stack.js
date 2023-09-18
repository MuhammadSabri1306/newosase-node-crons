const getPortStatusById = require("./db-query/get-port-status-by-id");
const getAlertUserOnWitel = require("./db-query/get-alert-user-on-witel");
const storePortMessage = require("./db-query/store-port-message");
const getPicUserOnLoc = require("./db-query/get-pic-user-on-loc");
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

        const portLocIds = alertPort
            .map(port => port.location_id)
            .reduce((portIds, portId) => {
                if(!portIds.includes(portId))
                    portIds.push(portId);
                return portIds;
            }, []);

        const userPicList = await getPicUserOnLoc(portLocIds);
        let alertedPortUserId = [];

        for(let i=0; i<alertPort.length; i++) {

            alertedPortUserId = [];

            // write alert for User and Group
            for(let j=0; j<userList.length; j++) {
                await writeStack(alertPort[i].id, userList[j].chat_id);
                alertedPortUserId.push(userList[j].id);
            }

            // exclude pic when has alerted before
            const alertedPicList = userPicList.filter(user => {
                return alertedPortUserId.indexOf(user.id) < 0;
            });

            // write alert for PIC User
            for(let k=0; k<alertedPicList.length; k++) {
                if(alertedPicList[k].location_id == alertPort[i].location_id)
                    await writeStack(alertPort[i].id, alertedPicList[k].chat_id);
            }

        }

        return true;

    } catch(err) {
        logger.log(`Failed to write alert on queue: ${ jobQueueNumber }`);
        logger.error(err);
        return false;
    }
};