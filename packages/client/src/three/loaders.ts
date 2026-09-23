import type * as THREE from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import type { WebGPURenderer } from 'three/webgpu';

export interface DecoderConfig {
  /** Hosted Draco decoder dir (e.g. "/decoders/draco/"); omit if assets are meshopt-canonical. */
  dracoDecoderPath?: string;
  /** Hosted Basis transcoder dir for KTX2 textures; omit when not using KTX2. */
  ktx2TranscoderPath?: string;
}

/**
 * A GLTFLoader with the meshopt decoder always attached (its WASM is inlined — zero hosting),
 * plus optional Draco/KTX2 support when decoder paths are configured. Canonical GLBs from
 * `molen asset import` are quantize+meshopt only, so most apps never configure paths.
 */
export function createGltfLoader(
  renderer?: THREE.WebGLRenderer | WebGPURenderer,
  config: DecoderConfig = {},
): GLTFLoader {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  if (config.dracoDecoderPath !== undefined) {
    const draco = new DRACOLoader();
    draco.setDecoderPath(config.dracoDecoderPath);
    loader.setDRACOLoader(draco);
  }
  if (config.ktx2TranscoderPath !== undefined && renderer !== undefined) {
    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath(config.ktx2TranscoderPath);
    ktx2.detectSupport(renderer);
    loader.setKTX2Loader(ktx2);
  }
  return loader;
}

export type { GLTFLoader };
