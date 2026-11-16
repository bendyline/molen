/** Standing Qing mansion and Cuijin Garden on the Qianhai West Street precinct. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const terrain = read('terrain-grid');
const layout = read('room-and-roof-layout');
const site = read('mapped-building-controls');
const glazing = new Set(['way/561187414', 'way/561187415', 'way/561187416', 'way/561187418']);
const surfaces = {
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  brick: { slot: 'wall', graph: 'brick_longformat', roughness: 0.95 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.9 },
  stone: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.93 },
  carved: { slot: 'trim', graph: 'stone_marble', roughness: 0.89 },
  paint: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.88 },
};
const c = Object.fromEntries(
  Object.entries({
    gray: '777b77',
    tileEdge: '9d9a85',
    darkRoof: '676c66',
    grassGreen: '547158',
    glazedEdge: '819173',
    brick: '92958c',
    masonry: 'b2aca0',
    grayShade: '73786e',
    stone: 'b4aca0',
    pale: 'c5bcaa',
    marble: 'e0d6c0',
    marbleShade: 'bfb59f',
    red: 'a24735',
    lacquer: '873e31',
    redShade: '693d33',
    teal: '3e7367',
    blue: '416488',
    gold: 'ba9755',
    deep: '50463b',
    water: '75877a',
    paving: 'b6ae9e',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const precinct = frame.geometry.polygons[0];
const prominentRoofs = layout.roofprints
  .slice()
  .sort((a, b) => b.width * b.depth - a.width * a.depth)
  .slice(0, 19);
const at = (p, y) => [p[0], y, p[1]];
function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = terrain.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}

const pondLevel = Math.max(...site.pond[0].map((p) => ground(...p))) + 0.05;

function block(out, slot, x, z, y, w, d, h, tint) {
  box(out, slot, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], tint);
}

function flatFront(out, slot, x, y, z, w, h, tint) {
  face(
    out,
    slot,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    tint,
  );
}

function roof(out, width, depth, low, rise, style, lod) {
  const n = [1, 1, 2, 6][lod];
  const eaveCurl = Math.min(0.51, depth * 0.047);
  const shape =
    lod === 0
      ? [
          [0, 1, 1, 0.32],
          [1, style.hardGable ? 0.91 : 0.49, 0.046, 0],
        ]
      : style.hardGable
        ? [
            [0, 1, 1, 0.49],
            [0.19, 0.91, 0.75, 0.18],
            [0.58, 0.9, 0.39, 0.07],
            [1, 0.89, 0.035, 0],
          ]
        : [
            [0, 1, 1, 1],
            [0.22, 0.92, 0.75, 0.34],
            [0.63, 0.79, 0.36, 0.15],
            [1, 0.64, 0.044, 0],
          ];
  const rings = shape.map(([h, x, z, curl]) => {
    const halfW = (width * x) / 2,
      halfD = (depth * z) / 2;
    const p = [
      [-halfW, -halfD],
      [-halfW, halfD],
      [halfW, halfD],
      [halfW, -halfD],
    ];
    return p.flatMap((a, k) => {
      const b = p[(k + 1) % 4];
      return Array.from({ length: n }, (_, j) => {
        const t = j / n,
          u = Math.abs(t * 2 - 1);
        return [
          mix(a[0], b[0], t),
          low + h * rise + eaveCurl * curl * u * u * u * u,
          mix(a[1], b[1], t),
        ];
      });
    });
  });
  const tint = style.glazed ? c.grassGreen : style.sealed ? c.darkRoof : c.gray;
  for (let k = 1; k < rings.length; k++) {
    const a = rings[k - 1],
      b = rings[k];
    for (let i = 0; i < a.length; i++) {
      const j = (i + 1) % a.length,
        gable = (k >= 2 || lod === 0) && style.hardGable && Math.floor(i / n) % 2 === 0;
      face(
        out,
        gable ? 'brick' : 'tile',
        [a[i], a[j], b[j], b[i]],
        gable ? (style.glazed ? c.lacquer : c.brick) : tint,
      );
    }
  }
  const upper = rings.at(-1);
  face(out, 'tile', [upper[0], upper[n], upper[2 * n], upper[3 * n]], tint);
  const bottom = rings[0];
  if (lod >= 1) {
    for (let i = 0; i < bottom.length; i++)
      triangle(
        out,
        'wood',
        [[0, low + 0.02, 0], bottom[(i + 1) % bottom.length], bottom[i]],
        c.deep,
      );
    const r = upper[2 * n][0],
      y = low + rise;
    beamPath(
      out,
      'tile',
      [
        [-r - 0.14, y + 0.15, 0],
        [-r + 0.28, y + 0.01, 0],
        [r - 0.28, y + 0.01, 0],
        [r + 0.14, y + 0.15, 0],
      ],
      0.16,
      0.19,
      tint,
    );
  }
  if (lod >= 2) {
    const edge = style.glazed ? c.glazedEdge : c.tileEdge;
    beamPath(out, 'tile', bottom, 0.11, 0.11, edge, true);
    for (let i = 0; i < 4; i++)
      beamPath(
        out,
        'tile',
        rings.map((row) => row[i * n]),
        0.16,
        0.19,
        edge,
      );
    for (const x of [upper[0][0], upper[2 * n][0]]) {
      const s = Math.sign(x),
        y = low + rise;
      beamPath(
        out,
        'paint',
        [
          [x - s * 0.24, y, 0],
          [x, y + 0.21, 0],
          [x + s * 0.19, y + 0.46, 0],
        ],
        0.13,
        0.18,
        edge,
      );
    }
  }
  if (lod === 3 && style.glazed) {
    for (const s of [-1, 1]) {
      for (let i = 1; i < Math.floor(width * 1.8); i++) {
        const u = (2 * i) / Math.floor(width * 1.8) - 1;
        const p = rings.map((r, j) => [r[2 * n][0] * u, r[2 * n][1] + 0.048, r[2 * n][2] * s]);
        beamPath(out, 'tile', p, 0.06, 0.08, c.glazedEdge);
      }
    }
  }
}

function lattice(out, x, z, y, width, height, quality) {
  flatFront(out, 'paint', x, y, z, width, height, c.redShade);
  const inset = width * 0.82;
  flatFront(out, 'paint', x, y + 0.15, z + 0.022, inset, height - 0.28, c.lacquer);
  if (quality < 2) return;
  const z1 = z + 0.045;
  if (quality === 2) {
    for (const u of [x - inset / 2, x, x + inset / 2])
      flatFront(out, 'paint', u, y, z1, 0.073, height, c.gold);
    for (const h of [0.18, 0.53, 0.88])
      flatFront(out, 'paint', x, y + h * height, z1 + 0.012, inset, 0.071, c.gold);
    return;
  }
  for (const u of [x - inset / 2, x, x + inset / 2])
    block(out, 'wood', u, z1, y, 0.076, 0.076, height, c.gold);
  for (const h of [0.18, 0.51, 0.78, 0.94])
    block(out, 'wood', x, z1, y + h * height, inset, 0.071, 0.07, c.gold);
  for (const s of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const u = x + s * (0.12 + i / 8) * inset;
      block(out, 'paint', u, z1 - 0.004, y + 0.45 * height, 0.023, 0.041, 0.52 * height, c.gold);
    }
}

function bays(out, width, depth, y, eave, count, open, quality, painted) {
  const front = depth / 2;
  const w = (width - 0.33) / count;
  const floor = y + 0.48;
  const header = eave - 0.65;
  for (let i = 0; i <= count; i++) {
    const x = (i - count / 2) * w;
    if (quality === 1) {
      flatFront(out, 'wood', x, floor, front - 0.24, 0.3, header - floor, c.red);
      flatFront(
        transform(out, Math.PI / 2, [x, 0, front - 0.36]),
        'wood',
        0,
        floor,
        0.01,
        0.3,
        header - floor,
        c.red,
      );
    } else {
      const sides = quality === 3 ? 8 : 5;
      const points = [
        radialRing(floor, 0.175, 0.175, sides, [x, front - 0.36]),
        radialRing(header, 0.155, 0.155, sides, [x, front - 0.36]),
      ];
      loft(out, 'wood', points, c.red, { cap: false });
    }
    if (quality === 3) {
      block(out, 'stone', x, front - 0.36, floor - 0.075, 0.42, 0.42, 0.18, c.pale);
      block(
        out,
        'paint',
        x,
        front - 0.34,
        header - 0.45,
        0.58,
        0.44,
        0.52,
        painted ? c.teal : c.redShade,
      );
      if (quality === 3)
        block(
          out,
          'paint',
          x,
          front - 0.35,
          header - 0.18,
          0.73,
          0.62,
          0.25,
          painted ? c.blue : c.lacquer,
        );
    }
  }
  block(
    out,
    'wood',
    0,
    front - 0.24,
    header - 0.08,
    width,
    0.64,
    0.43,
    painted ? c.teal : c.lacquer,
  );
  if (quality >= 2) {
    block(
      out,
      'paint',
      0,
      front + 0.045,
      header + 0.03,
      width * 0.99,
      0.1,
      0.13,
      painted ? c.blue : c.red,
    );
    block(out, 'paint', 0, front + 0.045, header + 0.19, width * 0.99, 0.1, 0.06, c.gold);
  }
  for (let i = 0; i < count; i++) {
    if (open && Math.abs(i - (count - 1) / 2) < 0.6) continue;
    const x = (i + 0.5 - count / 2) * w;
    const y = floor + 0.21;
    const z = front - (open ? 0.27 : Math.min(2.01, depth * 0.23));
    lattice(out, x, z, y, w * 0.75, header - y - 0.12, quality);
    if (quality >= 2) {
      block(out, 'stone', x, z - 0.03, floor - 0.06, w * 0.8, 0.28, 0.32, c.masonry);
      if (painted)
        block(
          out,
          'paint',
          x,
          front + 0.017,
          header + 0.22,
          w * 0.64,
          0.1,
          0.15,
          i % 2 ? c.blue : c.teal,
        );
    }
  }
}

function footprint(out, b, y, low, high, slot, tint) {
  block(out, slot, 0, 0, y + low, b.width, b.depth, high - low, tint);
}

function terrace(out, b, y, quality) {
  const stepCount = b.id === 'way/561187418' ? 6 : 4;
  const stepY = 0.61 / stepCount;
  const w = Math.min(b.width * 0.58, 10.2),
    z = b.depth / 2 + 0.1;
  for (let i = 0; i < (quality === 1 ? 2 : stepCount); i++) {
    const level = quality === 1 ? 0.32 * i : stepY * i;
    const depth = (quality === 1 ? 0.52 : 0.32) * (i + 1);
    block(
      out,
      'stone',
      0,
      z + (depth - 0.23) / 2,
      y - 0.55,
      w + i * 0.12,
      depth + 0.31,
      1.11 - level,
      c.stone,
    );
  }
}

function roofedBuilding(out, b, lod, special = false) {
  const open = ['outer-gate', 'gate', 'pavilion'].includes(b.kind);
  const glazed = glazing.has(b.id);
  const thick = special ? 0.7 : 0.31;
  const base = b.kind === 'pavilion' ? pondLevel + 0.13 : ground(b.x, b.z) + (special ? 0.08 : 0);
  const front = transform(out, -b.angle, [b.x, 0, b.z]);
  const eave = base + b.height;
  const low = Math.min(
    -0.7,
    ...[-1, 1].flatMap((i) =>
      [-1, 1].map((j) => {
        const ca = Math.cos(b.angle),
          sa = Math.sin(b.angle);
        const u = (i * b.width) / 2,
          v = (j * b.depth) / 2;
        return ground(b.x + u * ca - v * sa, b.z + u * sa + v * ca) - base - 0.74;
      }),
    ),
  );
  const tier = special ? lod : lod === 3 ? 1 : 0;
  const style = {
    glazed,
    hardGable: b.id !== 'way/561187414' && b.kind !== 'pavilion' && b.kind !== 'theatre',
    sealed: b.kind === 'rear',
  };
  if (tier === 0) {
    footprint(
      front,
      b,
      base,
      low,
      open ? 0.45 : b.height,
      'brick',
      open ? c.stone : glazed ? c.redShade : c.brick,
    );
    if (open) {
      const y = base + 0.45;
      const s = b.width * 0.16;
      for (const x of [-b.width / 2 + s, b.width / 2 - s])
        block(front, 'wood', x, 0, y, 2 * s, b.depth, eave - y, c.lacquer);
      block(front, 'wood', 0, 0, eave - 0.34, b.width, b.depth, 0.34, c.lacquer);
    }
    roof(front, b.width + 2 * thick, b.depth + 2 * thick, eave, b.rise, style, 0);
    return;
  }
  footprint(front, b, base, low, 0.46, 'stone', c.stone);
  if (!open) {
    const inner = b.kind === 'rear' ? b.depth * 0.89 : b.depth - Math.min(b.depth * 0.22, 1.43);
    block(
      front,
      'brick',
      0,
      -(b.depth - inner) * 0.5,
      base + 0.45,
      b.width,
      inner,
      eave - base - 0.45,
      c.brick,
    );
  }
  const count = tier >= 2 ? b.bays : Math.min(5, b.bays);
  bays(front, b.width, b.depth, base, eave, count, open, tier, glazed || b.kind === 'hall');
  if (open && tier >= 2)
    bays(
      transform(front, Math.PI),
      b.width,
      b.depth,
      base,
      eave,
      count,
      true,
      tier === 2 ? 1 : 2,
      glazed,
    );
  if (special && tier >= 2 && !open && b.kind !== 'pavilion')
    bays(transform(front, Math.PI), b.width, b.depth, base, eave, count, false, 1, glazed);

  roof(
    front,
    b.width + 2 * thick,
    b.depth + 2 * thick,
    eave,
    b.rise,
    style,
    tier === 2 && !glazed ? 1 : tier,
  );
  if (special && tier >= 1 && (glazed || b.kind === 'court')) terrace(front, b, base, tier);
}

function rearRange(out, b, lod, center) {
  const local = transform(out, -b.angle, [b.x, 0, b.z]);
  const y = ground(-4.22, 68.8),
    eave = y + b.height + wornRise(b.x);
  const z = b.depth / 2;
  const style = { glazed: false, hardGable: true, sealed: true };
  const room = b.width / 2,
    portal = 1.35;
  const columns = center
    ? [
        [-room, -portal],
        [portal, room],
      ]
    : [[-room, room]];
  const grade = Math.min(ground(b.x - b.width / 2, b.z), ground(b.x + b.width / 2, b.z), y) - 0.85;
  for (const [a, d] of columns)
    block(local, 'brick', (a + d) / 2, 0, grade, d - a, b.depth, eave - grade, c.brick);
  if (center) block(local, 'brick', 0, 0, y + 3.45, portal * 2, b.depth, eave - y - 3.45, c.brick);
  roof(
    local,
    b.width + 0.21,
    b.depth + 0.72,
    eave,
    b.rise,
    style,
    lod > 0 ? (lod === 3 ? 2 : 1) : 0,
  );
  if (lod === 0) return;
  const count = lod === 1 ? 8 : b.bays;
  for (const direction of [0, Math.PI]) {
    const facade = transform(local, direction);
    block(facade, 'wood', 0, z + 0.07, y + 3.48, b.width, 0.19, 0.17, c.grayShade);
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5 - count / 2) * b.width) / count;
      const span = lod === 1 ? 1.05 : 1.24;
      if (lod >= 2 && (!center || Math.abs(x) > 1.85))
        lattice(facade, x, z + 0.049, y + 0.81, span, 2.22, lod === 3 ? 2 : 1);
      flatFront(facade, 'paint', x, y + 4.43, z + 0.045, span, 0.86, c.deep);
      if (lod >= 2) {
        const open = i % 3 === 0 ? 0.32 : 0.43;
        block(facade, 'carved', x, z + 0.06, y + 4.39, span + 0.27, 0.18, 0.13, c.pale);
        for (const dx of [-open, 0, open])
          flatFront(facade, 'paint', x + dx, y + 4.5, z + 0.063, 0.062, 0.74, c.stone);
      }
    }
  }
}
const wornRise = (x) => Math.abs(x) * 0.0015;

function westernGate(out, lod) {
  const { x, z, width, height, openingWidth } = layout.westernGate;
  const y = ground(x, z),
    r = openingWidth / 2,
    spring = y + 2.08;
  const n = [5, 8, 13, 19][lod];
  const local = transform(out, 0, [x, 0, z]);
  for (const s of [-1, 1]) {
    const x = s * (r + 0.69);
    block(local, 'carved', x, 0, y - 0.26, 0.8, 1.23, height - 0.11, c.marble);
    block(local, 'stone', x, 0, y - 0.36, 1.05, 1.47, 0.66, c.pale);
    block(local, 'carved', x, 0, y + height - 0.39, 1.06, 1.49, 0.23, c.marble);
    if (lod > 0) {
      const flank = s * (width / 2 - 0.49);
      block(local, 'brick', flank, 0, y - 0.36, 0.96, 0.65, 2.98, c.brick);
      block(local, 'carved', flank, 0, y + 2.52, 1.1, 0.84, 0.23, c.marble);
    }
  }
  const arc = (r, h, z, t) => [r * Math.cos(t * Math.PI), spring + h * Math.sin(t * Math.PI), z];
  const front = 0.47;
  for (let i = 0; i < n; i++) {
    const a = i / n,
      b = (i + 1) / n;
    const p = arc(r, 1.27, front, a),
      q = arc(r, 1.27, front, b);
    for (const s of [1, -1]) {
      const f = transform(local, s === 1 ? 0 : Math.PI);
      face(
        f,
        'carved',
        [arc(r + 0.42, 1.69, front, a), arc(r + 0.42, 1.69, front, b), q, p],
        c.marble,
      );
    }
    face(local, 'carved', [p, q, [q[0], q[1], -front], [p[0], p[1], -front]], c.marbleShade);
  }
  const crest = y + height - 0.96;
  block(local, 'carved', 0, 0, crest, 3.83, 1.32, 0.55, c.marble);
  block(local, 'carved', 0, 0, crest + 0.54, 2.72, 0.98, 0.46, c.marble);
  if (lod >= 2) {
    for (const s of [-1, 1]) {
      for (const f of [-0.62, 0.62]) {
        beamPath(
          local,
          'carved',
          [
            [s * 0.63, crest + 0.46, f],
            [s * 1.46, crest + 0.31, f],
            [s * 1.81, crest + 0.62, f],
          ],
          0.19,
          0.17,
          c.marbleShade,
        );
      }
    }
  }
  block(local, 'stone', 0, 0, y - 0.48, openingWidth + 0.39, 1.8, 0.63, c.pale);
}

function boundary(out, ring, lod) {
  const gate = frame.terrainContact.local;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const count = Math.max(1, Math.ceil(l / (lod === 1 ? 29 : 12)));
    const local = transform(out, Math.atan2(a[1] - b[1], b[0] - a[0]), [a[0], 0, a[1]]);
    for (let k = 0; k < count; k++) {
      const p = (k + 0.5) / count;
      const x = mix(a[0], b[0], p),
        z = mix(a[1], b[1], p);
      if (Math.hypot(x - gate[0], z - gate[1]) < 6.7) continue;
      const y = ground(x, z),
        span = l / count;
      block(local, 'brick', p * l, 0, y - 0.64, span, 0.57, 2.92, c.brick);
      if (lod >= 2) block(local, 'tile', p * l, 0, y + 2.25, span, 0.74, 0.21, c.gray);
    }
  }
}

function pond(out, lod) {
  const [ring, island] = site.pond;
  const vertices = [...ring, ...island];
  const tris = earcut(vertices.flat(), [ring.length]);
  const y = pondLevel;
  for (let i = 0; i < tris.length; i += 3)
    triangle(
      out,
      'paint',
      [tris[i + 2], tris[i + 1], tris[i]].map((j) => at(vertices[j], y)),
      c.water,
    );
  if (lod === 0) return;
  for (const r of [ring, island]) {
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const local = transform(out, Math.atan2(a[1] - b[1], b[0] - a[0]), [a[0], 0, a[1]]);
      const low = Math.min(ground(...a), ground(...b), y) - 0.31;
      block(local, 'stone', l / 2, 0, low, l, 0.53, y - low + 0.21, c.stone);
    }
  }
}

function courtyards(out, lod) {
  for (const [x, z, w, d] of layout.courts) {
    const p = (u, v) => [u, ground(u, v) + 0.11, v];
    const n = lod === 3 ? 5 : 3;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const a = x - w / 2 + (w * i) / n,
          b = a + w / n,
          c0 = z - d / 2 + (d * j) / n,
          d0 = c0 + d / n;
        face(
          out,
          'stone',
          [p(a, c0), p(a, d0), p(b, d0), p(b, c0)],
          (i + 2 * j) % 5 === 0 ? c.stone : c.paving,
        );
      }
  }
}

function build(out, lod) {
  for (const b of layout.native) roofedBuilding(out, b, lod, true);
  for (const [i, b] of layout.rear.entries()) rearRange(out, b, lod, i === 1);
  const list = lod === 0 ? prominentRoofs : layout.roofprints;
  for (const b of list) roofedBuilding(out, b, lod, b.kind === 'theatre' || b.kind === 'hall');
  westernGate(out, lod);
  pond(out, lod);
  if (lod >= 2) {
    boundary(out, precinct, lod);
    courtyards(out, lod);
  }
}

export const princeGongSkyline = (out) => build(out, 0);
export const princeGongDistrict = (out) => build(out, 1);
export const princeGongStreet = (out) => build(out, 2);
export const princeGongCloseup = (out) => build(out, 3);
const recipe = 'prince-gong-mansion-model.mjs';
const camera = [281, 245, 367],
  lookAt = [0, 0, 91];
const h = layout.native.find((b) => b.kind === 'silver');
const pavilion = layout.native.find((b) => b.kind === 'pavilion');
const outlineArea = (ring) =>
  Math.abs(
    ring.reduce((sum, [x, z], index) => {
      const [nextX, nextZ] = ring[(index + 1) % ring.length];
      return sum + x * nextZ - z * nextX;
    }, 0),
  ) / 2;
const cutoutRoofprints = site.roofprints
  .map(({ ring }) => ({ ring, area: outlineArea(ring) }))
  .sort((a, b) => b.area - a.area)
  .slice(0, 64 - site.native.length)
  .map(({ ring }) => ring);
const visibleGroups = [...site.native.map((b) => b.ring), ...cutoutRoofprints];
export const princeGongModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  category: 'landmark',
  build: princeGongCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline: visibleGroups[2],
    outlines: visibleGroups,
    minimumCoverage: 0.88,
    basis:
      'Individual palace roof envelopes and the largest supplementary mapped roofs within the placement catalog limit. Courts and garden remain open.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Beijing’s Prince Gong mansion and garden, with the green-roofed ceremonial axis, gray tiled courts, rear screen building, marble garden arch and pond pavilion.',
  camera,
  lookAt,
  sunDirection: [-42, 70, 58],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.83,
    cameraYaw: 0.1,
    focus: { center: [0, 0, 99] },
    groundY: 0,
    far: 2500,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'courtyard-of-yinan-hall',
      position: [h.x - 8.2, ground(h.x - 8, h.z - 21) + 3.55, h.z - 21.2],
      lookAt: [h.x + 2, ground(h.x, h.z) + 4.4, h.z - 7],
    },
    { name: 'entrance-and-green-glazed-gate-axes', position: [43, 27, 244], lookAt: [0, 4, 186] },
    { name: 'rear-building-and-marble-garden-gate', position: [47, 20, 26], lookAt: [-0.5, 4, 64] },
    {
      name: 'pond-pavilion-and-garden',
      position: [pavilion.x - 22, ground(pavilion.x, pavilion.z) + 16, pavilion.z + 34],
      lookAt: [pavilion.x + 4, ground(pavilion.x, pavilion.z) + 2, pavilion.z - 2],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'mansion-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'princeGongSkyline',
    errorMeters: 6.1,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'princeGongDistrict', 2.7],
        ['street', 'princeGongStreet', 0.8],
        ['closeup', 'princeGongCloseup', 0.15],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceLicense:
    'Original model informed by CC0 photographs by Hermann Luyken. OpenStreetMap and Overture Buildings data ODbL 1.0. The building records identify Overture roofprint lineage.',
  limitations: plan.limitations,
};
