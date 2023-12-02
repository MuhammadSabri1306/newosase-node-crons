const cron = require("node-cron");
const logger = require("./logger");
const dbConfig = require("../env/database");
const { useHttp } = require("./http");
const { toDatetimeString } = require("../helpers/date");
const { InsertQueryBuilder } = require("../helpers/mysql-query-builder");
const { createDbPool, executeQuery, selectRowQuery,
    selectRowCollumnQuery, createQuery } = require("../core/mysql");

const createDbPools = database => {
    logger.info("Creating a database connection");
    const dbConfigOld = dbConfig.opnimusNewMigrated;
    const dbConfigNew = dbConfig.opnimusNewMigrated2;

    dbConfigOld.database = database;
    dbConfigNew.database = database;

    const poolDbOld = mysql.createPool(dbConfigOld);
    const poolDbNew = mysql.createPool(dbConfigNew);
    return { poolDbOld, poolDbNew }
};

const closeDbPoolsConnection = (poolDbOld, poolDbNew, callback) => {
    poolDbOld.end(() => poolDbNew.end(callback));
};

module.exports.main = async (database, tableName, processCode = 1) => {
    logger.info("App is starting");
    const { poolDbOld, poolDbNew } = createDbPools(database);

    try {

        if(processCode <= 1) {

            logger.info(`Empty table ${ database }.${ tableName } in new host`);
            await runDbQuery(poolDbNew, `DELETE FROM ${ tableName }`);

        }

        logger.info(`Get ${ database }.${ tableName } data from old host`);
        const data = await runDbQuery(poolDbOld, `SELECT * FROM ${ tableName }`);

        const fields = data.length > 0 ? Object.keys(data[0]) : null;
        if(data.length < 1) {
            closeDbPoolsConnection(poolDbOld, poolDbNew, () => logger.info(`Data from ${ database }.${ tableName } in old host is empty. App has closed`));
            return;
        }

        if(processCode <= 2) {

            let i = 0;
            let insertQuery;
            let rowBind;
            
            while(i < data.length) {
                
                insertQuery = new InsertQueryBuilder(tableName);
                rowBind = [];

                fields.forEach(key => {
                    insertQuery.addFields(key);
                    rowBind.push(data[i][key]);
                });

                insertQuery.appendRow(rowBind);
                logger.info(`Insert data row:${ i + 1 } id:${ data[i].id } to ${ database }.${ tableName } in new host`);
                await runDbQuery(poolDbNew, insertQuery.getQuery(), insertQuery.getBuiltBindData());

                i++;

            }

        }

        closeDbPoolsConnection(poolDbOld, poolDbNew, () => logger.info("App has closed"));
        
    } catch(err) {
        logger.error(err);
        closeDbPoolsConnection(poolDbOld, poolDbNew, () => logger.info("App has closed"));
    }

};

const runWorkList = async (database, tableList) => {
    for(let i=0; i<tableList.length; i++) {
        await this.main(database, tableList[i], 1);
    }
};

// update RunDbQuery sebelum running

// this.main("juan5684_opnimus_new", "newosase_api_token", 1);

// runWorkList("juan5684_opnimus_new", [
//     // "alert_message",
//     // "conversation",
//     // "datel",
//     // "newosase_api_token",
//     // "pic_location",
//     // "regional",
//     // "registration",
//     // "rtu_list",
//     // "rtu_location",
//     // "rtu_port_status",
//     // "telegram_admin",
//     // "telegram_alarm_error",
//     "telegram_callback_query",
//     "telegram_personal_user",
//     "telegram_user",
//     "witel"
// ]);

// this.main("juan5684_opnimus_new", "rtu_port_status", 1);

// runWorkList("juan5684_opnimus_new_bot", [
    // "callback_query",
    // "chat",
    // "chat_join_request",
    // "chat_member_updated",
    // "chosen_inline_result",
    // "conversation",
    // "edited_message",
    // "inline_query",
    // "message",
    // "poll",
    // "poll_answer",
    // "pre_checkout_query",
    // "request_limiter",
    // "shipping_query",
    // "telegram_update",
    // "user",
    // "user_chat",
// ]);