/**
 * The vehicle console (`@bendyline/molen-client/console`) over a vehicle in a chase view, for
 * look reviews and browser checks. `vehicle=<category>/<slug>` picks one from the entity catalog
 * (`aircraft/p51d`, `vehicle/toyota_corolla_2025`, `cycle/standard_motorcycle`,
 * `watercraft/speedboat`) or `walk`; `bg=sky|snow|dusk` the backdrop; `gauges=0` hides the
 * dials (an aircraft's airspeed and altitude, a vehicle's speedometer); `ground=1` parks it; `handed=left` mirrors the console. A small stand-in for
 * the simulation moves the vehicle from the console's input. `window.consoleQA` reads and
 * measures it.
 */
import { applyEnvironment, Renderer } from '@bendyline/molen-client';
import {
  type AircraftCockpitSession,
  applyAircraftControl,
  createAircraftVisual,
} from '@bendyline/molen-client/aircraft';
import { type ConsoleSubject, createVehicleConsole } from '@bendyline/molen-client/console';
import { NavigationInputSource } from '@bendyline/molen-client/navigation';
import { createVehicleVisual } from '@bendyline/molen-client/vehicles';
import { IDLE_AIRCRAFT_INPUT, initialAircraftState } from '@bendyline/molen-kernel/aircraft';
import type {
  AircraftInputData,
  AircraftSpec,
  AircraftStateData,
  BoatData,
  SkyData,
  VehicleData,
} from '@bendyline/molen-schema';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const params = new URLSearchParams(location.search);
const backdrop = params.get('bg') ?? 'sky';
const choice = params.get('vehicle') ?? 'aircraft/p51d';
const WIDTH = innerWidth;
const HEIGHT = innerHeight;

const catalogs = import.meta.glob<string>('../../../../content/entities/types/*.types.json', {
  query: '?url',
  import: 'default',
});
const models = import.meta.glob<string>(
  '../../../../content/entities/assets/molen/entities/*/*/model.glb',
  { query: '?url', import: 'default' },
);
type Catalog = Record<string, { components: Record<string, unknown> }>;
const catalog = async (name: string): Promise<Catalog> => {
  const load = catalogs[`../../../../content/entities/types/${name}.types.json`];
  if (!load) throw new Error(`No ${name} catalog`);
  return (await (await fetch(await load())).json()).types;
};
const modelUrl = async (category: string, slug: string): Promise<string> => {
  const load =
    models[`../../../../content/entities/assets/molen/entities/${category}/${slug}/model.glb`];
  if (!load) throw new Error(`No model for ${category}/${slug}`);
  return load();
};

// --- The world behind the console: the vehicle over fields, from a chase camera. ---

const stage = document.createElement('main');
stage.id = 'stage';
document.body.append(stage);
const renderer = await Renderer.create({
  backend: 'webgl',
  width: WIDTH,
  height: HEIGHT,
  antialias: true,
  preserveDrawingBuffer: true,
  pixelRatio: Math.min(devicePixelRatio, 2),
});
const canvas = renderer.three.domElement;
canvas.style.width = `${WIDTH}px`;
canvas.style.height = `${HEIGHT}px`;
canvas.tabIndex = 0;
canvas.setAttribute('aria-label', 'World view');
stage.append(canvas);
const epochs: Record<string, number> = {
  sky: Date.UTC(2026, 6, 15, 20, 0),
  snow: Date.UTC(2026, 0, 20, 21, 0),
  dusk: Date.UTC(2026, 6, 16, 4, 5),
};
const sky: SkyData = {
  mode: 'earth',
  observer: { latitude: 47.6, longitude: -122.3 },
  time: { epochMs: epochs[backdrop] ?? (epochs.sky as number), scale: 0 },
};
applyEnvironment(renderer, { sky, toneMapping: 'aces' });
/** Field patches, repeated: enough busy detail behind the console to judge legibility. */
function fieldTexture(snow: boolean): THREE.CanvasTexture {
  const size = 512;
  const paint = document.createElement('canvas');
  paint.width = paint.height = size;
  const g = paint.getContext('2d') as CanvasRenderingContext2D;
  let seed = 7;
  const random = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const palette = snow
    ? ['#eef2f6', '#e3e9ef', '#f6f8fa', '#d6dee6', '#c9d2da', '#8f9aa3']
    : ['#5d7a3a', '#7a8d45', '#a39a5c', '#4f6b34', '#8c7a4a', '#6e8a52'];
  g.fillStyle = palette[0] as string;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = palette[Math.floor(random() * palette.length)] as string;
    g.fillRect(random() * size, random() * size, 30 + random() * 120, 30 + random() * 120);
  }
  const texture = new THREE.CanvasTexture(paint);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(60, 60);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
