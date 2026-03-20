import { Texture, TextureLoader, NearestFilter } from 'three';
import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

//*

async function makeGLTFLoader(): Promise<GLTFLoader> {
  const wrapperDataUrl = dracoWasmWrapper(dracoWasmWrapper.keys()[0]);
  const wasmDataUrl = dracoDecoder(dracoDecoder.keys()[0]);
  const wrapperText = await fetch(wrapperDataUrl).then(r => r.text());
  const wasmBuffer  = await fetch(wasmDataUrl).then(r => r.arrayBuffer());

  const draco = new DRACOLoader();
  draco.setDecoderConfig({
    wasmBinary: wasmBuffer,
    wasmBinaryFile: wasmDataUrl,      // data:application/wasm;base64,...
    //javascriptFile: ,  // data:application/javascript;base64,...
  });
  const origLoad = (draco as any)._loadLibrary.bind(draco);
  (draco as any)._loadLibrary = (url: string, responseType: string) => {
    if (url === 'draco_wasm_wrapper.js') {
      return Promise.resolve(wrapperText);
    }
    if (url === 'draco_decoder.wasm') {
      return Promise.resolve(wasmBuffer);
    }
    return origLoad(url, responseType);
  };
  draco.preload();

  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  return loader;
} //*/ 
/*
function makeGLTFLoader(): GLTFLoader {
  return new GLTFLoader();
}//*/

// ─── Webpack asset inlining ───────────────────────────────────────────────────
// Each require.context call tells webpack to base64-inline all matching files
// at build time. Keys are like './hero.glb', './stone.png', './jump.mp3'.

declare const require: {
  context(dir: string, deep: boolean, re: RegExp): {
    keys(): string[];
    (id: string): string; // returns data URL after inlining
  };
};

const rawModels   = require.context('../../assets/models',   true, /\.glb$/);
const rawTextures = require.context('../../assets/textures', true, /\.(png|jpg|jpeg)$/);
const rawSounds   = require.context('../../assets/sounds',   true, /\.mp3$/);
const dracoWasmWrapper = require.context('../../node_modules/three/examples/jsm/libs/draco',   false, /draco_wasm_wrapper\.js$/);
const dracoDecoder = require.context('../../node_modules/three/examples/jsm/libs/draco',   false, /draco_decoder\.wasm$/); 

// ─── Types ────────────────────────────────────────────────────────────────────

type AssetKey<Ctx extends ReturnType<typeof require.context>> =
  ReturnType<Ctx['keys']>[number] extends `${string}/${infer Name}` ? Name :
  ReturnType<Ctx['keys']>[number] extends `./${infer Name}` ? Name : string;

// ─── Internal caches ──────────────────────────────────────────────────────────

const textureCache = new Map<string, Texture>();
const modelCache   = new Map<string, GLTF>();
const audioCache   = new Map<string, AudioBuffer>();

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

// ─── Key normalisation ────────────────────────────────────────────────────────
// './subdir/hero.glb' → 'hero.glb'   |   'hero.glb' → 'hero.glb'

function normalise(raw: string): string {
  return raw.replace(/^\.\//, '').replace(/^.*\//, '');
}

export async function preloadAll(): Promise<void> {
  await Promise.all([
    preloadTextures(),
    preloadModels(),
    preloadSounds(),
  ]);
}

async function preloadTextures(): Promise<void> {
  const loader = new TextureLoader();
  await Promise.all(
    rawTextures.keys().map(key =>
      new Promise<void>((resolve, reject) => {
        loader.load(
          rawTextures(key),
          tex => { tex.magFilter = NearestFilter; textureCache.set(normalise(key), tex); resolve(); },
          undefined,
          err => reject(new Error(`Texture load failed: ${key} — ${err}`))
        );
      })
    )
  );
}

async function preloadModels(): Promise<void> {
  const loader = await makeGLTFLoader();
  await Promise.all(
    rawModels.keys().map(key =>
      new Promise<void>((resolve, reject) => {
        loader.load(
          rawModels(key),
          gltf => { modelCache.set(normalise(key), gltf); resolve(); },
          undefined,
          err => reject(new Error(`Model load failed: ${key} — ${err}`))
        );
      })
    )
  );
}

async function preloadSounds(): Promise<void> {
  const ctx = getAudioContext();
  await Promise.all(
    rawSounds.keys().map(async key => {
      const res  = await fetch(rawSounds(key));
      const buf  = await res.arrayBuffer();
      const decoded = await ctx.decodeAudioData(buf);
      audioCache.set(normalise(key), decoded);
    })
  );
}

// ─── Accessors ────────────────────────────────────────────────────────────────
// These throw if the asset wasn't preloaded — fail loud, fail early.

export function getTexture(name: string): Texture {
  const t = textureCache.get(name);
  if (!t) throw new Error(`AssetManager: texture "${name}" not loaded. Did you call preloadAll()?`);
  return t;
}

export function getModel(name: string): GLTF {
  const m = modelCache.get(name);
  if (!m) throw new Error(`AssetManager: model "${name}" not loaded. Did you call preloadAll()?`);
  return m;
}

/** Returns a clone of the scene graph so each usage is independent. */
export function getModelScene(name: string): THREE.Group {
  return getModel(name).scene.clone(true);
}

export function getAudioBuffer(name: string): AudioBuffer {
  const b = audioCache.get(name);
  if (!b) throw new Error(`AssetManager: audio "${name}" not loaded. Did you call preloadAll()?`);
  return b;
}

/** Play a sound once — fire and forget. */
export function playSound(name: string, volume = 1): void {
  const ctx = getAudioContext();
  const src = ctx.createBufferSource();
  src.buffer = getAudioBuffer(name);
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.connect(gain).connect(ctx.destination);
  src.start();
}


/*
USAGE: 

// main.ts — once, before the game loop
await preloadAll();

// Anywhere else — synchronous, no fallback boilerplate
const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
  map: getTexture('stone.png'),
}));

const hero = getModelScene('hero.glb');
scene.add(hero);

playSound('jump.mp3', 0.8);

*/