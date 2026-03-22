import * as THREE from 'three';
import { cfg } from '../utils/GameConfig';
import { ObstacleWallSlot, buildObstacleSlot } from './ObstacleManager';
import { CoinLineSlot,     buildCoinSlot      } from './CoinManager';
import { GatePairSlot,     buildGateSlot      } from './GateManager';

export const LANE_COUNT  = 3;
export const TRACK_WIDTH = cfg().player.playableTrackWidth;
export const LANE_WIDTH  = TRACK_WIDTH / LANE_COUNT;
export const LANE_CENTERS = [
  -LANE_WIDTH,
   0,
   LANE_WIDTH,
] as const;

export type EntitySlot = ObstacleWallSlot | CoinLineSlot | GatePairSlot;

export class Chunk {
  worldZ:    number  = 0;
  populated: boolean = false;
  readonly slots: EntitySlot[] = [];

  private readonly mesh: THREE.Mesh;

  constructor(
    private readonly scene: THREE.Scene,
    material: THREE.Material,
  ) {
    const { chunkWidth, chunkLength } = cfg().track;
    const geo  = new THREE.PlaneGeometry(chunkWidth, chunkLength);
    this.mesh  = new THREE.Mesh(geo, material);
    this.mesh.rotation.x   = -Math.PI / 2;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  reset(worldZ: number, nextChunkFirstSlotZ?: number): void {
    this.worldZ       = worldZ;
    this.populated    = false;
    this.slots.length = 0;
    this.mesh.visible = true;
    this.mesh.position.set(0, 0, worldZ + cfg().track.chunkLength / 2);
    this.buildSlots(nextChunkFirstSlotZ);
  }

  parkBehind(worldZ: number): void {
    this.worldZ       = worldZ;
    this.populated    = true;
    this.slots.length = 0;
    this.mesh.visible = false;
    this.mesh.position.set(0, 0, worldZ + cfg().track.chunkLength / 2);
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
  }

  get farEdgeZ(): number { return this.worldZ + cfg().track.chunkLength; }
  get centreZ():  number { return this.worldZ + cfg().track.chunkLength / 2; }

  
  private buildSlots(nextChunkFirstSlotZ?: number): void {
    const { chunkLength, slotsPerChunk, slotPadding, obstacleStartZ } = cfg().track;
    const { obstacleWeight, coinWeight, gateWeight }                   = cfg().layout;
    const { triggerZ, clearZoneBefore }                                = cfg().finishLine;

    const clearStart = triggerZ - clearZoneBefore;

    const usable = chunkLength - slotPadding * 2;

    for (let i = 0; i < slotsPerChunk; i++) {
      const t     = slotsPerChunk === 1 ? 0.5 : i / (slotsPerChunk - 1);
      const slotZ = this.worldZ + slotPadding + t * usable;

      if (slotZ < obstacleStartZ) continue;
      if (slotZ >= clearStart) continue;

      let nextSlotZ: number;
      if (i < slotsPerChunk - 1) {
        const tNext = (i + 1) / (slotsPerChunk - 1);
        nextSlotZ   = this.worldZ + slotPadding + tNext * usable;
      } else {
        nextSlotZ = nextChunkFirstSlotZ ?? (this.worldZ + chunkLength - slotPadding);
      }

      const roll = Math.random();

      if (roll < obstacleWeight) {
        this.slots.push(buildObstacleSlot(slotZ));
      } else if (roll < obstacleWeight + coinWeight) {
        this.slots.push(buildCoinSlot(slotZ, nextSlotZ));
      } else if (roll < obstacleWeight + coinWeight + gateWeight) {
        this.slots.push(buildGateSlot(slotZ));
      }
    }
  }
}