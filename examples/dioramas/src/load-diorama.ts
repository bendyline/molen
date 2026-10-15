import { validate } from '@bendyline/molen-schema';

const scenes = import.meta.glob<unknown>('../../../content/dioramas/*/scene.json', {
  import: 'default',
});
const bounds = import.meta.glob<{ min: [number, number, number]; max: [number, number, number] }>(
  '../../../content/dioramas/*/bounds.json',
  { import: 'default' },
);
const scripts = import.meta.glob<string>(
  ['../../../content/dioramas/*/scripts/*.ts', '!../../../content/dioramas/*/scripts/*.d.ts'],
  {
    query: '?raw',
    import: 'default',
  },
);

/** Vite emits one chunk per file; script text is requested only when a placement activates. */
export async function loadDiorama(name: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const base = `../../../content/dioramas/${name}`;
  const sceneLoader = scenes[`${base}/scene.json`];
  const boundsLoader = bounds[`${base}/bounds.json`];
  if (!sceneLoader || !boundsLoader) throw new Error(`Unknown diorama: ${name}`);
  const [document, box] = await Promise.all([sceneLoader(), boundsLoader()]);
  signal?.throwIfAborted();
  const checked = validate('scene', document);
  if (!checked.ok) throw new Error(checked.formatted);
  const loaded = await Promise.all(
    (checked.value.scripts ?? []).map(async ({ path, ...script }) => {
      if (!path) return script;
      const read = scripts[`${base}/${path}`];
      if (!read) throw new Error(`Missing diorama script: ${name}/${path}`);
      const code = await read();
      signal?.throwIfAborted();
      return { ...script, code };
    }),
  );
  signal?.throwIfAborted();
  return { scene: { ...checked.value, camera: undefined, scripts: loaded }, bounds: box };
}
