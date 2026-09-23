import type { MessageLink } from '@bendyline/molen-schema';
import { describe, expect, it, vi } from 'vitest';
import { loadProject, startKernelWorker } from '../src/project';

const sceneDoc = {
  format: 'molen/scene@3',
  name: 'demo',
  seed: 'demo-1',
  tickRate: 30,
  keyframeInterval: 17,
  entities: [{ id: 'hero', components: { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } } }],
  scripts: [{ id: 'spin', path: 'scripts/spin.ts' }],
};

const typesDoc = {
  format: 'molen/types@1',
  namespace: 'demo',
  types: { 'demo.crate': { components: { transform: { pos: [1, 2, 3], rot: [0, 0, 0, 1] } } } },
};

const SPIN = "molen.on('tick', () => {});";

/** What a host actually hands the worker: scripts inlined. */
const loaded = (): ReturnType<typeof loadProject> =>
  loadProject({ scene: sceneDoc, scripts: { '../scripts/spin.ts': SPIN } });

function mockLink(): MessageLink & { posted: unknown[] } {
  const posted: unknown[] = [];
  return {
    posted,
    postMessage: (m: unknown) => posted.push(m),
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as MessageLink & { posted: unknown[] };
}

describe('loadProject', () => {
  it('inlines a script whatever prefix the bundler glob used', () => {
    // The two shipped shapes: a glob rooted beside the scene, and one rooted a directory up.
    for (const key of ['scripts/spin.ts', '../scripts/spin.ts', '../../scenes/scripts/spin.ts']) {
      const { scene } = loadProject({ scene: sceneDoc, scripts: { [key]: SPIN } });
      expect(scene.scripts?.[0]?.code, key).toBe(SPIN);
      expect(scene.scripts?.[0]?.path, key).toBeUndefined();
    }
  });

  it('names the script and the keys it had when no source matches', () => {
    expect(() =>
      loadProject({ scene: sceneDoc, scripts: { '../scripts/other.ts': SPIN } }),
    ).toThrow(/no source for script "scripts\/spin\.ts".*other\.ts/s);
  });

  it('refuses an ambiguous match rather than picking one', () => {
    expect(() =>
      loadProject({
        scene: sceneDoc,
        scripts: { 'a/scripts/spin.ts': SPIN, 'b/scripts/spin.ts': SPIN },
      }),
    ).toThrow(/ambiguous source for script "scripts\/spin\.ts"/);
  });

  it('leaves path refs alone when no sources are given', () => {
    const { scene } = loadProject({ scene: sceneDoc });
    expect(scene.scripts?.[0]?.path).toBe('scripts/spin.ts');
  });

  it('resolves a type registry, and accepts one document or several', () => {
    const one = loadProject({ scene: sceneDoc, types: typesDoc });
    expect(one.types?.get('demo.crate')?.components.transform).toEqual({
      pos: [1, 2, 3],
      rot: [0, 0, 0, 1],
    });
    expect(loadProject({ scene: sceneDoc, types: [typesDoc] }).types?.size).toBe(1);
    expect(loadProject({ scene: sceneDoc }).types).toBeUndefined();
  });

  it('throws the validator’s own formatted message for a bad document', () => {
    // The point of loading through the validator: the failure reads like `molen validate`.
    const badTransform = {
      ...sceneDoc,
      scripts: [],
      entities: [{ id: 'hero', components: { transform: { pos: 'over there' } } }],
    };
    expect(() => loadProject({ scene: badTransform })).toThrow(/transform/);
    expect(() => loadProject({ scene: sceneDoc, types: { format: 'molen/types@1' } })).toThrow();
  });

  it('reports duplicate type ids across documents instead of silently picking one', () => {
    expect(() => loadProject({ scene: sceneDoc, types: [typesDoc, typesDoc] })).toThrow(
      /demo\.crate/,
    );
  });
});

describe('startKernelWorker', () => {
  it('builds the world and announces itself over the link', () => {
    const link = mockLink();
    const { world, host } = startKernelWorker({ scene: loaded().scene, link });
    expect(world.exists('hero')).toBe(true);
    expect(host).toBeDefined();
    // A keyframe plus ready, so a page has state before its first frame.
    expect(link.posted.length).toBeGreaterThan(0);
    host.dispose();
  });

  it("takes the scene's keyframeInterval unless the caller overrides it", () => {
    const seen: (number | undefined)[] = [];
    const link = mockLink();
    const scene = loaded().scene;
    const a = startKernelWorker({ scene, link });
    seen.push((a.host as unknown as { keyframeInterval: number }).keyframeInterval);
    const b = startKernelWorker({ scene, link, host: { keyframeInterval: 5 } });
    seen.push((b.host as unknown as { keyframeInterval: number }).keyframeInterval);
    expect(seen).toEqual([17, 5]);
    a.host.dispose();
    b.host.dispose();
  });

  it('passes setup and build options through to buildWorld', () => {
    const setup = vi.fn();
    const link = mockLink();
    const { host } = startKernelWorker({
      scene: loaded().scene,
      setup,
      devFreeze: false,
      link,
    });
    expect(setup).toHaveBeenCalledOnce();
    host.dispose();
  });

  it('says what to do when the global scope is not a worker', () => {
    // Node's globalThis has neither, which is exactly the case a mis-imported module hits.
    expect(() => startKernelWorker({ scene: loaded().scene })).toThrow(
      /not a Worker.*Pass `link` explicitly/s,
    );
  });
});
