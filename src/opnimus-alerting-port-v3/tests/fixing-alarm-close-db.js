const { createDbPool, closePool, executeQuery, createQuery } = require("../../core/mysql");
const dbConfig = require("../../env/database");

const getTasks = async (pool) => {
    try {
        const query = "SELECT port_no, rtu_sname, COUNT(*), is_closed FROM alarm_port_status WHERE is_closed = 0 GROUP BY port_no, rtu_sname HAVING COUNT(*) > 1";
        const { results } = await executeQuery(pool, query);
        return results;
    } catch(err) {
        console.error(err);
        return [];
    }
};

const getPortTasks = async (pool, portNo, rtuSname) => {
    if(!portNo)
        throw new Error("portNo in getPortTasks() is empty");
    if(!rtuSname)
        throw new Error("rtuSname in getPortTasks() is empty");
    try {
        let query = "SELECT * FROM alarm_port_status WHERE rtu_sname=? AND port_no=? ORDER BY id DESC";
        query = createQuery(query, [ rtuSname, portNo ]);
        const { results } = await executeQuery(pool, query);
        return results;
    } catch(err) {
        console.error(err);
        return [];
    }
};

const closePortTask = async (pool, closedAt, portId) => {
    if(!closedAt)
        throw new Error("closedAt in getPortTasks() is empty");
    if(!portId)
        throw new Error("portId in getPortTasks() is empty");
    try {
        let query = "UPDATE alarm_port_status SET is_closed=1, closed_at=? WHERE id=?";
        query = createQuery(query, [ closedAt, portId ])
        const { results } = await executeQuery(pool, query);
        return results;
    } catch(err) {
        console.error(err);
        return [];
    }
};

const deletePortAlarm = async (pool, portId) => {
    if(!portId)
        throw new Error("portId in getPortTasks() is empty");
    try {
        let query = "DELETE FROM alarm_port_status WHERE id=?";
        query = createQuery(query, [ portId ])
        const { results } = await executeQuery(pool, query);
        return results;
    } catch(err) {
        console.error(err);
        return [];
    }
};

const processTasks = async () => {

    const pool = createDbPool(dbConfig.opnimusNewMigrated2);

    let portTasks;
    let nextPort;
    let currPort;
    try {

        const tasks = await getTasks(pool);

        for(let x=0; x<tasks.length; x++) {
    
            portTasks = await getPortTasks(pool, tasks[x].port_no, tasks[x].rtu_sname);
            console.log({
                x,
                rtuSname: tasks[x].rtu_sname,
                portNo: tasks[x].port_no
            });
    
            for(let y=1; y<portTasks.length; y++) {
    
                nextPort = portTasks[y - 1];
                currPort = portTasks[y];
    
                if(!currPort.is_closed && currPort.port_severity != nextPort.port_severity) {
                    console.log({
                        y,
                        portId: currPort.id,
                        operation: "closing"
                    });
                    await closePortTask(pool, nextPort.opened_at, currPort.id);
                    
                } else if(!currPort.is_closed) {
                    console.log({
                        y,
                        portId: currPort.id,
                        operation: "deleting"
                    });
                    await deletePortAlarm(pool, currPort.id);
                } else {
                    console.log({
                        y,
                        portId: currPort.id,
                        operation: "passing"
                    });
                }
    
            }
    
        }

    } catch(err) {
        console.error(err);
    } finally {
        closePool(pool);
    }

};

processTasks();