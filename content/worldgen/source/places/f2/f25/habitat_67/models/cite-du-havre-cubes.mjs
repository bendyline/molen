import { deform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.94 },
  slab: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  terrace: { slot: 'roof', graph: 'concrete_panel', roughness: 0.95 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.83 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.52 },
};
const concrete = ['a89887', 'aa9e8d', 'b2a38e', 'b1a296', 'a89d91', 'b7aa96'].map(rgb);
const oldConcrete = rgb('918b7d'),
  deck = rgb('a5a08e'),
  metal = rgb('676b5e');
const glass = rgb('56605a'),
  shade = rgb('878174'),
  garden = rgb('747e54');
const placement = facade([0, 0], site.frame.along);
const { modules, cores, floorBase, floorHeight, foundationBottom } = site;
const elevation = (floor) => floorBase + floor * floorHeight;
const bounds = (m) => [m.x, m.x + m.length, m.d - m.width / 2, m.d + m.width / 2];

const moduleAt = new Map(
  modules.map((m) => [m.row * 40 + m.floor * 2 + (m.side === 'west' ? 0 : 1), m]),
);
const unit = (row, floor, side = 'west') =>
  moduleAt.get(row * 40 + floor * 2 + (side === 'west' ? 0 : 1));

function face(out, slot, face, a, b, low, high, depth, color) {
  const p = face.P;
  quad4(out, slot, p(a, low, depth), p(b, low, depth), p(b, high, depth), p(a, high, depth), color);
}

function deckFace(out, slot, x0, x1, z0, z1, y, color) {
  quad4(out, slot, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], color);
}

function walls(out, detail, m) {
  const [x0, x1, z0, z1] = bounds(m);
  const y0 = elevation(m.floor),
    y1 = y0 + floorHeight - 0.008;
  const plan = outwardRing([
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]);
  const color = concrete[(m.row * 11 + m.floor * 7 + m.group) % concrete.length];
  for (const [i, a] of plan.entries()) {
    const f = wallFace(a, plan[(i + 1) % plan.length]),
      l = f.length;
    const short = Math.abs(f.normal[0]) > 0.99;
    const inward = f.normal[0] * (m.side === 'west' ? 1 : -1) > 0.99;
    const wide = (m.row + m.floor) % 4 === 1;
    const sideWindow = detail === 3 && (m.floor + m.row * 7 + i) % 4 === 1;
    if ((!short && !sideWindow) || (detail === 2 && inward && (m.row + m.floor) % 3 !== 0)) {
      face(out, 'concrete', f, 0, l, y0, y1, 0, color);
      continue;
    }
    const center = l * (short ? (wide ? 0.54 : 0.63) : 0.74);
    const width = short ? Math.min(l - 0.83, wide ? 3.1 : 2.39) : 1.13;
    const low = y0 + (wide ? 0.72 : 0.98),
      top = y1 - 0.55;
    const left = center - width / 2,
      right = center + width / 2;
    const recess = detail === 2 ? -0.057 : -0.21;
    face(out, 'concrete', f, 0, left, y0, y1, 0, color);
    face(out, 'concrete', f, right, l, y0, y1, 0, color);
    face(out, 'concrete', f, left, right, y0, low, 0, color);
    face(out, 'concrete', f, left, right, top, y1, 0, color);
    face(out, 'glass', f, left, right, low, top, recess, glass);
    if (detail === 2) continue;
    const p = f.P;
    quad4(
      out,
      'concrete',
      p(left, low, 0),
      p(left, low, recess),
      p(left, top, recess),
      p(left, top, 0),
      shade,
    );
    quad4(
      out,
      'concrete',
      p(right, low, recess),
      p(right, low, 0),
      p(right, top, 0),
      p(right, top, recess),
      shade,
    );
    quad4(
      out,
      'slab',
      p(left, low, recess),
      p(left, low, 0),
      p(right, low, 0),
      p(right, low, recess),
      deck,
    );
    quad4(
      out,
      'slab',
      p(left, top, 0),
      p(left, top, recess),
      p(right, top, recess),
      p(right, top, 0),
      oldConcrete,
    );
    fbox(out, 'frame', f, center - 0.044, center + 0.044, low, top, recess, recess + 0.08, metal);
    if (short) face(out, 'frame', f, left, right, top - 0.12, top - 0.05, recess + 0.055, metal);
  }
  deckFace(out, 'terrace', x0, x1, z0, z1, y1, deck);
  deckFace(out, 'slab', x1, x0, z0, z1, y0, oldConcrete);
}

function terrace(out, detail, m) {
  if (!m.terrace || (detail === 2 && m.floor % 3 === 1)) return;
  const [a, b, z0, z1] = bounds(m);
  const above = unit(m.row, m.floor + 1, m.side);
  const far = m.side === 'east';
  const left = far && above ? Math.max(a, above.x + above.length) : a;
  const right = !far && above ? Math.min(b, above.x) : b;
  if (right - left < 1.16) return;
  const y = elevation(m.floor + 1) - 0.012;
  const x = far ? right - 0.11 : left + 0.11;
  abox(out, 'concrete', [x - 0.13, y, z0 + 0.075], [x + 0.13, y + 0.31, z1 - 0.075], oldConcrete, {
    bottom: false,
  });
  abox(out, 'concrete', [x - 0.14, y + 0.71, z0 + 0.075], [x + 0.14, y + 0.91, z1 - 0.075], deck);
  if (detail < 3) return;
  for (const z of [z0 + 0.225, (z0 + z1) / 2, z1 - 0.225])
    abox(out, 'frame', [x - 0.052, y + 0.25, z - 0.06], [x + 0.052, y + 0.75, z + 0.06], metal, {
      bottom: false,
    });
  if ((m.row * 3 + m.floor + m.group) % 4 !== 1) {
    const u = far ? right - 0.84 : left + 0.22;
    const limit = Math.min(z0 + 2.18, z1 - 0.52);
    abox(out, 'terrace', [u, y, z0 + 0.56], [u + 0.6, y + 0.37, limit], shade, { bottom: false });
    deckFace(out, 'terrace', u + 0.04, u + 0.55, z0 + 0.6, limit - 0.04, y + 0.382, garden);
  }
}

