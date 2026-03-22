import * as AssetManager from '../utils/AssetManager';
import { EventBus } from './EventBus';
import { cfg } from '../utils/GameConfig';

export class SoundManager {
  private readonly ctx:        AudioContext;
  private readonly masterGain: GainNode;
  private readonly musicGain:  GainNode;

  private musicSource: AudioBufferSourceNode | null = null;
  private muted = false;

  private clipPhase       = 0;
  private lastPhase       = 0;
  private stepSoundIndex  = 0;
  private lastStepTime    = -Infinity;

  constructor(private readonly bus: EventBus) {
    this.ctx        = AssetManager.getAudioContext();
    this.masterGain = this.ctx.createGain();
    this.musicGain  = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.musicGain.connect(this.ctx.destination);

    this.applyVolumes();
    this.startMusic();
    this.registerBusListeners();
  }

  update(delta: number, runSpeedScale: number, isRunning: boolean): void {
    if (!isRunning) {
      this.clipPhase = 0;
      this.lastPhase = 0;
      return;
    }

    const { runningClipDuration, stepThresholds, stepMinInterval } = cfg().sounds;

    this.lastPhase  = this.clipPhase;
    this.clipPhase += (delta * runSpeedScale) / runningClipDuration;

    const wrapped = this.clipPhase >= 1.0;
    if (wrapped) this.clipPhase -= Math.floor(this.clipPhase);

    for (const threshold of stepThresholds) {
      const crossed =
        (!wrapped && this.lastPhase < threshold && this.clipPhase >= threshold) ||
        (wrapped  && this.lastPhase < threshold);

      if (crossed) {
        const now = this.ctx.currentTime;
        if (now - this.lastStepTime >= stepMinInterval) {
          this.playStep();
          this.lastStepTime = now;
        }
      }
    }
  }

  dispose(): void {
    this.stopMusic();
    this.bus.off('ui:mute_changed', this.onMuteChanged);
    this.bus.off('coin:collected', this.onCoinCollected);
    this.bus.off('obstacle:hit', this.onObstacleHit);
    this.bus.off('game:over', this.onGameOver);
    this.bus.off('game:won', this.onGameWon);
  }

  
  private registerBusListeners(): void {
    this.bus.on('ui:mute_changed', this.onMuteChanged);
    this.bus.on('coin:collected', this.onCoinCollected);
    this.bus.on('obstacle:hit', this.onObstacleHit);
    this.bus.on('game:over', this.onGameOver);
    this.bus.on('game:won', this.onGameWon);
  }

  private readonly onMuteChanged = ({ muted }: { muted: boolean }): void => {
    this.muted = muted;
    this.applyVolumes();
    if (muted) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
  };

  private readonly onCoinCollected = (): void => {
    this.playSfx(cfg().sounds.coinFile, cfg().sounds.coinVolume);
  };

  private readonly onObstacleHit = (): void => {
    this.playSfx(cfg().sounds.obstacleFile, cfg().sounds.obstacleVolume);
  };

  private readonly onGameOver = (): void => {
    this.playSfx(cfg().sounds.loseFile, cfg().sounds.loseVolume);
  };

  private readonly onGameWon = (): void => {
    this.playSfx(cfg().sounds.winFile, cfg().sounds.winVolume);
  };

  private startMusic(): void {
    if (this.muted || this.musicSource) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const src    = this.ctx.createBufferSource();
    src.buffer   = AssetManager.getAudioBuffer(cfg().sounds.musicFile);
    src.loop     = true;
    src.connect(this.musicGain);
    src.start();
    this.musicSource = src;
  }

  private stopMusic(): void {
    if (!this.musicSource) return;
    try { this.musicSource.stop(); } catch (_) { }
    this.musicSource.disconnect();
    this.musicSource = null;
  }

  
  private playSfx(file: string, volume: number): void {
    if (this.muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const src  = this.ctx.createBufferSource();
    src.buffer = AssetManager.getAudioBuffer(file);
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(this.masterGain);
    src.start();
  }

  private playStep(): void {
    const { stepFiles, stepVolume } = cfg().sounds;
    const file = stepFiles[randomInt(0, stepFiles.length - 1)];
    //this.stepSoundIndex++;
    this.playSfx(file, stepVolume);
  }

  private applyVolumes(): void {
    const { musicVolume, sfxVolume } = cfg().sounds;
    this.musicGain.gain.value  = this.muted ? 0 : musicVolume;
    this.masterGain.gain.value = this.muted ? 0 : sfxVolume;
  }
}


function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}