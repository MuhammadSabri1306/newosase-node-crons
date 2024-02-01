const { useSequelize, useModel } = require("../apps/models");
const dbOpnimusNewConfig = require("../../env/database/opnimus-new-migrated-2");

const getSequelize = () => {
    const onlineSequelize = useSequelize(dbOpnimusNewConfig);
    const localSequelize = useSequelize({
        host: "localhost",
        database: dbOpnimusNewConfig.database,
        user: "root",
        password: ""
    });
    return { onlineSequelize, localSequelize };
};

const cloneModelData = async ({ srcModel, destModel }) => {
    const srcData = srcModel.map(srcModel => srcModel.dataValues);
    await destModel.bulkCreate(srcData);
};

const cloneWitel = async () => {

    const { onlineSequelize, localSequelize } = getSequelize();

    const { Witel: OnlineWitel } = useModel(onlineSequelize);
    const onlineWitels = await OnlineWitel.findAll();

    const { Witel: LocalWitel } = useModel(localSequelize);
    await cloneModelData({
        srcModel: onlineWitels,
        destModel: LocalWitel
    });

    await onlineSequelize.close();
    await localSequelize.close();

};

const cloneRtu = async () => {

    const { onlineSequelize, localSequelize } = getSequelize();

    const { Rtu: OnlineRtu } = useModel(onlineSequelize);
    const onlineRtus = await OnlineRtu.findAll();

    const { Rtu: LocalRtu } = useModel(localSequelize);
    await cloneModelData({
        srcModel: onlineRtus,
        destModel: LocalRtu
    });

    await Promise.all([
        onlineSequelize.close(),
        localSequelize.close()
    ]);

};

const cloneAlertModes = async () => {

    const { onlineSequelize, localSequelize } = getSequelize();

    const { AlertModes: OnlineAlertModes } = useModel(onlineSequelize);
    const onlineAlertModess = await OnlineAlertModes.findAll();

    const { AlertModes: LocalAlertModes } = useModel(localSequelize);
    await cloneModelData({
        srcModel: onlineAlertModess,
        destModel: LocalAlertModes
    });

    await Promise.all([
        onlineSequelize.close(),
        localSequelize.close()
    ]);

};

const cloneLocation = async () => {

    const { onlineSequelize, localSequelize } = getSequelize();

    const { Location: OnlineLocation } = useModel(onlineSequelize);
    const onlineLocations = await OnlineLocation.findAll();

    const { Location: LocalLocation } = useModel(localSequelize);
    await cloneModelData({
        srcModel: onlineLocations,
        destModel: LocalLocation
    });

    await Promise.all([
        onlineSequelize.close(),
        localSequelize.close()
    ]);

};

const cloneTelegramUser = async () => {

    const { onlineSequelize, localSequelize } = getSequelize();

    const { TelegramUser: OnlineTelegramUser } = useModel(onlineSequelize);
    const onlineTelegramUsers = await OnlineTelegramUser.findAll();

    const { TelegramUser: LocalTelegramUser } = useModel(localSequelize);
    await cloneModelData({
        srcModel: onlineTelegramUsers,
        destModel: LocalTelegramUser
    });

    await Promise.all([
        onlineSequelize.close(),
        localSequelize.close()
    ]);

};

const cloneTelegramPersonalUser = async () => {

    const { onlineSequelize, localSequelize } = getSequelize();

    const { TelegramPersonalUser: OnlineTelegramPersonalUser } = useModel(onlineSequelize);
    const onlineTelegramPersonalUsers = await OnlineTelegramPersonalUser.findAll();

    const { TelegramPersonalUser: LocalTelegramPersonalUser } = useModel(localSequelize);
    await cloneModelData({
        srcModel: onlineTelegramPersonalUsers,
        destModel: LocalTelegramPersonalUser
    });

    await Promise.all([
        onlineSequelize.close(),
        localSequelize.close()
    ]);

};

const cloneAlertUsers = async () => {

    const { onlineSequelize, localSequelize } = getSequelize();

    const { AlertUsers: OnlineAlertUsers } = useModel(onlineSequelize);
    const onlineAlertUserss = await OnlineAlertUsers.findAll();

    const { AlertUsers: LocalAlertUsers } = useModel(localSequelize);
    await cloneModelData({
        srcModel: onlineAlertUserss,
        destModel: LocalAlertUsers
    });

    await Promise.all([
        onlineSequelize.close(),
        localSequelize.close()
    ]);

};

const clonePicLocation = async () => {

    const { onlineSequelize, localSequelize } = getSequelize();

    const { PicLocation: OnlinePicLocation } = useModel(onlineSequelize);
    const onlinePicLocations = await OnlinePicLocation.findAll();

    const { PicLocation: LocalPicLocation } = useModel(localSequelize);
    await cloneModelData({
        srcModel: onlinePicLocations,
        destModel: LocalPicLocation
    });

    await Promise.all([
        onlineSequelize.close(),
        localSequelize.close()
    ]);

};

const cloneRegional = async () => {

    const { onlineSequelize, localSequelize } = getSequelize();

    const { Regional: OnlineRegional } = useModel(onlineSequelize);
    const onlineRegionals = await OnlineRegional.findAll();

    const { Regional: LocalRegional } = useModel(localSequelize);
    await cloneModelData({
        srcModel: onlineRegionals,
        destModel: LocalRegional
    });

    await Promise.all([
        onlineSequelize.close(),
        localSequelize.close()
    ]);

};

// cloneWitel();
// cloneRtu();
// cloneAlertModes();
// cloneLocation();
// cloneTelegramUser();
// cloneTelegramPersonalUser();
// cloneAlertUsers();
// clonePicLocation();
// cloneRegional();