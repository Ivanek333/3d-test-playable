import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { cfg } from '../utils/GameConfig';

export class Environment {
  private readonly sky: Sky;
  private readonly sun: THREE.Vector3 = new THREE.Vector3();

  private readonly dirLight: THREE.DirectionalLight;

  constructor(
    private readonly scene:    THREE.Scene,
    private readonly renderer: THREE.WebGLRenderer,
  ) {
    this.setupFog();
    this.sky = this.setupSky();
    this.dirLight = this.setupLighting();
    this.updateSunPosition();
  }

  followPlayer(playerZ: number): void {
    this.dirLight.position.set(
      this.sun.x * 50,
      this.sun.y * 50,
      playerZ + this.sun.z * 50,
    );
    this.dirLight.target.position.set(0, 0, playerZ);
    this.dirLight.target.updateMatrixWorld();
  }

  dispose(): void {
    this.scene.remove(this.sky);
  }

  private setupFog(): void {
    const { fogColor, fogDensity } = cfg().environment;
    const color = Number(fogColor);
    this.scene.fog        = new THREE.FogExp2(color, fogDensity);
    this.scene.background = new THREE.Color(color);
  }

  private setupSky(): Sky {
    const sky = new Sky();
    sky.scale.setScalar(10000);
    this.scene.add(sky);

    const u = sky.material.uniforms;
    u['turbidity'].value       = 4;
    u['rayleigh'].value        = 1.5;
    u['mieCoefficient'].value  = 0.003;
    u['mieDirectionalG'].value = 0.97;

    return sky;
  }

  private setupLighting(): THREE.DirectionalLight {
    const fogColor = Number(cfg().environment.fogColor);

    const hemi = new THREE.HemisphereLight(fogColor, 0x7caa5a, 0.3);
    this.scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xffffff, 0.15);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff4e0, 2.5);
    sun.castShadow = true;

    const { shadowCameraFar, shadowCameraExtent } = cfg().environment;
    sun.shadow.camera.near   = 0.5;
    sun.shadow.camera.far    = shadowCameraFar;
    sun.shadow.camera.left   = -shadowCameraExtent;
    sun.shadow.camera.right  =  shadowCameraExtent;
    sun.shadow.camera.top    =  shadowCameraExtent;
    sun.shadow.camera.bottom = -shadowCameraExtent;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.001;

    this.scene.add(sun);
    this.scene.add(sun.target);

    return sun;
  }

  private updateSunPosition(): void {
    const { sunElevation, sunAzimuth } = cfg().environment;
    const phi   = THREE.MathUtils.degToRad(90 - sunElevation);
    const theta = THREE.MathUtils.degToRad(sunAzimuth);

    this.sun.setFromSphericalCoords(1, phi, theta);

    (this.sky.material.uniforms['sunPosition'].value as THREE.Vector3).copy(this.sun);

    // Initial position — followPlayer() repositions this every frame.
    this.dirLight.position.copy(this.sun).multiplyScalar(50);
    this.dirLight.updateMatrixWorld();

    const pmrem  = new THREE.PMREMGenerator(this.renderer);
    const envMap = pmrem.fromScene(new RoomEnvironment()).texture;
    this.scene.environment = envMap;
    pmrem.dispose();
  }
}