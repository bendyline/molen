/** Targeted deterministic aircraft batch: --ids=uh-1h,f-14d; --out <candidate.glb> with one ID. */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '@bendyline/molen-schema';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { completeCockpitControls } from './aircraft/cockpit-controls.mjs';
import {
  embedCockpitTextures,
  finishAircraftCockpit,
  writeCockpitTextures,
} from './aircraft/cockpit-surfaces.mjs';
import { completeAircraftArticulation } from './aircraft-articulation.mjs';
import { buildAircraft } from './aircraft-geometry.mjs';
import { tuneAircraftPerformance } from './aircraft-performance.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..'),
  root = resolve(repo, 'content/entities');
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const { aircraft } = await json(`${root}/source/aircraft-expansion.json`);
const reviews = (await json(`${root}/source/aircraft-expansion-review.json`)).models;
const select = process.argv
  .find((a) => a.startsWith('--ids='))
  ?.slice(6)
  .split(',');
const out = process.argv[process.argv.indexOf('--out') + 1];
const candidate = process.argv.includes('--out');
if (candidate && (select?.length !== 1 || !out)) throw Error('--out requires one --ids selection');
const basePlane = (await json(`${root}/source/aircraft/p-51/entity.types.json`)).types[
  'molen.entities.aircraft.p51d'
].components;
const baseHeli = (await json(`${root}/source/aircraft/oh-6/entity.types.json`)).types[
  'molen.entities.aircraft.oh6'
].components;
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
};
async function emit(path, value) {
  const bytes = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
  const current = await readFile(path, 'utf8').catch((e) => {
    if (e.code !== 'ENOENT') throw e;
  });
  if (current !== bytes) {
    // Replace rather than truncate: Windows editors may memory-map live type documents.
    const temporary = `${path}.${process.pid}.tmp`;
    try {
      await writeFile(temporary, bytes);
      await rename(temporary, path);
    } finally {
      await rm(temporary, { force: true });
    }
  }
}

