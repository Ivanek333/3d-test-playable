import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { cfg } from '../utils/GameConfig';


export class FinishLine {
  private readonly mesh:    THREE.Mesh;
  private readonly texture: THREE.CanvasTexture;
  private triggered:        boolean = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly bus:   EventBus,
  ) {
    this.texture = this.buildTexture();
    this.mesh    = this.buildMesh();
    scene.add(this.mesh);
  }
  
  checkTrigger(playerZ: number): void {
    if (this.triggered) return;
    if (playerZ >= cfg().finishLine.triggerZ) {
      this.triggered = true;
      this.bus.emit('player:finished', {});
    }
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.texture.dispose();
  }


  private buildTexture(): THREE.CanvasTexture {
    const { checkersX, checkersY } = cfg().finishLine;

    const SIZE  = 512;
    const tileW = SIZE / checkersX;
    const tileH = SIZE / checkersY;

    const canvas  = document.createElement('canvas');
    canvas.width  = SIZE;
    canvas.height = SIZE;
    const ctx     = canvas.getContext('2d')!;

    for (let row = 0; row < checkersY; row++) {
      for (let col = 0; col < checkersX; col++) {
        ctx.fillStyle = (col + row) % 2 === 0 ? '#000000' : '#ffffff';
        ctx.fillRect(col * tileW, row * tileH, tileW, tileH);
      }
    }

    const tex       = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  private buildMesh(): THREE.Mesh {
    const { triggerZ, carpetLength, yOffset } = cfg().finishLine;
    const { chunkWidth }                      = cfg().track;

    const geo = new THREE.PlaneGeometry(chunkWidth, carpetLength);
    const mat = new THREE.MeshStandardMaterial({
      map:       this.texture,
      roughness: 0.7,
      metalness: 0.0,
    });

    const mesh         = new THREE.Mesh(geo, mat);
    mesh.rotation.x    = -Math.PI / 2;
    mesh.position.set(0, yOffset, triggerZ);
    mesh.receiveShadow = true;
    return mesh;
  }
}