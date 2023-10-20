const configBot = require("../env/bot/opnimus-new-bot");
const { useTelegramBot } = require("../core/telegram-bot");

module.exports.config = configBot;

module.exports.useOpnimusNewBot = useTelegramBot({
    username: configBot.username,
    token: configBot.token,
    request: {

        async sendMessage(chatId, messageText, options = {}) {
            try {
                await this.getBot().telegram.sendMessage(chatId, messageText, options);
                return { success: true };
            } catch(error) {
                return { success: false, error };
            }
        }

    }
})