function footing(out, m) {
  const [x0, x1, z0, z1] = bounds(m);
  abox(
    out,
    'slab',
    [x0 + 0.61, foundationBottom, z0 + 0.39],
    [x1 - 0.57, floorBase + 0.011, z1 - 0.39],
    oldConcrete,
    { bottom: false },
  );
}

function proxy(out, detail) {
  const n = detail === 0 ? 2 : 1;
  const groupHeight = detail === 0 ? 3 : 2;
  for (let row = 0; row < site.rows.length; row += n) {
    for (let floor = 0; floor < site.levels; floor += groupHeight) {
      const types = detail === 0 ? ['west'] : ['west', 'east'];
      for (const side of types) {
        const cells = modules.filter(
          (m) =>
            m.row >= row &&
            m.row < row + n &&
            m.floor >= floor &&
            m.floor < floor + groupHeight &&
            m.side === side,
        );
        if (!cells.length) continue;
        const spans = cells.map(bounds);
        const x0 = Math.min(...spans.map((b) => b[0])),
          x1 = Math.max(...spans.map((b) => b[1]));
        const z0 = Math.min(...spans.map((b) => b[2])),
          z1 = Math.max(...spans.map((b) => b[3]));
        const lowest = Math.min(...cells.map((m) => m.floor)),
          highest = Math.max(...cells.map((m) => m.floor)) + 1;
        abox(
          out,
          'concrete',
          [x0, lowest === 0 ? foundationBottom : elevation(lowest), z0],
          [x1, elevation(highest) - 0.011, z1],
          concrete[(row + floor) % concrete.length],
        );
        if (detail > 0 && highest > floor) {
          const west = wallFace([x0, z0], [x0, z1]);
          face(
            out,
            'glass',
            west,
            (z1 - z0) * 0.29,
            (z1 - z0) * 0.71,
            elevation(highest) - 1.57,
            elevation(highest) - 0.61,
            0.057,
            glass,
          );
          if (highest <= 10 && row % 2 === 1)
            deckFace(
              out,
              'terrace',
              x0 + 0.037,
              x1 - 0.03,
              z0 + 0.042,
              z1 - 0.042,
              elevation(highest) + 0.01,
              deck,
            );
        }
      }
    }
  }
}

function connectors(out, detail) {
  if (detail === 0) return;
  for (const floor of [2, 5, 8])
    for (let i = 0; i < site.rows.length - 1; i++) {
      const a = unit(i, floor),
        b = unit(i + 1, floor);
      if (!a || !b || (detail === 1 && i % 2 === 1)) continue;
      const A = bounds(a),
        B = bounds(b);
      const x = Math.max(A[0], B[0]) + 0.38,
        z = A[3] - 0.2,
        end = B[2] + 0.2;
      if (x + 1.46 > Math.min(A[1], B[1]) || end - z < 0.32) continue;
      const y = elevation(floor);
      abox(out, 'slab', [x, y + 0.04, z], [x + 1.46, y + 0.36, end], oldConcrete);
      if (detail > 1) {
        const f = wallFace([x, z], [x, end]);
        fbox(out, 'frame', f, 0, f.length, y + 1.02, y + 1.12, -0.075, 0.075, metal);
        for (const u of [0.09, f.length - 0.09])
          fbox(out, 'frame', f, u - 0.04, u + 0.04, y + 0.29, y + 1.05, -0.049, 0.045, metal);
      }
    }
}

function liftCores(out, detail) {
  for (const { x, d, width, depth, height } of cores) {
    const left = x - width / 2,
      right = x + width / 2,
      north = d - depth / 2,
      south = d + depth / 2;
    abox(out, 'concrete', [left, foundationBottom, north], [right, height, south], oldConcrete);
    if (detail === 0) continue;
    const f = wallFace([left, north], [left, south]);
    for (const floor of [2, 5, 8, 11]) {
      const y = elevation(floor) + 0.19;
      face(out, 'glass', f, depth * 0.4, depth * 0.61, y, y + 1.76, 0.031, glass);
    }
    abox(
      out,
      'slab',
      [left - 0.16, height - 0.17, north - 0.16],
      [right + 0.16, height + 0.014, south + 0.16],
      deck,
    );
  }
}

function build(out, detail) {
  const local = deform(out, ([u, y, d]) => placement.P(u, y, d));
  if (detail < 2) proxy(local, detail);
  else
    for (const m of modules) {
      if (m.floor === 0) footing(local, m);
      walls(local, detail, m);
      terrace(local, detail, m);
    }
  connectors(local, detail);
  liftCores(local, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
