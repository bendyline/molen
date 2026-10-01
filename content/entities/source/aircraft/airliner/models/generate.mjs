/**
 * Deterministic master for a 38 m narrow-body twin-jet airliner seen from the ground. No network,
 * textures or private tools. The nose faces +Z and the origin is the fuselage centre. The two fan
 * discs (`fan-left`, `fan-right`) spin about Z; gear groups show only on approach.
 * `node models/generate.mjs` rewrites models/source.glb (hand edits are preserved); `--out <path>`
 * writes a review candidate instead.
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
const paint = mat('airliner-white', '#f3f4f2', 0.2, 0.4);
const livery = mat('airliner-livery', '#1f4f8c', 0.2, 0.4);
const belly = mat('airliner-belly', '#b9bfc4', 0.3, 0.45);
const metal = mat('engine-metal', '#8f989e', 0.8, 0.3);
const glass = mat('vehicle-glass', '#26343c', 0.1, 0.12, { transparent: true, opacity: 0.82 });
const rubber = mat('rubber', '#141718', 0, 0.92);
const dark = mat('fan-dark', '#1c2126', 0.3, 0.6);

const SPAN = 35.8;
const R = 1.95; // fuselage radius

function box(parent, name, size, pos, material) {
  const mesh = new T.Mesh(new T.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...pos);
  parent.add(mesh);
  return mesh;
}

function tube(parent, name, radiusFront, radiusBack, length, z, material, segments = 24) {
  const mesh = new T.Mesh(
    new T.CylinderGeometry(radiusFront, radiusBack, length, segments),
    material,
  );
  mesh.name = name;
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(0, 0, z);
  parent.add(mesh);
  return mesh;
}

/**
 * A tapered, swept panel (wing or tailplane) in plan view: root chord at x = 0, tip at `span`,
 * mirrored for the right side by negating x in the outline itself (a negative scale would turn
 * the faces inside out).
 */
function panel(parent, name, root, tip, span, sweep, thickness, side, material) {
  const shape = new T.Shape();
  shape.moveTo(0, root / 2);
  shape.lineTo(side * span, root / 2 - sweep);
  shape.lineTo(side * span, root / 2 - sweep - tip);
  shape.lineTo(0, -root / 2);
  shape.closePath();
  const geometry = new T.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.translate(0, 0, -thickness / 2);
  // Outline x/y is plan-view x/z: rotate so the extrusion (thickness) runs along Y.
  geometry.rotateX(Math.PI / 2);
  const mesh = new T.Mesh(geometry, material);
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function engine(parent, side) {
  const g = new T.Group();
  g.name = side > 0 ? 'engine-left' : 'engine-right';
  g.position.set(side * 5.8, -1.55, 3.4);
  parent.add(g);
  tube(g, 'nacelle', 1.05, 0.85, 3.6, 0, paint);
  const fan = new T.Group();
  fan.name = side > 0 ? 'fan-left' : 'fan-right';
  fan.position.set(0, 0, 1.78);
  g.add(fan);
  const disc = tube(fan, 'fan-disc', 0.92, 0.92, 0.05, 0, metal, 20);
  disc.name = 'fan-disc';
  for (let i = 0; i < 6; i++) {
    const blade = box(fan, 'fan-blade', [0.12, 1.7, 0.03], [0, 0, 0.03], dark);
    blade.rotation.z = (i * Math.PI) / 6;
  }
  box(g, 'pylon', [0.3, 1.0, 2.2], [0, 0.95, -0.3], paint);
}

function gear(parent, name, x, z, height) {
  const g = new T.Group();
  g.name = name;
  g.position.set(x, -R, z);
  parent.add(g);
  box(g, 'gear-strut', [0.18, height, 0.18], [0, -height / 2, 0], metal);
  for (const dx of [-0.3, 0.3]) {
    const tyre = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 0.3, 14), rubber);
    tyre.name = 'gear-tyre';
    tyre.rotation.z = Math.PI / 2;
    tyre.position.set(dx, -height, 0);
    g.add(tyre);
  }
}

function airliner() {
  const g = new T.Group();
  g.name = 'airliner';
  const fuselage = new T.Group();
  fuselage.name = 'fuselage';
  g.add(fuselage);
  tube(fuselage, 'cabin', R, R, 27, 0.5, paint);
  tube(fuselage, 'nose', 0.35, R, 5.5, 0.5 + 13.5 + 2.75, paint);
  tube(fuselage, 'tail-cone', R, 0.5, 6.5, 0.5 - 13.5 - 3.25, paint);
  box(fuselage, 'belly-fairing', [R * 1.3, 0.9, 11], [0, -R + 0.25, 1.5], belly);
  box(fuselage, 'cheatline', [R * 2.02, 0.22, 27], [0, 0.35, 0.5], livery);
  // Window band on both sides and the cockpit glazing.
  for (const x of [-R + 0.02, R - 0.02])
    box(fuselage, 'windows', [0.04, 0.3, 23], [x, 0.75, 0.3], glass);
  box(fuselage, 'cockpit-glazing', [1.6, 0.42, 0.9], [0, 0.95, 16.6], glass);
  // Wings, tailplanes and fin.
  const wings = new T.Group();
  wings.name = 'wings';
  wings.position.set(0, -1.0, 2.6);
  g.add(wings);
  for (const side of [1, -1]) {
    const wing = panel(
      wings,
      side > 0 ? 'wing-left' : 'wing-right',
      6.2,
      1.6,
      SPAN / 2 - R,
      6.0,
      0.45,
      side,
      paint,
    );
    wing.position.x = side * (R - 0.3);
    const flap = panel(
      wings,
      side > 0 ? 'flap-left' : 'flap-right',
      1.2,
      0.5,
      SPAN / 2 - R - 4,
      5.2,
      0.12,
      side,
      belly,
    );
    flap.position.set(side * (R - 0.2), -0.18, -2.8);
    engine(g, side);
    const stab = panel(
      g,
      side > 0 ? 'stabilizer-left' : 'stabilizer-right',
      3.4,
      1.2,
      6.2,
      3.2,
      0.25,
      side,
      paint,
    );
    stab.position.set(side * 0.3, 0.8, -15.2);
  }
  const fin = new T.Group();
  fin.name = 'fin';
  fin.position.set(0, R - 0.2, -14.6);
  g.add(fin);
  // Fin outline in (z, height): leading edge sweeps back from the root to the tip.
  const finShape = new T.Shape();
  finShape.moveTo(2.6, 0);
  finShape.lineTo(-1.8, 6.6);
  finShape.lineTo(-3.4, 6.6);
  finShape.lineTo(-3.4, 0);
  finShape.closePath();
  const finGeometry = new T.ExtrudeGeometry(finShape, { depth: 0.3, bevelEnabled: false });
  finGeometry.translate(0, 0, -0.15);
  // Outline x → world z, outline y → height, extrusion → thickness along x.
  finGeometry.rotateY(-Math.PI / 2);
  const finMesh = new T.Mesh(finGeometry, livery);
  finMesh.name = 'fin-surface';
  fin.add(finMesh);
  gear(g, 'gear-nose', 0, 13.5, 1.4);
  gear(g, 'gear-left', 3.2, 1.2, 1.2);
  gear(g, 'gear-right', -3.2, 1.2, 1.2);
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
  await new GLTFExporter().parseAsync(airliner(), { binary: true, onlyVisible: false }),
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
console.log(`airliner: ${bytes.length} bytes, ${generatedHash}`);
