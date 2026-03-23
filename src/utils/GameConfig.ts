export {};

declare global {
  interface Window {
    GameConfig: GameConfig;
  }
}


export interface ColliderBox {
  hw:      number;  // half-width  (X)
  hh:      number;  // half-height (Y) — box spans [yOffset, yOffset + hh*2]
  hd:      number;  // half-depth  (Z)
  yOffset: number;  // bottom of box relative to position.y
}

export interface EntityCollider {
  hw: number;
  hh: number;
  hd: number;
}

export interface GameConfig {
  isDebug:          boolean;
  designResolution: { w: number; h: number };

  camera: {
    offset:     { x: number; y: number; z: number };
    lookAheadZ: number;
    fovDeg:     number;
    near:       number;
    far:        number;
  };

  player: {
    initialSpeed:       number;
    speedRamp:          number;
    maxSpeed:           number;
    playableTrackWidth: number;
    lateralStiffness:   number;
    rotationLerp:       number;
    jumpVelocity:       number;
    gravity:            number;
    maxLeanAngle:       number;
    model:              string;
    colliders: {
      running: ColliderBox;
      jumping: ColliderBox;
      sliding: ColliderBox;
    };
  };

  track: {
    chunkLength:    number;
    chunkWidth:     number;
    poolSize:       number;
    spawnLookahead: number;
    recycleTrail:   number;
    slotsPerChunk:  number;
    slotPadding:    number;
    obstacleStartZ: number;
  };

  layout: {
    obstacleWeight: number;
    coinWeight:     number;
    gateWeight:     number;
    coinMinCount:   number;
    coinMaxCount:   number;
  };

  obstacles: {
    model:         string;
    lowModelName:  string;
    highModelName: string;
    lowY:          number;
    highY:         number;
    xHalfOffset:   number;
    recycleTrailZ: number;
    collider:      EntityCollider;
  };

  coins: {
    model:         string;
    modelName:     string;
    y:             number;
    spinSpeed:     number;
    recycleTrailZ: number;
    poolSize:      number;
    collider:      EntityCollider;
  };

  gates: {
    height:           number;
    depth:            number;
    opacity:          number;
    colorPositive:    string;
    colorNegative:    string;
    labelCanvasW:     number;
    labelCanvasH:     number;
    recycleTrailZ:    number;
    poolSize:         number;
    triggerZWindow:   number;
    effectAddMin:     number;
    effectAddMax:     number;
    effectMulMin:     number;
    effectMulMax:     number;
    effectMulChance:  number;
  };

  environment: {
    fogDensity:         number;
    fogColor:           string;
    sunElevation:       number;
    sunAzimuth:         number;
    shadowCameraFar:    number;
    shadowCameraExtent: number;
  };

  input: {
    dragXCommitPct: number;
  };
  
  clips: {
    idle:    string;
    running: string;
    jumping: string;
    sliding: string;
    death:   string;
    win:     string;
  };

  images: {
    coin:    string;
    volume_on: string;
    volume_off: string;
    cursor: string;
  };

  sounds: {
    musicFile:           string;
    musicVolume:         number;
    stepFiles:           string[];
    stepVolume:          number;
    runningClipDuration: number;
    stepThresholds:      number[];
    stepMinInterval:     number;
    coinFile:    string;
    coinVolume:  number;
    obstacleFile:    string;
    obstacleVolume:  number;
    loseFile:    string;
    loseVolume:  number;
    winFile:     string;
    winVolume:   number;
    sfxVolume:   number;
  };

  finishLine: {
    triggerZ:        number;
    clearZoneBefore: number;
    carpetLength:    number;
    checkersX:       number;
    checkersY:       number;
    yOffset:         number;
  };
}

export const cfg = (): GameConfig => window.GameConfig;