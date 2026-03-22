import { EventBus } from '../core/EventBus';
import * as AssetManager from '../utils/AssetManager';
import { cfg } from '../utils/GameConfig';
import { Tween, TweenManager, easeInOutQuad } from '../utils/Tween';

export class UIManager {
  private readonly root:         HTMLElement;
  private readonly coinLabel:    HTMLElement;
  private readonly coinIcon:     HTMLImageElement;
  private readonly volumeBtn:    HTMLButtonElement;
  private readonly volumeOnImg:  HTMLImageElement;
  private readonly volumeOffImg: HTMLImageElement;

  private readonly overlay:      HTMLElement;
  private readonly overlayTitle: HTMLElement;
  private readonly overlayBtn:   HTMLButtonElement;

  private readonly tutorial:          HTMLElement;
  private readonly cursorImg:         HTMLImageElement;
  private readonly jumpCursorImg:     HTMLImageElement;
  private readonly overlayCursorImg:  HTMLImageElement;

  private coins: number  = 0;
  private muted: boolean = false;

  private popTimeout: ReturnType<typeof setTimeout> | null = null;
  private overlayTimeout: ReturnType<typeof setTimeout> | null = null;

  private readonly tweenManager = new TweenManager();
  private tutorialRafId: number = 0;
  private cursorX = { value: 0 };
  private cursorY = { value: 0 };

  private readonly overlayTweenManager = new TweenManager();
  private overlayRafId: number = 0;
  private cursorScale = { value: 1 };

  constructor(
    container: HTMLElement,
    private readonly bus: EventBus,
  ) {
    this.root = this.buildDOM(container);

    this.coinLabel    = this.root.querySelector<HTMLElement>('.ui-coin-count')!;
    this.coinIcon     = this.root.querySelector<HTMLImageElement>('.ui-coin-icon')!;
    this.volumeBtn    = this.root.querySelector<HTMLButtonElement>('.ui-volume-btn')!;
    this.volumeOnImg  = this.root.querySelector<HTMLImageElement>('.ui-vol-on')!;
    this.volumeOffImg = this.root.querySelector<HTMLImageElement>('.ui-vol-off')!;
    this.overlay      = this.root.querySelector<HTMLElement>('.ui-overlay')!;
    this.overlayTitle = this.root.querySelector<HTMLElement>('.ui-overlay-title')!;
    this.overlayBtn   = this.root.querySelector<HTMLButtonElement>('.ui-overlay-btn')!;
    this.tutorial           = this.root.querySelector<HTMLElement>('.ui-tutorial')!;
    this.cursorImg          = this.root.querySelector<HTMLImageElement>('.ui-tutorial-cursor')!;
    this.jumpCursorImg      = this.root.querySelector<HTMLImageElement>('.ui-tutorial-jump-cursor')!;
    this.overlayCursorImg   = this.root.querySelector<HTMLImageElement>('.ui-overlay-cursor')!;

    
    const imgs = cfg().images;
    this.coinIcon.src          = AssetManager.getTexture(imgs.coin).image.src;
    this.volumeOnImg.src       = AssetManager.getTexture(imgs.volume_on).image.src;
    this.volumeOffImg.src      = AssetManager.getTexture(imgs.volume_off).image.src;
    const cursorSrc            = AssetManager.getTexture(imgs.cursor).image.src;
    this.cursorImg.src        = cursorSrc;
    this.jumpCursorImg.src    = cursorSrc;
    this.overlayCursorImg.src = cursorSrc;

    this.volumeBtn.addEventListener('click', this.onVolumeClick);
    this.bus.on('coin:collected', this.onCoinCollected);
    this.bus.on('game:over',      this.onGameOver);
    this.bus.on('game:won',       this.onGameWon);
    this.bus.on('game:started',   this.onGameStarted);

    this.startTutorial();
    this.render();
  }

