/**
 * Generate the rail rolling stock (content/entities/source/rail/<slug>/): each bundle's
 * models/recipe.json picks a builder in rail-models.mjs and carries its authoring dimensions and
 * running data. Writes models/source.glb, pins its hash in source.json and writes the bundle's
 * entity.types.json (spec, wheel and interior bindings, seats and boarding points derived from
 * the same geometry). Hand edits of a master are preserved, as for the other generators.
 *
 *   node packages/entities/scripts/generate-rail.mjs                 # every rail bundle
 *   node packages/entities/scripts/generate-rail.mjs --ids=boxcar-50ft,ge-es44ac
 *   node packages/entities/scripts/generate-rail.mjs --out-dir=shots/rail-candidates   # review only
 *   node packages/entities/scripts/generate-rail.mjs --check
 */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { RAIL_BUILDERS } from './rail-models.mjs';

// GLTFExporter uses FileReader only to pack its binary buffer in Node.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
};

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const root = resolve(repo, 'content/entities/source/rail');
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const selection = arg('ids')?.split(',').filter(Boolean);
const outDir = arg('out-dir') && resolve(repo, arg('out-dir'));
const check = process.argv.includes('--check');
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

async function writeAtomic(path, bytes) {
  const temporary = `${path}.rail.tmp`;
  await writeFile(temporary, bytes);
  await rename(temporary, path);
}

const round = (v) => v.map((x) => Math.round(x * 1000) / 1000);

/** Distant stand-in silhouette (`spec.rail.profile`) by builder. */
const RAIL_PROFILES = {
  es44ac: 'locomotive',
  gp38: 'locomotive',
  mp36: 'locomotive',
  bilevel: 'coach',
  boxcar: 'box',
  'covered-hopper': 'hopper',
  'tank-car': 'tank',
  'well-car': 'well',
  autorack: 'autorack',
  gondola: 'gondola',
  centerbeam: 'flat',
};

/** The entity type document for one recipe and its built geometry. */
export function railTypeDocument(recipe, info) {
  const axles = [];
  info.model.traverse((node) => {
    if (/^axle-\d+$/.test(node.name)) axles.push(node.name);
  });
  axles.sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)));
  const powered = recipe.power > 0;
  const spec = {
    label: recipe.label,
    bodyStyle: recipe.bodyStyle,
    genericLabel: recipe.genericLabel,
    width: recipe.width,
    length: recipe.length,
    height: recipe.height,
    centerOfMass: [0, recipe.centerOfMassY ?? 1.8, 0],
    wheelbase: recipe.truckCenters,
    wheelTrack: 1.5,
    wheelRadius: recipe.wheelRadius,
    mass: recipe.mass,
    engineForce: powered ? recipe.engineForce : 1,
    maxSpeed: recipe.maxSpeed,
    reverseSpeed: recipe.reverseSpeed ?? (powered ? recipe.maxSpeed : 30),
    brakeDeceleration: recipe.brakeDeceleration,
    maxSteer: 0,
    grip: 3,
    driverEye: round(info.driverEye ?? [0, 2.5, 0]),
    steeringRate: 1,
    steeringFadeSpeed: 18,
    rollingResistance: 0.012,
    aerodynamicResistance: recipe.aerodynamicResistance,
    terrainAlignRate: 2,
    supportTolerance: 0.1,
    maxStepHeight: 0.4,
    maxSlope: 0.07,
    drive: 'all',
    rollStiffness: 0,
    pitchStiffness: 0,
    rail: {
      truckCenters: recipe.truckCenters,
      couplerLength: recipe.couplerLength,
      power: recipe.power ?? 0,
      gauge: 1.435,
      profile: RAIL_PROFILES[recipe.model] ?? 'box',
    },
  };
  const visual = {
    wheelNodes: axles,
    frontWheelNodes: ['axle-1'],
    paintMaterial: 'rail-livery-body',
    ...(info.interior ? { interior: info.interior } : {}),
  };
  const components = {
    transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
    renderable: {
      kind: 'gltf',
      ref: recipe.id,
      shadows: { cast: true, receive: true },
    },
    vehicle: { kind: recipe.id, color: recipe.color, spec, visual },
    vehicleInput: { throttle: 0, steering: 0, brake: true },
    vehicleState: {
      speed: 0,
      steer: 0,
      yaw: 0,
      pitch: 0,
      roll: 0,
      vy: 0,
      wheelAngle: 0,
      grounded: true,
      waitingForTerrain: false,
    },
    ...(info.mount
      ? {
          mountable: {
            seats: info.mount.seats.map((seat) => ({ ...seat, position: round(seat.position) })),
            entries: info.mount.entries.map(round),
            exits: info.mount.exits.map(round),
            reach: 3,
          },
        }
      : {}),
    // Authored on the recipe: how ambient life runs the type (a locomotive leads mixed trains)
    // and its engine sound.
    ...(recipe.ambientRole ? { ambientRole: recipe.ambientRole } : {}),
    ...(recipe.audioSource ? { audioSource: recipe.audioSource } : {}),
  };
  return {
    format: 'molen/types@1',
    namespace: 'molen.entities',
    owner: '@bendyline/molen-entities',
    types: { [recipe.id]: { doc: recipe.doc, components, assets: [recipe.id] } },
  };
}

