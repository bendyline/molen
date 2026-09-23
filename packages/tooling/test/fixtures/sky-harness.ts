import {
  createSnapshotViewer,
  decodeStarCatalog,
  type MolenClient,
  type SkyData,
  type SkyStar,
  THREE,
} from '@bendyline/molen-client';
import type { Keyframe } from '@bendyline/molen-schema';

export interface SkyCaptureOptions {
  backend: 'webgl' | 'webgpu';
  sky: SkyData;
  tick?: number;
  aim?: 'sun' | 'moon';
  position?: [number, number, number];
  ortho?: boolean;
  foreground?: boolean;
}

declare global {
  interface Window {
    __skyCapture: {
      render(
        options: SkyCaptureOptions,
      ): Promise<{ sun: number; moon: number; utcMs?: number; drawCalls: number; backend: string }>;
      remove(): Promise<boolean>;
    };
  }
}
let viewer: MolenClient | undefined;
// The molen.sky pack's catalog, which the test serves beside this page.
let stars: Promise<SkyStar[]> | undefined;
const starCatalog = (): Promise<SkyStar[]> =>
  (stars ??= fetch('./stars.bin')
    .then((response) => response.arrayBuffer())
    .then((bytes) => decodeStarCatalog(bytes)));
let marker: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial> | undefined;
async function present(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

window.__skyCapture = {
  async render(options) {
    viewer?.dispose();
    marker?.geometry.dispose();
    marker?.material.dispose();
    marker = undefined;
    const old = document.querySelector('canvas');
    const canvas = document.createElement('canvas');
    old?.replaceWith(canvas);
    const keyframe: Keyframe = {
      kind: 'keyframe',
      v: 1,
      engine: '0.0.1',
      seed: 'sky',
      nextEntitySeq: 0,
      rng: { algo: 'sfc32', state: [1, 2, 3, 4] },
      plugins: {},
      tick: options.tick ?? 0,
      tickRate: 30,
      entities: {
        env: { environment: { sky: JSON.parse(JSON.stringify(options.sky)), toneMapping: 'none' } },
      },
    };
    viewer = await createSnapshotViewer(keyframe, {
      canvas,
      width: 640,
      height: 400,
      backend: options.backend,
      reverseDepthBuffer: true,
      stars: await starCatalog(),
    });
    viewer.backend.setAnimationTick(keyframe.tick, keyframe.tickRate);
    viewer.renderer.sky?.update(keyframe.tick / keyframe.tickRate);
    const frame = viewer.renderer.sky?.frame;
    const d =
      options.aim === 'sun'
        ? frame?.sunDirection
        : options.aim === 'moon'
          ? frame?.moonDirection
          : [0, 0.3, -1];
    if (!d) throw new Error('missing sky direction');
    const position = options.position ?? [0, 0, 0];
    const target = position.map((v, i) => v + (d[i] ?? 0)) as [number, number, number];
    viewer.setCamera({ position, lookAt: target });
    if (options.foreground) {
      marker = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ color: '#cc3377' }),
      );
      marker.position.fromArray(position).addScaledVector(new THREE.Vector3(...d).normalize(), 3);
      viewer.renderer.worldRoot.add(marker);
    }
    if (options.ortho) {
      const camera = new THREE.OrthographicCamera(-16, 16, 10, -10, 1, 10000);
      camera.position.fromArray(position);
      camera.lookAt(new THREE.Vector3(...target));
      viewer.renderer.camera = camera;
    }
    viewer.renderFrame();
    await present();
    viewer.renderFrame();
    await present();
    return {
      sun: viewer.renderer.sky?.sunLight.intensity ?? -1,
      moon: viewer.renderer.sky?.moonLight.intensity ?? -1,
      utcMs: frame?.earth?.utcMs,
      drawCalls: viewer.renderer.stats().drawCalls,
      backend: viewer.renderer.backend,
    };
  },
  async remove() {
    if (!viewer) throw new Error('missing viewer');
    viewer.backend.setEnvironment({ background: '#123456' });
    viewer.renderFrame();
    await present();
    return viewer.renderer.sky === undefined;
  },
};