  dispose(): void {
    this.bus.off('coin:collected', this.onCoinCollected);
    this.bus.off('game:over',      this.onGameOver);
    this.bus.off('game:won',       this.onGameWon);
    this.bus.off('game:started',   this.onGameStarted);
    this.volumeBtn.removeEventListener('click', this.onVolumeClick);
    this.overlayBtn.removeEventListener('click', this.onOverlayBtnClick);
    cancelAnimationFrame(this.tutorialRafId);
    this.tweenManager.removeAll();
    cancelAnimationFrame(this.overlayRafId);
    this.overlayTweenManager.removeAll();
    if (this.popTimeout !== null) clearTimeout(this.popTimeout);
    if (this.overlayTimeout !== null) clearTimeout(this.overlayTimeout);
    this.root.remove();
  }

  
  private buildDOM(container: HTMLElement): HTMLElement {
    const style = document.createElement('style');
    style.textContent = `
      .ui-hud {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 10;
        font-family: 'Arial Rounded MT Bold', Arial, sans-serif;
      }
 
      /* Coin panel */
      .ui-coin-panel {
        position: absolute;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 20px 6px 10px;
        background: rgba(0,0,0,0.40);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1.5px solid rgba(255,215,0,0.30);
        border-radius: 999px;
        box-shadow: 0 2px 14px rgba(0,0,0,0.30),
                    inset 0 1px 0 rgba(255,255,255,0.07);
        white-space: nowrap;
      }
 
      .ui-coin-icon {
        width: 34px;
        height: 34px;
        object-fit: contain;
        display: block;
        filter: drop-shadow(0 1px 4px rgba(0,0,0,0.55));
      }
 
      .ui-coin-count {
        font-size: 28px;
        font-weight: 900;
        color: #ffd700;
        letter-spacing: 0.02em;
        text-shadow:
          0 1px 5px rgba(0,0,0,0.65),
          0 0 14px rgba(255,200,0,0.35);
        min-width: 24px;
        text-align: left;
        line-height: 1;
        transition: transform 0.08s cubic-bezier(.34,1.6,.64,1), color 0.08s;
        display: inline-block;
      }
 
      .ui-coin-count.pop {
        transform: scale(1.4);
        color: #fff5b0;
      }
 
      /* Volume button */
      .ui-volume-btn {
        position: absolute;
        bottom: 24px;
        left: 20px;
        width: 54px;
        height: 54px;
        padding: 0;
        border: none;
        background: none;
        cursor: pointer;
        pointer-events: all;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.12s ease;
        -webkit-tap-highlight-color: transparent;
        outline: none;
      }
 
      .ui-volume-btn:active {
        transform: scale(0.88);
      }
 
      .ui-volume-btn img {
        width: 54px;
        height: 54px;
        object-fit: contain;
        pointer-events: none;
      }

 
      .ui-vol-off                      { display: none;  }
      .ui-volume-btn.muted .ui-vol-on  { display: none;  }
      .ui-volume-btn.muted .ui-vol-off { display: block; }

      /* ── Tutorial overlay ─────────────────────────────────────────────── */
      .ui-tutorial {
        position: absolute;
        bottom: 18%;
        left: 0;
        right: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0px;
        pointer-events: none;
        transition: opacity 0.35s ease;
      }

      .ui-tutorial.hidden {
        opacity: 0;
      }

      .ui-tutorial-hint {
        font-size: clamp(16px, 4vw, 22px);
        font-weight: 700;
        color: #ffffff;
        text-align: center;
        padding: 0 24px;
        text-shadow:
          0 1px 4px rgba(0,0,0,0.8),
          0 0 20px rgba(0,0,0,0.6);
        line-height: 1.3;
        margin-bottom: 28px;
      }

      .ui-tutorial-hint-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-bottom: 28px;
        padding: 0 24px;
      }

      .ui-tutorial-hint-row .ui-tutorial-hint {
        margin-bottom: 0;
        padding: 0;
        text-align: left;
      }

      .ui-tutorial-jump-col {
        position: relative;
        width: 52px;
        height: 80px;
        flex-shrink: 0;
      }

      .ui-tutorial-jump-cursor {
        position: absolute;
        width: 52px;
        height: 52px;
        object-fit: contain;
        left: 0;
        /* top is driven by JS */
        filter: drop-shadow(0 2px 6px rgba(0,0,0,0.55));
      }

      .ui-tutorial-swipe-row {
        position: relative;
        width: 60%;
        max-width: 260px;
        height: 80px;
        display: flex;
        align-items: center;
      }

      .ui-tutorial-swipe-label {
        position: absolute;
        bottom: -4px;
        left: 50%;
        transform: translateX(-50%);
        font-size: clamp(20px, 5.5vw, 30px);
        font-weight: 900;
        color: #ffffff;
        white-space: nowrap;
        text-shadow:
          0 2px 0 rgba(0,0,0,0.6),
          0 0 24px rgba(0,0,0,0.5);
        letter-spacing: 0.02em;
      }

      .ui-tutorial-cursor {
        position: absolute;
        width: 52px;
        height: 52px;
        object-fit: contain;
        top: 0;
        /* left is driven by JS */
        filter: drop-shadow(0 2px 6px rgba(0,0,0,0.55));
      }

      /* ── End-game overlay ─────────────────────────────────────────────── */
      .ui-overlay {
        position: absolute;
        top: 0; left: 0; right: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        padding-bottom: 25%;
        height: 55%;
        align-items: center;
        justify-content: flex-end;
        padding-bottom: 25%;
        height: 55%;
        background: linear-gradient(
          180deg,
          rgba(0,0,0,0.82) 0%,
          rgba(0,0,0,0.72) 80%,
          rgba(0,0,0,0.00) 100%
        );
        transform: translateY(-100%);
        transition: transform 0.55s cubic-bezier(0.34, 1.28, 0.64, 1);
        pointer-events: none;
      }
 
      .ui-overlay--visible {
        transform: translateY(0%);
        pointer-events: all;
      }
 
      .ui-overlay--win {
        background: linear-gradient(
          180deg,
          rgba(30,20,0,0.88) 0%,
          rgba(40,28,0,0.76) 80%,
          rgba(0,0,0,0.00) 100%
        );
      }
 
      .ui-overlay-title {
        font-size: clamp(42px, 10vw, 72px);
        font-weight: 900;
        letter-spacing: 0.01em;
        line-height: 1.05;
        text-align: center;
        margin-bottom: 28px;
        color: #ffffff;
        text-shadow:
          0 2px 0 rgba(0,0,0,0.55),
          0 0 40px rgba(220,60,60,0.55);
      }
 
      .ui-overlay--win .ui-overlay-title {
        text-shadow:
          0 2px 0 rgba(0,0,0,0.55),
          0 0 40px rgba(255,210,0,0.65);
      }
 
      .ui-overlay-btn {
        padding: 18px 56px;
        border: none;
        border-radius: 999px;
        cursor: pointer;
        pointer-events: all;
        font-family: inherit;
        font-size: clamp(20px, 5vw, 28px);
        font-weight: 900;
        letter-spacing: 0.03em;
        color: #ffffff;
        -webkit-tap-highlight-color: transparent;
        outline: none;
        transition: transform 0.10s ease, box-shadow 0.10s ease;
        background: linear-gradient(180deg, #f04040 0%, #b81c1c 100%);
        box-shadow:
          0 6px 0 #7a0f0f,
          0 8px 24px rgba(180,20,20,0.50);
      }
 
      .ui-overlay--win .ui-overlay-btn {
        background: linear-gradient(180deg, #ffe040 0%, #e8a000 100%);
        box-shadow:
          0 6px 0 #9a6400,
          0 8px 24px rgba(220,160,0,0.55);
        color: #3a2000;
      }
 
      .ui-overlay-btn:active {
        transform: translateY(4px);
        box-shadow:
          0 2px 0 #7a0f0f,
          0 4px 12px rgba(180,20,20,0.40);
      }
 
      .ui-overlay--win .ui-overlay-btn:active {
        box-shadow:
          0 2px 0 #9a6400,
          0 4px 12px rgba(220,160,0,0.35);
      }

      .ui-overlay-cursor-wrap {
        position: relative;
        width: 140px;
        height: 100px;
        margin-top: -50px;
        margin-right: -50px;
        align-self: flex-center;
        pointer-events: none;
      }

      .ui-overlay-cursor {
        position: absolute;
        width: 52px;
        height: 52px;
        object-fit: contain;
        filter: drop-shadow(0 2px 6px rgba(0,0,0,0.55));
        transform-origin: top left;
      }
    `;
    document.head.appendChild(style);
 
    container.style.position = 'relative';
 
    const hud = document.createElement('div');
    hud.className = 'ui-hud';
    hud.innerHTML = `
      <div class="ui-overlay" role="dialog" aria-modal="true" aria-hidden="true">
        <span class="ui-overlay-title"></span>
        <button class="ui-overlay-btn"></button>
        <div class="ui-overlay-cursor-wrap">
          <img class="ui-overlay-cursor" src="" alt="" />
        </div>
      </div>

      <div class="ui-tutorial">
        <div class="ui-tutorial-hint-row">
          <div class="ui-tutorial-hint">Jump or slide to avoid<br>bombs and collect coins</div>
          <div class="ui-tutorial-jump-col">
            <img class="ui-tutorial-jump-cursor" src="" alt="" />
          </div>
        </div>
        <div class="ui-tutorial-swipe-row">
          <img class="ui-tutorial-cursor" src="" alt="" />
          <span class="ui-tutorial-swipe-label">Swipe to move</span>
        </div>
      </div>

      <div class="ui-coin-panel">
        <img class="ui-coin-icon" src="" alt="" />
        <span class="ui-coin-count">0</span>
      </div>
 
      <button class="ui-volume-btn" aria-label="Toggle volume">
        <img class="ui-vol-on"  src="" alt="Sound on"  />
        <img class="ui-vol-off" src="" alt="Sound off" />
      </button>
    `;

    container.appendChild(hud);
    return hud;
  }

