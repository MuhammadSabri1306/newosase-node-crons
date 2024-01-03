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

const closeDbPoolsConnection = (poolDbOld, poolDbNew, callback = null) => {
    if(typeof callback == "function")
        poolDbOld.end(() => poolDbNew.end(callback));
    else
        poolDbOld.end(() => poolDbNew.end());
};

const getPoolDbName = pool => pool.config.connectionConfig.database || null;

const getTables = async (pool) => {
    logger.info(`Get all tables name from ${ getPoolDbName(pool) }`);
    try {

        const { results } = await executeQuery(pool, "SHOW TABLES");
        const tables = results.map(row => Object.values(row)[0]);
        return tables;

    } catch(err) {
        logger.error(`Failed to get tables name from ${ getPoolDbName(pool) }`, err);
        return [];
    }
};

const getTableStructure = async (pool, tableName) => {
    try {

        const { results } = await executeQuery(pool, `DESCRIBE ${ tableName }`);
        return results;

    } catch(err) {
        logger.error(`Failed to get table structure of ${ getPoolDbName(pool) }.${ tableName }`, err);
        return null;
    }
};

const getCreateTableQuery = async (pool, tableName) => {
    try {

        const { results } = await selectRowQuery(pool, `SHOW CREATE TABLE ${ tableName }`);
        for(let key in results) {
            if(key.toLowerCase() == "create table") {
                return results[key];
            }
        }

        return null;

    } catch(err) {
        return null;
    }
};

const insertTableData = async (pool, tableName, data, limit = 100) => {
    if(data.length < 1)
        return;

    let query;
    const queryFields = Object.keys(data[0]);

    let startIndex = 0;
    let endIndex = Math.min( (limit - 1), (data.length - 1) );

    while(startIndex < data.length) {
        
        query = new InsertQueryBuilder(tableName);
        queryFields.forEach(field => query.addFields(field));

        for(let index=startIndex; index<=endIndex; index++) {
            query.appendRow( queryFields.map(key => data[index][key]) );
        }

        try {
            
            logger.info(`Inserting data to ${ tableName } in rowIndex ${ startIndex }-${ endIndex }`);
            await executeQuery( pool, createQuery(query.getQuery(), query.getBuiltBindData()) );

        } catch(err) {
            logger.error(`Error when inserting data to ${ tableName } in rowIndex ${ startIndex }-${ endIndex }`, err);
        } finally{

            startIndex = startIndex + limit;
            endIndex = Math.min( (endIndex + limit), (data.length - 1) );

        }

    }
};

module.exports.syncTableStructure = async (poolSrc, poolDest, tableName) => {
    
    const tableSrc = `${ getPoolDbName(poolSrc) }.${ tableName }`;
    const tableDest = `${ getPoolDbName(poolDest) }.${ tableName }`;
    const syncInfo = `${ tableSrc } <-> ${ tableDest }`;
    logger.info(`Sync table's structure ${ syncInfo }`);
    try {

        const structSrc = await getTableStructure(poolSrc, tableName);
        const collumns = Object.keys(structSrc);
        const structDest = await getTableStructure(poolDest, tableName);

        if(structDest) {

            let isStructureMatch = true;

            for(let i=0; i<structSrc.length; i++) {
                for(let j=0; j<collumns.length; j++) {

                    if(structSrc[i][ collumns[j] ] != structDest[i][ collumns[j] ]) {
                        isStructureMatch = false;
                        j = collumns.length;
                        i = structSrc.length;
                    }

                }
            }

            if(isStructureMatch) {
                logger.info(`Table's structure of ${ syncInfo } was sychronized`);
                return true;
            } else {

                logger.info(`Table's structure of ${ syncInfo } is not match, dropping table ${ tableDest }`);
                await executeQuery(poolDest, `DROP ${ tableName }`);

            }
        }

        const createTableQueryStr = await getCreateTableQuery(poolSrc, tableName);
        logger.info(`Create new table, query:${ createTableQueryStr }`);

        await executeQuery(poolDest, createTableQueryStr);
        logger.info(`Table's structure of ${ syncInfo } was sychronized`);
        return true;


    } catch(err) {
        logger.error(`Failed to sync table's structure ${ syncInfo }`, err);
        return false;
    }
};

