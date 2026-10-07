/** Deterministic source GLBs for the first site-specific structure studies.
 * Run after building @bendyline/molen-worldgen:
 *   node packages/worldgen/scripts/generate-site-structures.mjs [--check]
 *
 * The source specs and GLBs live in content/worldgen/source/places. Import the GLBs
 * with `molen asset import`; this script never writes runtime sidecars.
 */

import './install-deterministic-math.mjs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';

const check = process.argv.includes('--check');
const biome = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../node_modules/@biomejs/biome/bin/biome',
);
const names = ['space-needle', 'golden-gate-bridge', 'sr-520-floating-bridge'];
const white = [0.88, 0.9, 0.88];
const steel = [0.78, 0.25, 0.11];
const concrete = [0.58, 0.6, 0.58];
const road = [0.16, 0.18, 0.19];
const line = [0.93, 0.85, 0.56];
const uv = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
const ref = 'palette:#ffffff';

function quad(out, slot, points, normal, color) {
  out.addQuad(slot, ref, points, normal, uv, color);
}

function box(out, slot, lo, hi, color) {
  const [x0, y0, z0] = lo;
  const [x1, y1, z1] = hi;
  quad(
    out,
    slot,
    [
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    [0, 0, 1],
    color,
  );
  quad(
    out,
    slot,
    [
      [x1, y0, z0],
      [x0, y0, z0],
      [x0, y1, z0],
      [x1, y1, z0],
    ],
    [0, 0, -1],
    color,
  );
  quad(
    out,
    slot,
    [
      [x0, y0, z0],
      [x0, y0, z1],
      [x0, y1, z1],
      [x0, y1, z0],
    ],
    [-1, 0, 0],
    color,
  );
  quad(
    out,
    slot,
    [
      [x1, y0, z1],
      [x1, y0, z0],
      [x1, y1, z0],
      [x1, y1, z1],
    ],
    [1, 0, 0],
    color,
  );
  quad(
    out,
    slot,
    [
      [x0, y1, z1],
      [x1, y1, z1],
      [x1, y1, z0],
      [x0, y1, z0],
    ],
    [0, 1, 0],
    color,
  );
  quad(
    out,
    slot,
    [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
    ],
    [0, -1, 0],
    color,
  );
}

function normalize(v) {
  const size = Math.hypot(...v) || 1;
  return v.map((x) => x / size);
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Capped faceted tube from a to b, used for legs, cables, braces, and masts. */
function tube(out, slot, a, b, radius, color, sides = 8) {
  const axis = normalize(b.map((v, i) => v - a[i]));
  const across = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]));
  const other = normalize(cross(axis, across));
  const ring = (center, angle) =>
    center.map((v, i) => v + radius * (Math.cos(angle) * across[i] + Math.sin(angle) * other[i]));
  for (let i = 0; i < sides; i++) {
    const t0 = (i / sides) * Math.PI * 2;
    const t1 = ((i + 1) / sides) * Math.PI * 2;
    const normal = normalize(
      across.map((v, k) => Math.cos((t0 + t1) / 2) * v + Math.sin((t0 + t1) / 2) * other[k]),
    );
    quad(out, slot, [ring(a, t0), ring(a, t1), ring(b, t1), ring(b, t0)], normal, color);
  }
  out.addConvexPolygon(
    slot,
    ref,
    Array.from({ length: sides }, (_, i) => ring(a, (i / sides) * Math.PI * 2)),
    axis.map((v) => -v),
    (p) => [p[0], p[2]],
    color,
  );
  out.addConvexPolygon(
    slot,
    ref,
    Array.from({ length: sides }, (_, i) => ring(b, (i / sides) * Math.PI * 2)),
    axis,
    (p) => [p[0], p[2]],
    color,
  );
}

