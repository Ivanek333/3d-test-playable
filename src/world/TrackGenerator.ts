import * as THREE from 'three';
import { Chunk } from './Chunk';
import { cfg } from '../utils/GameConfig';

export class TrackGenerator {
  private readonly pool:     Chunk[];
  private readonly material: THREE.MeshLambertMaterial;

  private frontZ: number = 0;

  constructor(private readonly scene: THREE.Scene) {
    this.material = new THREE.MeshLambertMaterial({ color: 0x7caa5a });

    this.pool = Array.from({ length: cfg().track.poolSize }, () => new Chunk(scene, this.material));

    // Start one chunk behind the player so there's ground under the camera at spawn.
    this.frontZ = -cfg().track.chunkLength;

    for (const chunk of this.pool) {
      this.placeChunk(chunk, this.frontZ);
    }
  }

  update(playerZ: number): void {
    this.recycleTrailing(playerZ);
    this.ensureLookahead(playerZ);
  }

  get chunks(): readonly Chunk[] {
    return this.pool;
  }

  dispose(): void {
    for (const chunk of this.pool) chunk.dispose();
    this.material.dispose();
  }

  
  private get trackEndZ(): number {
    return cfg().finishLine.triggerZ + cfg().track.chunkLength * 0.5;
  }

  private placeChunk(chunk: Chunk, worldZ: number): void {
    const { chunkLength, slotPadding } = cfg().track;
    const nextFirstSlotZ = worldZ + chunkLength + slotPadding;
    chunk.reset(worldZ, nextFirstSlotZ);
    this.frontZ = worldZ + chunkLength;
  }

  private recycleTrailing(playerZ: number): void {
    const recycleZ = playerZ - cfg().track.recycleTrail * cfg().track.chunkLength;
    for (const chunk of this.pool) {
      if (chunk.farEdgeZ < recycleZ) {
        if (this.frontZ < this.trackEndZ) {
          this.placeChunk(chunk, this.frontZ);
        } else {
          chunk.parkBehind(recycleZ - cfg().track.chunkLength);
        }
      }
    }
  }

  private ensureLookahead(playerZ: number): void {
    if (this.frontZ >= this.trackEndZ) return;

    const lookahead = playerZ + cfg().track.spawnLookahead * cfg().track.chunkLength;
    const recycleZ  = playerZ - cfg().track.recycleTrail   * cfg().track.chunkLength;

    while (this.frontZ < lookahead && this.frontZ < this.trackEndZ) {
      const candidate = this.pool.find(c => c.farEdgeZ < recycleZ);
      if (!candidate) break;
      this.placeChunk(candidate, this.frontZ);
    }
  }
}