// A host's own model for the "Custom model" override sample: a street kiosk assembled from boxes
// and exported to GLB in memory. Models are build outputs in this repository and never committed,
// so the sample makes its own the first time one is asked for.

import type { AssetProvider } from '@bendyline/molen-client';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { HOST_MODEL_REF } from './override-samples.js';

function box(
  size: [number, number, number],
  at: [number, number, number],
  color: string,
  name: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05 }),
  );
  mesh.position.set(...at);
  mesh.name = name;
  return mesh;
}

/** Meters, +Y up, the counter facing +Z, its origin on the ground: as override models are read. */
function kiosk(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'kiosk';
  group.add(
    box([6, 0.3, 4.4], [0, 0.15, 0], '#8a8f94', 'plinth'),
    box([5.2, 2.6, 3.6], [0, 1.6, 0], '#e8dcc0', 'cabin'),
    box([3.6, 1.1, 0.1], [0, 1.9, 1.84], '#2f4a5c', 'window'),
    box([4.2, 0.12, 0.8], [0, 1.25, 2.1], '#6b4a2f', 'counter'),
    box([6.4, 0.25, 5.2], [0, 3.05, 0.3], '#b8433a', 'roof'),
    box([4.4, 0.7, 0.12], [0, 3.55, 2.3], '#f2c230', 'sign'),
    box([0.14, 2.9, 0.14], [-2.9, 1.45, 2.7], '#3d4347', 'post-left'),
    box([0.14, 2.9, 0.14], [2.9, 1.45, 2.7], '#3d4347', 'post-right'),
  );
  group.updateMatrixWorld(true);
  return group;
}

let built: Promise<ArrayBuffer> | undefined;

/** The kiosk as GLB bytes: built once, a fresh copy for each caller. */
export async function hostModelBytes(): Promise<ArrayBuffer> {
  built ??= new GLTFExporter().parseAsync(kiosk(), { binary: true }) as Promise<ArrayBuffer>;
  return (await built).slice(0);
}

/** `base`, answering the kiosk's ref itself: what `createEarthWorldgen` takes as `overrideAssets`. */
export function createOverrideAssets(base: AssetProvider): AssetProvider {
  return {
    load: (ref, options) => (ref === HOST_MODEL_REF ? hostModelBytes() : base.load(ref, options)),
    loadText: (ref, options) => base.loadText(ref, options),
  };
}
