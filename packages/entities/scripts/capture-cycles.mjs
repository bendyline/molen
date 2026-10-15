/** Rider/contact review; --lock checks full steering, --models adds four-angle model captures. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { driveVehicle, installVehicles, stepVehicle } from '@bendyline/molen-kernel/vehicles';
import { screenshotAsset, screenshotScene } from '../../tooling/dist/index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/entities');
const scene = JSON.parse(await readFile(`${root}/scenes/cycles.scene.json`, 'utf8'));
const flat = { groundHeight: () => 0 };
const lock = process.argv.includes('--lock');
const input = lock
  ? { throttle: 0, steering: 1, brake: true }
  : { throttle: 1, steering: 0.35, brake: false };
const label = lock ? 'steering-lock' : 'riding';
const report = [];
await mkdir(`${root}/shots`, { recursive: true });
for (const cycle of scene.entities.filter((entity) => entity.type?.includes('.cycle.'))) {
  const id = cycle.id;
  const rider = scene.entities.find((entity) => entity.components?.mounted?.vehicle === id);
  const source = JSON.parse(
    await readFile(`${root}/source/cycles/${id}/entity.types.json`, 'utf8'),
  );
  const components = source.types[cycle.type].components;
  let transform = { pos: [0, 0, 0], rot: [0, 0, 0, 1] };
  let state = components.vehicleState;
  for (let tick = 0; tick < 90; tick++) {
    const result = stepVehicle(transform, state, input, components.vehicle.spec, 1 / 60, flat);
    transform = result.transform;
    state = result.state;
  }
  const shot = {
    ...scene,
    entities: [
      {
        ...cycle,
        components: { ...cycle.components, transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } },
      },
      rider,
      ...scene.entities.filter((entity) => ['plaza', 'environment'].includes(entity.id)),
    ],
  };
  const [x, y, z] = transform.pos;
  const result = await screenshotScene({
    scene: shot,
    projectPath: `${root}/project.json`,
    ticks: 90,
    setup(world) {
      installVehicles(world, flat);
      driveVehicle(world, rider.id, input);
    },
    camera: { position: [x + 3.6, y + 2.2, z + 4], lookAt: [x, y + 0.95, z], fov: 35 },
    size: [1000, 800],
    reflections: true,
    antialias: true,
    outPath: `${root}/shots/${id}-${label}.png`,
  });
  if (!result.ok) throw new Error(JSON.stringify(result));
  const bytes = await readFile(`${root}/source/cycles/${id}/models/source.glb`);
  report.push({
    id: cycle.type,
    sourceHash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    ...result,
  });
  if (process.argv.includes('--models')) {
    const model = await screenshotAsset({
      ref: cycle.type,
      projectPath: `${root}/project.json`,
      outDir: `${root}/source/cycles/${id}/shots`,
      angles: 4,
      size: [640, 480],
      reflections: true,
      antialias: true,
    });
    if (!model.ok) throw new Error(JSON.stringify(model));
  }
  console.log(id, result.stateHash);
}
const gallery = lock
  ? undefined
  : await screenshotScene({
      scenePath: `${root}/scenes/cycles.scene.json`,
      setupModule: `${root}/scenes/cycles.setup.mjs`,
      ticks: 60,
      size: [1600, 1000],
      reflections: true,
      antialias: true,
      outPath: `${root}/shots/cycles.png`,
    });
if (gallery && !gallery.ok) throw new Error(JSON.stringify(gallery));
await writeFile(
  `${root}/shots/cycle-${label}-report.json`,
  `${JSON.stringify({ riders: report, gallery }, null, 2)}\n`,
);
