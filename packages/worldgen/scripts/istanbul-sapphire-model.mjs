/** Original Istanbul Sapphire reconstruction. Meter units; photographs are references only. */
import { readFileSync } from 'node:fs';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frameBytes = readFileSync(structureSourcePath('n0229_istanbul_sapphire', 'map-frame.json'));
const frame = JSON.parse(frameBytes);
const X = 24.416,
  Z = 13.29,
  base = 24.3,
  interval = 4.3;
const blue = [0.26, 0.43, 0.49],
  silver = [0.55, 0.6, 0.61];
const dark = [0.09, 0.125, 0.135],
  grey = [0.48, 0.49, 0.47];
const timber = [0.6, 0.43, 0.24],
  pale = [0.82, 0.83, 0.8];
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);

function transformed(out, translation, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const vector = ([x, y, z]) => [c * x + s * z, y, -s * x + c * z];
  const point = (p) => vector(p).map((v, i) => v + translation[i]);
  return {
    addQuad: (s, r, p, n, u, c) => out.addQuad(s, r, p.map(point), vector(n), u, c),
    addTriangle: (s, r, p, n, u, c) => out.addTriangle(s, r, p.map(point), vector(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) =>
      out.addConvexPolygon(s, r, p.map(point), vector(n), u, c),
  };
}

// The architect describes a slight upward taper. The 0.8/0.65 m setbacks are working
// photographic estimates. Transform each polygon and recompute normals before validation.
function tapered(out) {
  const point = ([x, y, z]) => [
    x * (1 - (0.8 * Math.min(y, 239.1)) / (239.1 * X)),
    y,
    z * (1 - (0.65 * Math.min(y, 239.1)) / (239.1 * Z)),
  ];
  function polygon(slot, ref, p, _n, _uv, color) {
    p = p.map(point);
    if (p.length === 4) {
      const n = normalFor(p[0], p[1], p[2]);
      const distance = p[3].reduce((s, v, i) => s + (v - p[0][i]) * n[i], 0);
      if (Math.abs(distance) < 1e-8) {
        out.addQuad(
          slot,
          ref,
          p,
          n,
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
          color,
        );
        return;
      }
    }
    for (let i = 1; i + 1 < p.length; i++) {
      const tri = [p[0], p[i], p[i + 1]];
      out.addTriangle(
        slot,
        ref,
        tri,
        normalFor(...tri),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  }
  return { addQuad: polygon, addTriangle: polygon, addConvexPolygon: polygon };
}

/** A separately sealed pane, including frame depth. Transparent panes have no opaque backing. */
function pane(o, x0, x1, y0, y1, z, transparent = true) {
  const g = 0.018;
  face(
    o,
    transparent ? 'clear_glass' : 'glass',
    [
      [x0 + g, y0 + g, z],
      [x1 - g, y0 + g, z],
      [x1 - g, y1 - g, z],
      [x0 + g, y1 - g, z],
    ],
    blue,
  );
  for (const x of [x0, x1 - g]) {
    box(o, 'recess', [x, y0, z - 0.045], [x + g, y1, z + 0.012], dark);
    box(o, 'stainless', [x - 0.013, y0, z + 0.013], [x + g + 0.013, y1, z + 0.04], silver);
  }
  for (const y of [y0, y1 - g]) {
    box(o, 'recess', [x0, y, z - 0.045], [x1, y + g, z + 0.012], dark);
    box(o, 'stainless', [x0, y - 0.014, z + 0.013], [x1, y + g + 0.014, z + 0.04], silver);
  }
}

function rail(o, x0, x1, y, z) {
  face(
    o,
    'clear_glass',
    [
      [x0, y, z],
      [x1, y, z],
      [x1, y + 1.03, z],
      [x0, y + 1.03, z],
    ],
    [0.48, 0.61, 0.59],
  );
  tube(o, 'stainless', [x0, y + 1.05, z], [x1, y + 1.05, z], 0.023, silver, 10);
  for (let x = x0; x <= x1 + 0.001; x += 1.5)
    box(o, 'stainless', [x - 0.025, y, z - 0.025], [x + 0.025, y + 1.05, z + 0.025], silver);
}

function plant(o, x, y, z, seed) {
  tube(o, 'wood', [x, y, z], [x + 0.14, y + 1.6, z + 0.09], 0.045, timber, 8);
  for (let branch = 0; branch < 5; branch++) {
    const a = branch * 2.4 + seed,
      h = 0.8 + 0.18 * branch;
    const end = [x + 0.6 * Math.cos(a), y + h + 0.4, z + 0.6 * Math.sin(a)];
    tube(o, 'wood', [x, y + h, z], end, 0.019, timber, 6);
    for (let k = 0; k < 12; k++) {
      const theta = k * 2.399 + branch,
        radius = 0.12 + (0.3 * ((k * 7) % 11)) / 11;
      const p = [
        end[0] + radius * Math.cos(theta),
        end[1] + 0.1 * Math.sin(k),
        end[2] + radius * Math.sin(theta),
      ];
      const q = [p[0] + 0.19 * Math.cos(theta), p[1] + 0.05, p[2] + 0.19 * Math.sin(theta)];
      const v = [0.065 * Math.sin(theta), 0, -0.065 * Math.cos(theta)];
      const points = [
        p,
        q.map((n, i) => n + v[i]),
        [q[0] + 0.2 * Math.cos(theta), q[1] + 0.07, q[2] + 0.2 * Math.sin(theta)],
        q.map((n, i) => n - v[i]),
      ];
      const tint = [0.14 + 0.025 * (k % 3), 0.24 + 0.025 * (k % 4), 0.085];
      face(o, 'foliage', points, tint);
      face(o, 'foliage', points.toReversed(), tint);
    }
  }
}

/** Three-storey winter garden: outer skin, recessed inner windows and two projecting galleries. */
function gardenGroup(o, startY, social, part = 'all') {
  const exterior = part !== 'inside',
    interior = part !== 'outside';
  const w = (2 * X) / 30,
    h = interval,
    innerX = X - 1.05;
  // Interior slabs stop short of the weather skin. Each third floor spans the garden cavity.
  for (let row = 0; row < 3; row++) {
    const y = startY + row * h;
    if (interior) box(o, 'concrete', [-innerX, y, -8.65], [innerX, y + 0.23, 8.65], pale);
    for (const sign of [-1, 1]) {
      const wall = transformed(o, [0, 0, 0], sign === 1 ? 0 : Math.PI);
      if (interior && row === 0)
        box(wall, 'concrete', [-innerX, y, 8.65], [innerX, y + 0.23, Z - 0.85], grey);
      else if (interior) {
        box(wall, 'concrete', [-innerX, y, 8.65], [innerX, y + 0.23, 10.65], pale);
        box(wall, 'wood', [-innerX, y - 0.32, 10.65], [innerX, y + 0.1, 10.79], timber);
        for (let x = -innerX + 0.06; x < innerX - 0.06; x += 0.12)
          box(wall, 'wood', [x, y - 0.31, 10.79], [x + 0.055, y + 0.09, 10.83], [0.68, 0.51, 0.3]);
        rail(wall, -innerX + 0.1, innerX - 0.1, y + 0.23, 10.8);
      }
      for (let j = 0; j < 30; j++) {
        const x = -X + j * w;
        // Thin transom plus two glazing lights make the real horizontal facade rhythm.
        if (exterior) {
          pane(wall, x, x + w, y + 0.24, y + 2.8, Z, true);
          pane(wall, x, x + w, y + 2.85, y + h - 0.08, Z, true);
          box(wall, 'metal', [x, y + 2.8, Z - 0.12], [x + w, y + 2.85, Z + 0.055], silver);
        }
        if (interior && j > 0 && j < 29) {
          if (!social || row !== 1) pane(wall, x, x + w, y + 0.24, y + h - 0.12, 8.65, false);
          if (j % 5 === 0) box(wall, 'concrete', [x - 0.15, y, 8.0], [x + 0.15, y + h, 8.6], pale);
        }
      }
      if (interior && row === 0)
        for (let j = 0; j < 8; j++) {
          const x = -20 + j * 5.65;
          box(wall, 'stone', [x - 1.4, y + 0.24, 11.2], [x + 1.4, y + 0.68, 12.7], grey);
          box(
            wall,
            'recess',
            [x - 1.32, y + 0.67, 11.28],
            [x + 1.32, y + 0.7, 12.62],
            [0.11, 0.085, 0.06],
          );
          plant(wall, x, y + 0.7, 11.95, j);
        }
    }
    // Narrow end elevations, glazing slots next to independently modelled opaque core blades.
    if (exterior)
      for (const sign of [-1, 1]) {
        const wall = transformed(o, [sign * X, 0, 0], (sign * Math.PI) / 2);
        for (let j = 0; j < 12; j++) {
          const x = -Z + (j * 2 * Z) / 12;
          pane(wall, x, x + (2 * Z) / 12, y + 0.23, y + h - 0.08, 0, true);
        }
        box(wall, 'metal', [-Z, y + h - 0.08, -0.1], [Z, y + h, 0.08], silver);
      }
    if (interior) box(o, 'concrete', [-4, y, -5], [4, y + h, 5], [0.62, 0.63, 0.6]);
    if (exterior && social && row === 1)
      for (const sign of [-1, 1]) {
        const wall = transformed(o, [0, 0, 0], sign === 1 ? 0 : Math.PI);
        for (let k = 0; k < 12; k++)
          box(
            wall,
            'metal',
            [-X, y + 0.3 + k * 0.22, Z - 0.3],
            [X, y + 0.38 + k * 0.22, Z - 0.02],
            dark,
          );
      }
  }
}

function blade(o) {
  // Opaque south end blade, split from the curtain wall by narrow glazed vertical reveals.
  for (let row = 0; row < 57; row++) {
    const y = row * 4.2,
      top = Math.min(240.3, y + 4.2);
    if (top <= y) continue;
    const wall = transformed(o, [X + 0.3, 0, 0], Math.PI / 2);
    for (let j = 0; j < 12; j++) {
      const z = -8.2 + j * 1.37;
      box(
        wall,
        'metal',
        [z + 0.012, y + 0.012, -0.8],
        [z + 1.358, top - 0.012, 0.08],
        [0.34, 0.37, 0.37],
      );
    }
    for (const z of [-9.4, 8.4]) pane(wall, z, z + 0.9, y + 0.03, top - 0.03, -0.3, false);
  }
}

/** Curved canopy section: vertical tangent at the tower, then a gentle upturned outer lip. */
function canopyProfile(front) {
  const points = [];
  const reach = front ? 22 : 12,
    rise = front ? 20 : 16;
  for (let k = 0; k <= 24; k++) {
    const a = (Math.PI * k) / 48;
    points.push([Z + reach * (1 - Math.cos(a)), 10 + rise * (1 - Math.sin(a))]);
  }
  const start = Z + reach,
    end = front ? 65 : 40;
  for (let k = 1; k <= 20; k++) {
    const t = k / 20;
    points.push([start + (end - start) * t, 10 + (front ? 4.8 : 1.6) * t * t]);
  }
  return points;
}

function retail(o) {
  box(o, 'foundation', [-31, 0, -59], [31, 0.32, 36], grey);
  const width = 62,
    bays = 36;
  for (const front of [false, true]) {
    // Front is provisionally native -Z, toward the main road; signed fit stays pending.
    const s = front ? -1 : 1,
      wall = transformed(o, [0, 0, 0], s === 1 ? 0 : Math.PI);
    const profile = canopyProfile(front),
      n = profile.length;
    for (let k = 0; k < n - 1; k++) {
      const [z, y] = profile[k],
        [zn, yn] = profile[k + 1];
      // The glass skirt broadens from tower width to the wider retail roof.
      const half = X + (31 - X) * Math.min(1, (z - Z) / 16);
      const halfNext = X + (31 - X) * Math.min(1, (zn - Z) / 16);
      for (let j = 0; j < bays; j++) {
        const a = [-half + (2 * half * j) / bays, y, z],
          b = [-half + (2 * half * (j + 1)) / bays, y, z];
        const c = [-halfNext + (2 * halfNext * (j + 1)) / bays, yn, zn],
          d = [-halfNext + (2 * halfNext * j) / bays, yn, zn];
        face(wall, 'clear_glass', [a, d, c, b], blue);
        beam(wall, 'stainless', a, d, 0.055, 0.09, silver);
        if (k % 3 === 0) beam(wall, 'metal', a, b, 0.065, 0.11, silver);
      }
      for (const side of [-1, 1])
        beam(wall, 'stainless', [side * half, y, z], [side * halfNext, yn, zn], 0.19, 0.27, silver);
    }
    const [endZ, endY] = profile.at(-1),
      bottomZ = front ? 59 : 36;
    for (let j = 0; j < bays; j++) {
      const x = -31 + (width * j) / bays,
        xn = -31 + (width * (j + 1)) / bays;
      for (let row = 0; row < 3; row++) {
        const t0 = row / 3,
          t1 = (row + 1) / 3;
        const a = [x, 0.32 + (endY - 0.32) * t0, bottomZ + (endZ - bottomZ) * t0];
        const b = [xn, a[1], a[2]],
          d = [x, 0.32 + (endY - 0.32) * t1, bottomZ + (endZ - bottomZ) * t1];
        const c = [xn, d[1], d[2]];
        face(wall, 'clear_glass', [a, b, c, d], blue);
        beam(wall, 'stainless', a, d, 0.08, 0.12, silver);
        beam(wall, 'metal', a, b, 0.09, 0.12, silver);
      }
      if (j % 4 === 0)
        beam(
          wall,
          'metal',
          [x, 0.32, bottomZ - 0.5],
          [x, endY - 0.15, endZ - 0.5],
          0.32,
          0.4,
          grey,
        );
    }
    // Interior retail galleries give the transparent roof depth and real openings.
    for (let row = 1; row < 3; row++) {
      const y = row * 4.3,
        far = front ? 54 : 33;
      for (const sign of [-1, 1]) {
        const x0 = sign < 0 ? -30 : 20,
          x1 = sign < 0 ? -20 : 30;
        box(wall, 'concrete', [x0, y, Z - 2], [x1, y + 0.25, far], pale);
        box(wall, 'wood', [x0, y - 0.4, far], [x1, y + 0.2, far + 0.15], timber);
        rail(wall, x0, x1, y + 0.25, far - 0.15);
      }
    }
    // Each side wall follows the canopy's actual segmented section, not a solid box.
    for (const sign of [-1, 1])
      for (let k = 0; k < n - 1; k++) {
        const [z, y] = profile[k],
          [zn, yn] = profile[k + 1];
        const half = X + (31 - X) * Math.min(1, (z - Z) / 16),
          halfN = X + (31 - X) * Math.min(1, (zn - Z) / 16);
        let p = [
          [sign * half, 0.32, z],
          [sign * halfN, 0.32, zn],
          [sign * halfN, yn, zn],
          [sign * half, y, z],
        ];
        if (sign < 0) p = p.toReversed();
        face(wall, 'clear_glass', p, blue);
        if (k % 3 === 0)
          beam(wall, 'metal', [sign * half, 0.32, z], [sign * half, y, z], 0.1, 0.16, silver);
      }
  }
  // Entrance pairs, pavement joints and canopy columns are geometric, with working positions.
  const front = transformed(o, [0, 0, -59.04], Math.PI);
  for (let j = 0; j < 8; j++) {
    const x = -5.2 + j * 1.3;
    pane(front, x, x + 1.3, 0.32, 3.1, 0, true);
    tube(front, 'stainless', [x + 1.1, 1.05, 0.08], [x + 1.1, 1.95, 0.08], 0.021, silver, 10);
  }
  for (let x = -27; x <= 27; x += 9)
    for (const z of [-45, 28]) {
      const profile = canopyProfile(z < 0),
        d = Math.abs(z);
      const k = profile.findIndex((p) => p[0] >= d),
        a = profile[Math.max(0, k - 1)],
        b = profile[k];
      const y = a[1] + ((b[1] - a[1]) * (d - a[0])) / (b[0] - a[0]);
      tube(o, 'concrete', [x, 0.32, z], [x, y - 0.12, z], 0.22, pale, 16);
    }
  for (let x = -30; x <= 30; x += 2)
    box(o, 'recess', [x, 0.321, -58.8], [x + 0.01, 0.324, 35.8], grey);
  for (let z = -58; z <= 35; z += 2)
    box(o, 'recess', [-30.8, 0.321, z], [30.8, 0.324, z + 0.01], grey);
  // Tower lower floors under the curved weather skin, including recessed glazed lobby.
  for (let row = 0; row < 5; row++) {
    const y = 0.32 + row * 4.8;
    box(o, 'concrete', [-X + 1, y, -Z + 1], [X - 1, y + 0.22, Z - 1], pale);
    for (const sign of [-1, 1]) {
      const wall = transformed(o, [0, 0, 0], sign === 1 ? 0 : Math.PI);
      for (let j = 0; j < 28; j++)
        pane(
          wall,
          -X + 1 + (j * (2 * X - 2)) / 28,
          -X + 1 + ((j + 1) * (2 * X - 2)) / 28,
          y + 0.22,
          y + 4.77,
          Z - 1,
          row === 0,
        );
      const end = transformed(o, [sign * X, 0, 0], (sign * Math.PI) / 2);
      for (let j = 0; j < 16; j++)
        pane(end, -Z + (j * 2 * Z) / 16, -Z + ((j + 1) * 2 * Z) / 16, y, y + 4.78, 0, true);
    }
  }
}

function roof(o) {
  const out = tapered(o);
  for (let row = 0; row < 2; row++) {
    const y = 230.7 + 4.2 * row;
    box(out, 'concrete', [-X, y, -Z], [X, y + 0.22, Z], pale);
    for (const sign of [-1, 1]) {
      const wall = transformed(out, [0, 0, 0], sign === 1 ? 0 : Math.PI);
      for (let j = 0; j < 30; j++)
        pane(wall, -X + (j * 2 * X) / 30, -X + ((j + 1) * 2 * X) / 30, y + 0.22, y + 4.18, Z, true);
      const end = transformed(out, [sign * X, 0, 0], (sign * Math.PI) / 2);
      for (let j = 0; j < 12; j++)
        pane(end, -Z + (j * 2 * Z) / 12, -Z + ((j + 1) * 2 * Z) / 12, y + 0.22, y + 4.18, 0, true);
    }
  }
  box(out, 'metal', [-X, 239.1, -Z], [X, 239.35, Z], silver);
  box(out, 'concrete', [-6, 239.35, -5], [6, 242.2, 5], grey);
  for (let x = -5.4; x < 5.5; x += 1.8)
    for (let y = 239.6; y < 241.9; y += 0.18)
      box(out, 'metal', [x, y, 5.015], [x + 1.5, y + 0.055, 5.11], dark);
  // A slender sectioned mast above the separate occupied-roof datum.
  for (let k = 0; k < 12; k++) {
    const y = 242.2 + ((261 - 242.2) * k) / 12,
      yn = 242.2 + ((261 - 242.2) * (k + 1)) / 12;
    tube(o, 'stainless', [0, y, 0], [0, yn, 0], 0.32 * (1 - k / 12) + 0.025, silver, 16);
  }
  for (const s of [-1, 1]) {
    tube(o, 'stainless', [s * 17, 239.2, 0], [s * 17, 242.5, 0], 0.027, silver, 10);
    beam(o, 'metal', [s * 4, 242.1, 0], [0, 247.2, 0], 0.07, 0.09, silver);
  }
}

const parts = [
  { name: 'curved-glass-retail-base', build: retail, instances: [{}] },
  { name: 'opaque-end-blade', build: (o) => blade(tapered(o)), instances: [{}] },
  { name: 'observation-floors-and-mast', build: roof, instances: [{}] },
  ...Array.from({ length: 16 }, (_, i) => ({
    name: `tapered-weather-skin-${String(i + 1).padStart(2, '0')}`,
    build: (o) =>
      gardenGroup(tapered(o), base + 3 * interval * i, [3, 7, 11].includes(i), 'outside'),
    instances: [{}],
  })),
  ...[false, true].map((social) => ({
    name: social ? 'shared-social-garden' : 'shared-residential-garden',
    build: (o) => gardenGroup(o, 0, social, 'inside'),
    gpuInstances: true,
    instances: Array.from({ length: 16 }, (_, i) => i)
      .filter((i) => [3, 7, 11].includes(i) === social)
      .map((i) => ({ translation: [0, base + 3 * interval * i, 0] })),
  })),
];

export const istanbulSapphireStudy = {
  id: 'N0229',
  key: 'istanbul_sapphire',
  title: 'Istanbul Sapphire',
  wikidataId: 'Q166882',
  mapFrame: 'map-frame.json',
  build(out) {
    for (const p of parts)
      for (const i of p.instances) p.build(transformed(out, i.translation ?? [0, 0, 0]));
  },
  encodeAssembly(encode, join) {
    return join(
      parts.map((p) => ({ ...p, glb: encode(p.build, p.name) })),
      'Molen original Istanbul Sapphire double-envelope assembly',
    );
  },
  brief:
    'Slightly tapered double glass envelope with three-storey garden cavities, recessed residential glazing, projecting wood balcony edges, opaque end blade, asymmetric curved retail canopy, two observation floors and a separate rooftop mast.',
  sourceFacts: {
    architecturalHeightMeters: 261,
    tipMeters: 261,
    observatoryMeters: 234.9,
    aboveGroundFloors: 55,
    belowGroundFloors: 10,
    apartments: 187,
    residentialZones: 4,
  },
  reconstruction: {
    towerEnvelopeMeters: [2 * X, 2 * Z],
    residentialBaseMeters: base,
    workingFloorIntervalMeters: interval,
    threeStoreyGardenGroups: 16,
    workingRoofMeters: 239.35,
    tipMeters: 261,
    canopyExtentsZ: [-65, 40],
    canopyWidthMeters: 62,
    planBasis:
      'Tower envelope is cached exact-QID building:part geometry. The architect section and photographs guide the separate skins, gallery cavities and asymmetric canopy. Canopy extents, roof datums, garden distribution, taper, frames and panel subdivisions are working reconstructions, not surveyed dimensions.',
    materialBasis:
      'Canonical painted/stainless metal, plain concrete, granite and wood graphs. Reusable PBR glazing and vertex-colored foliage; no embedded images or photographic textures.',
    assembly: {
      uniqueParts: parts.length,
      instances: parts.reduce((n, p) => n + p.instances.length, 0),
    },
  },
  refs: [
    'https://www.tabanlioglu.com/project/sapphire/',
    'https://www.tabanlioglu.com/au-march-2013-2/',
    'https://www.tabanlioglu.com/larchitetto-april-2011/',
    'https://www.skyscrapercenter.com/building/torre-costanera/748',
    'https://www.openstreetmap.org/way/673790538',
  ],
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X along the mapped tower axis, approximately south',
    front: '-Z provisionally toward the main-road canopy',
    origin: 'Cached tower part center at provisional pavement contact',
  },
  geographic: () => ({
    anchor: frame.anchor,
    heading: frame.heading,
    mapGeometryHash: hashEvidenceText(frameBytes),
    notes:
      'Exact-QID tower-part footprint; canopy and end-blade signed direction, expanded retail boundary and terrain elevations are provisional. Do not treat the tower-part rectangle as the full site.',
  }),
  appearance: {
    period: 'Original built exterior from architect 2011/2013 publications',
    excluded:
      'Underground car parks, neighboring towers and unpublished interior apartment layouts.',
  },
  sourceDocuments: ['reference-metadata.json'],
  limitations: [
    'Maximum exterior fidelity is pending. Tower taper, window module count, cavity dimensions, balcony/plant distribution and support-floor heights require dimensioned facade and floor drawings.',
    'The 261 m tip, 234.9 m observatory and mapped 235 m height are distinct evidence. The 239.35 m working roof and mast division remain a section-guided reconstruction, not verified height datums.',
    'The cached footprint is a tower building:part only. Retail canopy dimensions, signed orientation, end-blade side, entrances and site ground contact require an independently registered site plan.',
    'Transparent mall galleries and winter-garden plants represent visible exterior depth; apartment interiors, exact retail layouts, lettering and rooftop equipment still need further reference.',
    'The 55 registry floors, 64 map levels and reconstructed facade row counts are recorded separately; facade subdivisions do not validate storey numbering.',
  ],
  camera: { position: [245, 155, -305], lookAt: [0, 121, -2], fov: 36 },
  qaCameras: [
    { name: 'outer-glass-and-seals', position: [-14, 87, -18], lookAt: [-14, 86, -12.9] },
    { name: 'winter-garden-depth', position: [-8, 79, -17], lookAt: [-8, 78, -9] },
    { name: 'balcony-wood-and-rail', position: [8, 81, -14], lookAt: [8, 80, -10.5] },
    { name: 'support-floor-louvres', position: [-12, 124, -26], lookAt: [-12, 121, -12.8] },
    { name: 'end-blade-joints', position: [34, 125, -1], lookAt: [24, 125, -1] },
    { name: 'curved-canopy', position: [-45, 47, -63], lookAt: [0, 16, -31] },
    { name: 'canopy-mullions', position: [-10, 27, -32], lookAt: [-10, 13, -30] },
    { name: 'retail-entrance', position: [1, 5, -70], lookAt: [1, 2, -59] },
    { name: 'rear-skirt', position: [41, 24, 49], lookAt: [0, 12, 25] },
    { name: 'observation-and-roof', position: [48, 254, -46], lookAt: [0, 235, 0] },
    { name: 'mast', position: [12, 257, 14], lookAt: [0, 250, 0] },
    { name: 'plan', position: [0, 310, 1], lookAt: [0, 0, 0] },
    { name: 'far-silhouette', position: [-650, 300, -760], lookAt: [0, 125, 0] },
  ],
};
