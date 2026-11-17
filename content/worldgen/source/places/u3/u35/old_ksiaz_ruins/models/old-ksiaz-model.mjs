/** Original roofless masonry interpretation using the ruin's own mapped wall traces. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

export const oldKsiazModels = [
  {
    id: 'KSI_R01',
    key: 'old_ksiaz_ruins',
    title: 'Old Książ ruins',
    way: 239074431,
    component: 'old-ksiaz',
    wikidata: 'Q9386558',
    brief:
      'Roofless masonry ruins with Gothic window openings, a dressed-stone portal and stairs, and a trail breach through the hillside return wall.',
    primaryDescription:
      'Independent Stary Książ ruin, own way/239074431, Q9386558 and NID A/5214/621. The surviving masonry follows exterior photographs and a courtyard panorama.',
    references: [
      'https://www.ksiaz.walbrzych.pl/turystyka/zamek',
      'https://commons.wikimedia.org/wiki/File:Old_Ksi%C4%85%C5%BC_Castle_02.JPG',
      'https://commons.wikimedia.org/wiki/File:Stary_Ksi%C4%85%C5%BC_8.jpg',
      'https://cit.walbrzych.pl/miejsce/stary-ksiaz/',
    ],
    cameras: [
      { name: 'portal-and-broken-high-wall', position: [42, 23, -38], lookAt: [0, 4, 0] },
      { name: 'pointed-windows-and-open-court', position: [-35, 26, -40], lookAt: [-4, 4, 0] },
      { name: 'roofless-wall-traces', position: [4, 105, 4], lookAt: [0, 2, 0] },
      { name: 'lower-courtyards-and-returns', position: [36, 23, 40], lookAt: [0, 3, 0] },
    ],
  },
];
export const oldKsiazSurfaces = {
  rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.94, metallic: 0 },
  brick: { slot: 'trim', graph: 'brick', roughness: 0.9, metallic: 0 },
  dressed: { slot: 'trim', graph: 'stone_limestone', roughness: 0.87, metallic: 0 },
};
export const oldKsiazPalette = { stone: '#d7c7a8', brick: '#c58d70', portal: '#cbd1ce' };
const colors = Object.fromEntries(
  Object.entries(oldKsiazPalette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const dir = new URL('../', import.meta.url);
const frame = JSON.parse(readFileSync(new URL('map-frame.json', dir)));
const means = JSON.parse(readFileSync(new URL('surface-means.json', dir)));

function face(o, points, color = 'stone', slot = 'rubble', target) {
  const p = points.map((v) => v.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    let t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (target && n.reduce((s, v, j) => s + v * target[j], 0) < 0) {
      t = [t[0], t[2], t[1]];
      n = normalFor(...t);
    }
    const a = t[1].map((v, j) => v - t[0][j]),
      b = t[2].map((v, j) => v - t[0][j]);
    if (
      Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) <
      1e-8
    )
      continue;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => [v[0], v[1]]),
      colors[color],
    );
  }
}
function wallSpace(o, a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    ux = (b[0] - a[0]) / length,
    uz = (b[1] - a[1]) / length;
  return {
    length,
    q: {
      addTriangle: (s, r, p, n, uv, col) =>
        o.addTriangle(
          s,
          r,
          p.map(([x, y, z]) => [a[0] + ux * x - uz * z, y, a[1] + uz * x + ux * z]),
          [ux * n[0] - uz * n[2], n[1], uz * n[0] + ux * n[2]],
          uv,
          col,
        ),
    },
  };
}
/** Closed wall slab with real holes and solid reveal surfaces on both sides. */
function pierced(o, profile, holes, depth) {
  const all = [...profile, ...holes.flat()],
    starts = holes.map(
      (_, i) => profile.length + holes.slice(0, i).reduce((s, h) => s + h.length, 0),
    ),
    ix = earcut(all.flat(), starts, 2);
  for (let i = 0; i < ix.length; i += 3)
    for (const z of [-depth / 2, depth / 2])
      face(
        o,
        ix.slice(i, i + 3).map((k) => [...all[k], z]),
        'stone',
        'rubble',
        [0, 0, Math.sign(z)],
      );
  for (const ring of [profile, ...holes])
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        hole = ring !== profile,
        n = hole ? [a[1] - b[1], b[0] - a[0], 0] : [b[1] - a[1], a[0] - b[0], 0];
      face(
        o,
        [
          [...a, -depth / 2],
          [...b, -depth / 2],
          [...b, depth / 2],
          [...a, depth / 2],
        ],
        'stone',
        'rubble',
        n,
      );
    }
}
function rectangle(x, y, w, h) {
  return [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ];
}
function pointed(x, y, w, h, n) {
  const half = w / 2,
    spring = y + h - w * 0.72;
  const cap = Array.from({ length: n + 1 }, (_, i) => {
    const t = -1 + (2 * i) / n;
    return [x + half * t, spring + w * 0.72 * (1 - Math.pow(Math.abs(t), 1.35))];
  });
  return [[x - half, y], [x + half, y], ...cap.toReversed()];
}
function round(x, y, w, h, n) {
  const r = w / 2,
    spring = y + h - r;
  return [
    [x - r, y],
    [x + r, y],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const a = (i * Math.PI) / n;
      return [x + r * Math.cos(a), spring + r * Math.sin(a)];
    }),
  ];
}
function outlineTrim(o, hole, width, depth, slot, color, sides = [-1, 1]) {
  // Offset a sampled loop from its center. Avoid per-stone meshes and tiny joints.
  const cx = (Math.min(...hole.map((p) => p[0])) + Math.max(...hole.map((p) => p[0]))) / 2;
  const cy = (Math.min(...hole.map((p) => p[1])) + Math.max(...hole.map((p) => p[1]))) / 2;
  const rx = Math.max(...hole.map((p) => Math.abs(p[0] - cx))),
    ry = Math.max(...hole.map((p) => Math.abs(p[1] - cy)));
  const outer = hole.map(([x, y]) => [
    cx + (x - cx) * (1 + width / rx),
    cy + (y - cy) * (1 + width / ry),
  ]);
  for (let i = 0; i < hole.length; i++) {
    const j = (i + 1) % hole.length;
    for (const sign of sides) {
      const z = sign * (depth / 2 + 0.015);
      face(
        o,
        [
          [...hole[i], z],
          [...hole[j], z],
          [...outer[j], z],
          [...outer[i], z],
        ],
        color,
        slot,
        [0, 0, Math.sign(z)],
      );
    }
  }
}
function brokenProfile(start, end, base, height, phase, steps) {
  const stations = Array.from({ length: steps + 1 }, (_, i) => start + ((end - start) * i) / steps);
  return [
    ...stations.map((x) => [x, base(x)]),
    ...stations
      .toReversed()
      .map((x, i) => [
        x,
        height(x) + 0.18 * Math.cos(i * 2.7 + phase) + 0.11 * Math.sin(i * 4.3 + phase),
      ]),
  ];
}
function ledge(o, length, y, depth, rise = 0) {
  face(
    o,
    [
      [0, y, depth / 2 + 0.07],
      [length, y + rise, depth / 2 + 0.07],
      [length, y + rise + 0.15, depth / 2 + 0.07],
      [0, y + 0.15, depth / 2 + 0.07],
    ],
    'portal',
    'dressed',
    [0, 0, 1],
  );
  face(
    o,
    [
      [0, y + 0.15, depth / 2],
      [length, y + rise + 0.15, depth / 2],
      [length, y + rise + 0.15, depth / 2 + 0.07],
      [0, y + 0.15, depth / 2 + 0.07],
    ],
    'portal',
    'dressed',
    [0, 1, 0],
  );
}
function portalLandings(o, portal, wallDepth) {
  for (const { side, depth, toe, steps } of portal.sides) {
    const near = wallDepth / 2 - 0.02,
      start = 0.81,
      transition = depth - 0.14;
    const rows = [[near, [0, 0]]];
    let level = [0, 0];
    for (let i = 1; i <= steps; i++) {
      const z = start + ((transition - start) * (i - 1)) / steps;
      const below = toe.map((height) => ((height + 0.045) * i) / steps);
      rows.push([z, level], [z, below]);
      level = below;
    }
    rows.push([transition, level], [depth, toe]);
    const bottom = Math.min(0, ...toe) - 0.31;
    const V = (x, y, z) => [portal.offset + (x * portal.width) / 2, y, side * z];
    for (let i = 1; i < rows.length; i++) {
      const [az, a] = rows[i - 1],
        [bz, b] = rows[i];
      face(
        o,
        [V(-1, a[0], az), V(1, a[1], az), V(1, b[1], bz), V(-1, b[0], bz)],
        'stone',
        'dressed',
        az === bz ? [0, 0, side] : [0, 1, 0],
      );
      if (az !== bz)
        for (const [j, x] of [-1, 1].entries())
          face(
            o,
            [V(x, bottom, az), V(x, bottom, bz), V(x, b[j], bz), V(x, a[j], az)],
            'stone',
            'rubble',
            [x, 0, 0],
          );
    }
  }
  const x = portal.offset,
    w = portal.width / 2,
    z = wallDepth / 2;
  face(
    o,
    [
      [x - w, 0, -z],
      [x + w, 0, -z],
      [x + w, 0, z],
      [x - w, 0, z],
    ],
    'stone',
    'dressed',
    [0, 1, 0],
  );
}
export function buildOldKsiaz(o, key = 'old_ksiaz_ruins', level = 'closeup') {
  if (key !== 'old_ksiaz_ruins') throw Error(`Unknown ruin ${key}`);
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  if (d === undefined) throw Error(`Unknown level ${level}`);
  const c = frame.controls,
    thickness = c.wallThickness,
    steps = d < 2 ? 4 : d === 2 ? 8 : 14;
  const fit = frame.siteFit;
  for (const [traceIndex, trace] of frame.geometry.centerlines.entries())
    for (let i = 0; i < trace.points.length - 1; i++) {
      const { q, length } = wallSpace(o, trace.points[i], trace.points[i + 1]);
      const { rows, gaps } = fit.walls[traceIndex].segments[i];
      const ground = (x, field) => {
        const t = (x * (rows.length - 1)) / length;
        const j = Math.min(rows.length - 2, Math.floor(t));
        return rows[j][field] + (rows[j + 1][field] - rows[j][field]) * (t - j);
      };
      const base = (x) => ground(x, 'base');
      const main = trace.way === c.mainFacadeWay,
        north = trace.way === c.northFacadeWay && i === c.northFacadeSegment;
      const holes = [];
      let profile;
      if (main) {
        // Unequal surviving heights: tallest broken portion opposite the dressed portal.
        const crown = [
          [length, 7.7],
          [length * 0.89, 7.75],
          [length * 0.77, 8.05],
          [length * 0.68, 9.7],
          [length * 0.5, 10.4],
          [length * 0.34, 10.12],
          [length * 0.19, 9.9],
          [0, 7.8],
        ];
        const chippedCrown =
          d === 3
            ? crown.flatMap(([x, y], j) => {
                const next = crown[j + 1];
                return next
                  ? [
                      [x, y],
                      [(x + next[0]) / 2, (y + next[1]) / 2 - 0.12],
                    ]
                  : [[x, y]];
              })
            : crown;
        profile = [
          ...rows.map(({ base }, j) => [(length * j) / (rows.length - 1), base]),
          ...chippedCrown.map(([x, y]) => [x, y - c.courtyardHeight]),
        ];
        const portal = round(fit.portal.offset, 0, 1.58, 2.6, d < 2 ? 6 : steps + 2);
        holes.push(
          portal,
          pointed(length * 0.21, 3.55, 1.13, 2.2, steps),
          pointed(length * 0.47, 3.55, 1.13, 2.2, steps),
          pointed(length * 0.78, 3.55, 1.13, 2.2, steps),
        );
        if (d >= 1)
          holes.push(
            rectangle(length * 0.19, 0.6, 0.75, 1.35),
            rectangle(length * 0.43, 0.6, 0.75, 1.35),
            rectangle(length * 0.94, 0.6, 0.55, 1.35),
          );
        pierced(q, profile, holes, thickness);
        outlineTrim(q, portal, d < 2 ? 0.2 : 0.32, thickness, 'dressed', 'portal', [1]);
        if (d === 3) outlineTrim(q, portal, 0.09, thickness + 0.08, 'dressed', 'portal', [1]);
        portalLandings(q, fit.portal, thickness);
        if (d >= 1)
          for (const h of holes.slice(1)) outlineTrim(q, h, 0.14, thickness, 'brick', 'brick');
        if (d >= 2) {
          ledge(q, length, 3.0, thickness);
          ledge(q, 2.75, 2.54, thickness);
        }
      } else if (north) {
        const rise = fit.galleryFloor[1] - fit.galleryFloor[0];
        const floor = (t) => fit.galleryFloor[0] + t * rise;
        profile = brokenProfile(
          0,
          length,
          base,
          (x) => floor(x / length) + c.northWallHeight - c.courtyardHeight,
          0.4,
          d < 2 ? 6 : d === 2 ? 18 : 26,
        );
        for (const t of [0.1, 0.24, 0.42, 0.61, 0.79])
          holes.push(pointed(length * t, floor(t) + 1.95, 1.28, 2.35, steps));
        holes.push(
          rectangle(length * 0.32, floor(0.32) + 0.11, 0.97, 3.0),
          rectangle(length * 0.91, floor(0.91) + 0.11, 0.97, 3.0),
        );
        if (d >= 1)
          for (const t of [0.12, 0.56, 0.75])
            holes.push(rectangle(length * t, floor(t) - 0.48, 0.7, 1.0));
        pierced(q, profile, holes, thickness);
        if (d >= 1) for (const h of holes) outlineTrim(q, h, 0.12, thickness, 'brick', 'brick');
        if (d >= 2) ledge(q, length, floor(0) + 0.9, thickness, rise);
      } else {
        const height =
          trace.way === 898350440
            ? i === 0
              ? 3.7
              : 4.3
            : trace.way === 805533437
              ? 2.6
              : i === 3
                ? 4.5
                : i === 4
                  ? 3.8
                  : 3.3;
        const intervals = [0, ...gaps.flat(), length];
        for (let j = 1; j < intervals.length; j += 2) {
          const start = intervals[j - 1],
            end = intervals[j],
            span = end - start;
          const grade = (x) => ground(x, 'grade');
          const discontinuity = gaps.length ? 0.75 : 0;
          const rump = (x) => grade(x) + height - discontinuity;
          const range = brokenProfile(
            start,
            end,
            base,
            rump,
            (trace.way % 17) + i,
            d < 2 ? Math.max(2, Math.ceil(span / 6)) : Math.max(3, Math.ceil(span / 1.8)),
          );
          const windows = [];
          if (span > 5.5 && d >= 1)
            for (let x = start + 2; x < end - 1.5; x += 3.4)
              windows.push(rectangle(x, grade(x) + 0.7, 0.7, 1.15));
          pierced(q, range, windows, thickness * 0.86);
          if (d >= 2)
            for (const h of windows) outlineTrim(q, h, 0.12, thickness * 0.86, 'brick', 'brick');
        }
      }
    }
}
export function buildOldKsiazSkyline(o, key = 'old_ksiaz_ruins') {
  buildOldKsiaz(
    {
      addTriangle: (s, r, p, n, uv, col) =>
        o.addTriangle(
          'silhouette',
          r,
          p,
          n,
          uv,
          col.map((v, i) => v * (means[s]?.[i] ?? 1)),
        ),
    },
    key,
    'skyline',
  );
}
