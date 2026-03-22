import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { Chunk, TRACK_WIDTH } from './Chunk';
import { cfg } from '../utils/GameConfig';
import { CollisionObject } from '../utils/Types';


export type GateOp = '+' | '-' | '*' | '/';

export interface GateSide {
  worldX:   number;
  op:       GateOp;
  value:    number;
  positive: boolean;
}

export interface GatePairSlot {
  kind:   'gate';
  worldZ: number;
  left:   GateSide;
  right:  GateSide;
}

export function buildGateSlot(worldZ: number): GatePairSlot {
  const positiveLeft = Math.random() < 0.5;

  const posEffect = pickPositiveEffect();
  const negEffect = pickNegativeEffect();

  const left: GateSide = {
    worldX:   -TRACK_WIDTH / 4,
    op:        positiveLeft ? posEffect.op : negEffect.op,
    value:     positiveLeft ? posEffect.value : negEffect.value,
    positive:  positiveLeft,
  };
  const right: GateSide = {
    worldX:    TRACK_WIDTH / 4,
    op:        positiveLeft ? negEffect.op : posEffect.op,
    value:     positiveLeft ? negEffect.value : posEffect.value,
    positive: !positiveLeft,
  };

  return { kind: 'gate', worldZ, left, right };
}


interface GateHalfInstance {
  group:    THREE.Group;
  mesh:     THREE.Mesh;
  label:    THREE.Mesh;
  texture:  THREE.CanvasTexture;
  canvas:   HTMLCanvasElement;
  worldZ:   number;
  worldX:   number;
  positive: boolean;
  op:       GateOp;
  value:    number;
}

interface GatePairInstance extends CollisionObject {
  left:   GateHalfInstance;
  right:  GateHalfInstance;
  active: boolean;
}


export class GateManager {
  private readonly pool: GatePairInstance[] = [];