/** Solid circular profile; layers are [height, radius, material slot, color]. */
function profile(out, layers, sides = 24) {
  for (let j = 0; j < layers.length - 1; j++) {
    const [y0, r0] = layers[j];
    const [y1, r1, slot, color] = layers[j + 1];
    for (let i = 0; i < sides; i++) {
      const t0 = (i / sides) * Math.PI * 2;
      const t1 = ((i + 1) / sides) * Math.PI * 2;
      const p = (y, r, t) => [r * Math.cos(t), y, r * Math.sin(t)];
      const mid = (t0 + t1) / 2;
      const normal = normalize([(y1 - y0) * Math.cos(mid), r0 - r1, (y1 - y0) * Math.sin(mid)]);
      quad(out, slot, [p(y0, r0, t0), p(y0, r0, t1), p(y1, r1, t1), p(y1, r1, t0)], normal, color);
    }
  }
  const [bottomY, bottomR] = layers[0];
  const [topY, topR, topSlot, topColor] = layers.at(-1);
  const circle = (y, r) =>
    Array.from({ length: sides }, (_, i) => {
      const t = (i / sides) * Math.PI * 2;
      return [r * Math.cos(t), y, r * Math.sin(t)];
    });
  out.addConvexPolygon(
    layers[1][2],
    ref,
    circle(bottomY, bottomR),
    [0, -1, 0],
    (p) => [p[0], p[2]],
    layers[1][3],
  );
  out.addConvexPolygon(topSlot, ref, circle(topY, topR), [0, 1, 0], (p) => [p[0], p[2]], topColor);
}

/** Faceted tube along a polyline, capped only at its ends (legs and spires). */
function polyTube(out, slot, points, radius, color, sides = 6) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const axis = normalize(b.map((v, k) => v - a[k]));
    const across = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]));
    const other = normalize(cross(axis, across));
    const ring = (center, angle) =>
      center.map((v, k) => v + radius * (Math.cos(angle) * across[k] + Math.sin(angle) * other[k]));
    for (let j = 0; j < sides; j++) {
      const t0 = (j / sides) * Math.PI * 2;
      const t1 = ((j + 1) / sides) * Math.PI * 2;
      const normal = normalize(
        across.map((v, k) => Math.cos((t0 + t1) / 2) * v + Math.sin((t0 + t1) / 2) * other[k]),
      );
      quad(out, slot, [ring(a, t0), ring(a, t1), ring(b, t1), ring(b, t0)], normal, color);
    }
  }
}

/**
 * The Space Needle at medium-fi: six legs in three pairs pinch to the hourglass waist and splay
 * again under the top house; a central core carries the gold elevators; the 100-foot SkyLine
 * level rings the core; the top house is a tapered, ribbed underside, the restaurant and
 * observation glass bands, the flared halo rim and a conical roof under the spire and beacon.
 * Under 3,000 triangles, so the skyline level keeps this exact silhouette.
 */