  // ── Tutorial ──────────────────────────────────────────────────────────────

  private startTutorial(): void {
    this.scheduleCursorTween(true);
    this.scheduleJumpCursorTween(true);
    this.tutorialRafId = requestAnimationFrame(this.tutorialLoop);
  }

  private readonly tutorialLoop = (): void => {
    this.tweenManager.update(performance.now());
    this.tutorialRafId = requestAnimationFrame(this.tutorialLoop);
  };

  private scheduleCursorTween(goRight: boolean): void {
    const row    = this.tutorial.querySelector<HTMLElement>('.ui-tutorial-swipe-row')!;
    const cursor = this.cursorImg;
    const rowW   = row.offsetWidth || 220;
    const curW   = cursor.offsetWidth || 52;

    const fromX = goRight ? 0           : rowW - curW;
    const toX   = goRight ? rowW - curW : 0;

    // small vertical bob — cursor sits a bit higher at the midpoint
    this.cursorX.value = fromX;
    cursor.style.left = `${fromX}px`;

    const tween = new Tween(
      this.cursorX,
      { value: fromX },
      { value: toX   },
      900,
      easeInOutQuad,
      (obj: { value: number }, progress?: number) => {
        cursor.style.left = `${obj.value}px`;
        // subtle vertical arc: highest at progress 0.5
        const arc = Math.sin((progress ?? 0) * Math.PI) * 12;
        cursor.style.top = `${-arc}px`;
      },
      () => {
        // 120 ms pause at each end before reversing
        setTimeout(() => this.scheduleCursorTween(!goRight), 120);
      },
    );

    this.tweenManager.add(tween);
  }

