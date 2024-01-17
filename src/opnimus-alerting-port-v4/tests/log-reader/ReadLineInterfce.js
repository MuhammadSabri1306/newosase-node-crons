const EventEmitter = require("events");

class ReadLineInterface {

    constructor(rl, maxTempLine = 100) {
        this.$rl = rl;
        this.$maxTempLine = maxTempLine;
        this.$events = new EventEmitter();
    }

    setTempMaxLine(maxTempLine) { this.$maxTempLine = maxTempLine; }

    onStart(callback) { this.$events.on("start", callback); }

    onLine(callback) { this.$events.on("readline", callback); }

    onClose(callback) { this.$events.on("close", callback); }

    async startReading() {
        let lineNumber = 0;
        const rl = this.$rl;
        const tempLines = [];

        this.$events.emit("start");
        rl.on("line", line => {

            lineNumber++;

            if(tempLines.length >= this.$maxTempLine)
                tempLines.shift();
            tempLines.push(line);

            this.$events.emit("readline", {
                rl,
                lines: tempLines,
                line,
                lineNumber
            });

        });

        await EventEmitter.once(rl, "close");
        this.$events.emit("close", { lineNumber });
    }
}

module.exports = ReadLineInterface;