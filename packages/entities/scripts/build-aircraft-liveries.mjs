/**
 * Build aircraft liveries from their design modules into content/entities/source/liveries.json.
 *
 *   node packages/entities/scripts/build-aircraft-liveries.mjs --ids=f-14d[,ov-10]   # build + write
 *   node packages/entities/scripts/build-aircraft-liveries.mjs --ids=f-14d --check   # verify only
 *   node packages/entities/scripts/build-aircraft-liveries.mjs --ids=f-14d --surfaces  # list paintable parts
 *
 * A design module is packages/entities/scripts/liveries/aircraft/<slug>.mjs. An optional
 * `slots(existing)` export returns its paint slots (default: the existing ones); the default
 * export receives { kit, space, slots, bounds, entry } and returns { selected, anchors,
 * graphics, variants }. Anchors and zone planes are authored in metres in the model frame through
 * `space` (kit.modelSpace), which converts them with the runtime model's own slot bounds, the
 * same bounds the client projects with. Every variant is applied to the runtime model with the
 * client's applyLivery and must produce no warnings. Afterwards run generate-models.mjs (the
 * type catalog) and preview-liveries.mjs --capture.
 */
import { mkdir, readFile, rename, rmdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { liverySchema } from '@bendyline/molen-schema';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyLivery } from '../../client/dist/index.mjs';
import * as kit from './liveries/kit.mjs';
import { stringifyWithCompactOutlines } from './livery-json.mjs';

const root = fileURLToPath(new URL('../../../content/entities/', import.meta.url));
const read = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ids = arg('ids')?.split(',').filter(Boolean);
if (!ids?.length) throw new Error('--ids=<aircraft slug,...> required');
const check = process.argv.includes('--check');
const surfaces = process.argv.includes('--surfaces');
const project = await read('project.json');
const cataloguePath = resolve(root, 'source/liveries.json');
const catalogue = JSON.parse(await readFile(cataloguePath, 'utf8'));

async function runtimeModel(id) {
  const sidecar = await read(project.assets[id]);
  const bytes = await readFile(resolve(root, project.assets[id], '..', sidecar.files.main));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'skipTextures', loadTexture: () => Promise.resolve(null) }));
  const gltf = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.updateMatrixWorld(true);
  return gltf.scene;
}

const materialsOf = (mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]);

/** A slot's triangles in model space, as the client's livery renderer collects them. */
function slotBounds(model, binding) {
  const subtree = binding.node === undefined ? model : model.getObjectByName(binding.node);
  const meshes = new Set();
  const collect = (object) => {
    if (!object.isMesh || meshes.has(object)) return;
    if (!materialsOf(object).some((m) => binding.materials.includes(m.name))) return;
    meshes.add(object);
  };
  subtree?.traverse(collect);
  if (binding.node !== undefined)
    model.traverse((object) => {
      const sources = object.userData.liverySourceNodes;
      if (Array.isArray(sources) && sources.includes(binding.node)) collect(object);
    });
  const box = new T.Box3(),
    v = new T.Vector3();
  const inverse = model.matrixWorld.clone().invert();
  for (const mesh of meshes) {
    const g = mesh.geometry,
      p = g.getAttribute('position'),
      index = g.index;
    const toRoot = inverse.clone().multiply(mesh.matrixWorld);
    const groups = Array.isArray(mesh.material)
      ? g.groups
      : [{ start: 0, count: index ? index.count : p.count, materialIndex: 0 }];
    for (const group of groups) {
      if (!binding.materials.includes(materialsOf(mesh)[group.materialIndex ?? 0]?.name)) continue;
      for (let i = group.start; i < group.start + group.count; i++)
        box.expandByPoint(v.fromBufferAttribute(p, index ? index.getX(i) : i).applyMatrix4(toRoot));
    }
  }
  return box.isEmpty() ? undefined : { min: box.min.toArray(), max: box.max.toArray() };
}

