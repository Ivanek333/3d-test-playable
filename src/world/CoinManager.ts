import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { Chunk, LANE_CENTERS } from './Chunk';
import { cfg } from '../utils/GameConfig';
import * as AssetManager from '../utils/AssetManager';
import { CollisionObject } from '../utils/Types';


export interface CoinLineSlot {
  kind:      'coins';
  worldZ:    number;
  endZ:      number;
  laneIndex: number;
  count:     number;
}

export function buildCoinSlot(worldZ: number, endZ: number): CoinLineSlot {
  const { coinMinCount, coinMaxCount } = cfg().layout;
  const laneIndex = randomInt(0, LANE_COUNT - 1);
  const span      = endZ - worldZ;
  const count     = Math.min(coinMaxCount, Math.max(coinMinCount, Math.round(span / 3)));
  return { kind: 'coins', worldZ, endZ, laneIndex, count };
}

const LANE_COUNT = 3;


interface CoinInstance extends CollisionObject {
  mesh:      THREE.Object3D;
  active:    boolean;
  collected: boolean;
}


export class CoinManager {
  private readonly pool:  CoinInstance[] = [];
  private readonly proto: THREE.Object3D;

  private total: number = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly bus:   EventBus,
  ) {
    const { model, modelName } = cfg().coins;
    const gltf  = AssetManager.getModel(model);
    
    const found = gltf.scene.getObjectByName(modelName);
    if (!found) throw new Error(`CoinManager: "${modelName}" not found in "${model}"`);
    this.proto = found;

    this.prewarm();
    this.registerBusListeners();
  }

  update(chunks: readonly Chunk[], playerZ: number): void {
    this.recycleTrailing(playerZ);
    this.populateChunks(chunks);
    this.spinCoins();
  }

  get coinTotal(): number { return this.total; }

  get activeCoins(): readonly CoinInstance[] {
    return this.pool.filter(i => i.active && !i.collected);
  }

  collect(inst: CoinInstance): void {
    if (inst.collected) return;
    inst.collected    = true;
    inst.mesh.visible = false;
    this.total       += 1;
    this.bus.emit('coin:collected', { value: 1, total: this.total });
  }

  dispose(): void {
    for (const inst of this.pool) this.scene.remove(inst.mesh);
  }

  
  private prewarm(): void {
    const { poolSize } = cfg().coins;
    const { hw, hh, hd } = cfg().coins.collider;
    ((this.proto as THREE.Mesh).material as THREE.MaterialProperties).depthWrite = true;
    for (let i = 0; i < poolSize; i++) {
      const mesh = this.proto.clone();
      mesh.visible = false;
      mesh.castShadow = true;
      mesh.traverse(child => { if ((child as THREE.Mesh).isMesh) child.castShadow = true; });
      this.scene.add(mesh);
      this.pool.push({
        mesh, active: false, collected: false,
        worldX: 0, worldY: 0, worldZ: 0,
        hw, hh, hd
      });
    }
  }

  private recycleTrailing(playerZ: number): void {
    const recycleZ = playerZ - cfg().coins.recycleTrailZ;
    for (const inst of this.pool) {
      if (inst.active && inst.worldZ < recycleZ) {
        inst.mesh.visible = false;
        inst.active       = false;
        inst.collected    = false;
      }
    }
  }

  private populateChunks(chunks: readonly Chunk[]): void {
    for (const chunk of chunks) {
      if (chunk.populated) continue;
      for (const slot of chunk.slots) {
        if (slot.kind !== 'coins') continue;
        this.spawnLine(slot);
      }
    }
  }

  private spawnLine(slot: CoinLineSlot): void {
    const { worldZ, endZ, laneIndex, count } = slot;
    const x     = LANE_CENTERS[laneIndex];
    const coinY = cfg().coins.y;

    for (let i = 0; i < count; i++) {
      const t = i / count;
      const z = worldZ + t * (endZ - worldZ);
      this.placeCoin(x, coinY, z);
    }
  }

  private placeCoin(x: number, y: number, z: number): void {
    const inst = this.pool.find(i => !i.active);
    if (!inst) { console.warn('CoinManager: pool exhausted'); return; }
    inst.mesh.position.set(x, y, z);
    inst.mesh.rotation.z = z;
    inst.mesh.visible = true;
    inst.active       = true;
    inst.collected    = false;
    inst.worldX       = x;
    inst.worldY       = y;
    inst.worldZ       = z;
  }

  private spinCoins(): void {
    const { spinSpeed } = cfg().coins;
    for (const inst of this.pool) {
      if (inst.active && !inst.collected) {
        inst.mesh.rotation.z += spinSpeed;
      }
    }
  }

  private registerBusListeners(): void {
    this.bus.on('gate:effect', ({ op, value }) => {
      switch (op) {
        case '+': this.total = this.total + value;               break;
        case '-': this.total = Math.max(0, this.total - value);  break;
        case '*': this.total = Math.round(this.total * value);   break;
        case '/': this.total = Math.round(this.total / value);   break;
      }
      this.bus.emit('coin:collected', { value: 0, total: this.total });
    });
  }
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}