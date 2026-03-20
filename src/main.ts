import * as THREE from 'three';
import { getModel, getModelScene, preloadAll } from './utils/AssetManager';

await preloadAll();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = -3;
camera.position.y = 3;
camera.rotation.y = Math.PI;
camera.rotation.x = 1/2;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 2, 3);
scene.add(directionalLight);

/*const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);*/


const char = getModel('summer_anims.glb');
printTree(char.scene);
char.animations.forEach(a => console.log(`${a.name}`))
const skinnedMesh = char.scene.getObjectByProperty('isSkinnedMesh', true) as THREE.SkinnedMesh;
(skinnedMesh.material as THREE.MaterialProperties).depthWrite = true;
const characterRoot = char.scene;
scene.add(characterRoot);
characterRoot.position.set(0, 0, 0);

const hips = skinnedMesh.skeleton.bones[0];

const mixer = new THREE.AnimationMixer(char.scene);
const running  = mixer.clipAction(THREE.AnimationClip.findByName(char.animations, 'running')!);
const sliding  = mixer.clipAction(THREE.AnimationClip.findByName(char.animations, 'sliding')!);
const jumping  = mixer.clipAction(THREE.AnimationClip.findByName(char.animations, 'jumping')!);
jumping.play();

const MAX_FRAME_DELTA = 2
const timer = new THREE.Timer();
var t = 0
const hipLastLocal = new THREE.Vector3();
const angle = 0;

function animate() {
    const worldBefore = new THREE.Vector3();
    const worldAfter = new THREE.Vector3();
    requestAnimationFrame(animate);
    timer.update();

    hips.position.copy(hipLastLocal);
    hips.getWorldPosition(worldBefore);
    mixer.update(timer.getDelta());
    hips.getWorldPosition(worldAfter);
    t += timer.getDelta();  

    const angle = Math.sin(t) * (Math.PI / 4);
    characterRoot.rotation.y = angle;

    const rootMotionDelta = worldAfter.clone().sub(worldBefore);
    if (rootMotionDelta.length() < MAX_FRAME_DELTA) {
      characterRoot.position.z += rootMotionDelta.z;
      characterRoot.position.x += rootMotionDelta.x;
    }
    characterRoot.position.y += rootMotionDelta.y
    hipLastLocal.copy(hips.position);
    hips.position.set(0, 0, 0);

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});



function printTree(object: THREE.Object3D, indent = 0): void {
  console.log(' '.repeat(indent * 2) + `[${object.type}] "${object.name}"`);
  object.children.forEach(child => printTree(child, indent + 1));
}

function traverseTree(object: THREE.Object3D, f: (obj: THREE.Object3D, depth: number) => void, depth = 0): void {
  f(object, depth);
  object.children.forEach(child => traverseTree(child, f, depth + 1));
}