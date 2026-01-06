export class Animator {
    constructor(frames, fps) {
        this.frames = frames;
        this.fps = fps;
        this.currentFrame = 0;
        this.interval = null;
        this.frameCallback = null;
    }

    onFrame(callback) {
        this.frameCallback = callback;
    }

    start() {
        if (this.interval) return; // Already running

        this.interval = setInterval(() => {
            if (this.frameCallback) {
                this.frameCallback(this.frames[this.currentFrame]);
            }
            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
        }, 1000 / this.fps);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}
