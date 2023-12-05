const cron = require("node-cron");
const JobQueue = require("../core/job-queue");
const logger = require("./logger");
const dbConfig = require("../env/database");
const { useHttp } = require("./http");
const { toDatetimeString } = require("../helpers/date");
const { InsertQueryBuilder } = require("../helpers/mysql-query-builder");
const { createDbPool, closePool, executeQuery, createQuery } = require("../core/mysql");

// const
module.exports.main = async () => {
    logger.info("App is starting");


    const currDate = new Date();
    const processDateStr = toDatetimeString(currDate);

    logger.info("Creating a database connection");
    const pool = createDbPool({
        ...dbConfig.opnimusNewMigrated,
        multipleStatements: true
    });

    try {

        const startDate = new Date(currDate);
        startDate.setDate(startDate.getDate() - 2);
        startDate.setHours(23, 0, 0, 0);

        const endDate = new Date(currDate);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 0, 0, 0);

        const getConvQueryStr = createQuery(
            "SELECT * FROM conversation WHERE status=? AND created_at BETWEEN ? AND ?",
            [ "active", toDatetimeString(startDate), toDatetimeString(endDate) ]
        );
        
        logger.info("Get active conversations, query:"+getConvQueryStr);
        const { results: conversationList } = await executeQuery(pool, getConvQueryStr);

        if(conversationList.length < 1) {

            logger.info("Active conversations is empty");

        } else {
            
            logger.info("Create update query");
            const cancelConvQueries = conversationList.map(item => {
                const queryStr = createQuery(
                    "UPDATE conversation SET status=?, updated_at=? WHERE id=?;",
                    [ "cancel", processDateStr, item.id ]
                );
                logger.info("Push update query item, query:" + queryStr);
                return queryStr;
            });
            
            const cancelConvQueryStr = cancelConvQueries.join(" ");
            logger.info("Update active conversation status to be 'cancel'");
            await executeQuery(pool, cancelConvQueryStr);

        }

    } catch(err) {
        logger.error(err);
    } finally {
        await closePool(pool);
        logger.info("App has closed");
    }
};

const runCron = async () => {
    const startTime = toDatetimeString(new Date());
    console.info(`\n\nRunning cron Opnimus Conversation Checker at ${ startTime }`);
    try {
        await this.main();
        const endTime = toDatetimeString(new Date());
        console.info(`\n\nCron Opnimus Conversation Checker closed at ${ endTime }`);
    } catch(err) {
        console.error(err);
        const endTime = toDatetimeString(new Date());
        console.info(`\n\nCron Opnimus Conversation Checker closed at ${ endTime }`);
    }
};

/*
 * Opnimus Alerting Port
 * Runs on 01:00 o'clock everyday
 */
cron.schedule("0 1 * * *", runCron);