for (const s of aircraft) {
  if (select && !select.includes(s.slug) && !select.includes(s.id)) continue;
  const { root: model, frame: f, visual, enginePoints, modelSignals } = buildAircraft(s);
  // Earth uses separate interior/exterior signal evaluators. Carry the animation's
  // transitive named variables into its own block, just as the unified model bridge does.
  if (visual.animation && modelSignals) {
    const allDerived = { ...modelSignals.derived, ...visual.animation.derived },
      allSources = { ...modelSignals.sources, ...visual.animation.sources },
      derived = { ...visual.animation.derived },
      sources = { ...visual.animation.sources },
      visited = new Set();
    const include = (name) => {
      if (visited.has(name)) return;
      visited.add(name);
      if (Object.hasOwn(allDerived, name)) {
        const expression = allDerived[name];
        derived[name] = expression;
        if (typeof expression === 'string') include(expression);
        else if (typeof expression === 'object')
          for (const arg of expression.args) if (typeof arg === 'string') include(arg);
      } else if (Object.hasOwn(allSources, name)) sources[name] = allSources[name];
    };
    for (const binding of visual.animation.bindings) include(binding.source);
    if (Object.keys(derived).length) visual.animation.derived = derived;
    // Only declare a source map when every binding dependency can be read explicitly.
    // Legacy bindings may intentionally use the aircraft renderer's built-in telemetry.
    if ([...visited].every((name) => Object.hasOwn(derived, name) || Object.hasOwn(sources, name)))
      visual.animation.sources = sources;
  }
  const components = structuredClone(f.heli ? baseHeli : basePlane);
  delete components.audioSource; // No propeller recording masquerading as a turbofan.
  components.transform = { pos: [0, 0, 0], rot: [0, 0, 0, 1] };
  components.renderable = { kind: 'gltf', ref: s.id, shadows: { cast: true, receive: true } };
  const fixed = s.gear === 'fixed' || s.gear === 'taildragger';
  const spec = {
    label: s.label,
    genericLabel: `${f.heli ? 'Helicopter' : f.fighter ? 'Military jet' : s.category === 'tiltrotor' ? 'Tiltrotor' : s.category === 'cargo' ? 'Cargo transport' : s.category === 'ga' ? 'General aviation aircraft' : s.category === 'business' ? 'Business jet' : 'Civil transport'} with ${s.tandem ? 'tandem' : 'enclosed'} cockpit`,
    model: f.heli ? 'helicopter' : 'airplane',
    mass: s.mass,
    span: s.span,
    length: s.length,
    height: s.height,
    centerOfMass: [0, f.cy, 0],
    pilotEye: f.eye,
    hardLandingSpeed: f.heli ? 4.5 : 4,
    hardLandingRoll: f.heli ? 0.35 : 0.2,
    hardLandingPitch: f.heli ? 0.4 : 0.28,
    maxSupportStep: 0.5,
    collisionProbes: [
      [0, f.cy, s.length * 0.43],
      [0, f.cy, -s.length * 0.43],
      [s.span * 0.46, f.heli ? s.height - 0.2 : f.cy, 0],
      [-s.span * 0.46, f.heli ? s.height - 0.2 : f.cy, 0],
    ],
    visual,
  };
  if (f.heli) {
    spec.engine = {
      ...baseHeli.aircraft.spec.engine,
      power: s.mass * 210,
      position: [0, f.cy, 0],
      rotorAngularSpeed: s.span > 14 ? 24 : 38,
      spoolRate: s.mass > 5000 ? 0.1 : 0.16,
    };
    spec.helicopter = {
      ...baseHeli.aircraft.spec.helicopter,
      rotorPosition: f.mainRotorPosition ?? [0, s.height - 0.2, 0],
      rotorRadius: s.span / 2,
      cyclicResponse: s.mass > 5000 ? 2.5 : 4,
      yawRate: s.mass > 5000 ? 0.5 : 0.85,
      verticalDrag: s.mass * 0.18,
      horizontalDrag: s.mass * 0.016,
      quadraticDrag: s.mass * 0.002,
    };
  } else {
    const jet = f.fighter || s.shape.includes('jet'),
      powered = ['tiltrotor', 'vtol'].includes(s.category);
    const thrust = s.mass * (powered ? 12.5 : jet ? 6.3 : 4.2);
    const chord = s.chord ?? 1.65,
      tip = s.tipChord ?? chord * 0.62;
    const area = ((s.category === 'tiltrotor' ? 14 : s.span) * (chord + tip)) / 2;
    spec.airplane = {
      ...basePlane.aircraft.spec.airplane,
      wingPosition: [0, f.cy, 0],
      wingArea: s.wingArea ?? area,
      controlAuthoritySpeed: f.fighter ? 120 : f.large ? 80 : 45,
      maxControlAuthority: 1.8,
      pitchAuthority: f.fighter ? 0.25 : 0.18,
      rollAuthority: f.fighter ? 1.8 : f.large ? 0.55 : 1.05,
      rollResponse: f.large ? 1.3 : 2,
      propellerEffects: jet || powered ? 0 : 0.08,
      maxLoadFactor: f.fighter ? 7.5 : 3.8,
      minLoadFactor: f.fighter ? -3 : -1.5,
      stallSpeed: f.fighter ? 60 : f.large ? 48 : 26,
      profileDrag: f.fighter ? 0.025 : 0.028,
      inducedDrag: 0.06,
      gearTransitTime: fixed ? 0 : 6,
      flapTransitTime: 4,
      maxThrust: thrust,
      minPropellerSpeed: jet ? 160 : 25,
      propellerEfficiency: 0.85,
      groundTrackRate: 12,
      brakeDeceleration: 4,
    };
    delete spec.airplane.rollInertia;
    delete spec.airplane.pitchInertia;
    delete spec.airplane.yawInertia;
    if (fixed) spec.airplane.fixedGear = true;
    spec.engines = enginePoints.map(({ id, position }, i) => ({
      id,
      position: powered ? [position[0], f.cy, 0] : position,
      thrustAxis: [0, 0, 1],
      power: ((thrust / enginePoints.length) * (jet ? 180 : 45)) / 0.85,
      idleRpm: powered ? 1 : 0.18,
      spoolRate: jet ? 0.2 : 0.25,
      rotorAngularSpeed: s.maxRpm ? (s.maxRpm * 2 * Math.PI) / 60 : jet ? 150 : powered ? 35 : 180,
      maxThrust: thrust / enginePoints.length,
      minPropellerSpeed: jet ? 160 : 25,
      propellerEfficiency: 0.85,
      ...(powered ? { vectored: true } : {}),
      ...(s.category === 'tiltrotor' && i === 1 ? { propellerRotation: 'counterclockwise' } : {}),
      ...(s.propellerRotations?.[i] ? { propellerRotation: s.propellerRotations[i] } : {}),
    }));
    if (s.category === 'vtol')
      spec.engines = [
        {
          ...spec.engines[0],
          position: [0, f.cy, 0],
          power: (thrust * 180) / 0.85,
          maxThrust: thrust,
        },
      ];
    if (powered)
      spec.poweredLift = {
        transitTime: s.category === 'tiltrotor' ? 12 : 3,
        controlFadeSpeed: s.category === 'tiltrotor' ? 75 : 65,
        pitchAuthority: 1.4,
        rollAuthority: 1.5,
        yawAuthority: 0.8,
        damping: 2.2,
      };
  }
  tuneAircraftPerformance(s.id, spec);
  completeAircraftArticulation(model, spec, s, modelSignals);
  completeCockpitControls(model, spec, f);
  finishAircraftCockpit(model, spec, s.slug);
  const bytes = embedCockpitTextures(
    Buffer.from(await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: false })),
  );
  if (candidate) {
    await mkdir(dirname(resolve(out)), { recursive: true });
    await writeFile(resolve(out), bytes);
    console.log(s.slug, hash(bytes));
    continue;
  }
  const directory = `${root}/source/aircraft/${s.slug}`;
  await mkdir(`${directory}/models`, { recursive: true });
  const previous = await json(`${directory}/source.json`).catch((e) => {
    if (e.code !== 'ENOENT') throw e;
    return undefined;
  });
  const current = await readFile(`${directory}/models/source.glb`).catch((e) => {
    if (e.code !== 'ENOENT') throw e;
  });
  if (current && hash(current) !== previous?.files.models[0]?.sha256 && !current.equals(bytes))
    throw Error(`Preserving hand edits: ${s.slug}`);
  if (!current?.equals(bytes)) await writeFile(`${directory}/models/source.glb`, bytes);
  const textures = await writeCockpitTextures(directory, bytes);
  components.aircraft = { kind: s.id, spec };
  if (modelSignals) components['model.signals'] = modelSignals;
  components.aircraftInput = {
    power: 0,
    pitch: 0,
    roll: 0,
    yaw: 0,
    brake: true,
    engine: false,
    gear: true,
    flaps: false,
    ...(spec.poweredLift ? { thrustVector: s.category === 'tiltrotor' ? 1 : 0 } : {}),
  };
  components.aircraftState = {
    velocity: [0, 0, 0],
    yaw: 0,
    pitch: 0,
    roll: 0,
    pitchRate: 0,
    rollRate: 0,
    rpm: 0,
    rotorAngle: 0,
    airspeed: 0,
    altitudeAGL: 0,
    verticalSpeed: 0,
    angleOfAttack: 0,
    stalled: false,
    grounded: true,
    crashed: false,
    waitingForTerrain: false,
    gearPosition: 1,
    ...(spec.model === 'airplane' ? { flapPosition: 0 } : {}),
    actuators: Object.fromEntries(
      Object.entries(spec.actuators ?? {}).map(([name, actuator]) => [name, actuator.initial ?? 0]),
    ),
    ...(spec.poweredLift ? { thrustVectorPosition: s.category === 'tiltrotor' ? 1 : 0 } : {}),
  };
  const seats = [{ id: 'driver', role: 'driver', position: f.eye }];
  if (!f.fighter)
    seats.push({ id: 'copilot', role: 'passenger', position: [-f.eye[0], f.eye[1], f.eye[2]] });
  if (s.tandem)
    seats.push({
      id: 'rear',
      role: 'passenger',
      position: f.rearEye ?? [0, f.eye[1] + 0.12, f.eye[2] - 1.25],
    });
  components.mountable = {
    seats,
    entries: [[s.width / 2 + 0.8, 0, f.cabinZ]],
    exits: [[s.width / 2 + 1.5, 0, f.cabinZ]],
    reach: 4,
  };
  const definition = {
    format: 'molen/types@1',
    namespace: 'molen.entities',
    owner: '@bendyline/molen-entities',
    types: {
      [s.id]: {
        doc: `${s.label}: original polygonal exterior and ${s.layout} cockpit. Clean configuration. Assisted flight tuning, not a certified flight model.`,
        components,
        assets: [s.id],
      },
    },
  };
  const checked = validate('types', definition);
  if (!checked.ok) throw Error(`${s.slug}: ${checked.formatted}`);
  await emit(`${directory}/entity.types.json`, definition);
  await emit(`${directory}/models/airframe.json`, s);
  await emit(
    `${directory}/models/generate.mjs`,
    `// Profile snapshot: airframe.json; authoritative roster: source/aircraft-expansion.json; shared deterministic mesh builder.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const command = fileURLToPath(
  new URL('../../../../../../packages/entities/scripts/generate-aircraft.mjs', import.meta.url),
);
const args = [command, '--ids=${s.slug}', ...process.argv.slice(2)];
const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
`,
  );
  const reviewed = reviews.find((r) => r.slug === s.slug);
  const visualStatus =
    reviewed?.visualStatus === 'reviewed-with-limitations' && reviewed.sourceSha256 === hash(bytes)
      ? 'Reviewed against exterior and cockpit references, with documented limitations.'
      : 'Prototype; individual exterior and cockpit rework/review required.';
  await emit(
    `${directory}/README.md`,
    `# ${s.label}\n\n**Visual status: ${visualStatus}** See the hash-bound [review record](../../aircraft-expansion-review.json) and [batch review](../../AIRCRAFT-EXPANSION.md).\n\nOriginal unarmed polygonal aircraft, ${s.length} m long, ${s.span} m span/rotor diameter and ${s.height} m nominal overall height. +Y up, +Z forward; ground-contact origin.\n\n${s.signature}. Main cockpit, seats, controls and instruments live in the exterior GLB. Live pointers, horizon cues, controls, rotors and gear use declared node bindings; screen maps and labels are diagrammatic.\n\nRegenerate: \`node packages/entities/scripts/generate-aircraft.mjs --ids=${s.slug}\`. Use \`--out .artifacts/${s.slug}.glb\` for a separate candidate. Edit \`source/aircraft-expansion.json\` in the entities pack (\`models/airframe.json\` is a generated snapshot), plus its builder in \`packages/entities/scripts/aircraft/\` when present, or shared \`aircraft-geometry.mjs\` / \`aircraft-interiors.mjs\`. Reference provenance and variant limitations: [aircraft ledger](../../AIRCRAFT-EXPANSION.md).\n\nGeometry is original MIT-licensed modeling; no reference image pixels or manufacturer logos are embedded. Dimensions and cockpit arrangement approximate the named variant; this is an assisted simulation, not a systems trainer. No external weapons, missiles, bombs, weapon pylons or gun pods. Target 15–100k triangles, under 4 MB optimized GLB.${textures.length ? ' Small original procedural cockpit finishes are embedded; source maps live in textures/. Shared [finish library](../../cockpit-materials/README.md) and [material review](../../COCKPIT-MATERIALS.json). Shared [font profiles](../../../fonts/README.md) select period, technical and display lettering for this cockpit.' : ' No textures.'}\n${previous?.files.documents.includes('preview.png') ? '\n[Exterior and cockpit preview](preview.png)\n' : ''}`,
  );
  const source = {
    format: 'molen/source-bundle@1',
    id: s.id,
    kind: 'aircraft',
    title: s.label,
    order: 3 + aircraft.indexOf(s),
    files: {
      definitions: ['entity.types.json'],
      models: [
        {
          path: 'models/source.glb',
          assetId: s.id,
          output: `assets/${s.id.replaceAll('.', '/')}/asset.json`,
          pipeline: 'import',
          sha256: hash(bytes),
        },
      ],
      generators: [{ id: 'model', path: 'models/generate.mjs' }],
      scripts: [],
      textures,
      sounds: [],
      documents: [
        'README.md',
        'models/airframe.json',
        ...(await readFile(`${directory}/reference-review.json`)
          .then(() => ['reference-review.json'])
          .catch((e) => {
            if (e.code !== 'ENOENT') throw e;
            return [];
          })),
        ...(previous?.files.documents.includes('preview.png') ? ['preview.png'] : []),
      ],
    },
  };
  await emit(`${directory}/source.json`, source);
  console.log(`${s.slug}: ${bytes.length} bytes ${hash(bytes)}`);
  model.traverse((o) => {
    if (o.isMesh) o.geometry.dispose();
  });
}
