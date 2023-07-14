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

class SelectQueryBuilder
{
    constructor(tableName) {
        this.tableName = tableName;
        this.joinTables = [];
        this.fields = [];
        this.whereQueries = [];
        this.groupField = [];
        this.bind = [];
    }

    addFields(name) {
        this.fields.push(name);
    }

    join(tableName, bridgeQuery, joinOperator = "JOIN") {
        this.joinTables.push(`${ joinOperator } ${ tableName } ON ${ bridgeQuery }`);
    }

    where(queryString, bindValue = null, operator = "AND") {
        let query = this.whereQueries.length > 0 ? operator + " " + queryString : queryString;
        this.whereQueries.push(query);
        if(bindValue !== null)
            this.bind.push(bindValue);
    }

    groupBy(fieldName) {
        this.groupField.push(fieldName);
    }

    getQuery() {
        const queryFields = this.fields.length > 0 ? this.fields.join(", ") : `${ this.tableName }.*`;
        let query = `SELECT ${ queryFields } FROM ${ this.tableName }`;
        
        if(this.joinTables.length > 0) {
            const queryJoin = this.joinTables.join(" ");
            query += " " + queryJoin;
        }
        
        if(this.whereQueries.length > 0) {
            const queryWhere = this.whereQueries.join(" ");
            query += " WHERE " + queryWhere;
        }
        
        if(this.groupField.length > 0) {
            const queryGroup = this.groupField.join(", ");
            query += " GROUP BY " + queryGroup;
        }

        return query;
    }

    getBuiltBindData() {
        return this.bind;
    }
}

module.exports = { InsertQueryBuilder, SelectQueryBuilder };