const [category = 'walk', slug = ''] = choice.split('/');
const water = category === 'watercraft';
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40_000, 40_000),
  water
    ? new THREE.MeshStandardMaterial({ color: '#2d5f7c', roughness: 0.25, metalness: 0.1 })
    : new THREE.MeshStandardMaterial({ map: fieldTexture(backdrop === 'snow'), roughness: 0.95 }),
);
ground.rotation.x = -Math.PI / 2;
renderer.worldRoot.add(ground);

// --- The console. ---

const navigation = new NavigationInputSource({ element: canvas, profile: 'walk' });
const vehicleConsole = createVehicleConsole(stage, {
  input: navigation.map,
  focusTarget: canvas,
  handed: params.get('handed') === 'left' ? 'left' : 'right',
});

// --- The vehicle and a stand-in for its simulation. ---

type Stepper = (dt: number, time: number) => { eye: THREE.Vector3; look: THREE.Vector3 };
let step: Stepper;
let subject: ConsoleSubject;
let readout: () => Record<string, unknown> = () => ({});
let flying: { input: AircraftInputData; state: AircraftStateData } | undefined;
if (category === 'aircraft') {
  const id = `molen.entities.aircraft.${slug}`;
  const entry = (await catalog('aircraft'))[id];
  if (!entry) throw new Error(`No aircraft ${id}`);
  const spec = (entry.components.aircraft as { spec: AircraftSpec }).spec;
  const { scene: model } = await new GLTFLoader().loadAsync(await modelUrl('aircraft', slug));
  const visual = createAircraftVisual(model, spec);
  model.position.set(0, 600, 0);
  renderer.worldRoot.add(model);
  const airborne = params.get('ground') !== '1';
  const air = {
    input: {
      ...IDLE_AIRCRAFT_INPUT,
      power: 0.62,
      engine: true,
      gear: !airborne,
      brake: false,
      flaps: 0,
    } as AircraftInputData,
    state: {
      ...initialAircraftState(0),
      airspeed: airborne ? 120 : 0,
      rpm: 0.8,
      gearPosition: airborne ? 0 : 1,
      flapPosition: 0,
      grounded: !airborne,
    } as AircraftStateData,
  };
  flying = air;
  const session = (): AircraftCockpitSession => ({
    id,
    cockpit: visual.cockpit,
    spec,
    input: air.input,
    state: air.state,
    change: (change) => {
      air.input = applyAircraftControl(air.input, change, spec, air.state);
    },
    release: () => {},
  });
  const gauges = params.get('gauges') !== '0';
  subject = { kind: 'aircraft', visual, spec, type: id, session, gauges };
  navigation.setProfile('pilot');
  const smooth = { pitch: 0, roll: 0 };
  const toward = (value: number, target: number, rate: number, dt: number): number =>
    value + Math.max(-rate * dt, Math.min(rate * dt, target - value));
  step = (dt, time) => {
    const nav = navigation.read(dt);
    const { input, state } = air;
    input.pitch = -nav.move.forward;
    input.roll = nav.move.right;
    input.yaw = nav.pilot?.yaw ?? 0;
    input.brake = nav.jump;
    state.gearPosition = toward(
      state.gearPosition ?? 0,
      Number(input.gear),
      1 / (spec.airplane?.gearTransitTime ?? 6),
      dt,
    );
    state.flapPosition = toward(
      state.flapPosition ?? 0,
      Number(input.flaps),
      1 / (spec.airplane?.flapTransitTime ?? 4),
      dt,
    );
    state.rpm = input.engine ? toward(state.rpm, 0.25 + 0.75 * input.power, 0.5, dt) : 0;
    if (airborne) state.airspeed = toward(state.airspeed, 70 + 95 * input.power, 6, dt);
    state.rotorAngle = (state.rotorAngle + state.rpm * 220 * dt) % (Math.PI * 2);
    smooth.pitch += (input.pitch - smooth.pitch) * (1 - Math.exp(-dt / 0.6));
    smooth.roll += (input.roll - smooth.roll) * (1 - Math.exp(-dt / 0.6));
    state.roll = smooth.roll * 0.6;
    state.pitch = -smooth.pitch * 0.14;
    model.quaternion.setFromEuler(new THREE.Euler(-state.pitch, 0, -state.roll, 'YXZ'));
    model.updateMatrixWorld(true);
    const back = 1.5 * spec.length + 4;
    const eye = model.position.clone().add(new THREE.Vector3(0, 0.3 * back, -back));
    visual.updateView(eye.toArray() as [number, number, number]);
    visual.update(state, input, model.position.y, undefined, time);
    return { eye, look: model.position.clone().add(new THREE.Vector3(0, 1.4, 10)) };
  };
  readout = () => ({
    pitch: air.input.pitch,
    roll: air.input.roll,
    yaw: air.input.yaw,
    power: air.input.power,
    gear: air.input.gear,
    flaps: air.input.flaps,
    engine: air.input.engine,
    brake: air.input.brake,
  });
} else if (category === 'vehicle' || category === 'cycle' || category === 'watercraft') {
  const id = `molen.entities.${category}.${slug}`;
  const entry = (await catalog(category))[id];
  if (!entry) throw new Error(`No vehicle ${id}`);
  const data = (entry.components.vehicle ?? entry.components.boat) as VehicleData | BoatData;
  const { scene: model } = await new GLTFLoader().loadAsync(await modelUrl(category, slug));
  const visual = createVehicleVisual(model, data as VehicleData);
  renderer.worldRoot.add(model);
  const gauges = params.get('gauges') !== '0';
  subject = { kind: 'vehicle', visual, data, boat: water, type: id, gauges };
  navigation.setProfile('drive');
  const car = { steer: 0, throttle: 0, brake: false, handbrake: false, speed: 0, wheel: 0 };
  step = (dt, time) => {
    const nav = navigation.read(dt);
    car.steer += (nav.move.right - car.steer) * (1 - Math.exp(-dt / 0.25));
    car.throttle = nav.move.forward;
    car.brake = nav.jump;
    car.handbrake = nav.sprint;
    car.speed = Math.max(0, car.speed + (car.throttle * 4 - (car.brake ? 8 : 0.5)) * dt);
    car.wheel += (car.speed / 0.33) * dt;
    model.updateMatrixWorld(true);
    visual.update(
      car.steer * 0.55,
      car.wheel,
      { throttle: car.throttle, brake: Number(car.brake), speed: car.speed },
      time,
    );
    const length = (data.spec as { length?: number }).length ?? 4.5;
    const eye = new THREE.Vector3(0, 1.2 + length * 0.35, -2 - length * 1.3);
    return { eye, look: new THREE.Vector3(0, 0.8, 6) };
  };
  readout = () => ({ ...car });
} else {
  subject = { kind: params.get('free') === '1' ? 'free' : 'walk' };
  navigation.setProfile(subject.kind === 'free' ? 'fly' : 'walk');
  const held = { jump: false, interact: 0 };
  step = (dt) => {
    const nav = navigation.read(dt);
    held.jump = nav.jump;
    held.interact += nav.interact;
    return { eye: new THREE.Vector3(0, 1.7, 0), look: new THREE.Vector3(0, 1.5, 10) };
  };
  readout = () => ({ ...held });
}
vehicleConsole.setSubject(subject);

