import {
  applyEnvironment,
  type EarthSkyData,
  Renderer,
  type SkyData,
  THREE,
} from '@bendyline/molen-client';

const input = (id: string): HTMLInputElement => document.getElementById(id) as HTMLInputElement;
const select = (id: string): HTMLSelectElement => document.getElementById(id) as HTMLSelectElement;
const canvas = document.getElementById('sky') as HTMLCanvasElement;
const error = document.getElementById('error') as HTMLElement;
const readout = document.getElementById('readout') as HTMLOutputElement;
const params = new URLSearchParams(location.search);
const renderer = await Renderer.create({
  canvas,
  width: innerWidth,
  height: innerHeight,
  antialias: true,
  backend:
    params.get('backend') === 'webgl'
      ? 'webgl'
      : params.get('backend') === 'webgpu'
        ? 'webgpu'
        : 'auto',
  reverseDepthBuffer: true,
});
let seconds = 0;
let epoch = Date.parse(`${input('date').value}Z`);
let scale = Number(select('speed').value);
let yaw = -1.8;
let pitch = 0.16;

// Small untextured silhouettes make the changing light and horizon easy to read.
const groundMaterial = new THREE.MeshStandardMaterial({ color: '#555d52', roughness: 1 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2;
renderer.worldRoot.add(ground);
const markers = new THREE.Group();
const stoneGeometry = new THREE.BoxGeometry(2, 9, 2);
for (let i = 0; i < 12; i++) {
  const stone = new THREE.Mesh(stoneGeometry, groundMaterial);
  const angle = (i * Math.PI) / 6;
  stone.position.set(Math.sin(angle) * 38, 2.5, Math.cos(angle) * 38);
  stone.rotation.y = angle;
  markers.add(stone);
}
renderer.worldRoot.add(markers);

function configuration(): SkyData {
  const size = Number(select('size').value);
  if (select('world').value === 'custom')
    return {
      mode: 'custom',
      sunBody: { direction: [-1, -0.12, -1] },
      moonBody: { direction: [0.6, 0.45, -1], angularDiameterDeg: 7 },
      palette: {
        dayZenith: '#5f36a3',
        dayHorizon: '#e394b5',
        twilight: '#e37893',
        nightZenith: '#100720',
        nightHorizon: '#543156',
        moon: '#bee9d8',
        ground: '#221631',
      },
      starRotationDeg: [25, 40, 15],
      stars: { intensity: 2 },
      moon: { earthshine: 0.09 },
    };
  return {
    mode: 'earth',
    observer: {
      latitude: Number(input('latitude').value),
      longitude: Number(input('longitude').value),
    },
    time: { epochMs: epoch, scale },
    sun: { size },
    moon: { size },
  };
}

function configure(): void {
  try {
    applyEnvironment(renderer, { sky: configuration(), toneMapping: 'agx', exposure: 1 });
    error.textContent = '';
  } catch (reason) {
    error.textContent = reason instanceof Error ? reason.message : String(reason);
  }
}
function adoptTime(): void {
  epoch = renderer.sky?.frame.earth?.utcMs ?? epoch;
  seconds = 0;
  renderer.setEnvironmentTime(0);
}
for (const id of ['world', 'latitude', 'longitude', 'size'])
  document.getElementById(id)?.addEventListener('change', configure);
input('date').addEventListener('change', () => {
  const date = Date.parse(`${input('date').value}Z`);
  if (!Number.isFinite(date)) {
    error.textContent = 'Enter a valid UTC date and time.';
    return;
  }
  epoch = date;
  seconds = 0;
  renderer.setEnvironmentTime(0);
  configure();
});
select('speed').addEventListener('change', () => {
  adoptTime();
  scale = Number(select('speed').value);
  configure();
});
document.getElementById('now')?.addEventListener('click', () => {
  epoch = Date.now();
  seconds = 0;
  scale = 1;
  select('speed').value = '1';
  select('world').value = 'earth';
  input('date').value = new Date(epoch).toISOString().slice(0, 19);
  renderer.setEnvironmentTime(0);
  configure();
});
document.getElementById('night')?.addEventListener('click', () => {
  select('world').value = 'earth';
  input('latitude').value = '47.6';
  input('longitude').value = '-122.3';
  epoch = Date.parse('2024-03-25T05:00:00Z');
  seconds = 0;
  scale = 0;
  select('speed').value = '0';
  input('date').value = new Date(epoch).toISOString().slice(0, 19);
  renderer.setEnvironmentTime(0);
  configure();
  face('moon');
});
function face(body: 'sun' | 'moon'): void {
  const direction =
    body === 'sun' ? renderer.sky?.frame.sunDirection : renderer.sky?.frame.moonDirection;
  if (!direction) return;
  yaw = Math.atan2(direction[0], -direction[2]);
  pitch = Math.max(0.04, Math.asin(direction[1]));
}
for (const body of ['sun', 'moon'] as const)
  document.getElementById(body)?.addEventListener('click', () => face(body));
let drag: { x: number; y: number } | undefined;
canvas.addEventListener('pointerdown', (event) => {
  drag = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  yaw -= (event.clientX - drag.x) * 0.004;
  pitch = Math.max(-0.25, Math.min(1.5, pitch + (event.clientY - drag.y) * 0.004));
  drag = { x: event.clientX, y: event.clientY };
});
canvas.addEventListener('pointerup', () => {
  drag = undefined;
});
canvas.addEventListener('pointercancel', () => {
  drag = undefined;
});
addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight));
if (params.get('hud') === '0')
  for (const element of document.querySelectorAll('main,footer'))
    (element as HTMLElement).hidden = true;
