/** Build/check aggregate runtime indexes from copyable logical source bundles. */
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '@bendyline/molen-schema';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The entities content (a Molen project: types, assets, scenes, source bundles) lives outside the
// package, in content/entities, and ships as a content pack rather than in the npm tarball.
const root = resolve(packageRoot, '../../content/entities');
const sourceRoot = resolve(root, 'source');
const check = process.argv.includes('--check');
const biome = resolve(packageRoot, 'node_modules/@biomejs/biome/bin/biome');

function formatJson(value, path) {
  const formatted = execFileSync(
    process.execPath,
    [biome, 'format', '--files-max-size=16777216', '--stdin-file-path', path],
    {
      input: JSON.stringify(value, null, 2),
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  // Biome can skip oversized/ignored stdin with exit code 0. Never replace a catalog with
  // empty output; preserve the previous file and surface an actionable generation failure.
  if (!formatted.trim()) throw new Error(`Formatter produced no JSON for ${path}`);
  JSON.parse(formatted);
  return formatted;
}

function listedPaths(manifest) {
  return [
    ...manifest.files.definitions,
    ...manifest.files.models.map((entry) => entry.path),
    ...(manifest.files.generators ?? []).map((entry) => entry.path),
    ...manifest.files.scripts.map((entry) => entry.path),
    ...manifest.files.textures.map((entry) => entry.path),
    ...manifest.files.sounds.map((entry) => entry.path),
    ...manifest.files.documents,
  ];
}

async function loadBundles() {
  const bundles = [];
  for (const category of await readdir(sourceRoot, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    const categoryDirectory = resolve(sourceRoot, category.name);
    for (const thing of await readdir(categoryDirectory, { withFileTypes: true })) {
      if (!thing.isDirectory()) continue;
      const directory = resolve(categoryDirectory, thing.name);
      const manifestPath = resolve(directory, 'source.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      const checked = validate('source-bundle', manifest);
      if (!checked.ok) throw new Error(`${manifestPath}\n${checked.formatted}`);
      for (const owned of listedPaths(manifest)) await readFile(resolve(directory, owned));
      if (manifest.files.definitions.length !== 1) {
        throw new Error(`${manifestPath}: reusable entities require exactly one type definition`);
      }
      const definitionPath = resolve(directory, manifest.files.definitions[0]);
      const definition = JSON.parse(await readFile(definitionPath, 'utf8'));
      const definitionCheck = validate('types', definition);
      if (!definitionCheck.ok) throw new Error(`${definitionPath}\n${definitionCheck.formatted}`);
      if (
        Object.keys(definition.types).length !== 1 ||
        definition.types[manifest.id] === undefined
      ) {
        throw new Error(`${definitionPath}: expected exactly the type ${manifest.id}`);
      }
      // Every mountable type carries a name-free identity beside its label, so a host can show
      // or filter the fleet without any manufacturer, model or type name (NOTICE.md §4b).
      const components = definition.types[manifest.id].components ?? {};
      const spec = components.vehicle?.spec ?? components.aircraft?.spec;
      if (spec !== undefined) {
        if (typeof spec.genericLabel !== 'string')
          throw new Error(`${definitionPath}: spec.genericLabel is required`);
        if (components.vehicle !== undefined && typeof spec.bodyStyle !== 'string')
          throw new Error(`${definitionPath}: vehicle spec.bodyStyle is required`);
      }
      // Model bytes are build outputs, so the committed sha256 pins and sidecar hashes are not
      // compared here; a copied runtime model must still be the same bytes as its source.
      for (const model of manifest.files.models) {
        const bytes = await readFile(resolve(directory, model.path));
        if (model.assetId === undefined || model.output === undefined) continue;
        const sidecarPath = resolve(root, model.output);
        const sidecar = JSON.parse(await readFile(sidecarPath, 'utf8'));
        if (sidecar.id !== model.assetId) {
          throw new Error(`${sidecarPath}: expected asset id ${model.assetId}`);
        }
        if (model.pipeline === 'copy') {
          const runtime = await readFile(resolve(dirname(sidecarPath), sidecar.files.main));
          if (!runtime.equals(bytes)) {
            throw new Error(`${sidecarPath}: copied runtime model differs from ${model.path}`);
          }
        }
      }
      bundles.push({
        directory,
        relativeDirectory: relative(root, directory).replaceAll('\\', '/'),
        manifest,
        definition,
      });
    }
  }
  const kindOrder = { nature: 0, aircraft: 1, vehicle: 2, transit: 3, cycle: 4, watercraft: 5 };
  bundles.sort(
    (a, b) =>
      (kindOrder[a.manifest.kind] ?? Number.MAX_SAFE_INTEGER) -
        (kindOrder[b.manifest.kind] ?? Number.MAX_SAFE_INTEGER) ||
      (a.manifest.order ?? Number.MAX_SAFE_INTEGER) -
        (b.manifest.order ?? Number.MAX_SAFE_INTEGER) ||
      a.manifest.id.localeCompare(b.manifest.id),
  );
  return bundles;
}

function aggregateTypes(bundles, kind, doc) {
  const types = {};
  for (const bundle of bundles.filter((candidate) => candidate.manifest.kind === kind)) {
    const definition = structuredClone(bundle.definition.types[bundle.manifest.id]);
    if (definition.scripts !== undefined) {
      definition.scripts = definition.scripts.map((script) => {
        const owned = bundle.manifest.files.scripts.find((entry) => entry.id === script.id);
        if (owned === undefined) {
          throw new Error(
            `${bundle.manifest.id}: script ${script.id} is not listed in source.json`,
          );
        }
        return {
          ...script,
          path: `generated-scripts/${bundle.relativeDirectory.replace(/^source\//, '')}/${owned.path}`,
        };
      });
    }
    types[bundle.manifest.id] = definition;
  }
  return {
    format: 'molen/types@1',
    namespace: 'molen.entities',
    owner: '@bendyline/molen-entities',
    doc,
    types,
  };
}

function projectDocument(bundles) {
  const assets = {};
  for (const bundle of bundles) {
    for (const model of bundle.manifest.files.models) {
      if (model.assetId !== undefined && model.output !== undefined)
        assets[model.assetId] = model.output;
    }
  }
  return {
    format: 'molen/project@1',
    name: 'molen-entities',
    scenes: {
      gallery: 'scenes/gallery.scene.json',
      aircraft: 'scenes/aircraft.scene.json',
      vehicles: 'scenes/vehicles.scene.json',
      transit: 'scenes/transit.scene.json',
      fleet: 'scenes/fleet.scene.json',
      'us-vehicles': 'scenes/us-vehicles.scene.json',
      'variety-vehicles': 'scenes/variety-vehicles.scene.json',
      rvs: 'scenes/rvs.scene.json',
      'regional-vehicles': 'scenes/regional-vehicles.scene.json',
      'mini-acura': 'scenes/mini-acura.scene.json',
      cycles: 'scenes/cycles.scene.json',
      harbor: 'scenes/harbor.scene.json',
    },
    defaultScene: 'gallery',
    types: [
      'types/entities.types.json',
      'types/aircraft.types.json',
      'types/vehicle.types.json',
      'types/transit.types.json',
      'types/cycle.types.json',
      'types/watercraft.types.json',
    ],
    assets,
    reservations: [
      {
        namespace: 'molen.entities',
        owner: '@bendyline/molen-entities',
        note: 'Published molen entity asset and type vocabulary.',
      },
    ],
    // Schema default, spelled out so this matches what updateProjectFile (asset import) writes.
    packs: [],
    components: {},
    codegen: { out: 'gen/molen-types.ts' },
  };
}

function galleryDocument(bundles) {
  const nature = bundles
    .filter((bundle) => bundle.manifest.kind === 'nature')
    .sort(
      (a, b) =>
        (a.manifest.order ?? Number.MAX_SAFE_INTEGER) -
          (b.manifest.order ?? Number.MAX_SAFE_INTEGER) ||
        a.manifest.id.localeCompare(b.manifest.id),
    );
  const positions = [
    [-7.2, 0, 1.5],
    [-2.8, 0, 1.4],
    [2.3, 0, 1],
    [6.8, 0, 1.2],
    [-3, 0, 4.2],
    [3, 0, 4.2],
  ];
  return {
    format: 'molen/scene@3',
    name: 'Molen entities nature gallery',
    seed: 'molen-entities-gallery-v1',
    tickRate: 30,
    lateCommands: 'rewrite',
    keyframeInterval: 60,
    prefabs: {},
    entities: [
      ...nature.map((bundle, index) => ({
        id: `gallery-${index + 1}`,
        type: bundle.manifest.id,
        components: { transform: { pos: positions[index], rot: [0, 0, 0, 1] } },
      })),
      {
        id: 'gallery-ground',
        components: {
          transform: { pos: [0, -0.08, -0.8], scale: [20, 0.15, 13] },
          renderable: {
            kind: 'primitive',
            ref: 'box',
            materialRef: 'palette:#66715d',
            shadows: { receive: true },
          },
        },
      },
      {
        id: 'gallery-environment',
        components: {
          environment: {
            ambient: { sky: '#dbe6e8', ground: '#5d6257', intensity: 1.15 },
            sun: {
              direction: [7, 12, 6],
              color: '#fff1d1',
              intensity: 2.1,
              castShadow: true,
            },
            background: '#b7ced4',
            toneMapping: 'agx',
            exposure: 1.1,
            shadows: 'high',
          },
        },
      },
    ],
    scripts: [],
    camera: { mode: 'fixed', position: [0, 8.5, 25], lookAt: [0, 4.1, -0.8], fov: 44 },
    physics: { engine: 'none' },
  };
}

async function emit(path, value) {
  await emitBytes(path, Buffer.from(formatJson(value, path)));
}

async function emitBytes(path, bytes) {
  const destination = resolve(root, path);
  const current = await readFile(destination).catch(() => undefined);
  if (
    current?.equals(bytes) ||
    (path.endsWith('.json') &&
      current?.toString('utf8').replaceAll('\r\n', '\n') ===
        bytes.toString('utf8').replaceAll('\r\n', '\n'))
  )
    return;
  if (check)
    throw new Error(`${path} is stale; run pnpm --filter @bendyline/molen-entities generate`);
  await mkdir(dirname(destination), { recursive: true });
  // Readers (including editor previews on Windows) can hold the previous catalog open.
  // Publish the complete replacement atomically instead of truncating that live file.
  const temporary = `${destination}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}

const bundles = await loadBundles();
for (const bundle of bundles) {
  for (const script of bundle.manifest.files.scripts) {
    await emitBytes(
      `types/generated-scripts/${bundle.relativeDirectory.replace(/^source\//, '')}/${script.path}`,
      await readFile(resolve(bundle.directory, script.path)),
    );
  }
}
await emit(
  'types/entities.types.json',
  aggregateTypes(
    bundles,
    'nature',
    'Curated reusable nature entities backed by meter-scaled GLTF assets.',
  ),
);
await emit(
  'types/aircraft.types.json',
  aggregateTypes(bundles, 'aircraft', 'Reusable aircraft with external flight tuning and models.'),
);
await emit(
  'types/vehicle.types.json',
  aggregateTypes(
    bundles,
    'vehicle',
    'Reusable standalone wheeled vehicles with external tuning and models.',
  ),
);
await emit(
  'types/transit.types.json',
  aggregateTypes(
    bundles,
    'transit',
    'Bendy Bus and Bendy Light Rail: player controls, operator cabins and ambient traffic roles.',
  ),
);
await emit(
  'types/cycle.types.json',
  aggregateTypes(
    bundles,
    'cycle',
    'Rideable bicycles and motorcycles with balanced handling, saddle poses and animated controls.',
  ),
);
await emit(
  'types/watercraft.types.json',
  aggregateTypes(
    bundles,
    'watercraft',
    'Waterline-aligned boats, cargo ships and ferries for ambient water routes.',
  ),
);
await emit('project.json', projectDocument(bundles));
await emit('scenes/gallery.scene.json', galleryDocument(bundles));

console.log(`${check ? 'Verified' : 'Generated'} ${bundles.length} logical entity source bundles.`);
