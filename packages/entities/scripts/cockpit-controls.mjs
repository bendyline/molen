/** Local live review: serve the repository with Vite and open this adjacent HTML page. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  AircraftPointerAxes,
  applyAircraftControl,
  bindAircraftCockpitPointer,
  createAircraftVisual,
} from '../../client/dist/aircraft.mjs';
import { readModelSignals } from '../../client/dist/index.mjs';
import {
  AircraftState,
  flyAircraft,
  initialAircraftState,
  installAircraft,
} from '../../kernel/dist/aircraft.mjs';
import { mountEntity } from '../../kernel/dist/vehicles.mjs';
import { Transform, World } from '../../kernel/dist/world-entry.mjs';

const documents = import.meta.glob(
  '../../../content/entities/source/aircraft/*/entity.types.json',
  { eager: true, import: 'default' },
);
const catalog = Object.entries(documents)
  .map(([path, document]) => ({
    slug: path.split('/').at(-2),
    components: Object.values(document.types)[0].components,
  }))
  .sort((a, b) => a.components.aircraft.spec.label.localeCompare(b.components.aircraft.spec.label));
const select = document.querySelector('#aircraft');
for (const entry of catalog) {
  const option = document.createElement('option');
  option.value = entry.slug;
  option.textContent = entry.components.aircraft.spec.label;
  select.append(option);
}
const canvas = document.querySelector('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#9ab5c6');
scene.add(new THREE.HemisphereLight(0xe6f3ff, 0x515540, 2.2));
const sun = new THREE.DirectionalLight(0xfff1da, 2.4);
sun.position.set(20, 30, 10);
scene.add(sun);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100000, 100000),
  new THREE.MeshStandardMaterial({ color: '#6c7765', roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.04;
scene.add(ground);
const camera = new THREE.PerspectiveCamera(68, 1, 0.025, 100000);
let world,
  visual,
  spec,
  input,
  components,
  chosen,
  loading = 0,
  view = 'cockpit',
  look = [0, 0.15];
const axes = new AircraftPointerAxes();
const reset = (airborne = false) => {
  axes.clear();
  input = structuredClone(components.aircraftInput);
  world = new World({ tickRate: 60, seed: 'cockpit-review' });
  installAircraft(world, { groundHeight: () => 0 });
  world.spawnRaw(
    { ...structuredClone(components), transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } },
    'craft',
  );
  world.spawnRaw({ transform: { pos: [...spec.pilotEye], rot: [0, 0, 0, 1] } }, 'pilot');
  if (!mountEntity(world, 'pilot', 'craft')) throw Error('Cannot occupy cockpit');
  if (airborne) {
    input = { ...input, engine: true, brake: false, power: 0.7, gear: true };
    world.set('craft', Transform, { pos: [0, 1000, 0], rot: [0, 0, 0, 1] });
    world.set('craft', AircraftState, {
      ...initialAircraftState(),
      grounded: false,
      velocity: [
        0,
        0,
        spec.model === 'airplane' ? Math.max(65, spec.airplane.stallSpeed * 1.5) : 0,
      ],
      rpm: 0.7,
    });
  }
  flyAircraft(world, 'pilot', input);
};
const pointer = bindAircraftCockpitPointer({
  element: canvas,
  camera,
  session: () =>
    !visual || view !== 'cockpit'
      ? undefined
      : {
          id: chosen,
          cockpit: visual.cockpit,
          spec,
          input,
          state: world.get('craft', AircraftState),
          change(change) {
            input = applyAircraftControl(input, change, spec, world.get('craft', AircraftState));
            axes.set(change);
            flyAircraft(world, 'pilot', input);
          },
          release() {
            axes.clear();
          },
        },
});
const load = async (slug) => {
  const ticket = ++loading;
  const entry = catalog.find((item) => item.slug === slug);
  const source = await fetch(`/content/entities/source/aircraft/${slug}/source.json`).then(
    (response) => response.json(),
  );
  const assetUrl = `/content/entities/${source.files.models[0].output}`;
  const asset = await fetch(assetUrl).then((response) => response.json());
  const model = (
    await new GLTFLoader().loadAsync(
      new URL(asset.files.main, new URL(assetUrl, location.href)).href,
    )
  ).scene;
  if (ticket !== loading) return;
  visual?.dispose();
  components = entry.components;
  spec = components.aircraft.spec;
  visual = createAircraftVisual(model, spec);
  scene.add(visual.object);
  chosen = slug;
  look = [0, 0.15];
  reset();
  history.replaceState(null, '', `?aircraft=${slug}`);
};
const error = (e) => {
  const box = document.querySelector('#error');
  box.textContent = String(e);
  box.style.display = 'block';
  console.error(e);
};
select.onchange = () => load(select.value).catch(error);
document.querySelector('#reset').onclick = () => reset();
document.querySelector('#airborne').onclick = () => reset(true);
document.querySelector('#view').onclick = (event) => {
  view = view === 'cockpit' ? 'exterior' : 'cockpit';
  event.currentTarget.textContent = view === 'cockpit' ? 'Exterior view' : 'Cockpit view';
  axes.clear();
};
let looking;
canvas.addEventListener('pointerdown', (event) => {
  looking = { id: event.pointerId, x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (looking?.id !== event.pointerId) return;
  look[0] -= (event.clientX - looking.x) * 0.004;
  look[1] = Math.max(-1.1, Math.min(1.1, look[1] + (event.clientY - looking.y) * 0.004));
  looking.x = event.clientX;
  looking.y = event.clientY;
});
canvas.addEventListener('pointerup', () => {
  looking = undefined;
});
canvas.addEventListener('pointercancel', () => {
  looking = undefined;
});
let last = performance.now(),
  accumulator = 0;
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (visual && world) {
    input = { ...input, pitch: axes.pitch, roll: axes.roll, yaw: axes.yaw };
    flyAircraft(world, 'pilot', input);
    accumulator += dt;
    while (accumulator >= 1 / 60) {
      world.step();
      accumulator -= 1 / 60;
    }
    const state = world.get('craft', AircraftState),
      transform = world.get('craft', Transform);
    visual.object.position.fromArray(transform.pos);
    visual.object.quaternion.fromArray(transform.rot);
    visual.update(
      state,
      input,
      transform.pos[1],
      {
        ...readModelSignals(spec.visual.interior?.sources, (name) => world.get('craft', { name })),
        ...readModelSignals(spec.visual.animation?.sources, (name) => world.get('craft', { name })),
      },
      world.tick / 60,
    );
    const origin = new THREE.Vector3().fromArray(transform.pos),
      rotation = new THREE.Quaternion().fromArray(transform.rot);
    if (view === 'cockpit') {
      camera.position.copy(
        new THREE.Vector3().fromArray(spec.pilotEye).applyQuaternion(rotation).add(origin),
      );
      const direction = new THREE.Vector3(
        Math.sin(look[0]) * Math.cos(look[1]),
        -Math.sin(look[1]),
        Math.cos(look[0]) * Math.cos(look[1]),
      ).applyQuaternion(rotation);
      camera.up.set(0, 1, 0).applyQuaternion(rotation);
      camera.lookAt(camera.position.clone().add(direction));
    } else {
      camera.position
        .copy(origin)
        .add(
          new THREE.Vector3(
            spec.length * Math.sin(look[0] + 0.7),
            spec.height + spec.length * 0.2,
            spec.length * Math.cos(look[0] + 0.7),
          ),
        );
      camera.up.set(0, 1, 0);
      camera.lookAt(origin.clone().add(new THREE.Vector3(0, spec.height / 2, 0)));
    }
    const readings = [
      `${spec.label}`,
      `${Math.round(state.airspeed * 1.944)} kt · ${Math.round(transform.pos[1])} m · ${state.grounded ? 'Grounded' : 'Airborne'}${state.crashed ? ' · Impact — reset to continue' : ''}`,
      `Pitch ${input.pitch.toFixed(2)} · Roll ${input.roll.toFixed(2)} · Rudder ${input.yaw.toFixed(2)}`,
      `Engine ${input.engine ? 'on' : 'off'}${spec.model === 'airplane' ? ` · Gear ${input.gear ? 'down' : 'up'} · Flaps ${Math.round(Number(input.flaps) * 100)}% · Brake ${input.brake ? 'set' : 'released'}` : ''}`,
    ];
    for (const engine of spec.engines ?? [{ ...spec.engine, id: 'main' }])
      readings.push(
        `${engine.id}: lever ${Math.round((input.engines?.[engine.id]?.power ?? input.power) * 100)}% · RPM ${Math.round((state.engines?.[engine.id]?.rpm ?? state.rpm) * 100)}%${input.engines?.[engine.id]?.enabled === false ? ' · cutoff' : ''}` +
          `${engine.mixtureControl ? ` · Mix ${Math.round((input.engines?.[engine.id]?.mixture ?? input.mixture ?? 1) * 100)}%` : ''}` +
          `${engine.propellerControl ? ` · Prop ${Math.round((input.engines?.[engine.id]?.propeller ?? input.propeller ?? 1) * 100)}%` : ''}` +
          `${engine.mixtureControl || engine.propellerControl ? ` · ${Math.round((state.engines?.[engine.id]?.shaftPower ?? 0) / 1000)} kW` : ''}`,
      );
    document.querySelector('#readings').textContent = readings.join('\n');
  }
  pointer.update();
  const width = canvas.clientWidth,
    height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
});
select.value = new URLSearchParams(location.search).get('aircraft') ?? 'baron-g58';
load(select.value).catch(error);
