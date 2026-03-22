import * as THREE from 'three';
import * as AssetManager from '../utils/AssetManager';
import { Chunk, LANE_CENTERS } from './Chunk';
import { cfg } from '../utils/GameConfig';
import { CollisionObject } from '../utils/Types';


export interface ObstacleWallSlot {
  kind:             'obstacle';
  worldZ:           number;
  lowBlockedLanes:  number[];
  highBlockedLanes: number[];
}

export function buildObstacleSlot(worldZ: number): ObstacleWallSlot {
  const allLanes = [0, 1, 2];
  const lowCount  = randomInt(0, 2);
  const highCount = randomInt(0, 2);
  const lowBlocked  = shuffle([...allLanes]).slice(0, lowCount);
  const available   = allLanes.filter(l => !lowBlocked.includes(l));
  const highBlocked = shuffle(available).slice(0, Math.min(highCount, available.length));
  return { kind: 'obstacle', worldZ, lowBlockedLanes: lowBlocked, highBlockedLanes: highBlocked };
}

interface ObstacleInstance extends CollisionObject {
  mesh:   THREE.Object3D;
  active: boolean;
  protoName: string;
}


export class ObstacleManager {
  private readonly pool:      ObstacleInstance[] = [];
  private readonly lowProto:  THREE.Object3D;
  private readonly highProto: THREE.Object3D;

  constructor(
    private readonly scene: THREE.Scene,
  ) {
    const gltf = AssetManager.getModel(cfg().obstacles.model);
    const { lowModelName, highModelName } = cfg().obstacles;

    const low = gltf.scene.getObjectByName(lowModelName);
    if (!low)  throw new Error(`ObstacleManager: "${lowModelName}" not found in GLTF`);
    const high = gltf.scene.getObjectByName(highModelName);
    if (!high) throw new Error(`ObstacleManager: "${highModelName}" not found in GLTF`);

    this.lowProto  = low;
    this.highProto = high;

    this.prewarm();
  }

  update(chunks: readonly Chunk[], playerZ: number): void {
    this.recycleTrailing(playerZ);
    this.populateChunks(chunks);
  } 
  
  get activeObstacles(): readonly ObstacleInstance[] {
    return this.pool.filter(i => i.active);
  }

  dispose(): void {
    for (const inst of this.pool) this.scene.remove(inst.mesh);
    this.pool.length = 0;
  }

  
  private prewarm(): void {
    const { poolSize } = cfg().track;
    const maxMeshes    = poolSize * 3 * 3 * 2 * 2;

    ((this.lowProto as THREE.Mesh).material as THREE.MaterialProperties).depthWrite = true;
    ((this.highProto as THREE.Mesh).material as THREE.MaterialProperties).depthWrite = true;
    
    for (let i = 0; i < maxMeshes; i++) {
      const proto = i < maxMeshes / 2 ? this.lowProto : this.highProto;
      this.addToPool(proto);
    }
  }

  private addToPool(proto: THREE.Object3D): void {
    const mesh = proto.clone();
    mesh.visible = false;
    mesh.castShadow = true;
    mesh.traverse(child => { if ((child as THREE.Mesh).isMesh) child.castShadow = true; });
    this.scene.add(mesh);
    this.pool.push({ mesh, active: false, protoName: proto.name,
        worldX: 0, worldY: 0, worldZ: 0,
        hw: 0, hh: 0, hd: 0, });
  }

  private recycleTrailing(playerZ: number): void {
    const recycleZ = playerZ - cfg().obstacles.recycleTrailZ;
    for (const inst of this.pool) {
      if (inst.active && inst.worldZ < recycleZ) {
        inst.mesh.visible = false;
        inst.active = false;
      }
    }
  }

  private populateChunks(chunks: readonly Chunk[]): void {
    for (const chunk of chunks) {
      if (chunk.populated) continue;
      for (const slot of chunk.slots) {
        if (slot.kind !== 'obstacle') continue;
        this.spawnWall(slot);
      }
    }
  }

  private spawnWall(slot: ObstacleWallSlot): void {
    const { lowY, highY } = cfg().obstacles;
    this.spawnRow(slot.worldZ, slot.lowBlockedLanes,  lowY,  this.lowProto);
    this.spawnRow(slot.worldZ, slot.highBlockedLanes, highY, this.highProto);
  }

  private spawnRow(worldZ: number, blockedLanes: number[], y: number, proto: THREE.Object3D): void {
    const offset = cfg().obstacles.xHalfOffset;
    for (const laneIdx of blockedLanes) {
      const laneX = LANE_CENTERS[laneIdx];
      this.placeObstacle(laneX - offset, y, worldZ, proto);
      this.placeObstacle(laneX + offset, y, worldZ, proto);
    }
  }

  private placeObstacle(x: number, y: number, z: number, proto: THREE.Object3D): void {
    let inst = this.pool.find(i => !i.active && i.protoName === proto.name);
    if (!inst) inst = this.pool.find(i => !i.active);
    if (!inst) {
      console.warn('ObstacleManager: pool exhausted, growing');
      this.addToPool(proto);
      inst = this.pool[this.pool.length - 1];
    }

    if (inst.protoName !== proto.name) {
      this.scene.remove(inst.mesh);
      const fresh = proto.clone();
      fresh.visible  = false;
      this.scene.add(fresh);
      inst.mesh      = fresh;
      inst.protoName = proto.name;
    }
    
    const { hw, hh, hd } = cfg().obstacles.collider;
    inst.mesh.position.set(x, y, z);
    inst.mesh.visible = true;
    inst.active       = true;
    inst.worldX       = x;
    inst.worldY       = y;
    inst.worldZ       = z;
    inst.hw           = hw;
    inst.hh           = hh;
    inst.hd           = hd;
  }
}


function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}