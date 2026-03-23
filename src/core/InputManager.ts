import { EventBus } from '../core/EventBus';
import { cfg } from '../utils/GameConfig';

export class InputManager {
  private readonly canvas: HTMLElement;

  private activePointerId: number | null = null;
  private pointerStartX   = 0;

  private gestureConsumed = false;

  private currentLane: number = 1;

  constructor(
    canvas: HTMLElement,
    private readonly bus: EventBus,
  ) {
    this.canvas = canvas;
    this.canvas.style.touchAction = 'none';
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove',   this.onPointerMove);
    window.addEventListener('pointerup',     this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove',   this.onPointerMove);
    window.removeEventListener('pointerup',     this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
  }

  updatePlayerZ(_z: number): void {}

  private laneToWorldX(lane: number): number {
    const hw = cfg().player.playableTrackWidth / 4;
    return (lane - 1) * (-hw);
  }

  private emitLane(): void {
    this.bus.emit('input:targetX', { worldX: this.laneToWorldX(this.currentLane) });
  }

  private moveLeft(): void {
    if (this.currentLane > 0) {
      this.currentLane--;
      this.emitLane();
    }
  }

  private moveRight(): void {
    if (this.currentLane < 2) {
      this.currentLane++;
      this.emitLane();
    }
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.activePointerId !== null) return;

    this.activePointerId = e.pointerId;
    this.pointerStartX   = e.clientX;
    this.gestureConsumed = false;

    this.canvas.setPointerCapture(e.pointerId);

    this.emitLane();
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointerId) return;
    if (this.gestureConsumed) return;

    const threshold = cfg().input.dragXCommitPct * window.innerWidth;
    const totalDX   = e.clientX - this.pointerStartX;

    if (totalDX < -threshold) {
      this.moveLeft();
      this.gestureConsumed = true;
    } else if (totalDX > threshold) {
      this.moveRight();
      this.gestureConsumed = true;
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointerId) return;
    this.activePointerId = null;
  };
}