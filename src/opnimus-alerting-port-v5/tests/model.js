const { useSequelize, useModel } = require("../apps/models");
const { Op } = require("sequelize");
const dbOpnimusNewConfig = require("../../env/database/opnimus-new-migrated-2");

const main = async () => {

    const sequelize = useSequelize({
        host: "localhost",
        database: dbOpnimusNewConfig.database,
        user: "root",
        password: ""
    });
    // const { Rtu, AlarmHistory } = useModel(sequelize);

    // const alarms = await Alarm.findAll({
    //     include: [{
    //         model: Rtu,
    //     }]
    // });

    // alarms.forEach(alarm => {
    //     console.log(alarm.toJSON());
    // });

    // const rtus = await Rtu.findAll({
    //     include: [{
    //         model: Alarm
    //     }]
    // });
    // console.log(rtus[0].get({ plain: true }));

    // const rtu = await Rtu.findOne();
    // const alarms = await rtu.getAlarms();
    // console.log(alarms);

    // const rtus = await Rtu.findAll();
    // console.log(rtus[0] instanceof Rtu);
    
    const { AlarmHistory, TelegramUser, AlertUsers, Rtu, PicLocation, AlertStack } = useModel(sequelize);
    const [ alarms, groupUsers, picUsers ] = await Promise.all([
        AlarmHistory.findAll({
            where: {
                alarmId: { [Op.in]: [1, 2, 3] }
            },
            include: [{
                model: Rtu,
                required: true
            }]
        }),
        TelegramUser.findAll({
            where: {
                [Op.and]: [
                    { isPic: false },
                    {
                        [Op.or]: [
                            { level: "nasional" },
                            { level: "regional", regionalId: 2 },
                            { level: "witel", witelId: 43 },
                        ]
                    }
                ]
            },
            include: [{
                model: AlertUsers,
                required: true,
                where: {
                    [Op.and]: [
                        { cronAlertStatus: true },
                        { userAlertStatus: true }
                    ]
                }
            }]
        }),
        TelegramUser.findAll({
            where: {
                [Op.and]: [
                    { isPic: true },
                    {
                        [Op.or]: [
                            { level: "nasional" },
                            { level: "regional", regionalId: 2 },
                            { level: "witel", witelId: 43 },
                        ]
                    }
                ]
            },
            include: [{
                model: AlertUsers,
                required: true,
                where: {
                    [Op.and]: [
                        { cronAlertStatus: true },
                        { userAlertStatus: true }
                    ]
                }
            }, {
                model: PicLocation,
                required: true
            }]
        })
    ]);

    // alarms.forEach(item => console.log( item.get({ plain: true }) ));
    // groupUsers.forEach(item => console.log( item.get({ plain: true }) ));
    // picUsers.forEach(item => console.log( item.get({ plain: true }) ));
    console.log( groupUsers[0].get({ plain: true }) );

    await sequelize.close();

};

main();