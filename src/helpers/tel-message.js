class TelMessage
{
    constructor(text = null) {
        this.lines = [];
        if(text)
            this.lines.push(text);
    }

    addLine(text = "") {
        this.lines.push(text);
    }

    getMessage() {
        return this.lines.join("\n");
    }

    toCodeFormat() {
        const text = this.getMessage();
        return "```\n" + text + "\n```";
    }

    static toBoldText(text) {
        return "*" + text + "*";
    }

    static toItalicText(text) {
        return "_" + text + "_";
    }

    static toUrl(text, url) {
        return `[${ text }](${ url })`;
    }
}

module.exports = TelMessage;