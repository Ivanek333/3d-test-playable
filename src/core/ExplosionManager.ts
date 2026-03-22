import * as THREE from 'three';
import { EventBus } from './EventBus';

const PARTICLE_COUNT  = 24;
const POOL_SIZE       = 3;
const LIFETIME        = 0.55;
const SPEED_MIN       = 2;
const SPEED_MAX       = 6;
const SIZE            = 0.5;

interface Particle {
  mesh:   THREE.Mesh;
  vel:    THREE.Vector3;
  life:   number;
  active: boolean;
}

interface Explosion {
  particles: Particle[];
  active:    boolean;
}

export class ExplosionManager {
  private readonly explosions: Explosion[] = [];
  private readonly geo:        THREE.PlaneGeometry;
  private readonly mat:        THREE.MeshBasicMaterial;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly bus:   EventBus,
  ) {
    this.geo = new THREE.PlaneGeometry(SIZE, SIZE);
    this.mat = new THREE.MeshBasicMaterial({
      color:       0xff8800,
      transparent: true,
      depthWrite:  false,
      side:        THREE.DoubleSide,
    });

    // Pre-build the pool
    for (let e = 0; e < POOL_SIZE; e++) {
      const particles: Particle[] = [];
      for (let p = 0; p < PARTICLE_COUNT; p++) {
        const mesh = new THREE.Mesh(this.geo, this.mat.clone());
        mesh.visible = false;
        scene.add(mesh);
        particles.push({ mesh, vel: new THREE.Vector3(), life: 0, active: false });
      }
      this.explosions.push({ particles, active: false });
    }

    this.bus.on('obstacle:hit', this.onObstacleHit);
  }

  update(delta: number): void {
    for (const explosion of this.explosions) {
      if (!explosion.active) continue;

      let anyAlive = false;
      for (const p of explosion.particles) {
        if (!p.active) continue;

        p.life -= delta;
        if (p.life <= 0) {
          p.active      = false;
          p.mesh.visible = false;
          continue;
        }

        anyAlive = true;
        const t = p.life / LIFETIME;

        p.mesh.position.addScaledVector(p.vel, delta);
        p.mesh.position.y = Math.max(0.05, p.mesh.position.y);

        const scale = t * 1.4 + 0.2;
        p.mesh.scale.setScalar(scale);

        const col = (p.mesh.material as THREE.MeshBasicMaterial).color;
        col.setRGB(1, t * 0.55 + 0.45, t * 0.1);

        (p.mesh.material as THREE.MeshBasicMaterial).opacity = t * t;
      }

      if (!anyAlive) explosion.active = false;
    }
  }

  dispose(): void {
    this.bus.off('obstacle:hit', this.onObstacleHit);
    for (const explosion of this.explosions) {
      for (const p of explosion.particles) {
        this.scene.remove(p.mesh);
      }
    }
    this.geo.dispose();
    this.mat.dispose();
  }

  private readonly onObstacleHit = (): void => {
    this.spawn(this.playerPos);
  };

  private playerPos = new THREE.Vector3();
  setPlayerPosition(pos: THREE.Vector3): void {
    this.playerPos.copy(pos);
  }

  private spawn(origin: THREE.Vector3): void {
    const slot = this.explosions.find(e => !e.active);
    if (!slot) return;

    slot.active = true;

    for (const p of slot.particles) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI * 0.75;
      const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);

      p.vel.set(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed * 0.6 + speed * 0.4,
        Math.sin(phi) * Math.sin(theta) * speed,
      );

      p.mesh.position.copy(origin).setY(origin.y + 0.5);
      p.mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );
      p.life         = LIFETIME * (0.6 + Math.random() * 0.4);
      p.active       = true;
      p.mesh.visible = true;

      const scale = 0.8 + Math.random() * 0.8;
      p.mesh.scale.setScalar(scale);
    }
  }
}