function spaceNeedle(out, spec) {
  const total = spec.heightMeters;
  const legWhite = [0.78, 0.8, 0.78];
  const roofWhite = [0.7, 0.72, 0.71];
  const core = [0.52, 0.54, 0.55];
  const restaurantGlass = [0.05, 0.1, 0.16];
  const deckGlass = [0.09, 0.17, 0.25];
  const gold = [0.8, 0.43, 0.07];
  const beacon = [0.8, 0.13, 0.1];
  const base = 1.5;
  const waist = 105;
  const top = 149;
  // Plinth.
  profile(
    out,
    [
      [0, 19],
      [base, 19, 'foundation', concrete],
      [base + 0.1, 17.5, 'foundation', concrete],
    ],
    24,
  );
  // Leg centerline radius and pair half-separation by height: wide tripod, waist, splay.
  const radius = (y) =>
    y <= waist
      ? 4.6 + 12.4 * Math.pow((waist - y) / (waist - base), 1.6)
      : 4.6 + 4.2 * Math.pow((y - waist) / (top - waist), 1.4);
  const spread = (y) =>
    y <= waist
      ? 0.9 + 2.5 * Math.pow((waist - y) / (waist - base), 1.3)
      : 0.9 + 0.8 * ((y - waist) / (top - waist));
  const heights = [base, 12, 26, 42, 60, 80, waist, 124, 138, top];
  const legPoint = (a, side, y) => {
    const radial = [Math.cos(a), 0, Math.sin(a)];
    const tangent = [-Math.sin(a), 0, Math.cos(a)];
    const r = radius(y);
    const s = spread(y) * side;
    return [radial[0] * r + tangent[0] * s, y, radial[2] * r + tangent[2] * s];
  };
  for (let pair = 0; pair < 3; pair++) {
    const a = (pair / 3) * Math.PI * 2 + Math.PI / 6;
    for (const side of [-1, 1])
      polyTube(
        out,
        'wall',
        heights.map((y) => legPoint(a, side, y)),
        0.95,
        legWhite,
        6,
      );
    // Ties across each pair.
    for (const y of [26, 60, waist, 138])
      tube(out, 'trim', legPoint(a, -1, y), legPoint(a, 1, y), 0.35, legWhite, 4);
  }
  // Central core, tapering slightly, into the top house.
  profile(
    out,
    [
      [base, 3.4],
      [top, 2.7, 'trim', core],
    ],
    12,
  );
  // Gold elevator cabs on the core: the Needle's one accent color.
  for (const [angle, y] of [
    [0, 72],
    [Math.PI, 118],
  ]) {
    const c = [Math.cos(angle) * 3.4, y, Math.sin(angle) * 3.4];
    box(out, 'trim', [c[0] - 1.2, y, c[2] - 1.2], [c[0] + 1.2, y + 3.4, c[2] + 1.2], gold);
  }
  // SkyLine level at 100 feet.
  profile(
    out,
    [
      [28.2, 3.4],
      [29.2, 11.5, 'trim', legWhite],
      [32, 11.5, 'window', restaurantGlass],
      [32.6, 11, 'roof', roofWhite],
      [33, 3.4, 'roof', roofWhite],
    ],
    24,
  );
  // Top house.
  profile(
    out,
    [
      [top - 3, 3],
      [top - 1, 8, 'wall', legWhite],
      [152.4, 17.5, 'wall', legWhite],
      [153.2, 19.6, 'trim', legWhite],
      [156.8, 19.8, 'window', restaurantGlass],
      [157.8, 21, 'trim', legWhite],
      [161.2, 21, 'window', deckGlass],
      [162, 22.6, 'trim', legWhite],
      [162.8, 22.6, 'trim', legWhite],
      [164, 19.6, 'roof', roofWhite],
      [169.4, 6.6, 'roof', roofWhite],
      [171, 4, 'roof', roofWhite],
      [172, 2.2, 'trim', legWhite],
    ],
    32,
  );
  // Ribs under the top house, where the legs fan out to the deck.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    tube(
      out,
      'trim',
      [Math.cos(a) * 7.6, top - 0.6, Math.sin(a) * 7.6],
      [Math.cos(a) * 19.6, 153.1, Math.sin(a) * 19.6],
      0.32,
      legWhite,
      4,
    );
  }
  // Spire and beacon.
  profile(
    out,
    [
      [172, 1.2],
      [179, 0.75, 'trim', legWhite],
      [total - 1.6, 0.42, 'trim', legWhite],
      [total, 0.12, 'trim', beacon],
    ],
    8,
  );
}

function goldenGate(out, spec) {
  const main = spec.mainSpanMeters;
  const side = spec.sideSpanMeters;
  const towerX = main / 2;
  const end = towerX + side;
  const towerY = spec.towerHeightMeters;
  const deckY = spec.deckHeightMeters;
  const halfWidth = spec.widthMeters / 2;
  // Span, asphalt, red supporting trusses, walkways and median stripes.
  box(out, 'foundation', [-end, deckY - 5.5, -halfWidth], [end, deckY - 1.2, halfWidth], steel);
  box(out, 'roof', [-end, deckY - 1.2, -halfWidth + 2], [end, deckY, halfWidth - 2], road);
  for (const z of [-halfWidth + 0.8, halfWidth - 0.8]) {
    box(out, 'trim', [-end, deckY, z - 0.35], [end, deckY + 2, z + 0.35], steel);
    box(out, 'trim', [-end, deckY - 9, z - 0.65], [end, deckY - 5.5, z + 0.65], steel);
  }
  for (let x = -end + 18; x < end; x += 36) {
    box(out, 'trim', [x, deckY + 0.03, -0.12], [Math.min(end, x + 12), deckY + 0.08, 0.12], line);
  }
  for (const x of [-towerX, towerX]) {
    for (const z of [-halfWidth + 1.4, halfWidth - 1.4]) {
      box(out, 'foundation', [x - 7, 0, z - 5.5], [x + 7, 6, z + 5.5], concrete);
      box(out, 'wall', [x - 4.5, 5, z - 3.2], [x + 4.5, towerY, z + 3.2], steel);
      for (const y of [95, 145, 194])
        box(out, 'trim', [x - 5, y, z - 3.8], [x + 5, y + 2.2, z + 3.8], steel);
    }
    for (const y of [112, 178, 219])
      box(out, 'trim', [x - 4.5, y, -halfWidth + 1], [x + 4.5, y + 4, halfWidth - 1], steel);
  }
  const cableY = (x) => {
    const a = Math.abs(x);
    if (a <= towerX) return deckY + 25 + (towerY - deckY - 25) * (a / towerX) ** 2;
    return towerY + (deckY + 12 - towerY) * ((a - towerX) / side);
  };
  for (const z of [-halfWidth + 1.4, halfWidth - 1.4]) {
    for (let x = -end; x < end; x += 16) {
      const next = Math.min(end, x + 16);
      tube(out, 'wall', [x, cableY(x), z], [next, cableY(next), z], 0.9, steel, 6);
    }
    for (let x = -end + 24; x < end; x += 24) {
      const top = cableY(x);
      if (top > deckY + 6) tube(out, 'trim', [x, deckY + 2, z], [x, top, z], 0.17, steel, 5);
    }
  }
  for (let x = -end + 18; x < end; x += 36)
    for (const z of [-halfWidth + 0.8, halfWidth - 0.8])
      tube(out, 'trim', [x, deckY - 9, z], [Math.min(end, x + 18), deckY - 5.5, z], 0.25, steel, 4);
}

