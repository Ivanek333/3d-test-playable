import { Texture, TextureLoader, NearestFilter } from 'three';
import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

async function makeGLTFLoader(): Promise<GLTFLoader> {
  const wrapperDataUrl = dracoWasmWrapper(dracoWasmWrapper.keys()[0]);
  const wasmDataUrl = dracoDecoder(dracoDecoder.keys()[0]);
  const wrapperText = await fetch(wrapperDataUrl).then(r => r.text());
  const wasmBuffer  = await fetch(wasmDataUrl).then(r => r.arrayBuffer());

  const draco = new DRACOLoader();
  draco.setDecoderConfig({
    wasmBinary: wasmBuffer,
    wasmBinaryFile: wasmDataUrl,
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
}

declare const require: {
  context(dir: string, deep: boolean, re: RegExp): {
    keys(): string[];
    (id: string): string;
  };
};

const rawModels   = require.context('../../assets/models',   true, /\.glb$/);
const rawTextures = require.context('../../assets/textures', true, /\.(png|jpg|jpeg)$/);
const rawSounds   = require.context('../../assets/sounds',   true, /\.mp3$/);
const dracoWasmWrapper = require.context('../../node_modules/three/examples/jsm/libs/draco',   false, /draco_wasm_wrapper\.js$/);
const dracoDecoder = require.context('../../node_modules/three/examples/jsm/libs/draco',   false, /draco_decoder\.wasm$/); 

type AssetKey<Ctx extends ReturnType<typeof require.context>> =
  ReturnType<Ctx['keys']>[number] extends `${string}/${infer Name}` ? Name :
  ReturnType<Ctx['keys']>[number] extends `./${infer Name}` ? Name : string;

const textureCache = new Map<string, Texture<HTMLImageElement>>();
const modelCache   = new Map<string, GLTF>();
const audioCache   = new Map<string, AudioBuffer>();

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

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

export function getTexture(name: string): Texture<HTMLImageElement> {
  const t = textureCache.get(name);
  if (!t) throw new Error(`AssetManager: texture "${name}" not loaded. Did you call preloadAll()?`);
  return t;
}

export function getModel(name: string): GLTF {
  const m = modelCache.get(name);
  if (!m) throw new Error(`AssetManager: model "${name}" not loaded. Did you call preloadAll()?`);
  return m;
}

export function getModelScene(name: string): THREE.Group {
  return getModel(name).scene.clone(true);
}

export function getAudioBuffer(name: string): AudioBuffer {
  const b = audioCache.get(name);
  if (!b) throw new Error(`AssetManager: audio "${name}" not loaded. Did you call preloadAll()?`);
  return b;
}