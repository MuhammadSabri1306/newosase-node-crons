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

module.exports = { InsertQueryBuilder };