import * as THREE from 'three';
import { AnimStateMachine, AnimState } from './AnimStateMachine';
import { EventBus } from '../core/EventBus';
import { cfg, ColliderBox } from '../utils/GameConfig';
import * as AssetManager from '../utils/AssetManager';

export class Player {
  readonly position = new THREE.Vector3();

  get isSliding(): boolean { return this.anim.state === AnimState.Sliding; }
  get isJumping():  boolean { return this.anim.state === AnimState.Jumping; }
  get isRunning():  boolean { return this.anim.state === AnimState.Running; }
  get isFrozen(): boolean {
    const s = this.anim.state;
    return s === AnimState.Idle || s === AnimState.Death || s === AnimState.Win;
  }

  get colliderBox(): ColliderBox {
    const c = cfg().player.colliders;
    switch (this.anim.state) {
      case AnimState.Jumping: return c.jumping;
      case AnimState.Sliding: return c.sliding;
      default:                return c.running;
    }
  }

  get runSpeedScale(): number {
    const forwardSpeed = this.runningClipSpeed * this.speedMultiplier;
    return Math.hypot(this.vx, forwardSpeed) / this.runningClipSpeed;
  }

  private readonly root:    THREE.Group;
  private readonly hipBone: THREE.Bone;
  private readonly anim:    AnimStateMachine;

  private runningClipSpeed = 1;
  private speedMultiplier = 1;

  private vx = 0;
  private targetX = 0;
  private vy = 0;
  private currentAngle = 0;

  private readonly onInputTargetX = ({ worldX }: { worldX: number }) => this.setTargetX(worldX);
  private readonly onInputJump    = () => this.jump();
  private readonly onInputSlide   = () => this.slide();

  private readonly _measureBefore = new THREE.Vector3();
  private readonly _measureAfter  = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly bus:   EventBus,
  ) {
    const gltf = AssetManager.getModel(cfg().player.model);
    this.root = gltf.scene;
    this.root.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow    = true;
        child.receiveShadow = false;
      }
    });
    scene.add(this.root);

    const skinnedMesh = this.root.getObjectByProperty('isSkinnedMesh', true) as
      THREE.SkinnedMesh | undefined;
    if (!skinnedMesh) throw new Error('Player: no SkinnedMesh found in GLTF');
    (skinnedMesh.material as THREE.MaterialProperties).depthWrite = true;

    this.hipBone = skinnedMesh.skeleton.bones[0];
    this.anim = new AnimStateMachine(this.root, gltf.animations);

    const MEASURE_DELTA = 0.1;
    const runClip  = THREE.AnimationClip.findByName(gltf.animations, cfg().clips.running);
    const tmpMixer = new THREE.AnimationMixer(this.root);
    const tmpAction = tmpMixer.clipAction(runClip!);
    tmpAction.play();
 
    this.hipBone.getWorldPosition(this._measureBefore);
    tmpMixer.update(MEASURE_DELTA);
    this.hipBone.getWorldPosition(this._measureAfter);
 
    tmpMixer.stopAllAction();
    tmpMixer.uncacheRoot(this.root);

    const dz = this._measureAfter.z - this._measureBefore.z;
    const measured = dz / MEASURE_DELTA;

    this.runningClipSpeed = measured > 0.01 ? measured : 1;

    this.anim.reset();
    this.hipBone.position.set(0, 0, 0);
    this.root.position.copy(this.position);

    this.bus.on('input:targetX', this.onInputTargetX);
    this.bus.on('input:jump',    this.onInputJump);
    this.bus.on('input:slide',   this.onInputSlide);
  }


  setTargetX(x: number): void {
    const hw = cfg().player.playableTrackWidth/ 2;
    this.targetX = THREE.MathUtils.clamp(x, -hw, hw);
  }

  setSpeed(multiplier: number): void {
    this.speedMultiplier = Math.max(0, multiplier);
  }

  startRun(): void {
    this.anim.transition(AnimState.Running);
  }

  jump(): void {
    if (this.isFrozen || this.isJumping || this.isSliding) return;
    this.vy = cfg().player.jumpVelocity;
    this.anim.transition(AnimState.Jumping);
    this.bus.emit('player:jump', {});
  }

  slide(): void {
    if (this.isFrozen || this.isJumping || this.isSliding) return;
    this.anim.transition(AnimState.Sliding);
    this.bus.emit('player:slide', {});
  }

  die(): void {
    this.anim.forceTransition(AnimState.Death);
    this.vx = 0;
    this.vy = 0;
    this.speedMultiplier = 0;
  }
  
  win(): void {
    this.anim.forceTransition(AnimState.Win);
    this.vx = 0;
    this.vy = 0;
    this.speedMultiplier = 0;
    this.root.rotation.y = Math.PI;
  }

  update(delta: number): void {
    if (!this.isFrozen) {
        this.updateLateralVelocity(delta);
    }
    this.updateVertical(delta);
    this.updateAnimationAndPosition(delta);
    this.root.position.copy(this.position);
  }

  dispose(): void {
    this.bus.off('input:targetX', this.onInputTargetX);
    this.bus.off('input:jump',    this.onInputJump);
    this.bus.off('input:slide',   this.onInputSlide);
    this.anim.dispose();
    this.scene.remove(this.root);
  }

  private updateLateralVelocity(delta: number): void {
    const { lateralStiffness, maxLeanAngle } = cfg().player;
    const lateralDamping = 2 * Math.sqrt(lateralStiffness);
    const dx = this.targetX - this.position.x;
    this.vx += (dx * lateralStiffness - this.vx * lateralDamping) * delta;

    const forwardSpeed = this.runningClipSpeed * this.speedMultiplier;
    const maxVx = forwardSpeed * Math.tan(THREE.MathUtils.degToRad(maxLeanAngle));
    this.vx = THREE.MathUtils.clamp(this.vx, -maxVx, maxVx);
  }

  private updateVertical(delta: number): void {
    const { gravity } = cfg().player;
    if (this.position.y > 0 || this.vy > 0) {
      this.vy -= gravity * delta;
      this.position.y += this.vy * delta;
    }
    if (this.position.y < 0) {
      this.position.y = 0;
      this.vy = 0;
    }
  }

  private updateAnimationAndPosition(delta: number): void {
    const { rotationLerp, maxLeanAngle } = cfg().player;
    const maxLeanRad  = THREE.MathUtils.degToRad(maxLeanAngle);
    const forwardSpeed = this.runningClipSpeed * this.speedMultiplier;
    
    if (!this.isFrozen) {
        const targetAngle = Math.atan2(this.vx, forwardSpeed);
        const clamped = THREE.MathUtils.clamp(targetAngle, -maxLeanRad, maxLeanRad);
        this.currentAngle += (clamped - this.currentAngle) * Math.min(rotationLerp * delta, 1);
        this.root.rotation.y = this.currentAngle;
        this.position.z += forwardSpeed * delta;
        this.position.x += this.vx * delta;
    }
    this.anim.update(delta, this.runSpeedScale);
    if (!this.isFrozen) {
        this.hipBone.position.x = 0;
        this.hipBone.position.y = 0;
    }
  }
}