// --- The frame. ---

let time = 0;
let mainMs = 0;
let consoleMs = 0;
function frame(dt: number, now: number): void {
  time += dt;
  const { eye, look } = step(dt, time);
  renderer.setCamera({
    position: eye.toArray() as [number, number, number],
    lookAt: look.toArray() as [number, number, number],
  });
  const t0 = performance.now();
  renderer.render();
  const t1 = performance.now();
  vehicleConsole.update(now);
  mainMs = t1 - t0;
  consoleMs = performance.now() - t1;
}
renderer.setFov(70);
await renderer.prepareObject(renderer.worldRoot);
let frozen = false;
let clock = performance.now();
let last = clock;
const loop = (now: number): void => {
  if (!frozen) {
    const dt = Math.min(0.05, (now - last) / 1000);
    clock += dt * 1000;
    frame(dt, clock);
  }
  last = now;
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);

const api = {
  /** The console's layout. */
  layout: () => {
    const layout = vehicleConsole.layout;
    return layout
      ? {
          size: layout.size,
          height: layout.height,
          rects: Object.fromEntries(layout.rects),
          hidden: layout.hidden,
          drawer: layout.drawer,
          stick: layout.stick,
        }
      : undefined;
  },
  drawing: () => vehicleConsole.drawing,
  input: () => readout(),
  /** Set the aircraft's controls directly (for captures), then run `seconds` of frames. */
  pose(
    options: Partial<AircraftInputData> & {
      gearPosition?: number;
      flapPosition?: number;
      seconds?: number;
    },
  ) {
    if (flying) {
      const { gearPosition, flapPosition, seconds: _seconds, ...input } = options;
      flying.input = { ...flying.input, ...input };
      if (gearPosition !== undefined) flying.state.gearPosition = gearPosition;
      if (flapPosition !== undefined) flying.state.flapPosition = flapPosition;
    }
    api.run(options.seconds ?? 1);
  },
  /** Run frames at 60 Hz with the clock stopped between them. */
  run(seconds: number) {
    frozen = true;
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      clock += 1000 / 60;
      frame(1 / 60, clock);
    }
  },
  /** Back to the live clock. */
  release() {
    frozen = false;
  },
  /** Alpha-weighted share of the viewport the console strip covers. */
  coverage(): number {
    const strip = document.querySelector('.molen-console-strip') as HTMLCanvasElement | null;
    if (!strip) return 0;
    // The strip keeps no drawing buffer: draw it again and read it in the same task.
    vehicleConsole.setVisible(false);
    vehicleConsole.setVisible(true);
    clock += 1000 / 60;
    frame(1 / 60, clock);
    if (strip.width === 0 || strip.height === 0) return 0;
    const read = document.createElement('canvas');
    read.width = strip.width;
    read.height = strip.height;
    const g = read.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    g.drawImage(strip, 0, 0);
    const { data } = g.getImageData(0, 0, read.width, read.height);
    let sum = 0;
    for (let i = 3; i < data.length; i += 4) sum += data[i] as number;
    const scale = (read.width / strip.clientWidth) * (read.height / strip.clientHeight);
    return sum / 255 / scale / (WIDTH * HEIGHT);
  },
  /** Main-thread milliseconds per frame for the world and for the console, over `frames`. */
  timing(frames: number): { mainMs: number; consoleMs: number } {
    frozen = true;
    let main = 0;
    let spent = 0;
    for (let i = 0; i < frames; i++) {
      clock += 1000 / 60;
      frame(1 / 60, clock);
      main += mainMs;
      spent += consoleMs;
    }
    return { mainMs: main / frames, consoleMs: spent / frames };
  },
  ready: true,
};
declare global {
  interface Window {
    consoleQA: typeof api;
  }
}
window.consoleQA = api;
