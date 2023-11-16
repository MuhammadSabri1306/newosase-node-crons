const cron = require("node-cron");
const mysql = require("mysql");
const logger = require("./logger");
const dbConfig = require("../env/database");
const { useHttp } = require("./http");
const { toDatetimeString } = require("../helpers/date");
const { InsertQueryBuilder } = require("../helpers/mysql-query-builder");

const runDbQuery = (pool, ...args) => {
    return new Promise((resolve, reject) => {

        const callback = (conn, err, results) => {
            if(err) {
                reject(err);
                return;
            }
            resolve(results);
        };

        pool.getConnection((err, conn) => {
            if(err) {
                reject(err);
                return;
            }
            
            conn.release();
            if(args.length > 2)
                conn.query(args[0], args[1], (err, results) => callback(conn, err, results));
            else if(args.length > 1)
                conn.query(args[0], args[1], (err, results) => callback(conn, err, results));
            else
                conn.query(args[0], (err, results) => callback(conn, err, results));
        });

    });
};

const createDbPools = database => {
    logger.info("Creating a database connection");
    const poolDbOld = mysql.createPool({
        host: "10.60.164.18",
        user: "admindb",
        password: "@Dm1ndb#2020",
        database
    });
    const poolDbNew = mysql.createPool({
        host: "10.62.175.4",
        user: "admapp",
        password: "4dm1N4Pp5!!",
        database
    });
    return { poolDbOld, poolDbNew }
};

const closeDbPoolsConnection = (poolDbOld, poolDbNew, callback) => {
    poolDbOld.end(() => {
        poolDbNew.end(callback);
    });
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