function sr520(out, spec) {
  const length = spec.lengthMeters;
  const end = length / 2;
  const width = spec.widthMeters;
  const deckY = spec.deckHeightMeters;
  box(out, 'foundation', [-end, deckY - 2.4, -width / 2], [end, deckY - 0.7, width / 2], concrete);
  box(out, 'roof', [-end, deckY - 0.7, -width / 2 + 4], [end, deckY, width / 2 - 1.6], road);
  box(
    out,
    'trim',
    [-end, deckY - 0.65, -width / 2],
    [end, deckY - 0.05, -width / 2 + 4],
    [0.52, 0.56, 0.56],
  );
  for (const z of [-width / 2 + 0.7, width / 2 - 0.7]) {
    box(out, 'trim', [-end, deckY, z - 0.2], [end, deckY + 1.35, z + 0.2], [0.55, 0.59, 0.6]);
  }
  // 21 longitudinal, two cross and 54 supplemental stability pontoons (27 on each side).
  const count = spec.longitudinalPontoons;
  const step = length / count;
  for (let i = 0; i < count; i++) {
    const x0 = -end + i * step + 0.45;
    box(out, 'foundation', [x0, -1.2, -11], [x0 + step - 0.9, 1.8, 11], concrete);
    for (const x of [x0 + 8, x0 + step - 9])
      for (const z of [-8.5, 8.5])
        box(out, 'wall', [x - 1.5, 1.8, z - 1.5], [x + 1.5, deckY - 2.4, z + 1.5], concrete);
  }
  for (const x of [-end + 1, end - 9])
    box(out, 'foundation', [x, -1.2, -width / 2 + 2], [x + 8, 1.8, width / 2 - 2], concrete);
  for (const z of [-17, 17]) {
    for (let i = 0; i < spec.supplementalPontoons / 2; i++) {
      const x = -end + ((i + 0.5) * length) / (spec.supplementalPontoons / 2);
      box(out, 'foundation', [x - 16, -1.2, z - 5], [x + 16, 1.2, z + 5], concrete);
    }
  }
  box(out, 'trim', [-end, deckY, 0.7], [end, deckY + 0.9, 1.5], concrete);
  box(out, 'trim', [-end, deckY, -16.1], [end, deckY + 0.9, -15.7], concrete);
  for (const z of [-8.1, -4.5, 6.2, 9.8])
    for (let x = -end; x < end; x += 12)
      box(
        out,
        'trim',
        [x, deckY + 0.025, z],
        [Math.min(end, x + 4), deckY + 0.04, z + 0.12],
        white,
      );
  for (let x = -end + 70; x < end; x += 140) {
    tube(
      out,
      'trim',
      [x, deckY + 1.3, -width / 2 + 0.5],
      [x, deckY + 7.4, -width / 2 + 0.5],
      0.16,
      [0.56, 0.61, 0.63],
      6,
    );
  }
}

const builders = {
  'space-needle': spaceNeedle,
  'golden-gate-bridge': goldenGate,
  'sr-520-floating-bridge': sr520,
};
const material = {
  wall: { name: 'painted-steel', roughness: 0.58, metallic: 0.42 },
  roof: { name: 'deck-or-roof', roughness: 0.83, metallic: 0.04 },
  trim: { name: 'structural-trim', roughness: 0.55, metallic: 0.52 },
  foundation: { name: 'concrete-foundation', roughness: 0.92, metallic: 0.02 },
  window: { name: 'dark-glazing', roughness: 0.27, metallic: 0.15 },
};

