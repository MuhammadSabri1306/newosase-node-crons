class Model {

    constructor(rules) {
        this.rules = rules;
        this.data = null;
    }

    isList() {
        return Array.isArray(this.data);
    }

    set(data) {
        const rules = this.rules;
        try {
            if(!Array.isArray(data)) {
                this.data = {};
                for(let key in rules) {
                    if(!rules[key].nullable) {
                        if(data[key] === null || data[key] === undefined)
                            throw new Error(`'${ key }' is not nullable, given:${ data[key] }`);
                    }
                    if(data[key] === null || data[key] === undefined)
                        this.data[key] = null;
                    else if(rules[key].type === Boolean)
                        this.data[key] = data[key] == 1;
                    else
                        this.data[key] = rules[key].type(data[key]);
                }
                return;
            }
    
            this.data = data.map(row => {
                const item = {};
                for(let key in rules) {
                    if(!rules[key].nullable) {
                        if(row[key] === null || row[key] === undefined)
                            throw new Error(`'${ key }' is not nullable, given:${ row[key] }`);
                    }
                    if(row[key] === null || row[key] === undefined)
                        item[key] = null;
                    else if(rules[key].type === Boolean)
                        item[key] = row[key] == 1;
                    else
                        item[key] = rules[key].type(row[key]);
                }
                return item;
            });
        } catch(err) {
            throw new Error(`Error in ${ this.constructor.name }, ${ err.message }`);
        }
    }

    get() { return this.data; }

}

module.exports.Model = Model;

class WitelModel extends Model {
    constructor() {
        super({
            id: { nullable: false, type: Number },
            witel_name: { nullable: false, type: String },
            witel_code: { nullable: true, type: String },
            regional_id: { nullable: false, type: Number },
            timestamp: { nullable: false, type: String },
        });
    }
}

module.exports.WitelModel = WitelModel;
module.exports.useWitelModel = (data = null) => {
    const model = new WitelModel();
    if(data) model.set(data);
    return model;
};

class RtuModel extends Model {
    constructor() {
        super({
            id: { nullable: false, type: Number },
            uuid: { nullable: true, type: String },
            name: { nullable: false, type: String },
            sname: { nullable: false, type: String },
            location_id: { nullable: false, type: Number },
            datel_id: { nullable: false, type: Number },
            witel_id: { nullable: false, type: Number },
            regional_id: { nullable: false, type: Number },
            timestamp: { nullable: false, type: String },
        });
    }
}

module.exports.RtuModel = RtuModel;
module.exports.useRtuModel = (data = null) => {
    const model = new RtuModel();
    if(data) model.set(data);
    return model;
};

class GroupUserModel extends Model {
    constructor() {
        super({
            id: { nullable: false, type: Number },
            chat_id: { nullable: false, type: String },
            user_id: { nullable: false, type: String },
            username: { nullable: true, type: String },
            first_name: { nullable: true, type: String },
            last_name: { nullable: true, type: String },
            type: { nullable: false, type: String },
            is_pic: { nullable: false, type: Boolean },
            regist_id: { nullable: false, type: Number },
            pic_regist_id: { nullable: true, type: Number },
            level: { nullable: false, type: String },
            regional_id: { nullable: true, type: Number },
            witel_id: { nullable: true, type: Number },
            created_at: { nullable: false, type: String },
            updated_at: { nullable: true, type: String },
            mode_id: { nullable: false, type: Number },
            rules: { nullable: false, type: String },
        });
    }
}

module.exports.GroupUserModel = GroupUserModel;
module.exports.useGroupUserModel = (data = null) => {
    const model = new GroupUserModel();
    if(data) model.set(data);
    return model;
};

class PicUserModel extends Model {
    constructor() {
        super({
            id: { nullable: false, type: Number },
            user_id: { nullable: false, type: String },
            type: { nullable: false, type: String },
            username: { nullable: true, type: String },
            first_name: { nullable: true, type: String },
            last_name: { nullable: true, type: String },
            full_name: { nullable: true, type: String },
            location_id: { nullable: false, type: Number },
            mode_id: { nullable: false, type: Number },
            rules: { nullable: false, type: String },
            witel_id: { nullable: false, type: Number },
            regional_id: { nullable: false, type: Number },
        });
    }
}

module.exports.PicUserModel = PicUserModel;
module.exports.usePicUserModel = (data = null) => {
    const model = new PicUserModel();
    if(data) model.set(data);
    return model;
};

class AlarmModel extends Model {
    constructor() {
        super({
            id: { nullable: false, type: Number },
            port_no: { nullable: false, type: String },
            port_name: { nullable: true, type: String },
            port_value: { nullable: true, type: Number },
            port_unit: { nullable: false, type: String },
            port_severity: { nullable: false, type: String },
            port_description: { nullable: true, type: String },
            type: { nullable: true, type: String },
            location: { nullable: false, type: String },
            rtu_sname: { nullable: false, type: String },
            is_closed: { nullable: false, type: Boolean },
            opened_at: { nullable: false, type: String },
            closed_at: { nullable: true, type: String },
            location_id: { nullable: false, type: Number },
            datel_id: { nullable: false, type: Number },
            witel_id: { nullable: false, type: Number },
            regional_id: { nullable: false, type: Number },
        });
    }
}

module.exports.AlarmModel = AlarmModel;
module.exports.useAlarmModel = (data = null) => {
    const model = new AlarmModel();
    if(data) model.set(data);
    return model;
};