  private scheduleJumpCursorTween(goUp: boolean): void {
    const col   = this.tutorial.querySelector<HTMLElement>('.ui-tutorial-jump-col')!;
    const colH  = col.offsetHeight || 80;
    const curH  = this.jumpCursorImg.offsetHeight || 52;

    const fromY = goUp ? colH - curH : 0;
    const toY   = goUp ? 0           : colH - curH;

    this.cursorY.value = fromY;
    this.jumpCursorImg.style.top = `${fromY}px`;

    const tween = new Tween(
      this.cursorY,
      { value: fromY },
      { value: toY   },
      600,
      easeInOutQuad,
      (obj: { value: number }) => {
        this.jumpCursorImg.style.top = `${obj.value}px`;
      },
      () => {
        setTimeout(() => this.scheduleJumpCursorTween(!goUp), 180);
      },
    );

    this.tweenManager.add(tween);
  }

  private readonly onGameStarted = (): void => {
    this.tutorial.classList.add('hidden');
    cancelAnimationFrame(this.tutorialRafId);
    this.tweenManager.removeAll();
  };

  // ── Overlay cursor ────────────────────────────────────────────────────────

  private startOverlayCursor(): void {
    this.overlayTweenManager.removeAll();
    cancelAnimationFrame(this.overlayRafId);
    this.scheduleOverlayCursorTween(true);
    this.overlayRafId = requestAnimationFrame(this.overlayLoop);
  }

