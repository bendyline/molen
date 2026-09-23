import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { InterpTransform } from '../src/interpolation';
import type { Renderable } from '../src/sync';
import { SceneMirror } from '../src/sync';
import { ThreeSceneBackend } from '../src/three/backend';
import type { KindHandle, RenderableKind } from '../src/three/kinds';

const transform: InterpTransform = { pos: [1, 2, 3], rot: [0, 0, 0, 1] };

function testKind(): { kind: RenderableKind; handles: (KindHandle & { ticks: unknown[] })[] } {
  const handles: (KindHandle & { ticks: unknown[] })[] = [];
  const kind: RenderableKind = {
    kind: 'blob',
    identity: (r) => `${r.ref}`,
    create: (id, _renderable, ctx) => {
      const object = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
      mesh.matrixAutoUpdate = true;
      object.add(mesh);
      const handle: KindHandle & { ticks: unknown[] } = {
        object,
        ticks: [],
        update: vi.fn(),
        setTick(tick, tickRate, view) {
          this.ticks.push([tick, tickRate, view === undefined ? 'capture' : 'live']);
          ctx.mirror?.peek(id, 'blob');
        },
        dispose: vi.fn(),
      };
      handles.push(handle);
      return handle;
    },
    dispose: vi.fn(),
  };
  return { kind, handles };
}

describe('custom renderable kinds', () => {
  it('routes create, same-identity update, identity change and destroy through the kind', () => {
    const scene = new THREE.Scene();
    const backend = new ThreeSceneBackend(scene);
    const { kind, handles } = testKind();
    backend.registerKind(kind);
    expect(() => backend.registerKind(kind)).toThrow(/already registered/);
    expect(() => backend.registerKind({ ...kind, kind: 'gltf' } as RenderableKind)).toThrow(
      /built in/,
    );

    const renderable: Renderable = { kind: 'blob', ref: 'a', shadows: { cast: true } };
    backend.create('e1', renderable);
    expect(handles).toHaveLength(1);
    const first = handles[0] as KindHandle;
    expect(first.object.name).toBe('e1');
    expect(first.object.parent).toBe(scene);
    expect((first.object.children[0] as THREE.Mesh).castShadow).toBe(true);
    expect(backend.count()).toBe(1);

    backend.updateRenderable('e1', { ...renderable, visible: false });
    expect(first.update).toHaveBeenCalledTimes(1);
    expect(first.object.visible).toBe(false);
    expect(handles).toHaveLength(1);

    backend.updateRenderable('e1', { ...renderable, ref: 'b' });
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(handles).toHaveLength(2);

    backend.setTransform('e1', transform);
    expect((handles[1] as KindHandle).object.position.toArray()).toEqual([1, 2, 3]);

    backend.destroy('e1');
    expect((handles[1] as KindHandle).dispose).toHaveBeenCalledTimes(1);
    expect(backend.count()).toBe(0);
    backend.dispose();
    expect(kind.dispose).toHaveBeenCalledTimes(1);
  });

  it('samples ticks on the capture and live paths and leaves bones auto-updating', () => {
    const scene = new THREE.Scene();
    const backend = new ThreeSceneBackend(scene, undefined, undefined, undefined, {
      animation: false,
    });
    const { kind, handles } = testKind();
    backend.registerKind(kind);
    backend.create('e1', { kind: 'blob', ref: 'a' });
    backend.setTransform('e1', transform);
    backend.prepareFrame();
    const handle = handles[0] as KindHandle & { ticks: unknown[] };
    expect((handle.object.children[0] as THREE.Mesh).matrixAutoUpdate).toBe(true);

    backend.setAnimationTick(12, 60);
    expect(handle.ticks).toEqual([[12, 60, 'capture']]);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(1, 2, 8);
    camera.lookAt(1, 2, 3);
    backend.updateLiveAnimations(12.5, 60, camera);
    expect(handle.ticks[1]).toEqual([12.5, 60, 'live']);
  });

  it('renders unknown kinds as empty placeholders with one warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scene = new THREE.Scene();
    const backend = new ThreeSceneBackend(scene);
    backend.create('e1', { kind: 'mystery', ref: 'x' });
    backend.create('e2', { kind: 'mystery', ref: 'y' });
    expect(backend.count()).toBe(2);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('exposes mirrored components to kinds without cloning and awaits tracked work', async () => {
    const scene = new THREE.Scene();
    const backend = new ThreeSceneBackend(scene);
    const mirror = new SceneMirror();
    backend.bindMirror(mirror);
    let seen: unknown;
    let resolveWork: () => void = () => {};
    const kind: RenderableKind = {
      kind: 'peeker',
      identity: () => 'x',
      create: (id, _renderable, ctx) => {
        seen = ctx.mirror?.peek(id, 'extra');
        ctx.track(
          new Promise<void>((resolve) => {
            resolveWork = resolve;
          }),
        );
        return { object: new THREE.Group(), update() {}, dispose() {} };
      },
    };
    backend.registerKind(kind);
    mirror.applyKeyframe({
      kind: 'keyframe',
      v: 1,
      engine: '',
      tick: 0,
      tickRate: 60,
      seed: '',
      nextEntitySeq: 1,
      rng: { algo: 'sfc32', state: [0, 0, 0, 0] },
      entities: {
        e1: {
          transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
          renderable: { kind: 'peeker', ref: 'p' },
          extra: { value: 7 },
        },
      },
      plugins: {},
    });
    mirror.reconcile(backend);
    expect(seen).toEqual({ value: 7 });
    expect(mirror.peek('e1', 'extra')).toBe(mirror.peek('e1', 'extra'));

    let ready = false;
    const pending = backend.whenReady().then(() => {
      ready = true;
    });
    await Promise.resolve();
    expect(ready).toBe(false);
    resolveWork();
    await pending;
    expect(ready).toBe(true);
  });
});
