import { Player } from '../player/Player';
import { ObstacleManager } from '../world/ObstacleManager';
import { CoinManager } from '../world/CoinManager';
import { GateManager } from '../world/GateManager';
import { EventBus } from './EventBus';


export interface AABB {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

function overlaps(a: AABB, b: AABB): boolean {
  return (
    a.maxX > b.minX && a.minX < b.maxX &&
    a.maxY > b.minY && a.minY < b.maxY &&
    a.maxZ > b.minZ && a.minZ < b.maxZ
  );
}

export class CollisionSystem {
  private readonly playerBox: AABB = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
  private readonly entityBox: AABB = { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };

  constructor(
    private readonly player:    Player,
    private readonly obstacles: ObstacleManager,
    private readonly coins:     CoinManager,
    private readonly gates:     GateManager,
    private readonly bus:       EventBus,
  ) {}

  update(): void {
    this.buildPlayerBox(this.playerBox);
    this.checkObstacles();
    this.checkCoins();
    this.checkGates();
  }

  
  private buildPlayerBox(out: AABB): void {
    const pos = this.player.position;
    const box = this.player.colliderBox;
    out.minX = pos.x - box.hw;
    out.maxX = pos.x + box.hw;
    out.minY = pos.y + box.yOffset;
    out.maxY = pos.y + box.yOffset + box.hh * 2;
    out.minZ = pos.z - box.hd;
    out.maxZ = pos.z + box.hd;
  }


  private checkObstacles(): void {
    for (const inst of this.obstacles.activeObstacles) {
      this.setEntityBox(inst.worldX, inst.worldY, inst.worldZ, inst.hw, inst.hh, inst.hd);
      if (overlaps(this.playerBox, this.entityBox)) {
        this.bus.emit('obstacle:hit', {});
        this.bus.emit('player:died', {});
        return;
      }
    }
  }

  private checkCoins(): void {
    for (const inst of this.coins.activeCoins) {
      this.setEntityBox(inst.worldX, inst.worldY, inst.worldZ, inst.hw, inst.hh, inst.hd);
      if (overlaps(this.playerBox, this.entityBox)) {
        this.coins.collect(inst);
      }
    }
  }

  private checkGates(): void {
    const pos = this.player.position;
    for (const inst of this.gates.activeGates) {
      this.setEntityBox(inst.worldX, inst.worldY, inst.worldZ, inst.hw, inst.hh, inst.hd);
      if (overlaps(this.playerBox, this.entityBox)) {
        this.gates.trigger(inst, pos.x);
      }
    }
  }

  
  private setEntityBox(
    cx: number, cy: number, cz: number,
    hw: number, hh: number, hd: number,
  ): void {
    const b = this.entityBox;
    b.minX = cx - hw; b.maxX = cx + hw;
    b.minY = cy;      b.maxY = cy + hh * 2;
    b.minZ = cz - hd; b.maxZ = cz + hd;
  }
}