  private readonly overlayLoop = (): void => {
    this.overlayTweenManager.update(performance.now());
    this.overlayRafId = requestAnimationFrame(this.overlayLoop);
  };

  private scheduleOverlayCursorTween(moveIn: boolean): void {
    const wrap  = this.overlayCursorImg.parentElement!;
    const wrapW = wrap.offsetWidth  || 140;
    const wrapH = wrap.offsetHeight || 100;
    const curW  = this.overlayCursorImg.offsetWidth  || 52;
    const curH  = this.overlayCursorImg.offsetHeight || 52;

    // top-left  = on the button  (small scale — "pressing")
    // bot-right = away, bottom   (large scale — "hovering")
    const fromLeft = moveIn ? wrapW - curW : 0;
    const fromTop  = moveIn ? wrapH - curH : 0;
    const toLeft   = moveIn ? 0            : wrapW - curW;
    const toTop    = moveIn ? 0            : wrapH - curH;
    const fromScale = moveIn ? 1.3 : 0.75;
    const toScale   = moveIn ? 0.75 : 1.3;

    const obj = { left: fromLeft, top: fromTop, scale: fromScale };
    this.overlayCursorImg.style.left      = `${fromLeft}px`;
    this.overlayCursorImg.style.top       = `${fromTop}px`;
    this.overlayCursorImg.style.transform = `scale(${fromScale})`;

    const tween = new Tween(
      obj,
      { left: fromLeft, top: fromTop, scale: fromScale },
      { left: toLeft,   top: toTop,   scale: toScale   },
      600,
      easeInOutQuad,
      (o: { left: number; top: number; scale: number }) => {
        this.overlayCursorImg.style.left      = `${o.left}px`;
        this.overlayCursorImg.style.top       = `${o.top}px`;
        this.overlayCursorImg.style.transform = `scale(${o.scale})`;
      },
      () => {
        setTimeout(() => this.scheduleOverlayCursorTween(!moveIn), 150);
      },
    );

    this.overlayTweenManager.add(tween);
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  private readonly onCoinCollected = ({ total }: { value: number; total: number }): void => {
    this.coins = total;
    this.render();
    this.triggerPop();
  };
  
  private readonly onGameOver = (): void => {
    this.scheduleOverlay(false);
  };
 
  private readonly onGameWon = (): void => {
    this.scheduleOverlay(true);
  };

  private readonly onVolumeClick = (): void => {
    this.muted = !this.muted;
    this.volumeBtn.classList.toggle('muted', this.muted);
    this.bus.emit('ui:mute_changed', { muted: this.muted });
  };

  private readonly onOverlayBtnClick = (): void => {
    // this.bus.emit('game:restart', {});
  };
  
  private scheduleOverlay(isWin: boolean): void {
    if (this.overlayTimeout !== null) clearTimeout(this.overlayTimeout);
 
    this.overlayTimeout = setTimeout(() => {
      this.showOverlay(isWin);
      this.overlayTimeout = null;
    }, 900);
  }
 
  private showOverlay(isWin: boolean): void {
    this.overlayTitle.textContent = isWin ? 'You won!'   : 'You lost';
    this.overlayBtn.textContent   = isWin ? 'Play now'   : 'Try again';
 
    this.overlay.classList.toggle('ui-overlay--win', isWin);
    this.overlay.setAttribute('aria-hidden', 'false');
 
    void this.overlay.offsetHeight;
    this.overlay.classList.add('ui-overlay--visible');

    this.startOverlayCursor();
  }

  private render(): void {
    this.coinLabel.textContent = String(this.coins);
  }

  private triggerPop(): void {
    if (this.popTimeout !== null) {
      clearTimeout(this.popTimeout);
      this.coinLabel.classList.remove('pop');
      void (this.coinLabel as HTMLElement).offsetWidth;
    }
    this.coinLabel.classList.add('pop');
    this.popTimeout = setTimeout(() => {
      this.coinLabel.classList.remove('pop');
      this.popTimeout = null;
    }, 200);
  }
}