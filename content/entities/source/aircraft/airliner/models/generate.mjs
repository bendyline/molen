import {
  transportCell,
  transportCoaming,
  transportProfiles,
  transportSection,
  transportWindowFrames,
} from '../../../../../../packages/entities/scripts/aircraft/transport-profiles.mjs';
/**
 * Deterministic Bendy Small Airliner, with an operator cabin and polygonal close-view fittings.
 * Local shared procedural finishes. Nose +Z; origin at ground level with gear down.
 * `node models/generate.mjs` rewrites models/source.glb (hand edits are preserved); `--out <path>`
 * writes a review candidate instead.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { completeCockpitControls } from '../../../../../../packages/entities/scripts/aircraft/cockpit-controls.mjs';
import {
  embedCockpitTextures,
  finishAircraftCockpit,
  writeCockpitTextures,
} from '../../../../../../packages/entities/scripts/aircraft/cockpit-surfaces.mjs';
import { smoothSurface } from '../../../../../../packages/entities/scripts/surface-normals.mjs';
import {
  addRivetRows,
  detailKit,
} from '../../../../../../packages/entities/scripts/vehicle-detail.mjs';
import { aircraftPanelTools as panelTools } from '../../../../../../packages/entities/scripts/vehicle-interiors.mjs';

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

function tube(
  parent,
  name,
  radiusFront,
  radiusBack,
  length,
  z,
  material,
  segments = 24,
  open = false,
) {
  const mesh = new T.Mesh(
    new T.CylinderGeometry(radiusFront, radiusBack, length, segments, 1, open),
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
  tube(g, 'nacelle', 1.05, 0.85, 3.6, 0, paint, 24, true);
  const fan = new T.Group();
  fan.name = side > 0 ? 'fan-left' : 'fan-right';
  fan.position.set(0, 0, 1.55);
  g.add(fan);
  const disc = tube(fan, 'fan-disc', 0.92, 0.92, 0.05, 0, metal, 20);
  disc.name = 'fan-disc';
  for (let i = 0; i < 12; i++) {
    const blade = box(fan, 'fan-blade', [0.06, 1.7, 0.03], [0, 0, 0.03], dark);
    blade.rotation.z = (i * Math.PI) / 12;
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
  // Airliner-specific drooped radome and six straight-edged flight-deck panes.
  const template = transportProfiles['airbus-a320neo'];
  const profile = {
    ...template,
    cy: 0,
    ry: R,
    radius: R,
    nose: template.nose.map(([d, w, b, t]) => [
      d,
      (w * R) / template.radius,
      ((b - template.cy) * R) / template.ry,
      ((t - template.cy) * R) / template.ry,
    ]),
  };
  const spec = { length: 39, category: 'airliner' },
    skin = [],
    glazing = [];
  const cuts = [
    14,
    19.5,
    ...profile.nose.map((a) => 19.5 - a[0]).filter((z) => z > 14),
    ...profile.windows.flatMap((w) => w.map((a) => 19.5 - a[1])),
  ];
  for (let z = 14; z < 19.5; z += 0.12) cuts.push(z);
  cuts.sort((a, b) => a - b);
  for (let i = 0; i < cuts.length - 1; i++)
    for (let j = 0; j < 64; j++) {
      const a = (j * Math.PI) / 32,
        b = ((j + 1) * Math.PI) / 32;
      transportCell(
        spec,
        profile,
        [
          [cuts[i], a],
          [cuts[i + 1], a],
          [cuts[i + 1], b],
          [cuts[i], b],
        ],
        (kind, points) => {
          const target = kind === 'skin' ? skin : glazing;
          for (let k = 1; k < points.length - 1; k++)
            target.push(...points[0], ...points[k], ...points[k + 1]);
        },
      );
    }
  const frames = detailKit(fuselage, 'flight-deck-window-frames');
  transportWindowFrames(frames, spec, profile, metal);
  frames.finish();
  transportCoaming(g, spec, { profile, eye: [0.55, 0.85, 15.4], panelZ: 15.975 }, dark);
  for (const [name, positions, material] of [
    ['nose', skin, paint],
    ['flight-deck-glazing', glazing, glass],
  ]) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    const mesh = new T.Mesh(smoothSurface(geometry), material);
    mesh.name = name;
    fuselage.add(mesh);
  }
  // The exterior nose was one-sided: from the seats its entire lower half vanished.
  // Follow the same measured facets with inward-facing trim, preserving every window.
  const liningPositions = [];
  for (let i = 0; i < skin.length; i += 9) {
    if ([2, 5, 8].some((j) => skin[i + j] > 19)) continue;
    for (const j of [0, 6, 3]) {
      const z = skin[i + j + 2];
      const sec = transportSection(spec, profile, z),
        center = (sec[2] + sec[3]) / 2;
      liningPositions.push(skin[i + j] * 0.992, center + (skin[i + j + 1] - center) * 0.992, z);
    }
  }
  const liningGeometry = new T.BufferGeometry();
  liningGeometry.setAttribute('position', new T.Float32BufferAttribute(liningPositions, 3));
  liningGeometry.computeVertexNormals();
  const noseLining = new T.Mesh(liningGeometry, mat('flight-deck-lining', '#7d8788'));
  noseLining.name = 'flight-deck-lining';
  fuselage.add(noseLining);
  const noseCap = new T.Mesh(new T.CircleGeometry(profile.nose[0][1], 64), paint);
  noseCap.scale.y = (profile.nose[0][3] - profile.nose[0][2]) / (2 * profile.nose[0][1]);
  noseCap.name = 'nose-end-cap';
  noseCap.position.set(0, (profile.nose[0][2] + profile.nose[0][3]) / 2, 19.5);
  fuselage.add(noseCap);
  tube(fuselage, 'tail-cone', R, 0.5, 6.5, 0.5 - 13.5 - 3.25, paint);
  box(fuselage, 'belly-fairing', [R * 1.3, 0.9, 11], [0, -R + 0.25, 1.5], belly);
  box(fuselage, 'cheatline', [R * 2.02, 0.22, 27], [0, 0.35, 0.5], livery);
  // Window band on both sides and the cockpit glazing.
  for (const side of [-1, 1])
    for (let i = 0; i < 28; i++) {
      const z = -11.6 + i * 0.85;
      if ([-11, 11.5].some((door) => Math.abs(z - door) < 0.6)) continue;
      // Individual windows, aligned to the round shell rather than one opaque stripe.
      const window = box(
        fuselage,
        'passenger-window',
        [0.035, 0.32, 0.23],
        [side * 1.816, 0.73, z],
        dark,
      );
      window.rotation.z = side * 0.39;
    }
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
      1.0,
      0.6,
      SPAN / 2 - R - 4,
      1.0,
      0.12,
      side,
      belly,
    );
    // Follow the wing's trailing-edge sweep; the leading edge stays under its hinge line.
    flap.position.set(side * (R - 0.2), -0.225, -2.9);
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
  glass.opacity = 0.18;
  glass.side = T.DoubleSide;
  glass.depthWrite = false;
  let detail = detailKit(g);
  for (const side of [-1, 1]) {
    detail.text('BENDY', [side * 1.955, 0.16, 7.5], 0.5, (side * Math.PI) / 2);
    for (const z of [-11, 11.5]) {
      const outline = [
        [-0.35, -0.9],
        [-0.45, -0.8],
        [-0.45, -0.4],
        [-0.45, 0],
        [-0.45, 0.4],
        [-0.45, 0.9],
        [-0.35, 1.0],
        [0.35, 1.0],
        [0.45, 0.9],
        [0.45, 0.4],
        [0.45, 0],
        [0.45, -0.4],
        [0.45, -0.8],
        [0.35, -0.9],
      ];
      const surface = ([dz, y]) => {
        // Match the actual 24-sided shell instead of putting a flat door behind curved skin.
        const angle = Math.asin(y / R),
          step = Math.PI / 12;
        const a = Math.floor(angle / step) * step,
          b = a + step;
        const t = (y - R * Math.sin(a)) / (R * Math.sin(b) - R * Math.sin(a));
        const x = R * (Math.cos(a) * (1 - t) + Math.cos(b) * t);
        const outer = Math.abs(y - 0.35) <= 0.115 ? Math.max(x, R * 1.01) : x;
        return [side * (outer + 0.02), y, z + dz];
      };
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i],
          b = outline[(i + 1) % outline.length];
        const steps = Math.max(1, Math.ceil(Math.abs(b[1] - a[1]) / 0.05));
        const point = (j) =>
          surface([a[0] + ((b[0] - a[0]) * j) / steps, a[1] + ((b[1] - a[1]) * j) / steps]);
        for (let j = 0; j < steps; j++) detail.rod(point(j), point(j + 1), 0.008, detail.dark);
      }
      detail.box([0.04, 0.06, 0.19], [side * 1.96, 0, z], detail.metal);
    }
    detail.ring(1.02, 0.065, [side * 5.8, -1.55, 5.2], detail.metal);
    detail.box([0.08, 0.08, 0.2], [side * 17.4, -0.88, -4.3], side > 0 ? detail.red : detail.green);
  }
  // Keep cabin finishes independent from the airframe fittings that use the same base palette.
  detail.finish();
  detail = detailKit(g, 'airliner-cabin-detail');
  detail.box([2.2, 0.055, 2.7], [0, -0.39, 15.6], detail.dark);
  // Solid console returns bridge the main panel to the fitted lower shell.
  for (const side of [-1, 1]) {
    detail.box([0.3, 0.7, 1.6], [side * 1.02, -0.015, 15.55], detail.dark);
    detail.box([0.06, 0.035, 0.28], [side * 0.87, 0.35, 15.2], detail.metal);
  }
  detail.box([2.1, 0.7, 0.08], [0, -0.04, 16.35], detail.dark);
  for (const side of [-1, 1]) {
    detail.box([0.5, 0.13, 0.6], [side * 0.55, -0.15, 15.2], detail.dark);
    detail.box([0.5, 0.75, 0.12], [side * 0.55, 0.15, 14.93], detail.dark);
  }
  const instruments = panelTools(detail);
  detail.box([2.08, 0.32, 0.38], [0, 0.4, 16.18], detail.dark);
  detail.box([2.1, 0.05, 0.42], [0, 0.685, 16.17], detail.dark);
  // Separate attitude/navigation pairs and central engine/system displays.
  for (const [x, kind] of [
    [-0.83, 'attitude'],
    [-0.5, 'radar'],
    [-0.17, 'engine'],
    [0.17, 'engine'],
    [0.5, 'radar'],
    [0.83, 'attitude'],
  ]) {
    instruments.display(x, 0.49, 15.975, 0.285, 0.235, kind);
    instruments.buttons(x, 0.35, 15.96, 5, 0.037);
    instruments.knob(x + 0.13, 0.365, 15.95, 0.012);
  }
  for (const [i, label] of ['COURSE', 'SPEED', 'HDG', 'ALT', 'VS'].entries()) {
    const x = -0.68 + i * 0.34;
    instruments.display(x, 0.73, 16.03, 0.12, 0.025, 'mode');
    instruments.knob(x, 0.68, 16.02, 0.016);
    detail.text(label, [x, 0.775, 16.015], 0.016, Math.PI, detail.ivory, 'display');
  }
  detail.box([0.42, 0.25, 0.76], [0, 0.04, 15.22], detail.dark);
  for (const side of [-1, 1]) {
    // Flight-management keypad and radio banks. No decorative numeric flight data.
    instruments.display(side * 0.17, 0.255, 15.57, 0.14, 0.09, 'route');
    for (let row = 0; row < 4; row++)
      instruments.buttons(side * 0.17, 0.19 - row * 0.025, 15.56, 4, 0.026);
    const lever = new T.Group();
    lever.name = `airliner-throttle-${side}`;
    lever.position.set(side * 0.065, 0.18, 15.24);
    lever.userData.aircraftControl = {
      action: 'power',
      engine: side > 0 ? 'left' : 'right',
      motion: { property: 'rotation', axis: 'x', scale: 0.65 },
    };
    g.add(lever);
    const ld = detailKit(lever, lever.name);
    ld.rod([0, 0, 0], [0, 0.22, 0.05], 0.012, detail.metal);
    ld.box([0.065, 0.035, 0.047], [0, 0.225, 0.05], detail.ivory);
    ld.finish();
    detail.rod([side * 0.19, 0.17, 15.1], [side * 0.19, 0.3, 15.14], 0.009, detail.metal);
    detail.box(
      [0.04, 0.025, 0.055],
      [side * 0.19, 0.305, 15.14],
      side < 0 ? detail.ivory : detail.dark,
    );
    // Harness hardware and inboard seat armrests.
    detail.box([0.035, 0.57, 0.009], [side * 0.55 + 0.12, 0.25, 15.0], detail.ivory);
    detail.box([0.06, 0.04, 0.35], [side * 0.28, 0.19, 15.14], detail.dark);
  }
  // Overhead systems panel, above the eye and aft of the windscreen.
  detail.box([0.7, 0.045, 0.58], [0, 1.3, 15.28], detail.dark);
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 7; col++) {
      const x = (col - 3) * 0.08,
        z = 15.08 + row * 0.12;
      detail.box([0.045, 0.006, 0.07], [x, 1.273, z], detail.metal);
      detail.rod([x, 1.27, z], [x, 1.244, z + 0.009], 0.004, detail.dark);
    }
  for (const x of [-0.2, 0, 0.2]) detail.box([0.05, 0.03, 0.075], [x, 1.265, 15.52], detail.red);
  detail.finish();
  const yoke = new T.Group();
  yoke.name = 'control-yoke';
  yoke.position.set(0.55, 0.35, 15.8);
  g.add(yoke);
  const controls = detailKit(yoke, 'yoke-trim');
  controls.rod([-0.15, 0.12, 0], [-0.15, 0, 0], 0.025, controls.dark);
  controls.rod([-0.15, 0, 0], [0.15, 0, 0], 0.025, controls.dark);
  controls.rod([0.15, 0, 0], [0.15, 0.12, 0], 0.025, controls.dark);
  controls.finish();
  const rows = [];
  for (let z = -11.5; z < 14; z += 1.25) {
    const row = [];
    for (let i = 0; i < 128; i++) {
      const a = (i * Math.PI * 2) / 128;
      row.push({
        point: [R * Math.cos(a), R * Math.sin(a), z],
        normal: [Math.cos(a), Math.sin(a), 0],
      });
    }
    rows.push(row);
  }
  addRivetRows(g, [fuselage.getObjectByName('cabin')], rows, 0.0035);
  // Ground-aligned origin shared by the simulator, seats, collision probes and model.
  for (const child of g.children) child.position.y += 3.8;
  return g;
}

// source.json pins the master this generator last wrote. A master that matches neither the pin
// nor this run's output was edited by hand, and regenerating would discard that work.
const sourcePath = resolve(root, '../source.json');
const sourceText = await readFile(sourcePath, 'utf8');
const pinned = JSON.parse(sourceText).files.models.find(
  (m) => m.path === 'models/source.glb',
)?.sha256;
const definitionPath = resolve(root, '../entity.types.json');
const definitionText = await readFile(definitionPath, 'utf8');
const definition = JSON.parse(definitionText);
const controlSpec = Object.values(definition.types)[0].components.aircraft.spec;
controlSpec.visual.interior.nodes = [
  'airliner-cabin-detail',
  'control-yoke',
  'airliner-throttle--1',
  'airliner-throttle-1',
];
const controlledModel = completeCockpitControls(airliner(), controlSpec, {
  panelZ: 15.975,
  floor: 3.6,
});
finishAircraftCockpit(controlledModel, controlSpec, 'airliner');
const bytes = embedCockpitTextures(
  Buffer.from(
    await new GLTFExporter().parseAsync(controlledModel, { binary: true, onlyVisible: false }),
  ),
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
const source = JSON.parse(sourceText);
source.files.models.find((model) => model.path === 'models/source.glb').sha256 = generatedHash;
source.files.textures = await writeCockpitTextures(resolve(root, '..'), bytes);
async function writeChangedJson(path, value, previous) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (text === previous) return;
  // Live Windows editors can memory-map these manifests. Replace a completed
  // file instead of truncating it, as the aircraft batch generator does.
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, text);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
await writeChangedJson(sourcePath, source, sourceText);
await writeChangedJson(definitionPath, definition, definitionText);
console.log(`airliner: ${bytes.length} bytes, ${generatedHash}`);