let count = 0;
for (const slug of (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()) {
  if (selection && !selection.includes(slug)) continue;
  const directory = resolve(root, slug);
  const recipe = JSON.parse(await readFile(resolve(directory, 'models/recipe.json'), 'utf8'));
  const build = RAIL_BUILDERS[recipe.model];
  if (!build) throw new Error(`${slug}: unknown rail builder ${recipe.model}`);
  const info = build(recipe);
  const bytes = Buffer.from(
    await new GLTFExporter().parseAsync(info.model, { binary: true, onlyVisible: false }),
  );
  if (outDir) {
    await mkdir(outDir, { recursive: true });
    await writeFile(resolve(outDir, `${slug}.glb`), bytes);
    console.log(`${slug}: candidate ${bytes.length} bytes ${hash(bytes)}`);
    count++;
    continue;
  }
  const sourcePath = resolve(directory, 'source.json');
  const sourceText = await readFile(sourcePath, 'utf8');
  const pin = JSON.parse(sourceText).files.models.find(
    (m) => m.path === 'models/source.glb',
  ).sha256;
  const path = resolve(directory, 'models/source.glb');
  const previous = await readFile(path).catch((e) => {
    if (e.code === 'ENOENT') return undefined;
    throw e;
  });
  if (previous && hash(previous) !== pin && !previous.equals(bytes))
    throw new Error(`Preserving artist edits: ${path}; move the master before regenerating.`);
  const definitionPath = resolve(directory, 'entity.types.json');
  const definition = railTypeDocument(recipe, info);
  const current = await readFile(definitionPath, 'utf8')
    .then(JSON.parse)
    .catch(() => undefined);
  if (check) {
    if (!previous?.equals(bytes) || hash(bytes) !== pin)
      throw new Error(`Stale rail model: ${path}`);
    if (!isDeepStrictEqual(current, definition))
      throw new Error(`Stale rail type: ${definitionPath}`);
  } else {
    if (!isDeepStrictEqual(current, definition))
      await writeAtomic(definitionPath, `${JSON.stringify(definition, null, 2)}\n`);
    if (!previous?.equals(bytes)) await writeFile(path, bytes);
    if (pin !== hash(bytes)) await writeAtomic(sourcePath, sourceText.replace(pin, hash(bytes)));
  }
  console.log(`${recipe.id}: ${bytes.length} bytes ${hash(bytes)}`);
  count++;
}
if (!count) throw new Error('No rail recipes matched.');
