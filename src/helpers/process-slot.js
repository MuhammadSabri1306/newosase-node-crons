class ProcessSlot
{
    constructor(slotLength) {
        this.slotLength = slotLength;
        this.slot = [];
        this.slotSuccess = 0;

        this.workList = [];
        this.nextWorkList = -1;
        this.onFinish = null;

        this.nextRunTimer = 100;
        this.errorRetryTime = 100;

        this.successCallback = null;
        this.errorCallback = null;
    }

    addWork(run, callback = {}) {
        const index = this.workList.length;
        this.workList.push({
            index,
            run,
            success: false,
            onSuccess: callback.onSuccess || null,
            onError: callback.onError || null
        });
    }

    createSlot(workIndex) {
        const currWork = this.workList[workIndex];
        const slotTempData = { runCount: 0 };

        if(typeof this.nextRunTimer != "function")
            slotTempData.nextRunTimer = this.nextRunTimer;
        if(typeof this.errorRetryTime != "function")
            slotTempData.errorRetryTime = this.errorRetryTime;

        let slotData = JSON.parse(JSON.stringify(slotTempData));
        slotData = { slotData, ...currWork };

        if(typeof this.nextRunTimer == "function")
            slotData.nextRunTimer = this.nextRunTimer;
        if(typeof this.errorRetryTime == "function")
            slotData.errorRetryTime = this.errorRetryTime;

        return slotData;
    }

    setupSlot() {
        const slotLength = this.slotLength;
        this.slotLength = 0;

        for(let i=0; i<slotLength; i++) {
            if(i < this.workList.length) {
                this.slot[i] = this.createSlot(i);
                this.slotLength++;
            }
        }
        
        this.nextWorkList = 0;
    }

    onSlotDone() {
        this.slotSuccess++;
        if(this.slotSuccess < this.slotLength)
            return;
            
        const onFinish = this.onFinish;
        if(onFinish)
            onFinish();
    }

    executeSlot(index) {
        if(this.nextWorkList < 0 || index >= this.slotLength) {
            console.log(index);
            this.onSlotDone();
            return;
        }
        
        const currSlot = this.slot[index];
        this.nextWorkList++;
        currSlot.runCount++;
        
        if(currSlot.success) {
            this.replaceSlot(index);
            return;
        }

        if(!currSlot.run) {
            this.onSlotDone();
            return;
        }
        
        currSlot
            .run()
            .then(() => {
                currSlot.success = true;
                currSlot.onSuccess && currSlot.onSuccess();
                const nextRunTimer = (typeof currSlot.nextRunTimer == "function") ? currSlot.nextRunTimer() : currSlot.nextRunTimer;
                console.log(`nextRunTimer: ${ nextRunTimer }`);
                setTimeout(() => {

                    this.slot[index].success = true;
                    this.workList[currSlot.index].success = true;

                    if(this.replaceSlot(index)) {   
                        this.executeSlot(index);
                    }

                }, nextRunTimer);
            })
            .catch(err => {
                const errorRetryTime = (typeof currSlot.errorRetryTime == "function") ? currSlot.errorRetryTime(err) : currSlot.errorRetryTime;
                currSlot.onError && currSlot.onError(err);
                
                if(currSlot.runCount <= 3) {
                    console.log(`errorRetryTime: ${ errorRetryTime }`);
                    setTimeout(() => {
                        this.executeSlot(index);
                    }, errorRetryTime);
                } else {
                    const nextRunTimer = (typeof currSlot.nextRunTimer == "function") ? currSlot.nextRunTimer() : currSlot.nextRunTimer;
                    setTimeout(() => {

                        this.slot[index].success = true;
                        this.workList[currSlot.index].success = true;
    
                        if(this.replaceSlot(index)) {   
                            this.executeSlot(index);
                        }
    
                    }, nextRunTimer);
                }
            });
    }

    replaceSlot(index) {
        if(index >= this.slotLength)
            return false;
        if(this.nextWorkList >= this.workList.length) {
            this.nextWorkList = -1;
            console.log("replaceSlot");
            this.onSlotDone();
            return false;
        }

        this.slot[index] = this.createSlot(this.nextWorkList);
        return true;
    }

    setTimer(time) {
        if(time.nextRunTimer)
            this.nextRunTimer = time.nextRunTimer;
        if(time.errorRetryTime)
            this.errorRetryTime = time.errorRetryTime;
    }

    run({ onStart, onFinish}) {
        this.onFinish = onFinish || null;
        onStart && onStart();
        this.setupSlot();

        for(let index in this.slot) {
            this.executeSlot(index);
        }
    }
}

module.exports = ProcessSlot;