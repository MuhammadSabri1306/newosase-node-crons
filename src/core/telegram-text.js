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

    addText(text) {
        this.$text = this.$text + `${ text }`;
        return this;
    }

    addLine(count = 1) {
        for(let i=1; i<=count; i++) {
            this.$text = this.$text + "\n";
        }
        return this;
    }

    startBold() { return this.addText("*"); }
    endBold() { return this.addText("*"); }
    addBold(text) { return this.startBold().addText(text).endBold(); }

    startItalic() { return this.addText("___"); }
    endItalic() { return this.addText("___"); }
    addItalic(text) { return this.startItalic().addText(text).endItalic(); }

    startStrike() { return this.addText("~~"); }
    endStrike() { return this.addText("~~"); }
    addStrike(text) { return this.startStrike().addText(text).endStrike(); }

    startCode() { return this.addText("```").addLine(); }
    endCode() { return this.addText("```"); }
    addCode(text) { return this.startCode().addText(text).endCode(); }

    addSpace(count = 1) {
        for(let i=1; i<=count; i++) {
            this.$text = this.$text + "\s";
        }
        return this;
    }

    addTabspace() { return this.addSpace(8); }

    addUrl(url, text) {
        return this.addText(`[${ text }](${ url })`);
    }

    addMentionByUsername(username) {
        return this.addText(`[@${ username }](https://t.me/${ username })`);
    }

    addMentionByUserId(userId, name) {
        return this.addText(`[${ name }](tg://user?id=${ userId })`);
    }

}

module.exports = TelegramText;