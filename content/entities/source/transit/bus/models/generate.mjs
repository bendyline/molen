/**
 * Deterministic master for a 12 m low-floor city bus. No network, textures or private tools.
 * Front faces +Z, the kerb-side doors are on the right (-X), wheels sit on y = 0.
 * Run `node models/generate.mjs` to rewrite models/source.glb (hand edits are preserved: a
 * master matching neither source.json's pin nor this output is left alone), or
 * `node models/generate.mjs --out /tmp/bus-candidate.glb` to review a candidate.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// GLTFExporter uses FileReader only to pack its binary buffer in Node.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
};
const root = dirname(fileURLToPath(import.meta.url));
const mat = (name, color, metalness = 0, roughness = 0.6, extra = {}) =>
  new T.MeshStandardMaterial({ name, color, metalness, roughness, ...extra });
const paint = mat('vehicle-paint-and-trim', '#ffffff', 0.15, 0.42);
const glass = mat('vehicle-glass', '#26343c', 0.1, 0.12, { transparent: true, opacity: 0.82 });
const trim = mat('trim-charcoal', '#22272b', 0.05, 0.7);
const rubber = mat('rubber', '#141718', 0, 0.92);
const rim = mat('wheel-rim', '#9aa2a6', 0.7, 0.35);
const lamp = mat('lamp-lens', '#fff4d6', 0, 0.3, { emissive: '#fff4d6', emissiveIntensity: 0.6 });
const tail = mat('tail-lens', '#c9302c', 0, 0.3, { emissive: '#8a1512', emissiveIntensity: 0.5 });
const sign = mat('destination-sign', '#12161a', 0, 0.5);
const signText = mat('destination-text', '#ffb347', 0, 0.4, {
  emissive: '#ffb347',
  emissiveIntensity: 0.9,
});

const L = 12.0; // length
const W = 2.55; // width
const H = 3.2; // height
const WHEEL_R = 0.5;
const FRONT_AXLE = L / 2 - 2.6;
const REAR_AXLE = -L / 2 + 3.3;

function box(parent, name, size, pos, material) {
  const mesh = new T.Mesh(new T.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...pos);
  parent.add(mesh);
  return mesh;
}

function wheel(parent, name, x, z) {
  const group = new T.Group();
  group.name = name;
  group.position.set(x, WHEEL_R, z);
  parent.add(group);
  // The first child spins about X (createVehicleVisual rotates children[0].rotation.x).
  const spinner = new T.Group();
  spinner.name = `${name}-spin`;
  group.add(spinner);
  const tyre = new T.Mesh(new T.CylinderGeometry(WHEEL_R, WHEEL_R, 0.32, 20), rubber);
  tyre.name = 'wheel-mesh';
  tyre.rotation.z = Math.PI / 2;
  spinner.add(tyre);
  const hub = new T.Mesh(new T.CylinderGeometry(WHEEL_R * 0.55, WHEEL_R * 0.55, 0.34, 12), rim);
  hub.name = 'wheel-hub';
  hub.rotation.z = Math.PI / 2;
  spinner.add(hub);
}

function bus() {
  const g = new T.Group();
  g.name = 'bus';
  const body = new T.Group();
  body.name = 'body';
  g.add(body);
  const skirt = 0.36;
  // Lower body, window band, roof and roof pod.
  box(body, 'lower-body', [W, 1.0, L - 0.2], [0, skirt + 0.5, 0], paint);
  box(body, 'window-band', [W - 0.04, 1.28, L - 0.7], [0, skirt + 1.64, -0.1], glass);
  box(body, 'pillar-band', [W, 0.2, L - 0.2], [0, skirt + 1.1, 0], paint);
  box(body, 'roof', [W, 0.36, L - 0.3], [0, H - 0.34, -0.05], paint);
  box(body, 'roof-pod', [W * 0.72, 0.28, 2.8], [0, H - 0.04, -L / 2 + 2.4], paint);
  // Window pillars along both sides.
  for (let i = 0; i < 9; i++) {
    const z = -L / 2 + 1.2 + i * 1.2;
    for (const x of [-W / 2 + 0.01, W / 2 - 0.01])
      box(body, 'pillar', [0.04, 1.28, 0.1], [x, skirt + 1.64, z], paint);
  }
  // Front: windscreen, destination sign, bumper, lamps.
  box(body, 'windscreen', [W - 0.12, 1.5, 0.06], [0, skirt + 1.6, L / 2 - 0.06], glass);
  box(body, 'sign', [W - 0.4, 0.26, 0.05], [0, H - 0.52, L / 2 - 0.07], sign);
  box(body, 'sign-text', [W - 0.9, 0.12, 0.02], [0, H - 0.52, L / 2 - 0.04], signText);
  box(body, 'front-bumper', [W, 0.34, 0.18], [0, skirt + 0.1, L / 2 - 0.02], trim);
  for (const x of [-W / 2 + 0.3, W / 2 - 0.3])
    box(body, 'headlamp', [0.34, 0.16, 0.04], [x, skirt + 0.46, L / 2 - 0.08], lamp);
  // Rear: engine grille, lamps, bumper.
  box(body, 'rear-window', [W - 0.3, 0.9, 0.05], [0, skirt + 1.9, -L / 2 + 0.07], glass);
  box(body, 'rear-bumper', [W, 0.34, 0.18], [0, skirt + 0.1, -L / 2 + 0.02], trim);
  box(body, 'engine-grille', [W - 0.6, 0.5, 0.04], [0, skirt + 0.62, -L / 2 + 0.08], trim);
  for (const x of [-W / 2 + 0.2, W / 2 - 0.2])
    box(body, 'tail-lamp', [0.18, 0.5, 0.04], [x, skirt + 0.9, -L / 2 + 0.08], tail);
  // Kerb-side doors (right of travel is -X when facing +Z): front and centre.
  for (const z of [L / 2 - 1.3, -0.4])
    box(body, 'door', [0.05, 2.1, 1.2], [-W / 2 - 0.01, skirt + 1.05, z], glass);
  // Mirrors.
  for (const x of [-W / 2 - 0.25, W / 2 + 0.25])
    box(body, 'mirror', [0.06, 0.4, 0.18], [x, skirt + 1.9, L / 2 - 0.35], trim);
  // Wheel arches (dark) and wheels: left is +X when facing +Z.
  for (const z of [FRONT_AXLE, REAR_AXLE])
    for (const x of [-W / 2, W / 2]) box(body, 'arch', [0.06, 0.62, 1.3], [x, 0.62, z], trim);
  wheel(g, 'wheel-front-left', W / 2 - 0.2, FRONT_AXLE);
  wheel(g, 'wheel-front-right', -W / 2 + 0.2, FRONT_AXLE);
  wheel(g, 'wheel-rear-left', W / 2 - 0.2, REAR_AXLE);
  wheel(g, 'wheel-rear-right', -W / 2 + 0.2, REAR_AXLE);
  return g;
}

// source.json pins the master this generator last wrote. A master that matches neither the pin
// nor this run's output was edited by hand, and regenerating would discard that work.
const sourcePath = resolve(root, '../source.json');
const sourceText = await readFile(sourcePath, 'utf8');
const pinned = JSON.parse(sourceText).files.models.find(
  (m) => m.path === 'models/source.glb',
)?.sha256;
const bytes = Buffer.from(
  await new GLTFExporter().parseAsync(bus(), { binary: true, onlyVisible: false }),
);
const path = resolve(root, 'source.glb');
const current = await readFile(path).catch(() => undefined);
const hash = (buffer) => `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
const generatedHash = hash(bytes);
const outIndex = process.argv.indexOf('--out');
if (outIndex !== -1) {
  const candidate = resolve(process.argv[outIndex + 1] ?? '');
  if (candidate === path || candidate === sourcePath)
    throw new Error('--out must be separate from the source master and its source.json');
  await mkdir(dirname(candidate), { recursive: true });
  await writeFile(candidate, bytes);
  console.log(`Candidate: ${candidate} ${generatedHash}`);
  process.exit(0);
}
if (current && pinned && hash(current) !== pinned && !current.equals(bytes))
  throw new Error(`Preserving artist edits in ${path}; move the master before regenerating.`);
if (!current?.equals(bytes)) await writeFile(path, bytes);
if (pinned !== generatedHash)
  await writeFile(sourcePath, sourceText.replace(pinned ?? 'sha256:pending', generatedHash));
console.log(`bus: ${bytes.length} bytes, ${generatedHash}`);
