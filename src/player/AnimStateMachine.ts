import * as THREE from 'three';
import { cfg } from '../utils/GameConfig';

export enum AnimState {
  Idle    = 'idle',
  Running = 'running',
  Jumping = 'jumping',
  Sliding = 'sliding',
  Death   = 'death',
  Win     = 'win',
}

interface TransitionConfig {
  duration:    number;
  hasExitTime: boolean;
}

const TRANSITIONS: Record<AnimState, Partial<Record<AnimState, TransitionConfig>>> = {
  [AnimState.Idle]: {
    [AnimState.Running]: { duration: 0.2, hasExitTime: false },
  },
  [AnimState.Running]: {
    [AnimState.Jumping]: { duration: 0.15, hasExitTime: false },
    [AnimState.Sliding]: { duration: 0.15, hasExitTime: false },
  },
  [AnimState.Jumping]: {
    [AnimState.Running]: { duration: 0.2, hasExitTime: true },
  },
  [AnimState.Sliding]: {
    [AnimState.Running]: { duration: 0.2, hasExitTime: true },
  },
  [AnimState.Death]: {},
  [AnimState.Win]:   {},
};

const LOOPONCE_STATES = new Set([
  AnimState.Jumping,
  AnimState.Sliding,
  AnimState.Death
]);

const RETURN_STATE: Partial<Record<AnimState, AnimState>> = {
  [AnimState.Jumping]: AnimState.Running,
  [AnimState.Sliding]: AnimState.Running,
};

const FORCE_TRANSITION_CFG: Partial<Record<AnimState, TransitionConfig>> = {
  [AnimState.Death]: { duration: 0.15, hasExitTime: false },
  [AnimState.Win]:   { duration: 0.15, hasExitTime: false },
};

const FIXED_TIMESCALE = 1;


export class AnimStateMachine {
  private readonly mixer:   THREE.AnimationMixer;
  private readonly actions: Map<AnimState, THREE.AnimationAction> = new Map();

  private current: AnimState = AnimState.Idle;

  constructor(
    root:  THREE.Object3D,
    clips: THREE.AnimationClip[],
  ) {
    this.mixer = new THREE.AnimationMixer(root);

    const clipsCfg = cfg().clips;
    const clipNames: Record<AnimState, string> = {
      [AnimState.Idle]:    clipsCfg.idle,
      [AnimState.Running]: clipsCfg.running,
      [AnimState.Jumping]: clipsCfg.jumping,
      [AnimState.Sliding]: clipsCfg.sliding,
      [AnimState.Death]:   clipsCfg.death,
      [AnimState.Win]:     clipsCfg.win,
    };

    for (const state of Object.values(AnimState)) {
      const clipName = clipNames[state];
      const clip = THREE.AnimationClip.findByName(clips, clipName);
      if (!clip) throw new Error(`AnimStateMachine: clip "${clipName}" not found`);

      const action = this.mixer.clipAction(clip);

      if (LOOPONCE_STATES.has(state)) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }

      this.actions.set(state, action);
    }

    this.actions.get(AnimState.Idle)!.play();
    this.mixer.addEventListener('finished', this.onActionFinished);
  }

  get state(): AnimState { return this.current; }

  transition(next: AnimState): boolean {
    if (next === this.current) return false;

    const config = TRANSITIONS[this.current]?.[next];
    if (!config) return false;

    this.crossfade(next, config);
    return true;
  }

  forceTransition(next: AnimState): void {
    if (next === this.current) return;

    const config = FORCE_TRANSITION_CFG[next];
    if (!config) {
      console.warn(`AnimStateMachine: no force-transition config for "${next}"`);
      return;
    }

    this.crossfade(next, config);
  }

  update(delta: number, runSpeedScale: number): void {
    const runAction = this.actions.get(AnimState.Running)!;
    runAction.timeScale = this.current === AnimState.Running ? runSpeedScale : FIXED_TIMESCALE;
    this.mixer.update(delta);
  }

  dispose(): void {
    this.mixer.removeEventListener('finished', this.onActionFinished);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }

  reset(): void {
    this.mixer.stopAllAction();
    this.mixer.setTime(0);
    const idle = this.actions.get(AnimState.Idle)!;
    idle.reset().play();
    this.current = AnimState.Idle;
  }


  private crossfade(next: AnimState, config: TransitionConfig): void {
    const from = this.actions.get(this.current)!;
    const to   = this.actions.get(next)!;

    to.reset().setEffectiveTimeScale(FIXED_TIMESCALE).setEffectiveWeight(1);
    from.crossFadeTo(to, config.duration, config.hasExitTime);
    to.play();

    this.current = next;
  }

  private readonly onActionFinished = (e: { action: THREE.AnimationAction }): void => {
    const finishedState = this.findStateForAction(e.action);
    if (finishedState === null) return;
    if (finishedState !== this.current) return;

    const returnTo = RETURN_STATE[finishedState];
    if (!returnTo) return;

    const config = TRANSITIONS[this.current]?.[returnTo];
    if (!config) return;

    this.crossfade(returnTo, config);
  };

  private findStateForAction(action: THREE.AnimationAction): AnimState | null {
    for (const [state, a] of this.actions) {
      if (a === action) return state;
    }
    return null;
  }
}