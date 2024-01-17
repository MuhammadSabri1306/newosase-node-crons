const SftpClient = require("ssh2-sftp-client");

module.exports.useSftpClient = async (config = null) => {

    if(!config) {

        const sftpConfig = require("../../../../../../.vscode/sftp.json");
        config = {
            host: sftpConfig.host,
            port: sftpConfig.port,
            username: sftpConfig.username,
            password: sftpConfig.password,
        };

    }

    const sftp = new SftpClient();
    await sftp.connect(config);
    return sftp;

};