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

  private readonly overlayWrap:  HTMLElement;
  private readonly overlayPanel: HTMLElement;
  private readonly overlayTitle: HTMLElement;
  private readonly overlayBtn:   HTMLButtonElement;
  private readonly overlayCursor: HTMLImageElement;

  private readonly tutorial:      HTMLElement;
  private readonly cursorImg:     HTMLImageElement;

  private coins: number  = 0;
  private muted: boolean = false;

  private popTimeout:     ReturnType<typeof setTimeout> | null = null;
  private overlayTimeout: ReturnType<typeof setTimeout> | null = null;

  private readonly tweenManager        = new TweenManager();
  private readonly overlayTweenManager = new TweenManager();
  private tutorialRafId: number = 0;
  private overlayRafId:  number = 0;
  private cursorX   = { value: 0 };
  private cursorPos = { x: 0, y: 0, scale: 1 };

  constructor(
    container: HTMLElement,
    private readonly bus: EventBus,
  ) {
    this.root = this.buildDOM(container);

    this.coinLabel     = this.root.querySelector<HTMLElement>('.ui-coin-count')!;
    this.coinIcon      = this.root.querySelector<HTMLImageElement>('.ui-coin-icon')!;
    this.volumeBtn     = this.root.querySelector<HTMLButtonElement>('.ui-volume-btn')!;
    this.volumeOnImg   = this.root.querySelector<HTMLImageElement>('.ui-vol-on')!;
    this.volumeOffImg  = this.root.querySelector<HTMLImageElement>('.ui-vol-off')!;
    this.overlayWrap   = this.root.querySelector<HTMLElement>('.ui-overlay-wrap')!;
    this.overlayPanel  = this.root.querySelector<HTMLElement>('.ui-overlay-panel')!;
    this.overlayTitle  = this.root.querySelector<HTMLElement>('.ui-overlay-title')!;
    this.overlayBtn    = this.root.querySelector<HTMLButtonElement>('.ui-overlay-btn')!;
    this.overlayCursor = this.root.querySelector<HTMLImageElement>('.ui-overlay-cursor')!;
    this.tutorial      = this.root.querySelector<HTMLElement>('.ui-tutorial')!;
    this.cursorImg     = this.root.querySelector<HTMLImageElement>('.ui-tutorial-cursor')!;

    const imgs = cfg().images;
    this.coinIcon.src      = AssetManager.getTexture(imgs.coin).image.src;
    this.volumeOnImg.src   = AssetManager.getTexture(imgs.volume_on).image.src;
    this.volumeOffImg.src  = AssetManager.getTexture(imgs.volume_off).image.src;
    const cursorSrc        = AssetManager.getTexture(imgs.cursor).image.src;
    this.cursorImg.src     = cursorSrc;
    this.overlayCursor.src = cursorSrc;

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
    cancelAnimationFrame(this.tutorialRafId);
    cancelAnimationFrame(this.overlayRafId);
    this.tweenManager.removeAll();
    this.overlayTweenManager.removeAll();
    if (this.popTimeout     !== null) clearTimeout(this.popTimeout);
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

      /* ── Coin panel ───────────────────────────────────────────────────── */
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
        width: 34px; height: 34px;
        object-fit: contain; display: block;
        filter: drop-shadow(0 1px 4px rgba(0,0,0,0.55));
      }
      .ui-coin-count {
        font-size: 28px; font-weight: 900; color: #ffd700;
        letter-spacing: 0.02em;
        text-shadow: 0 1px 5px rgba(0,0,0,0.65), 0 0 14px rgba(255,200,0,0.35);
        min-width: 24px; text-align: left; line-height: 1;
        transition: transform 0.08s cubic-bezier(.34,1.6,.64,1), color 0.08s;
        display: inline-block;
      }
      .ui-coin-count.pop { transform: scale(1.4); color: #fff5b0; }

      /* ── Volume button ────────────────────────────────────────────────── */
      .ui-volume-btn {
        position: absolute; bottom: 24px; left: 20px;
        width: 54px; height: 54px; padding: 0; border: none; background: none;
        cursor: pointer; pointer-events: all;
        display: flex; align-items: center; justify-content: center;
        transition: transform 0.12s ease;
        -webkit-tap-highlight-color: transparent; outline: none;
      }
      .ui-volume-btn:active { transform: scale(0.88); }
      .ui-volume-btn img { width: 54px; height: 54px; object-fit: contain; pointer-events: none; }
      .ui-vol-off                      { display: none; }
      .ui-volume-btn.muted .ui-vol-on  { display: none; }
      .ui-volume-btn.muted .ui-vol-off { display: block; }

      /* ── Tutorial overlay ─────────────────────────────────────────────── */
      .ui-tutorial {
        position: absolute; bottom: 18%; left: 0; right: 0;
        display: flex; flex-direction: column; align-items: center;
        pointer-events: none;
        transition: opacity 0.35s ease;
      }
      .ui-tutorial.hidden { opacity: 0; }
      .ui-tutorial-hint {
        font-size: clamp(16px, 4vw, 22px); font-weight: 700; color: #ffffff;
        text-align: center;
        text-shadow: 0 1px 4px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.6);
        line-height: 1.3; margin-top: 12px;
      }
      .ui-tutorial-swipe-row {
        position: relative; width: 60%; max-width: 260px; height: 80px;
        display: flex; align-items: center;
      }
      .ui-tutorial-swipe-label {
        position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%);
        font-size: clamp(20px, 5.5vw, 30px); font-weight: 900; color: #ffffff;
        white-space: nowrap;
        text-shadow: 0 2px 0 rgba(0,0,0,0.6), 0 0 24px rgba(0,0,0,0.5);
        letter-spacing: 0.02em;
      }
      .ui-tutorial-cursor {
        position: absolute; width: 52px; height: 52px; object-fit: contain; top: 0;
        filter: drop-shadow(0 2px 6px rgba(0,0,0,0.55));
      }

      /* ── End-game overlay ─────────────────────────────────────────────── */

      /*
       * Wrap fills the screen, centres the panel, dims the background.
       * Starts invisible; .visible fades it in.
       */
      .ui-overlay-wrap {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.55);
        opacity: 0; pointer-events: none;
        transition: opacity 0.35s ease;
      }
      .ui-overlay-wrap.visible {
        opacity: 1; pointer-events: all;
      }

      /*
       * Panel: fixed design size 360×260 "design-px".
       * We scale it down uniformly to fit inside the screen with 24px margin
       * on each side, keeping aspect-ratio constant.
       * The trick: width = min(360px, 100vw - 48px)
       *            height is set via aspect-ratio so it follows width,
       *            but we also cap via a max-height in case landscape is very short.
       */
      .ui-overlay-panel {
        position: relative;
        width: min(80vw, 80vh * 360 / 260);
        aspect-ratio: 360 / 260;
        background: linear-gradient(160deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%);
        border-radius: 24px;
        border: 1.5px solid rgba(255,255,255,0.12);
        box-shadow:
          0 24px 64px rgba(0,0,0,0.6),
          0 0 0 1px rgba(255,255,255,0.04) inset;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0;
        padding: 0;
        box-sizing: border-box;
      }

      /* Win tint */
      .ui-overlay-panel.win {
        background: linear-gradient(160deg, #1a1500 0%, #2a2000 60%, #3a2e00 100%);
      }

      .ui-overlay-title {
        font-size: calc(min(80vw, 80vh * 360 / 260) * 0.0875);
        font-weight: 900; letter-spacing: 0.01em; line-height: 1;
        color: #ffffff; text-align: center;
        text-shadow: 0 2px 0 rgba(0,0,0,0.5), 0 0 32px rgba(220,60,60,0.6);
        margin-bottom: calc(min(80vw, 80vh * 360 / 260) * 0.036);
      }
      .ui-overlay-panel.win .ui-overlay-title {
        text-shadow: 0 2px 0 rgba(0,0,0,0.5), 0 0 32px rgba(255,200,0,0.7);
      }

      .ui-overlay-btn {
        padding: calc(min(80vw, 80vh * 360 / 260) * 0.025)
                 calc(min(80vw, 80vh * 360 / 260) * 0.07);
        border: none; border-radius: 999px; cursor: pointer; pointer-events: all;
        font-family: inherit;
        font-size: calc(min(80vw, 80vh * 360 / 260) * 0.0415);
        font-weight: 900; letter-spacing: 0.03em; color: #ffffff;
        -webkit-tap-highlight-color: transparent; outline: none;
        transition: transform 0.10s ease, box-shadow 0.10s ease;
        background: linear-gradient(180deg, #f04040 0%, #b81c1c 100%);
        box-shadow: 0 6px 0 #7a0f0f, 0 8px 24px rgba(180,20,20,0.50);
      }
      .ui-overlay-panel.win .ui-overlay-btn {
        background: linear-gradient(180deg, #ffe040 0%, #e8a000 100%);
        box-shadow: 0 6px 0 #9a6400, 0 8px 24px rgba(220,160,0,0.55);
        color: #3a2000;
      }
      .ui-overlay-btn:active {
        transform: translateY(3px);
        box-shadow: 0 3px 0 #7a0f0f, 0 4px 12px rgba(180,20,20,0.40);
      }
      .ui-overlay-panel.win .ui-overlay-btn:active {
        box-shadow: 0 3px 0 #9a6400, 0 4px 12px rgba(220,160,0,0.35);
      }

      .ui-overlay-cursor {
        position: absolute;
        width: calc(min(80vw, 80vh * 360 / 260) * 0.145);
        height: calc(min(80vw, 80vh * 360 / 260) * 0.145);
        object-fit: contain;
        pointer-events: none;
        filter: drop-shadow(0 2px 6px rgba(0,0,0,0.55));
        transform-origin: top left;
      }
    `;
    document.head.appendChild(style);

    container.style.position = 'relative';

    const hud = document.createElement('div');
    hud.className = 'ui-hud';
    hud.innerHTML = `
      <div class="ui-overlay-wrap" aria-hidden="true">
        <div class="ui-overlay-panel">
          <span class="ui-overlay-title"></span>
          <button class="ui-overlay-btn"></button>
          <img class="ui-overlay-cursor" src="" alt="" />
        </div>
      </div>

      <div class="ui-tutorial">
        <div class="ui-tutorial-swipe-row">
          <img class="ui-tutorial-cursor" src="" alt="" />
          <span class="ui-tutorial-swipe-label">Swipe to move</span>
        </div>
        <div class="ui-tutorial-hint">Avoid bombs, collect coins!</div>
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
    this.tutorialRafId = requestAnimationFrame(this.tutorialLoop);
  }

  private readonly tutorialLoop = (): void => {
    this.tweenManager.update(performance.now());
    this.tutorialRafId = requestAnimationFrame(this.tutorialLoop);
  };

  private scheduleCursorTween(goRight: boolean): void {
    const row  = this.tutorial.querySelector<HTMLElement>('.ui-tutorial-swipe-row')!;
    const rowW = row.offsetWidth || 220;
    const curW = this.cursorImg.offsetWidth || 52;
    const fromX = goRight ? 0 : rowW - curW;
    const toX   = goRight ? rowW - curW : 0;
    this.cursorX.value = fromX;
    this.cursorImg.style.left = `${fromX}px`;
    const tween = new Tween(
      this.cursorX, { value: fromX }, { value: toX }, 900, easeInOutQuad,
      (obj: { value: number }, progress?: number) => {
        this.cursorImg.style.left = `${obj.value}px`;
        const arc = Math.sin((progress ?? 0) * Math.PI) * 12;
        this.cursorImg.style.top = `${-arc}px`;
      },
      () => setTimeout(() => this.scheduleCursorTween(!goRight), 120),
    );
    this.tweenManager.add(tween);
  }

  private readonly onGameStarted = (): void => {
    this.tutorial.classList.add('hidden');
    cancelAnimationFrame(this.tutorialRafId);
    this.tweenManager.removeAll();
  };

  // ── End-game overlay ──────────────────────────────────────────────────────

  private scheduleOverlay(isWin: boolean): void {
    if (this.overlayTimeout !== null) clearTimeout(this.overlayTimeout);
    this.overlayTimeout = setTimeout(() => {
      this.showOverlay(isWin);
      this.overlayTimeout = null;
    }, 900);
  }

  private showOverlay(isWin: boolean): void {
    this.overlayTitle.textContent = isWin ? 'You won!' : 'You lost';
    this.overlayBtn.textContent   = isWin ? 'Play now' : 'Try again';
    this.overlayPanel.classList.toggle('win', isWin);
    this.overlayWrap.setAttribute('aria-hidden', 'false');
    void this.overlayWrap.offsetHeight;
    this.overlayWrap.classList.add('visible');
    this.startOverlayCursor();
  }

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
    const panel  = this.overlayPanel;
    const btn    = this.overlayBtn;
    const cursor = this.overlayCursor;

    const pW  = panel.offsetWidth   || 360;
    const pH  = panel.offsetHeight  || 260;
    const bW  = btn.offsetWidth     || 180;
    const bH  = btn.offsetHeight    || 52;
    const bL  = btn.offsetLeft      || (pW - bW) / 2;
    const bT  = btn.offsetTop       || pH * 0.58;
    const cW  = cursor.offsetWidth  || 52;
    const cH  = cursor.offsetHeight || 52;

    const onX  = bL + bW * 0.65 - cW * 0.1;
    const onY  = bT + bH * 0.15 - cH * 0.1;
    const offX = pW * 0.78;
    const offY = pH * 0.82;

    const fromX     = moveIn ? offX : onX;
    const fromY     = moveIn ? offY : onY;
    const toX       = moveIn ? onX  : offX;
    const toY       = moveIn ? onY  : offY;
    const fromScale = moveIn ? 1.25 : 0.8;
    const toScale   = moveIn ? 0.8  : 1.25;

    this.cursorPos.x = fromX; this.cursorPos.y = fromY; this.cursorPos.scale = fromScale;
    cursor.style.left      = `${fromX}px`;
    cursor.style.top       = `${fromY}px`;
    cursor.style.transform = `scale(${fromScale})`;

    const tween = new Tween(
      this.cursorPos,
      { x: fromX, y: fromY, scale: fromScale },
      { x: toX,   y: toY,   scale: toScale   },
      600, easeInOutQuad,
      (o: { x: number; y: number; scale: number }) => {
        cursor.style.left      = `${o.x}px`;
        cursor.style.top       = `${o.y}px`;
        cursor.style.transform = `scale(${o.scale})`;
      },
      () => setTimeout(() => this.scheduleOverlayCursorTween(!moveIn), 200),
    );
    this.overlayTweenManager.add(tween);
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  private readonly onCoinCollected = ({ total }: { value: number; total: number }): void => {
    this.coins = total;
    this.render();
    this.triggerPop();
  };

  private readonly onGameOver = (): void => { this.scheduleOverlay(false); };
  private readonly onGameWon  = (): void => { this.scheduleOverlay(true);  };

  private readonly onVolumeClick = (): void => {
    this.muted = !this.muted;
    this.volumeBtn.classList.toggle('muted', this.muted);
    this.bus.emit('ui:mute_changed', { muted: this.muted });
  };

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