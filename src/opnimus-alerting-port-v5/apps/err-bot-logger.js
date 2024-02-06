const { Telegraf } = require("telegraf");
const botConfig = require("../../env/bot/opnimus-new-bot");
const { toDatetimeString } = require("../../helpers/date");

class ErrorLogger {

    constructor(key, name) {
        this.key = key;
        this.name = name;
        this.msgText = "";
        this.bot = new Telegraf(botConfig.token);
    }

    catch(err) {
        const title = `*${ this.name }* from [@${ botConfig.username }](https://t.me/${ botConfig.username })`;
        const descr = err.message;
        const stack = err.stack
            .toString()
            .split("\n")
            .slice(1)
            .map(line => "  "+line.trimStart())
            .join("\n");
    
        const dateTimeStr = toDatetimeString(new Date());
        const footer = `#mybotlogger #nodeerror #${ this.key } ${ dateTimeStr }`;

        this.msgText = `${ title }\n\n${ descr }\`\`\`\n${ stack }\`\`\`\n\n${ footer }`;
        return this;
    }

    async logTo(chatId) {
        try {
            await this.bot.telegram.sendMessage(chatId, this.msgText, { parse_mode: "Markdown" });
        } catch(err) {
            console.error(err);
        }
    }
}

module.exports.ErrorLogger = ErrorLogger;