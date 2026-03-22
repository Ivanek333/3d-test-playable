import * as THREE from 'three';
import { EventBus } from './EventBus';
import { SceneManager } from './SceneManager';
import { InputManager } from './InputManager';
import * as AssetManager from '../utils/AssetManager';
import { Player } from '../player/Player';
import { Environment } from '../world/Enviroment';
import { TrackGenerator } from '../world/TrackGenerator';
import { ObstacleManager } from '../world/ObstacleManager';
import { CoinManager } from '../world/CoinManager';
import { GateManager } from '../world/GateManager';
import { FinishLine } from '../world/FinishLine';
import { cfg } from '../utils/GameConfig';
import { CollisionSystem } from './CollisionSystem';
import { UIManager } from '../ui/UIManager';
import { SoundManager } from './SoundManager';
import { ExplosionManager } from './ExplosionManager';


export enum GameState {
  Loading  = 'loading',
  Ready    = 'ready',
  Playing  = 'playing',
  GameOver = 'gameover',
  Won      = 'won',
}

export class GameManager {
  private readonly bus:         EventBus;
  private readonly scene:       SceneManager;
  private readonly input:       InputManager;
  private readonly environment: Environment;
  private readonly track:       TrackGenerator;
  private readonly gates:       GateManager;
  private readonly finishLine:  FinishLine;
  
  private obstacles: ObstacleManager | null = null;
  private coins:     CoinManager     | null = null;
  private player:    Player          | null = null;
  private collision: CollisionSystem | null = null;
  private ui:        UIManager       | null = null;
  private sound:     SoundManager    | null = null;
  private explosion: ExplosionManager | null = null;

  private state: GameState = GameState.Loading;
  private speed: number = 0;
  private rafId: number = 0;
  private readonly timer = new THREE.Timer();

  constructor(private readonly container: HTMLElement) {
    this.bus   = new EventBus();
    this.scene = new SceneManager(container);

    this.input = new InputManager(
      this.scene.renderer.domElement,
      this.bus,
      this.scene.camera,
    );

    this.environment = new Environment(this.scene.scene, this.scene.renderer);
    this.track       = new TrackGenerator(this.scene.scene);
    this.gates       = new GateManager(this.scene.scene, this.bus);
    this.finishLine  = new FinishLine(this.scene.scene, this.bus);

    this.registerBusListeners();
    this.load();
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.input.dispose();
    this.player?.dispose();
    this.obstacles?.dispose();
    this.coins?.dispose();
    this.gates.dispose();
    this.sound?.dispose();
    this.explosion?.dispose();
    this.finishLine.dispose();
    this.track.dispose();
    this.scene.dispose();
    this.bus.clear();
  }

  private async load(): Promise<void> {
    await AssetManager.preloadAll();

    this.obstacles = new ObstacleManager(this.scene.scene);
    this.coins     = new CoinManager(this.scene.scene, this.bus);
    this.player    = new Player(this.scene.scene, this.bus);

    this.collision = new CollisionSystem(
      this.player,
      this.obstacles,
      this.coins,
      this.gates,
      this.bus,
    );

    this.ui = new UIManager(this.container, this.bus);
    this.sound = new SoundManager(this.bus);
    this.explosion = new ExplosionManager(this.scene.scene, this.bus);

    this.speed = cfg().player.initialSpeed;
    this.state = GameState.Ready;
    this.startLoop();
  }

  private startLoop(): void {
    this.timer.update();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private readonly loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);
    this.timer.update();
    const delta = Math.min(this.timer.getDelta(), 0.1);
    this.update(delta);
    this.scene.render();
  };

  private update(delta: number): void {
    if (!this.player) return;

    if (this.state === GameState.Playing) {
        const { speedRamp, maxSpeed } = cfg().player;
        this.speed = Math.min(this.speed + speedRamp * delta, maxSpeed);
        this.player.setSpeed(this.speed);
    }

    this.player.update(delta);
    this.sound?.update(
      delta,
      this.player.runSpeedScale,
      this.player.isRunning,
    );

    this.input.updatePlayerZ(this.player.position.z);
    this.scene.follow(this.player.position, delta);
    this.environment.followPlayer(this.player.position.z);
    this.track.update(this.player.position.z);
    this.obstacles?.update(this.track.chunks, this.player.position.z);
    this.gates.update(this.track.chunks, this.player.position.z);
    this.coins?.update(this.track.chunks, this.player.position.z);
    for (const chunk of this.track.chunks) {
        if (!chunk.populated) chunk.populated = true;
    }

    this.explosion?.setPlayerPosition(this.player.position);
    this.explosion?.update(delta);

    if (this.state === GameState.Playing) {
        this.collision?.update();
        this.finishLine.checkTrigger(this.player.position.z);
    }
  }

  private registerBusListeners(): void {
    this.bus.on('input:targetX',   this.onFirstInput);
    this.bus.on('input:jump',      this.onFirstInput);
    this.bus.on('input:slide',     this.onFirstInput);
    this.bus.on('player:died',     this.onPlayerDied);
    this.bus.on('player:finished', this.onPlayerFinished);
  }

  private readonly onFirstInput = (): void => {
    if (this.state !== GameState.Ready) return;
    this.state = GameState.Playing;
    this.player!.setSpeed(this.speed);
    this.player!.startRun();
    this.bus.emit('game:started', {});

    this.bus.off('input:targetX', this.onFirstInput);
    this.bus.off('input:jump',    this.onFirstInput);
    this.bus.off('input:slide',   this.onFirstInput);
  };

  private readonly onPlayerDied = (): void => {
    if (this.state !== GameState.Playing) return;
    this.state = GameState.GameOver;
    this.player?.die();
    this.bus.emit('game:over', {
      score: Math.floor(this.player?.position.z ?? 0),
      coins: this.coins?.coinTotal ?? 0,
    });
  };

  private readonly onPlayerFinished = (): void => {
    if (this.state !== GameState.Playing) return;
    this.state = GameState.Won;
    this.player?.win();
    this.bus.emit('game:won', {
      score: Math.floor(this.player?.position.z ?? 0),
      coins: this.coins?.coinTotal ?? 0,
    });
  };
}