function listSurfaces(model) {
  const rows = new Map();
  const inverse = model.matrixWorld.clone().invert();
  model.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const names = [];
    for (let n = mesh; n && n !== model; n = n.parent) if (n.name) names.push(n.name);
    const box = new T.Box3().setFromObject(mesh).applyMatrix4(inverse);
    for (const m of materialsOf(mesh)) {
      const key = `${m.name} | ${names.slice(0, 3).join(' < ')}`;
      const row = rows.get(key) ?? { box: new T.Box3(), tris: 0 };
      row.box.union(box);
      row.tris += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3;
      rows.set(key, row);
    }
  });
  const fmt = (v) =>
    v
      .toArray()
      .map((x) => x.toFixed(2))
      .join(',');
  for (const [key, row] of [...rows].sort())
    console.log(
      `  ${key}  tris ${Math.round(row.tris)}  min ${fmt(row.box.min)} max ${fmt(row.box.max)}`,
    );
}

let failures = 0;
const outputs = new Map();
for (const slug of ids) {
  const source = JSON.parse(
    await readFile(resolve(root, `source/aircraft/${slug}/source.json`), 'utf8'),
  );
  const id = source.id;
  const entry = catalogue.models[id];
  if (!entry) throw new Error(`${slug}: no livery entry for ${id}`);
  const model = await runtimeModel(id);
  if (surfaces) {
    console.log(`${slug} (${id}) paintable surfaces: material | node path`);
    listSurfaces(model);
    console.log(`  existing slots: ${Object.keys(entry.slots).join(', ')}`);
    continue;
  }
  const modulePath = resolve(
    fileURLToPath(new URL('.', import.meta.url)),
    `liveries/aircraft/${slug}.mjs`,
  );
  const module = await import(`${pathToFileURL(modulePath).href}?t=${Date.now()}`);
  // Slots: the module's own (an optional `slots(existing)` export), else the existing ones.
  // Their bounds feed the model-space helpers.
  const slots = module.slots ? module.slots(entry.slots) : entry.slots;
  const bounds = {};
  for (const [name, binding] of Object.entries(slots)) {
    const b = slotBounds(model, binding);
    if (b) bounds[name] = b;
  }
  const space = kit.modelSpace(bounds);
  const built = await module.default({ kit, entry, slots, space, bounds });
  const data = {
    selected: built.selected,
    slots,
    ...(built.anchors && Object.keys(built.anchors).length ? { anchors: built.anchors } : {}),
    ...(built.graphics && Object.keys(built.graphics).length ? { graphics: built.graphics } : {}),
    variants: built.variants,
  };
  const parsed = liverySchema.safeParse(data);
  if (!parsed.success) {
    console.error(`${slug}: schema`, JSON.stringify(parsed.error.issues.slice(0, 5), null, 1));
    failures++;
    continue;
  }
  if (data.variants.length < 3) {
    console.error(`${slug}: aircraft need at least three liveries`);
    failures++;
    continue;
  }
  const problems = [];
  for (const variant of data.variants) {
    if (!variant.provenance.references.length)
      problems.push(`${variant.id}: a real photograph reference is required`);
    const visual = applyLivery(model, { ...data, selected: variant.id });
    for (const warning of visual.warnings) problems.push(`${variant.id}: ${warning}`);
    visual.dispose();
  }
  if (problems.length) {
    console.error(`${slug}:\n  ${problems.join('\n  ')}`);
    failures++;
    continue;
  }
  const bytes = JSON.stringify(data).length;
  if (!check) outputs.set(id, data);
  console.log(
    `${slug}: ${data.variants.length} liveries, ${Object.keys(data.anchors ?? {}).length} anchors, ` +
      `${Object.keys(data.graphics ?? {}).length} shared graphics, ${(bytes / 1024).toFixed(0)} KiB${check ? ' (checked)' : ''}`,
  );
}
// Several authors build different aircraft at once: re-read the file under a lock and replace
// only the entries built here, so nobody's work is lost.
if (!check && !surfaces && !failures && outputs.size) {
  const lock = `${cataloguePath}.lock`;
  for (let tries = 0; ; tries++) {
    try {
      await mkdir(lock);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST' || tries > 600) throw error;
      await new Promise((ok) => setTimeout(ok, 100));
    }
  }
  try {
    const latest = JSON.parse(await readFile(cataloguePath, 'utf8'));
    for (const [id, data] of outputs) latest.models[id] = data;
    const temporary = `${cataloguePath}.${process.pid}.tmp`;
    await writeFile(temporary, stringifyWithCompactOutlines(latest));
    await rename(temporary, cataloguePath);
  } finally {
    await rmdir(lock);
  }
}
if (failures) process.exitCode = 1;