module.exports.syncTableData = async (poolSrc, poolDest, tableName, idField = "id") => {
    const tableSrc = `${ getPoolDbName(poolSrc) }.${ tableName }`;
    const tableDest = `${ getPoolDbName(poolDest) }.${ tableName }`;
    const syncInfo = `${ tableSrc } <-> ${ tableDest }`;
    logger.info(`Sync table's data ${ syncInfo }`);
    try {

        const getLastIdQueryStr = `SELECT ${ idField } FROM ${ tableName } ORDER BY ${ idField } DESC LIMIT 1`;
        const lastIdSrc = await selectRowCollumnQuery(poolSrc, idField, getLastIdQueryStr);
        const lastIdDest = await selectRowCollumnQuery(poolSrc, idField, getLastIdQueryStr);

        if(lastIdDest == lastIdSrc) {

            logger.info(`Table's data of ${ syncInfo } was sychronized`);
            return true;

        }

        logger.info(`Table's last id of ${ syncInfo } is not match, resetting data of table ${ tableDest }`);
        await executeQuery(poolDest, `TRUNCATE TABLE ${ tableName }`);

        logger.info(`Get all data from table ${ tableSrc }`);
        const { results } = await executeQuery(poolSrc, `SELECT * FROM ${ tableName }`);

        if(results.length > 0) {
            
            await insertTableData(poolDest, tableName, results);

        } else {
            logger.info(`Data from ${ tableSrc } is empty`);
        }

        logger.info(`Table's data of ${ syncInfo } was sychronized`);
        return true;

    } catch(err) {
        logger.error(`Failed to sync table's data ${ syncInfo }`, err);
        return false;
    }
};

module.exports.main = async () => {
    
    logger.info("App is starting");
    
    const dbOpnimusNewMigrated = JSON.parse(JSON.stringify(dbConfig.opnimusNewMigrated));
    const dbOpnimusNewMigrated2 = JSON.parse(JSON.stringify(dbConfig.opnimusNewMigrated2));
    dbOpnimusNewMigrated.database = "juan5684_opnimus_new_bot";
    dbOpnimusNewMigrated2.database = "juan5684_opnimus_new_bot";

    const poolSrc = createDbPool(dbOpnimusNewMigrated);
    const poolDest = createDbPool(dbOpnimusNewMigrated2);

    const tableNames = await getTables(poolSrc);
    let isSyncSuccess = false;

    for(let i=0; i<tableNames.length; i++) {
        
        isSyncSuccess = await this.syncTableStructure(poolSrc, poolDest, tableNames[i]);
        if(isSyncSuccess) {
            await this.syncTableData(poolSrc, poolDest, tableNames[i]);
        }

    }

    closeDbPoolsConnection(poolSrc, poolDest, () => logger.info("App is closing"));

};

const test = async () => {
    const dbOpnimusNewMigrated = JSON.parse(JSON.stringify(dbConfig.opnimusNewMigrated));
    const dbOpnimusNewMigrated2 = JSON.parse(JSON.stringify(dbConfig.opnimusNewMigrated2));
    dbOpnimusNewMigrated.database = "juan5684_opnimus_new_bot";
    dbOpnimusNewMigrated2.database = "juan5684_opnimus_new_bot";

    const poolSrc = createDbPool(dbOpnimusNewMigrated);
    const poolDest = createDbPool(dbOpnimusNewMigrated2);

    
    const tableName = "telegram_user";
    const { results } = await executeQuery(poolSrc, `SELECT * FROM ${ tableName }`);
    await insertTableData(poolDest, tableName, results, 20);

    closeDbPoolsConnection(poolSrc, poolDest);
};

/*
 * Database baru Opnimus V2 belum dapat digunakan
 */
// test();
this.main();