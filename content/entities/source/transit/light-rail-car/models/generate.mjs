/**
 * Deterministic master for a 27 m two-section light-rail vehicle. No network, textures or private
 * tools. Front faces +Z; the rail head is y = 0. Both cabs are identical, so a consist can run
 * either way. `node models/generate.mjs` rewrites models/source.glb (hand edits are preserved);
 * `--out <path>` writes a review candidate instead.
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
const paint = mat('rail-livery-body', '#ffffff', 0.1, 0.45);
const livery = mat('rail-livery-stripe', '#1d6f8f', 0.1, 0.45);
const doorGlass = mat('door-glass', '#1d2a31', 0.1, 0.15, { transparent: true, opacity: 0.85 });
const glass = mat('vehicle-glass', '#26343c', 0.1, 0.12, { transparent: true, opacity: 0.82 });
const trim = mat('trim-charcoal', '#22272b', 0.05, 0.7);
const rubber = mat('rubber', '#141718', 0, 0.92);
const rim = mat('wheel-rim', '#9aa2a6', 0.7, 0.35);
const lamp = mat('lamp-lens', '#fff4d6', 0, 0.3, { emissive: '#fff4d6', emissiveIntensity: 0.6 });
const tail = mat('tail-lens', '#c9302c', 0, 0.3, { emissive: '#8a1512', emissiveIntensity: 0.5 });
const signPanel = mat('destination-sign', '#12161a', 0, 0.5);
const signText = mat('destination-text', '#ffb347', 0, 0.4, {
  emissive: '#ffb347',
  emissiveIntensity: 0.9,
});

const L = 27.0;
const W = 2.65;
const H = 3.6;
const FLOOR = 0.95;

function box(parent, name, size, pos, material) {
  const mesh = new T.Mesh(new T.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...pos);
  parent.add(mesh);
  return mesh;
}

function bogie(parent, name, z) {
  const g = new T.Group();
  g.name = name;
  g.position.set(0, 0, z);
  parent.add(g);
  box(g, 'bogie-frame', [W * 0.72, 0.36, 2.6], [0, 0.55, 0], trim);
  for (const dz of [-0.9, 0.9])
    for (const x of [-0.72, 0.72]) {
      const wheel = new T.Mesh(new T.CylinderGeometry(0.34, 0.34, 0.14, 16), rubber);
      wheel.name = 'rail-wheel';
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.34, dz);
      g.add(wheel);
    }
}

function cab(body, sign) {
  const z = sign * (L / 2 - 0.05);
  box(body, 'windscreen', [W - 0.2, 1.3, 0.06], [0, FLOOR + 1.55, z], glass);
  box(
    body,
    'destination-sign',
    [W - 0.6, 0.24, 0.05],
    [0, FLOOR + 2.42, z],
    sign > 0 ? signPanel : signPanel,
  );
  box(body, 'destination-text', [W - 1.1, 0.1, 0.02], [0, FLOOR + 2.42, z + sign * 0.03], signText);
  box(body, 'coupler-shroud', [W - 0.4, 0.5, 0.2], [0, FLOOR + 0.1, z], trim);
  for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) {
    box(body, 'headlamp', [0.3, 0.14, 0.04], [x, FLOOR + 0.55, z + sign * 0.02], lamp);
    box(body, 'tail-lamp', [0.14, 0.14, 0.04], [x * 0.8, FLOOR + 0.3, z + sign * 0.02], tail);
  }
}

function lightRail() {
  const g = new T.Group();
  g.name = 'light-rail-car';
  const body = new T.Group();
  body.name = 'body';
  g.add(body);
  const section = (L - 1.0) / 2;
  for (const [i, zc] of [
    [0, L / 4 + 0.25],
    [1, -L / 4 - 0.25],
  ]) {
    box(body, `lower-${i}`, [W, 1.0, section], [0, FLOOR + 0.5, zc], paint);
    box(body, `windows-${i}`, [W - 0.03, 1.2, section - 0.4], [0, FLOOR + 1.62, zc], glass);
    box(body, `roof-${i}`, [W, 0.5, section], [0, FLOOR + 2.47, zc], paint);
    box(body, `stripe-${i}`, [W + 0.01, 0.14, section], [0, FLOOR + 1.02, zc], livery);
    for (let k = 0; k < 6; k++) {
      const z = zc - section / 2 + 0.6 + k * ((section - 1.2) / 5);
      for (const x of [-W / 2 + 0.01, W / 2 - 0.01])
        box(body, 'pillar', [0.04, 1.2, 0.12], [x, FLOOR + 1.62, z], paint);
    }
    // Two double doors per side per section.
    for (const dz of [-section / 4, section / 4])
      for (const x of [-W / 2 - 0.005, W / 2 + 0.005])
        box(body, 'door', [0.04, 2.0, 1.3], [x, FLOOR + 1.0, zc + dz], doorGlass);
  }
  // Articulation bellows between the sections.
  box(body, 'articulation', [W - 0.25, 2.5, 1.0], [0, FLOOR + 1.3, 0], trim);
  cab(body, 1);
  cab(body, -1);
  // Roof equipment and pantograph.
  box(body, 'roof-equipment', [W * 0.6, 0.3, 3.2], [0, FLOOR + 2.87, -L / 4], trim);
  const pantograph = new T.Group();
  pantograph.name = 'pantograph';
  pantograph.position.set(0, FLOOR + 2.72, L / 4);
  body.add(pantograph);
  box(pantograph, 'pantograph-base', [1.2, 0.12, 1.6], [0, 0.06, 0], trim);
  const arm = box(pantograph, 'pantograph-arm', [0.06, 0.06, 1.7], [0, 0.55, 0], rim);
  arm.rotation.x = -0.6;
  box(pantograph, 'pantograph-head', [1.6, 0.06, 0.12], [0, 1.02, -0.45], rim);
  bogie(g, 'bogie-front', L / 2 - 4.2);
  bogie(g, 'bogie-middle', 0);
  bogie(g, 'bogie-rear', -L / 2 + 4.2);
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
  await new GLTFExporter().parseAsync(lightRail(), { binary: true, onlyVisible: false }),
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
console.log(`light-rail-car: ${bytes.length} bytes, ${generatedHash}`);
