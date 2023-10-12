const { Telegraf } = require("telegraf");

class TelegramBot
{
    constructor(botUserame, botToken) {
        this.$bot = new Telegraf(botToken);
        this.$data = {
            username: botUserame
        };
    }

    getBot() {
        return this.$bot;
    }

    data(key, val = null) {
        if(val)
            this.$data[key] = val;
        return this.$data[key];
    }
}

const getAllMethods = object => {
    return Object.getOwnPropertyNames(object).filter(function(property) {
        return typeof object[property] == "function";
    });
};

const useTelegramBot = (options = {}) => {
    const caller = () => {
        const botUserame = options.username || null;
        const botToken = options.token || null;

        const telegramBot = {
            $bot: new Telegraf(botToken),

            $data: {
                username: botUserame
            },

            getBot() {
                return this.$bot;
            },
        
            data(key, val = null) {
                if(val)
                    this.$data[key] = val;
                return this.$data[key];
            }
        };

        if(options.request) {
            getAllMethods(options.request).forEach(func => telegramBot[func] = options.request[func]);
        }

        return telegramBot;
    };
    return caller;
};

module.exports = { TelegramBot, useTelegramBot };