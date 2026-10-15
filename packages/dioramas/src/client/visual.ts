import {
  type AssetCache,
  InterpolationBuffer,
  SceneMirror,
  ThreeSceneBackend,
} from '@bendyline/molen-client';
import { figureKind } from '@bendyline/molen-figures/client';
import type { SceneManifest } from '@bendyline/molen-schema';
import * as THREE from 'three';
import type { DioramaBounds, DioramaDefinition, DioramaInstance, DioramaPlacement } from '../types';

export interface DioramaVisualOptions {
  /** Attach below the host's floating-origin root. */
  root: THREE.Object3D;
  camera?: THREE.Camera;
  assets?: AssetCache;
}

/** Lazy-load the scripting runtime only when a placement is admitted by the director. */
export async function createDioramaVisual(
  definition: DioramaDefinition,
  placement: DioramaPlacement,
  options: DioramaVisualOptions,
): Promise<DioramaInstance> {
  const { createDiorama } = await import('../kernel');
  const playback = createDiorama(definition);
  const root = new THREE.Group();
  root.name = `diorama:${placement.id}`;
  root.position.fromArray(placement.position);
  root.rotation.y = placement.yaw ?? 0;
  const mirror = new SceneMirror();
  const interpolation = new InterpolationBuffer(playback.tickRate, { delayTicks: 1 });
  let timeMs = 0;
  // No Renderer: a local scene must not reset the host's environment, weather or sky clock.
  const backend = new ThreeSceneBackend(root, options.assets);
  backend.registerKind(figureKind());
  backend.bindMirror(mirror);
  const sync = (): void => {
    interpolation.sampleActive(timeMs, (id, transform) => backend.setTransform(id, transform));
    const renderTick = interpolation.estimateRenderTick(timeMs) ?? playback.tick;
    if (options.camera) backend.updateLiveAnimations(renderTick, playback.tickRate, options.camera);
    else backend.setAnimationTick(renderTick, playback.tickRate);
    backend.prepareFrame();
  };
  const dispose = (): void => {
    root.removeFromParent();
    backend.dispose();
    playback.dispose();
  };
  try {
    mirror.applyKeyframe(playback.keyframe());
    mirror.reconcile(backend);
    interpolation.push(playback.tick, mirror.transforms(), 0);
    sync();
    await backend.whenReady();
    options.root.add(root);
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    setPosition(position) {
      root.position.fromArray(position);
    },
    update(seconds) {
      const delta = playback.advance(seconds);
      timeMs += Math.min(seconds, 0.2) * 1000;
      if (delta) {
        mirror.applyDelta(delta);
        interpolation.pushDelta(delta.tick, mirror.transformChanges(delta), timeMs);
        mirror.reconcile(backend);
        for (const [id, changed] of Object.entries(delta.changed)) {
          if (changed.renderable || changed.light) interpolation.activate(id);
        }
      }
      sync();
    },
    dispose,
  };
}

/**
 * Fetch a trusted scene and its relative JavaScript sources on demand. TypeScript sources must
 * be erased by the publisher, or bundled with molenScripts() and supplied through a custom loader.
 * No requests happen until the host calls this function. The host owns URL/pack selection.
 */
export async function loadDioramaScene(
  url: URL,
  bounds: DioramaBounds,
  signal?: AbortSignal,
): Promise<DioramaDefinition> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Diorama scene: HTTP ${response.status}`);
  const scene = (await response.json()) as SceneManifest;
  const scripts = await Promise.all(
    (scene.scripts ?? []).map(async (script) => {
      if (!script.path) return script;
      const sourceUrl = new URL(script.path, url);
      if (sourceUrl.pathname.endsWith('.ts'))
        throw new Error(
          'Runtime diorama loads need JavaScript; erase TypeScript at publication or use molenScripts()',
        );
      const loaded = await fetch(sourceUrl, { signal });
      if (!loaded.ok) throw new Error(`Diorama script ${script.id}: HTTP ${loaded.status}`);
      const { path: _path, ...rest } = script;
      return { ...rest, code: await loaded.text() };
    }),
  );
  return { scene: { ...scene, scripts }, bounds };
}