function previewScene(name, spec) {
  const isBridge = name !== 'space-needle';
  const length =
    name === 'golden-gate-bridge'
      ? spec.mainSpanMeters + 2 * spec.sideSpanMeters
      : name === 'sr-520-floating-bridge'
        ? spec.lengthMeters
        : 300;
  const camera =
    name === 'space-needle'
      ? { position: [125, 100, 175], lookAt: [0, 92, 0], fov: 36 }
      : name === 'golden-gate-bridge'
        ? { position: [80, 320, 1500], lookAt: [0, 95, 0], fov: 43 }
        : { position: [250, 55, 240], lookAt: [0, 5, 0], fov: 43 };
  return {
    format: 'molen/scene@3',
    name: `${spec.title} asset preview`,
    seed: spec.generator,
    tickRate: 30,
    entities: [
      {
        id: 'structure',
        components: {
          transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
          renderable: { kind: 'gltf', ref: spec.id, shadows: { cast: true, receive: true } },
        },
      },
      {
        id: 'ground',
        components: {
          transform: {
            pos: [0, -0.12, 0],
            rot: [0, 0, 0, 1],
            scale: [length + 250, 0.2, isBridge ? 600 : 320],
          },
          renderable: {
            kind: 'primitive',
            ref: 'box',
            materialRef: isBridge ? 'palette:#63899d' : 'palette:#798369',
            shadows: { receive: true },
          },
        },
      },
      {
        id: 'environment',
        components: {
          environment: {
            ambient: { sky: '#dce5ed', ground: '#6c7473', intensity: 1.15 },
            sun: { direction: [-8, 14, 9], color: '#fff1d3', intensity: 2.2, castShadow: true },
            background: '#b5d2df',
            toneMapping: 'agx',
            exposure: 1.08,
            shadows: 'high',
          },
        },
      },
    ],
    camera: { mode: 'fixed', ...camera },
    physics: { engine: 'none' },
  };
}

async function emit(path, bytes, textFile = false) {
  if (check) {
    const previous = await readFile(path);
    const same =
      previous.equals(bytes) ||
      (textFile &&
        previous.toString('utf8').replaceAll('\r\n', '\n') ===
          bytes.toString('utf8').replaceAll('\r\n', '\n'));
    if (!same) throw new Error(`${path}: generated source is stale`);
  } else {
    await mkdir(resolve(path, '..'), { recursive: true });
    await writeFile(path, bytes);
  }
}

function formattedJson(value, path) {
  return Buffer.from(
    execFileSync(process.execPath, [biome, 'format', '--stdin-file-path', path], {
      input: JSON.stringify(value),
      encoding: 'utf8',
    }),
  );
}

for (const name of names) {
  const dir = structureSourceDirectory(name);
  const spec = JSON.parse(await readFile(resolve(dir, 'spec.json'), 'utf8'));
  if (spec.generator !== name || typeof spec.id !== 'string')
    throw new Error(`${name}: invalid spec`);
  const out = new MeshBufferBuilder();
  builders[name](out, spec);
  const buffers = out.finalize();
  const materials = buffers.groups.map((group) => material[group.slot] ?? { name: group.slot });
  const glb = Buffer.from(encodeGlb(buffers, materials, 'molen site structures'));
  const hash = `sha256:${createHash('sha256').update(glb).digest('hex')}`;
  const source = {
    format: 'molen/source-bundle@1',
    id: spec.id,
    kind: 'static-structure',
    title: spec.title,
    files: {
      definitions: ['spec.json', 'scene.json'],
      models: [
        {
          path: 'models/source.glb',
          assetId: spec.id,
          output: structureAssetSidecarPath(spec.id),
          pipeline: 'import',
          sha256: hash,
        },
      ],
      scripts: [],
      textures: [],
      sounds: [],
      documents: ['README.md', 'preview.png'],
    },
  };
  await emit(resolve(dir, 'models/source.glb'), glb);
  await emit(
    resolve(dir, 'scene.json'),
    formattedJson(previewScene(name, spec), `${name}/scene.json`),
    true,
  );
  await emit(resolve(dir, 'source.json'), formattedJson(source, `${name}/source.json`), true);
  console.log(
    `${name}: ${buffers.triangleCount} triangles, ${buffers.vertexCount} vertices, ${glb.byteLength} bytes`,
  );
}
