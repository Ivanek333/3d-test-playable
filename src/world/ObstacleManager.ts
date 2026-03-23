import * as THREE from 'three';
import * as AssetManager from '../utils/AssetManager';
import { Chunk, LANE_CENTERS } from './Chunk';
import { cfg } from '../utils/GameConfig';
import { CollisionObject } from '../utils/Types';


export interface ObstacleWallSlot {
  kind:         'obstacle';
  worldZ:       number;
  blockedLanes: number[];
}

export function buildObstacleSlot(worldZ: number): ObstacleWallSlot {
  const allLanes = [0, 1, 2];
  const blockedCount = randomInt(1, 2);
  const blockedLanes = shuffle([...allLanes]).slice(0, blockedCount);
  return { kind: 'obstacle', worldZ, blockedLanes };
}

interface ObstacleInstance extends CollisionObject {
  mesh:   THREE.Object3D;
  active: boolean;
}


export class ObstacleManager {
  private readonly pool:  ObstacleInstance[] = [];
  private readonly proto: THREE.Object3D;

  constructor(
    private readonly scene: THREE.Scene,
  ) {
    const gltf = AssetManager.getModel(cfg().obstacles.model);
    const { lowModelName } = cfg().obstacles;

    const low = gltf.scene.getObjectByName(lowModelName);
    if (!low) throw new Error(`ObstacleManager: "${lowModelName}" not found in GLTF`);

    this.proto = low;
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
    const maxMeshes = cfg().track.poolSize * 2 * 2;
    ((this.proto as THREE.Mesh).material as THREE.MaterialProperties).depthWrite = true;
    for (let i = 0; i < maxMeshes; i++) this.addToPool();
  }

  private addToPool(): void {
    const mesh = this.proto.clone();
    mesh.visible = false;
    mesh.castShadow = true;
    mesh.traverse(child => { if ((child as THREE.Mesh).isMesh) child.castShadow = true; });
    this.scene.add(mesh);
    this.pool.push({ mesh, active: false,
      worldX: 0, worldY: 0, worldZ: 0, hw: 0, hh: 0, hd: 0 });
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
    const { lowY, xHalfOffset } = cfg().obstacles;
    for (const laneIdx of slot.blockedLanes) {
      const laneX = LANE_CENTERS[laneIdx];
      this.placeObstacle(laneX - xHalfOffset, lowY, slot.worldZ);
      this.placeObstacle(laneX + xHalfOffset, lowY, slot.worldZ);
    }
  }

  private placeObstacle(x: number, y: number, z: number): void {
    let inst = this.pool.find(i => !i.active);
    if (!inst) {
      console.warn('ObstacleManager: pool exhausted, growing');
      this.addToPool();
      inst = this.pool[this.pool.length - 1];
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