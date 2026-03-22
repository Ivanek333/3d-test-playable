import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { cfg } from '../utils/GameConfig';

export class InputManager {
  private readonly canvas: HTMLElement;
  private readonly camera: THREE.PerspectiveCamera;

  private readonly raycaster   = new THREE.Raycaster();
  private readonly playerPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private readonly hitPoint    = new THREE.Vector3();
  private readonly ndcPoint    = new THREE.Vector2();

  private activePointerId: number | null = null;
  private pointerStartX   = 0;
  private pointerStartY   = 0;
  private pointerPrevX    = 0;
  private pointerPrevY    = 0;
  private pointerPrevTime = 0;

  private gestureConsumed = false;
  private dragCommitted   = false;

  constructor(
    canvas: HTMLElement,
    private readonly bus: EventBus,
    camera: THREE.PerspectiveCamera,
  ) {
    this.canvas = canvas;
    this.camera = camera;

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

  updatePlayerZ(z: number): void {
    this.playerPlane.constant = -z;
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.activePointerId !== null) return;

    this.activePointerId = e.pointerId;
    this.pointerStartX   = e.clientX;
    this.pointerStartY   = e.clientY;
    this.pointerPrevX    = e.clientX;
    this.pointerPrevY    = e.clientY;
    this.pointerPrevTime = performance.now();
    this.gestureConsumed = false;
    this.dragCommitted   = false;

    this.bus.emit('input:targetX', { worldX: this.screenToWorldX(e.clientX) });

    this.canvas.setPointerCapture(e.pointerId);
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointerId) return;

    const now = performance.now();
    const dt = (now - this.pointerPrevTime) / 1000;
    const dy = e.clientY - this.pointerPrevY;
    const totalDX  = Math.abs(e.clientX - this.pointerStartX);

    const { swipeYThreshold, dragXCommit } = cfg().input;

    if (!this.gestureConsumed && !this.dragCommitted && dt > 0) {
      const vy = dy / dt;

      if (vy < -swipeYThreshold) {
        this.bus.emit('input:jump',  {});
        this.gestureConsumed = true;
      } else if (vy > swipeYThreshold) {
        this.bus.emit('input:slide', {});
        this.gestureConsumed = true;
      }
    }

    if (!this.gestureConsumed && totalDX > dragXCommit) {
      this.dragCommitted = true;
    }

    this.bus.emit('input:targetX', { worldX: this.screenToWorldX(e.clientX) });

    this.pointerPrevX = e.clientX;
    this.pointerPrevY = e.clientY;
    this.pointerPrevTime = now;
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activePointerId) return;
    this.activePointerId = null;
  };

  private screenToWorldX(screenX: number): number {
    this.ndcPoint.set((screenX / window.innerWidth) * 2 - 1, 0);
    this.raycaster.setFromCamera(this.ndcPoint, this.camera);

    const hit = this.raycaster.ray.intersectPlane(this.playerPlane, this.hitPoint);
    if (!hit) return 0;

    const hw = cfg().player.playableTrackWidth / 2;
    return THREE.MathUtils.clamp(hit.x, -hw, hw);
  }
}