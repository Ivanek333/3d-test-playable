type EasingFunction = (t: number) => number;

export const linear = (t: number) => t;

export const easeInQuad = (t: number) => t * t;
export const easeOutQuad = (t: number) => t * (2 - t);
export const easeInOutQuad = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

export const easeInCubic = (t: number) => t * t * t;
export const easeOutCubic = (t: number) => (--t) * t * t + 1;
export const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

export const easeOutElastic = (t: number) => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

export class Tween {
  private startTime: number = 0;
  private pausedTime: number = 0;
  private isPaused: boolean = false;
  private isFinished: boolean = false;
  public startValues: Record<string, number> = {};
  public targetValues: Record<string, number> = {};
  private currentValues: Record<string, number> = {};
  public onUpdateCallback?: (obj: any, progress?: number) => void;
  public onCompleteCallback?: () => void;
  public easing: EasingFunction;

  constructor(
    private target: any | undefined, 
    private startProperties: Record<string, number> | undefined,
    private endProperties: Record<string, number> | undefined,
    private duration: number,
    easing?: EasingFunction,
    onUpdate?: (obj: any) => void,
    onComplete?: () => void
  ) {
    this.easing = easing || linear;
    this.onUpdateCallback = onUpdate;
    this.onCompleteCallback = onComplete;

    if (target && startProperties && endProperties)
      for (const key in startProperties) {
        if (target.hasOwnProperty(key) || key in target) {
          this.startValues[key] = startProperties[key];
          this.targetValues[key] = endProperties[key];
          this.currentValues[key] = target[key];
        }
      }
  }

  start() {
    this.startTime = performance.now();
    this.isFinished = false;
    this.isPaused = false;
  }

  pause() {
    if (!this.isFinished && !this.isPaused) {
      this.isPaused = true;
      this.pausedTime = performance.now();
    }
  }

  resume() {
    if (this.isPaused) {
      const pauseDuration = performance.now() - this.pausedTime;
      this.startTime += pauseDuration;
      this.isPaused = false;
    }
  }

  update(now: number) {
    if (this.isFinished || this.isPaused) return false;

    const elapsed = now - this.startTime;
    let progress = Math.min(elapsed / this.duration, 1);
    const eased = this.easing(progress);

    for (const key in this.targetValues) {
      const start = this.startValues[key];
      const end = this.targetValues[key];
      const value = start + (end - start) * eased;
      this.target[key] = value;
      this.currentValues[key] = value;
    }

    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.target, progress);
    }

    if (progress >= 1) {
      this.isFinished = true;
      if (this.onCompleteCallback) {
        this.onCompleteCallback();
      }
      return true;
    }
    return false;
  }

  isActive() {
    return !this.isFinished && !this.isPaused;
  }

  stop() {
    this.isFinished = true;
  }
}



export class TweenManager {
  private tweens: Tween[] = [];

  add(tween: Tween) {
    this.tweens.push(tween);
    tween.start();
  }

  update(now: number = performance.now()) {
    this.tweens.forEach(tween => {
      tween.update(now);
    });
  }

  removeAll() {
    this.tweens.forEach(t => t.stop());
    this.tweens = [];
  }
}