  private readonly gateGeo:  THREE.BoxGeometry;
  private readonly labelGeo: THREE.PlaneGeometry;
  private readonly matPos:   THREE.MeshStandardMaterial;
  private readonly matNeg:   THREE.MeshStandardMaterial;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly bus:   EventBus,
  ) {
    const { height, depth, opacity, colorPositive, colorNegative } = cfg().gates;
    const gateWidth = TRACK_WIDTH / 2;

    this.gateGeo  = new THREE.BoxGeometry(gateWidth, height, depth);
    this.labelGeo = new THREE.PlaneGeometry(gateWidth * 0.8, height * 0.4);
    this.matPos   = new THREE.MeshStandardMaterial({
      color: Number(colorPositive), transparent: true, opacity,
    });
    this.matNeg   = new THREE.MeshStandardMaterial({
      color: Number(colorNegative), transparent: true, opacity,
    });

    this.prewarm();
  }

  
  update(chunks: readonly Chunk[], playerZ: number): void {
    this.recycleTrailing(playerZ);
    this.populateChunks(chunks);
  }

  get activeGates(): readonly GatePairInstance[] {
    return this.pool.filter(i => i.active);
  }

  trigger(pair: GatePairInstance, playerX: number): void {
    if (!pair.active) return;

    const side = playerX < 0 ? pair.left : pair.right;

    this.bus.emit('gate:entered', { positive: side.positive });
    this.bus.emit('gate:effect',  { op: side.op, value: side.value, positive: side.positive });

    pair.active  = false;
  }

  dispose(): void {
    for (const pair of this.pool) {
      this.scene.remove(pair.left.group);
      this.scene.remove(pair.right.group);
      pair.left.texture.dispose();
      pair.right.texture.dispose();
    }
    this.gateGeo.dispose();
    this.labelGeo.dispose();
    this.matPos.dispose();
    this.matNeg.dispose();
  }

  
  private prewarm(): void {
    const { poolSize, height, depth } = cfg().gates;
    const hw = TRACK_WIDTH / 2;  // full pair width so both halves are hittable
    const hh = height / 2;
    const hd = depth / 2;
    for (let i = 0; i < poolSize; i++) {
      this.pool.push({
        left:   this.makeHalf(),
        right:  this.makeHalf(),
        active: false,
        worldZ: 0, worldY: 0, worldX: 0,
        hw, hh, hd
      });
    }
  }

  private makeHalf(): GateHalfInstance {
    const { depth, labelCanvasW, labelCanvasH } = cfg().gates;

    const mat  = this.matPos.clone();
    const mesh = new THREE.Mesh(this.gateGeo, mat);

    const canvas  = document.createElement('canvas');
    canvas.width  = labelCanvasW;
    canvas.height = labelCanvasH;
    const texture  = new THREE.CanvasTexture(canvas);
    const labelMat = new THREE.MeshBasicMaterial({
      map:         texture,
      transparent: true,
      depthWrite:  false,
      side:        THREE.DoubleSide,
    });
    const label = new THREE.Mesh(this.labelGeo, labelMat);
    label.position.z = -(depth / 2 + 0.02);
    label.rotation.y = Math.PI;

    const group = new THREE.Group();
    group.add(mesh);
    group.add(label);
    group.visible = false;
    this.scene.add(group);

    return {
      group, mesh, label, texture, canvas,
      positive: true, op: '+', value: 0,
      worldX: 0, worldZ: 0,
    };
  }

  private recycleTrailing(playerZ: number): void {
    const recycleZ = playerZ - cfg().gates.recycleTrailZ;
    for (const pair of this.pool) {
      if (pair.active && pair.worldZ < recycleZ) {
        pair.left.group.visible  = false;
        pair.right.group.visible = false;
        pair.active = false;
      }
    }
  }

  private populateChunks(chunks: readonly Chunk[]): void {
    for (const chunk of chunks) {
      if (chunk.populated) continue;
      for (const slot of chunk.slots) {
        if (slot.kind !== 'gate') continue;
        this.spawnPair(slot);
      }
    }
  }

  private spawnPair(slot: GatePairSlot): void {
    const pair = this.pool.find(p => !p.active);
    if (!pair) { console.warn('GateManager: pool exhausted'); return; }

    this.configureHalf(pair.left,  slot.left,  slot.worldZ);
    this.configureHalf(pair.right, slot.right, slot.worldZ);

    pair.active = true;
    pair.worldZ = slot.worldZ;
  }

  private configureHalf(inst: GateHalfInstance, side: GateSide, worldZ: number): void {
    const { height, colorPositive, colorNegative } = cfg().gates;

    inst.group.position.set(side.worldX, height / 2, worldZ);
    (inst.mesh.material as THREE.MeshStandardMaterial).color.set(
      Number(side.positive ? colorPositive : colorNegative)
    );

    this.drawLabel(inst, side.op, side.value, side.positive);

    inst.worldZ   = worldZ;
    inst.worldX   = side.worldX;
    inst.positive = side.positive;
    inst.op       = side.op;
    inst.value    = side.value;
    inst.group.visible = true;
  }

  private drawLabel(inst: GateHalfInstance, op: GateOp, value: number, positive: boolean): void {
    const { labelCanvasW, labelCanvasH } = cfg().gates;
    const canvas = inst.canvas;
    const ctx    = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, labelCanvasW, labelCanvasH);

    const fontSize = Math.round(labelCanvasH * 0.75);
    ctx.fillStyle    = '#ffffff';
    ctx.font         = `bold ${fontSize}px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${opSymbol(op)}${value}`, labelCanvasW / 2, labelCanvasH / 2);

    inst.texture.needsUpdate = true;
  }
}


function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function opSymbol(op: GateOp): string {
  switch (op) {
    case '+': return '+';
    case '-': return '−';
    case '*': return '×';
    case '/': return '÷';
  }
}


interface GateEffect { op: GateOp; value: number; }

function pickPositiveEffect(): GateEffect {
  const { effectAddMin, effectAddMax, effectMulMin, effectMulMax, effectMulChance } = cfg().gates;
  if (Math.random() < effectMulChance) {
    return { op: '*', value: randomInt(effectMulMin, effectMulMax) };
  }
  return { op: '+', value: randomInt(effectAddMin, effectAddMax) };
}

function pickNegativeEffect(): GateEffect {
  const { effectAddMin, effectAddMax, effectMulMin, effectMulMax, effectMulChance } = cfg().gates;
  if (Math.random() < effectMulChance) {
    return { op: '/', value: randomInt(effectMulMin, effectMulMax) };
  }
  return { op: '-', value: randomInt(effectAddMin, effectAddMax) };
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}