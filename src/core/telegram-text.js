class TelegramText {

    constructor(text = "") {
        this.$text = `${ text }`;
    }

    static create(text = "") {
        return new TelegramText(text);
    }

    get() {
        return this.$text;
    }

    escapeText(text) {
        const escapedChars = ["_", "*", "`", "["];
        const regex = new RegExp(`[${ escapedChars.join("\\") }]`, "g");
        return text.replace(regex, '\\$&');
    }

    addText(text, escapeText = true) {
        if(escapeText)
            this.$text = this.$text + this.escapeText(`${ text }`);
        else
            this.$text = this.$text + `${ text }`;
        return this;
    }

    addLine(count = 1) {
        for(let i=1; i<=count; i++) {
            this.$text = this.$text + "\n";
        }
        return this;
    }

    startBold() { return this.addText("*", false); }
    endBold() { return this.addText("*", false); }
    addBold(text, escapeText = true) { return this.startBold().addText(text, escapeText).endBold(); }

    startItalic() { return this.addText("___", false); }
    endItalic() { return this.addText("___", false); }
    addItalic(text, escapeText = true) { return this.startItalic().addText(text, escapeText).endItalic(); }

    startStrike() { return this.addText("~~", false); }
    endStrike() { return this.addText("~~", false); }
    addStrike(text, escapeText = true) { return this.startStrike().addText(text, escapeText).endStrike(); }

    startCode() { return this.addText("```", false).addLine(); }
    endCode() { return this.addText("```", false); }
    addCode(text, escapeText = true) { return this.startCode().addText(text, escapeText).endCode(); }

    addSpace(count = 1) {
        for(let i=1; i<=count; i++) {
            this.$text = this.$text + "\s";
        }
        return this;
    }

    addTabspace() { return this.addSpace(8); }

    addUrl(url, text) {
        return this.addText(`[${ text }](${ url })`, false);
    }

    addMentionByUsername(username) {
        return this.addText(`[@${ username }](https://t.me/${ username })`, false);
    }

    addMentionByUserId(userId, name) {
        return this.addText(`[${ name }](tg://user?id=${ userId })`, false);
    }

}

module.exports = TelegramText;