if (params.has('date')) {
  epoch = Date.parse(params.get('date') ?? '');
  scale = 0;
  select('speed').value = '0';
}
configure();
face('sun');
let last = performance.now(),
  lastReadout = -Infinity;
function render(now: number): void {
  seconds += (now - last) / 1000;
  last = now;
  renderer.setEnvironmentTime(seconds);
  renderer.setCamera({
    position: [0, 2, 0],
    lookAt: [
      Math.sin(yaw) * Math.cos(pitch) * 100,
      2 + Math.sin(pitch) * 100,
      -Math.cos(yaw) * Math.cos(pitch) * 100,
    ],
  });
  try {
    renderer.render();
  } catch (reason) {
    error.textContent = String(reason);
    return;
  }
  const state = renderer.sky?.frame.earth;
  if (now - lastReadout > 250) {
    lastReadout = now;
    readout.textContent = state
      ? `${new Date(state.utcMs).toISOString().replace('T', ' ').slice(0, 19)} UTC\nSun    ${state.sun.altitudeDeg.toFixed(1)}° altitude / ${state.sun.azimuthDeg.toFixed(1)}° az\nMoon   ${state.moon.altitudeDeg.toFixed(1)}° altitude / ${state.moon.azimuthDeg.toFixed(1)}° az\nLunar illumination  ${(state.moon.illuminatedFraction * 100).toFixed(1)}%\n${renderer.backend.toUpperCase()} · ${renderer.stats().drawCalls} draw calls`
      : `Authored world\nMoon lit by the configured sun\n${renderer.backend.toUpperCase()} · ${renderer.stats().drawCalls} draw calls`;
  }
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// A small inspectable surface for browser playback and regression captures.
declare global {
  interface Window {
    __skyObservatory: { renderer: Renderer; set(data: EarthSkyData, body?: 'sun' | 'moon'): void };
  }
}
window.__skyObservatory = {
  renderer,
  set(data, body = 'sun') {
    epoch = data.time.epochMs;
    scale = data.time.scale ?? 0;
    seconds = 0;
    input('latitude').value = String(data.observer.latitude);
    input('longitude').value = String(data.observer.longitude);
    renderer.setEnvironmentTime(0);
    applyEnvironment(renderer, { sky: data, toneMapping: 'agx' });
    face(body);
  },
};
addEventListener(
  'pagehide',
  () => {
    ground.geometry.dispose();
    stoneGeometry.dispose();
    groundMaterial.dispose();
    renderer.dispose();
  },
  { once: true },
);
