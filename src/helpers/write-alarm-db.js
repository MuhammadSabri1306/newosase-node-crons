const Database = require("./newosase/database");
const { toDatetimeString } = require("./date");

class InsertQueryBuilder
{
    constructor(tableName) {
        this.tableName = tableName;
        this.fields = [];
        this.rows = [];
    }

    addFields(name) {
        this.fields.push(name);
    }

    appendRow(row) {
        this.rows.push(row);
    }

    getQuery() {
        const queryFields = this.fields.join(", ");
        const queryBindMarks = this.rows
            .map(() => {
                return "(" + this.fields.map(() => "?").join(", ") + ")";
            })
            .join(", ");

        return `INSERT INTO ${ this.tableName } (${ queryFields }) VALUES ${ queryBindMarks }`;
    }

    getBuiltBindData() {
        const data = [];
        this.rows.forEach(row => {
            row.forEach(item => data.push(item));
        });
        return data;
    }
}

// const writeNewAlarm = async (alarmList) => {
//     if(alarmList.length < 1)
//         return;
    
//     const db = new Database();
//     const queryDbPort = new InsertQueryBuilder('rtu_port_status');
//     queryDbPort.addFields('rtu_code');
//     queryDbPort.addFields('port');
//     queryDbPort.addFields('port_name');
//     queryDbPort.addFields('value');
//     queryDbPort.addFields('unit');
//     queryDbPort.addFields('rtu_status');
//     queryDbPort.addFields('start_at');
//     queryDbPort.addFields('state');
//     queryDbPort.addFields('location');
//     queryDbPort.addFields('regional_id');
    
//     const currDateTime = toDatetimeString(new Date());

//     alarmList.forEach(item => {
//         queryDbPort.appendRow([item.rtu_sname, item.no_port, item.port_name, (item.value || 0), item.units, item.rtu_status,
//             currDateTime, 1, item.location, item.regional_id]);
//     });

//     const resultDbPort = await db.runQuery({
//         query: queryDbPort.getQuery(),
//         bind: queryDbPort.getBuiltBindData(),
//         autoClose: false
//     });

//     let results = resultDbPort.results;
//     console.log(results.affectedRows);

//     const queryDbMsg = new InsertQueryBuilder("rtu_port_message");
//     queryDbMsg.addFields("status_id");
//     queryDbMsg.addFields("created_at");

//     for(let statusId=results.insertId; statusId<(results.insertId + results.affectedRows); statusId++) {
//         queryDbMsg.appendRow([statusId, currDateTime]);
//     }

//     const resultDbMsg = await db.runQuery({
//         query: queryDbMsg.getQuery(),
//         bind: queryDbMsg.getBuiltBindData()
//     });

//     results = resultDbMsg.results;
//     console.log(results.affectedRows);
// };

const writeNewAlarm = async (alarmList) => {
    if(alarmList.length < 1)
        return;
    
    const db = new Database();
    const queryDbPort = new InsertQueryBuilder('rtu_port_status');
    queryDbPort.addFields('rtu_code');
    queryDbPort.addFields('port');
    queryDbPort.addFields('port_name');
    queryDbPort.addFields('value');
    queryDbPort.addFields('unit');
    queryDbPort.addFields('rtu_status');
    queryDbPort.addFields('start_at');
    queryDbPort.addFields('state');
    queryDbPort.addFields('location');
    queryDbPort.addFields('regional_id');
    
    const currDateTime = toDatetimeString(new Date());
    let openedAlarm = 0;
    alarmList.forEach(item => {
        const isSeverityNormal = item.severity.id === 1;
        if(!isSeverityNormal)
            openedAlarm++;
        queryDbPort.appendRow([item.rtu_sname, item.no_port, item.port_name, (item.value || 0), item.units, item.rtu_status,
            currDateTime, !isSeverityNormal, item.location, item.regional_id]);
    });

    const resultDbPort = await db.runQuery({
        query: queryDbPort.getQuery(),
        bind: queryDbPort.getBuiltBindData(),
        autoClose: false
    });

    if(openedAlarm < 1)
        return;
    let results = resultDbPort.results;

    const queryDbMsg = new InsertQueryBuilder("rtu_port_message");
    queryDbMsg.addFields("status_id");
    queryDbMsg.addFields("created_at");

    let portStatusId = results.insertId;
    const maxPortStatusId = results.insertId + results.affectedRows;
    alarmList.forEach(item => {
        if(portStatusId >= maxPortStatusId)
            return;
        queryDbMsg.appendRow([portStatusId, currDateTime]);
        portStatusId++;
    });

    // for(let statusId=results.insertId; statusId<(results.insertId + results.affectedRows); statusId++) {
    //     queryDbMsg.appendRow([statusId, currDateTime]);
    // }

    const resultDbMsg = await db.runQuery({
        query: queryDbMsg.getQuery(),
        bind: queryDbMsg.getBuiltBindData()
    });

    // results = resultDbMsg.results;
    // console.log(results.affectedRows);
};

const writeNewMessage = async (alarmList) => {
    if(alarmList.length < 1)
        return;

    const queryDbMsg = new InsertQueryBuilder("rtu_port_message");
    queryDbMsg.addFields("status_id");
    queryDbMsg.addFields("created_at");

    const currDateTime = toDatetimeString(new Date());
    alarmList.forEach(item => {
        queryDbMsg.appendRow([item.portStatusId, currDateTime]);
    });

    const db = new Database();
    await db.runQuery({
        query: queryDbMsg.getQuery(),
        bind: queryDbMsg.getBuiltBindData()
    });
};

const closePortState = async (alarmList) => {
    // if(alarmList.length < 1)
    //     return;

    const currDateTime = toDatetimeString(new Date());
    const portIds = alarmList
        .map(item => item.portStatusId);

    const db = new Database();
    await db.runQuery({
        query: "UPDATE rtu_port_status SET state=0, end_at=? WHERE id IN (?)",
        bind: [currDateTime, portIds]
    });
    console.log(db.query);
};

module.exports = { writeNewAlarm, writeNewMessage, closePortState };