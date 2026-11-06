/** Original whole STRAT exterior from retained map controls and ordinary photographs. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
  torus,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const a = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url))),
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const linear = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: linear('e3e0d5'),
    glass: linear('a4b6b9'),
    metal: linear('a6adae'),
    dark: linear('454b50'),
    roof: linear('c2c2bb'),
    paving: linear('b7b1a6'),
    water: linear('438c99'),
    red: linear('b53c32'),
  };
export const stratSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.87, metallic: 0 },
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.19, metallic: 0.17 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.56, metallic: 0.42 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.92, metallic: 0 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94, metallic: 0 },
  water: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.18, metallic: 0.1 },
};
export const stratControls = a;
export function stratGroundY(x, z) {
  const u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    p = u - i,
    q = v - j,
    n = g.size[0],
    h = g.elevationsMeters;
  return (
    (1 - p) * (1 - q) * h[j * n + i] +
    p * (1 - q) * h[j * n + i + 1] +
    (1 - p) * q * h[(j + 1) * n + i] +
    p * q * h[(j + 1) * n + i + 1] -
    a.originElevation
  );
}
const configs = {
  skyline: { far: true, sides: 8, legSimple: true },
  district: { sides: 16, hotelRows: 24, bandFlat: true, podiumBands: 2, lattice: 8, mast: 4 },
  street: {
    sides: 32,
    hotelRows: 24,
    panes: true,
    pitch: 6,
    bands: true,
    podiumBands: 3,
    lattice: 16,
    mast: 8,
    entry: true,
    plant: true,
  },
  closeup: {
    sides: 48,
    hotelRows: 24,
    panes: true,
    pitch: 3,
    bands: true,
    mullions: true,
    podiumBands: 3,
    lattice: 24,
    mast: 12,
    entry: true,
    plant: true,
    rails: true,
  },
  master: {
    sides: 72,
    hotelRows: 24,
    panes: true,
    pitch: 2.8,
    bands: true,
    mullions: true,
    reveals: true,
    podiumBands: 3,
    lattice: 36,
    mast: 16,
    entry: true,
    plant: true,
    rails: true,
    dense: true,
  },
};
const S = (c, n) => (c.far ? 'far' : n),
  ring = (r) =>
    r.length > 1 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1] ? r.slice(0, -1) : r,
  area = (r) =>
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0) / 2,
  oriented = (polys) =>
    polys.map((poly) =>
      poly.map((raw, i) => {
        let r = ring(raw);
        if (area(r) > 0 !== (i === 0)) r = r.toReversed();
        return r;
      }),
    );
function cap(o, slot, polys, y, color, down = false) {
  for (const poly of polys) {
    const rs = poly.map(ring),
      ps = rs.flat(),
      holes = [];
    let n = rs[0].length;
    for (const r of rs.slice(1)) {
      holes.push(n);
      n += r.length;
    }
    const ids = earcut(ps.flat(), holes, 2);
    for (let i = 0; i < ids.length; i += 3) {
      let p = ids
        .slice(i, i + 3)
        .map((k) => [ps[k][0], typeof y === 'function' ? y(...ps[k]) : y, ps[k][1]]);
      if (normalFor(...p)[1] < 0 !== down) p = p.toReversed();
      o.addTriangle(
        slot,
        'palette:#ffffff',
        p,
        normalFor(...p),
        p.map((p) => [p[0], p[2]]),
        color,
      );
    }
  }
}
function walls(o, slot, polys, lo, hi, color) {
  for (const poly of oriented(polys))
    for (const r of poly)
      for (let i = 0; i < r.length; i++) {
        const p = r[i],
          q = r[(i + 1) % r.length];
        if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.01) continue;
        const low = (p) => (typeof lo === 'function' ? lo(...p) : lo),
          ps = [
            [p[0], low(p), p[1]],
            [p[0], hi, p[1]],
            [q[0], hi, q[1]],
            [q[0], low(q), q[1]],
          ];
        quad(o, slot, ps, normalFor(...ps), color);
      }
}
function panel(o, slot, p, q, y0, y1, n, d, color, uv) {
  const P = (p, y) => [p[0] + n[0] * d, y, p[1] + n[2] * d],
    ps = [P(p, y0), P(q, y0), P(q, y1), P(p, y1)];
  o.addQuad(
    slot,
    uv ? 'metric:uv' : 'palette:#ffffff',
    ps,
    n,
    uv ?? [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    color,
  );
}
function resort(o, c) {
  const p = a.podium,
    h = a.hotel,
    w = a.lowWing,
    lo = (x, z) => Math.min(-0.6, stratGroundY(x, z) - 0.6);
  walls(o, S(c, 'wall'), p.polygons, lo, p.topY, C.wall);
  cap(o, S(c, 'roof'), c.far ? p.polygons : p.roofs, p.topY, C.roof);
  cap(o, S(c, 'wall'), p.polygons, lo, C.wall, true);
  for (const v of [h, w]) {
    walls(o, S(c, 'wall'), v.polygons, v.minY, v.topY, C.wall);
    cap(o, S(c, 'roof'), v.roofs, v.topY, C.roof);
  }
  if (c.far) return;
  for (const poly of oriented(h.polygons))
    for (const r of poly)
      for (let i = 0; i < r.length; i++) {
        const p = r[i],
          q = r[(i + 1) % r.length],
          L = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (L < 0.1) continue;
        const n = [(q[1] - p[1]) / L, 0, -(q[0] - p[0]) / L],
          P = (u) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u],
          rows = c.hotelRows,
          dy = (h.topY - h.minY) / rows,
          bays = Math.max(1, Math.round(L / (c.pitch ?? 8)));
        // Very short return/end walls remain pale;long sides carry the characteristic white floor bands.
        if (L < 14) continue;
        if (!c.panes)
          panel(o, 'glass', p, q, h.minY + 0.7, h.topY - 0.7, n, 0.035, C.glass, [
            [0, 0],
            [L / 3, 0],
            [L / 3, rows],
            [0, rows],
          ]);
        for (let row = 0; row < rows; row++) {
          const y0 = h.minY + row * dy + 0.4,
            y1 = h.minY + (row + 1) * dy - 0.25;
          if (c.panes)
            for (let k = 0; k < bays; k++) {
              const u0 = (k + 0.04) / bays,
                u1 = (k + 0.96) / bays,
                pp = P(u0),
                qq = P(u1);
              panel(o, 'glass', pp, qq, y0, y1, n, 0.065, C.glass, [
                [0.02, 0.05],
                [0.98, 0.05],
                [0.98, 0.95],
                [0.02, 0.95],
              ]);
              if (c.reveals) {
                const Q = (p, y, d) => [p[0] + n[0] * d, y, p[1] + n[2] * d],
                  ps = [
                    [pp, y0],
                    [qq, y0],
                    [qq, y1],
                    [pp, y1],
                  ];
                for (let j = 0; j < 4; j++) {
                  const p = ps[j],
                    q = ps[(j + 1) % 4],
                    v = [Q(...p, 0.065), Q(...q, 0.065), Q(...q, 0.18), Q(...p, 0.18)];
                  quad(o, 'wall', v, normalFor(...v), C.wall);
                }
              }
            }
          const y = h.minY + row * dy;
          if (c.bands)
            beam(
              o,
              'wall',
              [p[0] + n[0] * 0.18, y + 0.19, p[1] + n[2] * 0.18],
              [q[0] + n[0] * 0.18, y + 0.19, q[1] + n[2] * 0.18],
              0.45,
              0.55,
              C.wall,
            );
          else panel(o, 'wall', p, q, y, y + 0.55, n, 0.08, C.wall);
        }
        if (c.mullions)
          for (let k = 0; k <= bays; k++) {
            const pp = P(k / bays);
            beam(
              o,
              'metal',
              [pp[0] + n[0] * 0.14, h.minY, pp[1] + n[2] * 0.14],
              [pp[0] + n[0] * 0.14, h.topY, pp[1] + n[2] * 0.14],
              0.045,
              0.045,
              C.metal,
            );
          }
      }
  for (const poly of oriented(p.polygons))
    for (const r of poly)
      for (let i = 0; i < r.length; i++) {
        const p = r[i],
          q = r[(i + 1) % r.length],
          L = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (L < 3) continue;
        const n = [(q[1] - p[1]) / L, 0, -(q[0] - p[0]) / L];
        for (let j = 0; j < c.podiumBands; j++)
          panel(o, 'glass', p, q, 2.2 + j * 3.8, 4.5 + j * 3.8, n, 0.07, C.glass, [
            [0, 0],
            [Math.max(1, L / 3), 0],
            [Math.max(1, L / 3), 1],
            [0, 1],
          ]);
      }
  // Roof pool follows the actual retained swimming-pool outline;opaque stylized water adds no image.
  cap(o, 'water', a.pool.polygons, a.pool.surfaceY, C.water);
  if (c.rails) {
    walls(o, 'paving', a.pool.polygons, 24, 24.35, C.paving);
    for (const r of a.pool.polygons[0]) {
      const rr = ring(r);
      for (let i = 0; i < rr.length; i++) {
        const p = rr[i],
          q = rr[(i + 1) % rr.length];
        beam(o, 'paving', [p[0], 24.35, p[1]], [q[0], 24.35, q[1]], 0.24, 0.3, C.paving);
      }
    }
  }
  if (c.plant) {
    const inside = (p, poly) => {
      let v = false;
      for (const r of poly)
        for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
          const a = r[i],
            b = r[j];
          if (
            a[1] > p[1] !== b[1] > p[1] &&
            p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
          )
            v = !v;
        }
      return v;
    };
    let count = 0;
    for (const [polys, y] of [
      [p.roofs, 14],
      [h.roofs, 75],
      [w.roofs, 24],
    ])
      for (let x = -160; x < 170; x += 22)
        for (let z = -80; z < 90; z += 22) {
          if (
            !polys.some((poly) =>
              [
                [x - 3, z - 2],
                [x + 3, z - 2],
                [x + 3, z + 2],
                [x - 3, z + 2],
              ].every((p) => inside(p, poly)),
            ) ||
            a.pool.polygons.some((poly) => inside([x, z], poly))
          )
            continue;
          if (!c.dense && count++ % 2) continue;
          box(o, 'metal', [x - 3, y + 0.1, z - 2], [x + 3, y + 1.8, z + 2], C.metal);
          if (c.dense)
            for (let k = 0; k < 6; k++)
              box(
                o,
                'metal',
                [x - 2.8, y + 1.8, z - 1.8 + k * 0.55],
                [x + 2.8, y + 1.87, z - 1.68 + k * 0.55],
                C.dark,
              );
        }
  }
  if (c.entry) {
    const label = {
      addQuad: (s, r, p, n, u, color) =>
        o.addQuad(
          s,
          r,
          p.map((p) => [p[0] + 133, p[1], p[2] + 100.34]),
          n,
          u,
          color,
        ),
      addConvexPolygon: (s, r, p, n, u, color) =>
        o.addConvexPolygon(
          s,
          r,
          p.map((p) => [p[0] + 133, p[1], p[2] + 100.34]),
          n,
          u,
          color,
        ),
    };
    lettering(label, 'THE STRAT', {
      width: 21,
      height: 2.1,
      y: 8,
      z: 0,
      color: C.dark,
      slot: 'metal',
      stroke: 0.14,
    });
  }
}
function cylinder(o, slot, profiles, N, color, center = a.tower.center) {
  loft(
    o,
    slot,
    profiles.map(([y, r]) => radialRing(y, r, r, N, center)),
    color,
  );
}
function tower(o, c) {
  const t = a.tower,
    [cx, cz] = t.center,
    profiles = c.legSimple
      ? [t.legProfiles[0], t.legProfiles[3], t.legProfiles[5], t.legProfiles.at(-1)]
      : t.legProfiles;
  for (let k = 0; k < 3; k++) {
    const angle = t.legAngle + (k * Math.PI * 2) / 3,
      rad = [Math.cos(angle), Math.sin(angle)],
      tan = [-rad[1], rad[0]],
      R = profiles.map(([y, r, w, d], i) => {
        const center = [cx + rad[0] * r, cz + rad[1] * r],
          base = i === 0 ? Math.min(-0.6, stratGroundY(...center) - 0.6) : y;
        return [
          [-1, -1],
          [-1, 1],
          [1, 1],
          [1, -1],
        ].map(([u, v]) => [
          center[0] + (rad[0] * u * w) / 2 + (tan[0] * v * d) / 2,
          base,
          center[1] + (rad[1] * u * w) / 2 + (tan[1] * v * d) / 2,
        ]);
      });
    loft(o, S(c, 'wall'), R, C.wall);
  }
  cylinder(o, S(c, 'wall'), t.core, c.far ? 3 : 9, C.wall);
  // Circular entrance drum under the open legs,not a filled50m-wide tower column.
  cylinder(
    o,
    S(c, 'glass'),
    [
      [Math.min(-0.7, stratGroundY(cx, cz) - 0.6), 11.1],
      [17.5, 11.1],
      [18, 11.7],
    ],
    c.sides,
    C.glass,
  );
  if (!c.far) {
    for (const y of [4.5, 9, 13.5, 17.8])
      cylinder(
        o,
        'wall',
        [
          [y - 0.18, 11.3],
          [y + 0.18, 11.3],
        ],
        c.sides,
        C.wall,
      );
    if (c.entry)
      for (let i = 0; i < c.sides; i++) {
        const angle = (i * Math.PI * 2) / c.sides;
        beam(
          o,
          'metal',
          [cx + 11.2 * Math.cos(angle), 0.8, cz + 11.2 * Math.sin(angle)],
          [cx + 11.2 * Math.cos(angle), 17.6, cz + 11.2 * Math.sin(angle)],
          0.075,
          0.075,
          C.metal,
        );
      }
  }
  cylinder(
    o,
    S(c, 'wall'),
    [
      [238.6, 16.4],
      [240.4, 17.3],
    ],
    c.sides,
    C.wall,
  );
  // The lower lattice cone and main sloping observation glazing use separate physical bands.
  for (let i = 1; i < t.pod.length; i++) {
    const lo = t.pod[i - 1],
      hi = t.pod[i],
      glazed = lo[0] >= 240 && hi[0] <= 264;
    const N = c.sides;
    for (let k = 0; k < N; k++) {
      const u0 = (-k * Math.PI * 2) / N,
        u1 = (-(k + 1) * Math.PI * 2) / N,
        P = (y, r, u) => [cx + r * Math.cos(u), y, cz + r * Math.sin(u)],
        p = [P(...lo, u0), P(...lo, u1), P(...hi, u1), P(...hi, u0)];
      o.addQuad(
        S(c, glazed ? 'glass' : 'metal'),
        'metric:uv',
        p,
        normalFor(...p),
        [
          [0, 0],
          [1, 0],
          [1, (hi[0] - lo[0]) / 3],
          [0, (hi[0] - lo[0]) / 3],
        ],
        glazed ? C.glass : C.dark,
      );
    }
  }
  cap(
    o,
    S(c, 'metal'),
    [[ring(radialRing(281, 9, 9, c.sides, t.center).map((p) => [p[0], p[2]]))]],
    281,
    C.dark,
  );
  if (!c.far) {
    for (const [y, r] of [
      [242, 17.6],
      [250.2, 20.5],
      [254, 21.6],
      [258, 23.4],
      [263, 25.9],
      [265, 26.1],
      [269, 18],
    ])
      cylinder(
        o,
        'metal',
        [
          [y - 0.13, r],
          [y + 0.13, r],
        ],
        c.sides,
        C.metal,
      );
    for (let k = 0; k < c.lattice; k++) {
      const u = (k * Math.PI * 2) / c.lattice,
        v = ((k + 1) * Math.PI * 2) / c.lattice,
        P = (y, r, a) => [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
      beam(o, 'metal', P(240.6, 17.5, u), P(250, 20.7, v), 0.18, 0.18, C.metal);
      beam(o, 'metal', P(240.6, 17.5, v), P(250, 20.7, u), 0.18, 0.18, C.metal);
    }
    if (c.rails) {
      for (const [y, r] of [
        [266, 24.4],
        [281, 8.8],
      ]) {
        torus(o, 'metal', [cx, y + 0.95, cz], r, 0.06, C.metal, c.sides, 4);
        for (let k = 0; k < 24; k++) {
          const u = (k * Math.PI * 2) / 24;
          beam(
            o,
            'metal',
            [cx + r * Math.cos(u), y, cz + r * Math.sin(u)],
            [cx + r * Math.cos(u), y + 1, cz + r * Math.sin(u)],
            0.055,
            0.055,
            C.metal,
          );
        }
      }
    }
  }
  // Tall red/white mast:static platform/carriage representation;no ride simulation or operating-state claim.
  const steps = c.mast ?? 1,
    top = t.mastLatticeTopY,
    base = t.mastBaseY;
  for (let j = 0; j < steps; j++) {
    const y0 = base + ((top - base) * j) / steps,
      y1 = base + ((top - base) * (j + 1)) / steps,
      r0 = 1.6 - (j / steps) * 0.65,
      r1 = 1.6 - ((j + 1) / steps) * 0.65,
      color = j % 2 ? C.wall : C.red;
    for (let k = 0; k < 3; k++) {
      const u = (k * Math.PI * 2) / 3,
        v = ((k + 1) * Math.PI * 2) / 3,
        P = (r, y, a) => [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
      beam(
        o,
        S(c, 'metal'),
        P(r0, y0, u),
        P(r1, y1, u),
        c.far ? 0.35 : 0.18,
        c.far ? 0.35 : 0.18,
        color,
      );
      if (c.mast) {
        beam(o, 'metal', P(r0, y0, u), P(r1, y1, v), 0.1, 0.1, color);
        beam(o, 'metal', P(r0, y0, v), P(r1, y1, u), 0.1, 0.1, color);
      }
    }
  }
  cylinder(
    o,
    S(c, 'metal'),
    [
      [330, 0.32],
      [344, 0.25],
      [350, 0.09],
    ],
    c.far ? 4 : 8,
    C.wall,
  );
  if (c.entry) {
    cylinder(
      o,
      'metal',
      [
        [281, 4],
        [281.45, 4],
        [283, 2.8],
      ],
      c.sides,
      C.metal,
    );
    for (let i = 0; i < 16; i++) {
      const u = (i * Math.PI * 2) / 16,
        x = cx + 3 * Math.cos(u),
        z = cz + 3 * Math.sin(u);
      box(o, 'metal', [x - 0.26, 281.5, z - 0.26], [x + 0.26, 282.8, z + 0.26], C.dark);
    }
  }
}
export function buildStratLevel(o, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown STRAT level:' + level);
  resort(o, c);
  tower(o, c);
}
export const buildStratSkyline = (o) => buildStratLevel(o, 'skyline');
export const buildStratDistrict = (o) => buildStratLevel(o, 'district');
export const buildStratStreet = (o) => buildStratLevel(o, 'street');
export const buildStratCloseup = (o) => buildStratLevel(o, 'closeup');
