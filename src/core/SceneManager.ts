import * as THREE from 'three';
import { cfg } from '../utils/GameConfig';

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled  = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    container.appendChild(this.renderer.domElement);

    const { near, far, fovDeg } = cfg().camera;
    this.camera = new THREE.PerspectiveCamera(fovDeg, 1, near, far);
    this.resize();

    window.addEventListener('resize', this.resize);
  }

  follow(playerPosition: THREE.Vector3, delta: number): void {
    const { offset, lookAheadZ } = cfg().camera;

    this.camera.position.set(
      offset.x,
      offset.y,
      playerPosition.z + offset.z,
    );

    this.camera.lookAt(0, 1, playerPosition.z + lookAheadZ);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private readonly resize = (): void => {
    const { w, h } = cfg().designResolution;
    const designAspect  = w / h;
    const designVFovRad = THREE.MathUtils.degToRad(cfg().camera.fovDeg);

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const screenAspect = screenW / screenH;

    this.renderer.setSize(screenW, screenH);

    let vFovRad: number;
    if (screenAspect >= designAspect) {
      vFovRad = designVFovRad;
    } else {
      const hFovRad = 2 * Math.atan(Math.tan(designVFovRad / 2) * designAspect);
      vFovRad = 2 * Math.atan(Math.tan(hFovRad / 2) / screenAspect);
    }

    this.camera.fov = THREE.MathUtils.radToDeg(vFovRad);
    this.camera.aspect = screenAspect;
    this.camera.updateProjectionMatrix();
  };
}