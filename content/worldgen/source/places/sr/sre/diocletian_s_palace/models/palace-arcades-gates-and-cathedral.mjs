import { openArcade } from '../../../../../../../../packages/worldgen/scripts/courtyard-landmark-geometry.mjs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  spire,
  tower,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../palace-plan.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.9 },
  column: { slot: 'trim', graph: 'stone_granite', roughness: 0.77 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.92 },
  dark: { slot: 'trim', graph: 'stone_basalt_raw', roughness: 0.93 },
};
const cream = rgb('cabda6'),
  pale = rgb('dbcebb'),
  weathered = rgb('b2a48a');
const warm = rgb('b6a090'),
  red = rgb('9d6552'),
  roof = rgb('ac7058'),
  dark = rgb('544e45');
const rotation = Math.atan2(site.east[1], site.east[0]);
const width = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const normal = (a, b) => [(b[0] - a[0]) / width(a, b), (b[1] - a[1]) / width(a, b)];
const center = (ring) =>
  ring.reduce(([x, z], p) => [x + p[0] / ring.length, z + p[1] / ring.length], [0, 0]);
const foot = (f, u, d = 0) => {
  const [x, , z] = f.P(u, 0, d);
  return [x, z];
};
const band = (out, slot, f, u, U, y, Y, d, D, color) =>
  fbox(out, slot, f, u, U, y, Y, d, D, color, { bottom: true });
const block = (out, slot, c, rx, rz, y, Y, color) =>
  band(out, slot, facade(c, site.east), -rx, rx, y, Y, -rz, rz, color);
const polygon = (c, radius, sides, angle = rotation) =>
  Array.from({ length: sides }, (_, i) => {
    const theta = angle + (Math.PI * 2 * i) / sides;
    return [c[0] + radius * Math.cos(theta), c[1] + radius * Math.sin(theta)];
  });
const faceList = (ring) => {
  const r = outwardRing(ring);
  return r.map((p, i) => wallFace(p, r[(i + 1) % r.length]));
};
function trimArch(out, f, u, y, r, thick, d, steps, rise = 1) {
  const points = roundArch(1, steps);
  for (let i = 1; i < points.length; i++) {
    const [a, b] = points[i - 1],
      [c, e] = points[i];
    quad4(
      out,
      'trim',
      f.P(u + r * a, y + r * b * rise, d),
      f.P(u + r * c, y + r * e * rise, d),
      f.P(u + (r + thick) * c, y + (r + thick) * e * rise, d),
      f.P(u + (r + thick) * a, y + (r + thick) * b * rise, d),
      pale,
    );
  }
}
function capital(out, c, r, y, level) {
  lathe(
    out,
    'trim',
    c,
    [
      [y, r * 0.72, r * 0.72],
      [y + 0.16, r * 0.87, r * 0.87],
      [y + 0.37, r, r],
      [y + 0.51, r, r],
    ],
    level > 1 ? 8 : 4,
    pale,
    { rotation: rotation + Math.PI / 4 },
  );
  if (level > 2) {
    for (const [x, z] of polygon(c, r * 0.72, 8))
      lathe(
        out,
        'trim',
        [x, z],
        [
          [y + 0.05, 0.046, 0.046],
          [y + 0.24, 0.135, 0.135],
          [y + 0.4, 0.1, 0.1],
        ],
        4,
        cream,
        { capTop: false },
      );
  }
}
function column(out, c, y, Y, r, color, level) {
  const facets = level > 1 ? 10 : 4;
  lathe(
    out,
    'column',
    c,
    [
      [y, r * 1.15, r * 1.15],
      [y + 0.17, r * 1.15, r * 1.15],
      [y + 0.21, r, r],
      [Y - 0.51, r * 0.84, r * 0.84],
    ],
    facets,
    color,
    { capTop: false },
  );
  if (level) capital(out, c, r * 1.25, Y - 0.51, level);
}
function cathedral(out, level) {
  const ring = site.mausoleum;
  const c = center(ring),
    shrink = (k) => ring.map(([x, z]) => [c[0] + (x - c[0]) * k, c[1] + (z - c[1]) * k]);
  extrude(out, 'stone', ring, -1.48, 1.28, weathered);
  extrude(out, 'trim', shrink(0.95), 1.28, 1.55, pale);
  extrude(out, 'stone', shrink(0.74), 1.54, 13.94, cream);
  extrude(out, 'trim', shrink(0.86), 9.54, 9.86, pale);
  extrude(out, 'stone', shrink(0.88), 9.85, 10.08, weathered);
  extrude(out, 'trim', shrink(0.77), 13.53, 14.28, pale);
  const outer = shrink(0.793);
  const top = outer.map(([x, z]) => [x, 14.28, z]);
  for (let i = 0; i < top.length; i++) {
    const a = top[i],
      b = top[(i + 1) % top.length];
    quad4(
      out,
      'roof',
      b,
      a,
      [c[0] + (a[0] - c[0]) * 0.24, 17.22, c[1] + (a[2] - c[1]) * 0.24],
      [c[0] + (b[0] - c[0]) * 0.24, 17.22, c[1] + (b[2] - c[1]) * 0.24],
      roof,
    );
  }
  extrude(out, 'roof', shrink(0.19), 16.95, 17.24, roof);
  if (level)
    for (const f of faceList(shrink(0.89))) {
      column(out, foot(f, f.length * 0.5), 1.55, 9.52, 0.58, warm, level);
      const r = 0.58;
      const back = facade(foot(f, f.length * 0.5, -1), f.along);
      opening(out, back, 0, 10.53, 2 * r, 1.88, {
        head: 'round',
        glassSlot: 'dark',
        frame: pale,
        glass: dark,
        frameWidth: 0.12,
        d: 0.05,
        steps: level > 2 ? 8 : 4,
      });
    }
  const annex = site.annex;
  extrude(out, 'stone', annex, -1.31, 7.48, cream, { topSlot: 'roof', topColor: roof });
  const t = site.towerCenter;
  extrude(out, 'stone', site.towerRing, -1.15, 11.75, cream);
  for (const [y, h, half] of [
    [11.72, 6.01, 3.05],
    [17.69, 6.52, 2.9],
    [24.17, 6.15, 2.72],
    [30.27, 6.21, 2.54],
    [36.44, 6.16, 2.27],
  ]) {
    const ring = polygon(t, half * Math.SQRT2, 4, rotation + Math.PI / 4);
    const rim = half + 0.23;
    block(out, 'trim', t, rim, rim, y, y + 0.43, pale);
    block(out, 'trim', t, rim, rim, y + h - 0.45, y + h + 0.1, cream);
    for (const f of faceList(ring)) {
      const count = y < 17 ? 1 : 2;
      openArcade(out, f, {
        count,
        bottom: y + 0.43,
        top: y + h - 0.45,
        spring: y + h * (count === 1 ? 0.52 : 0.64),
        depth: 0.66,
        slot: 'stone',
        color: cream,
        steps: level ? 6 : 3,
        openRatio: 0.37,
      });
      if (level > 1) {
        for (let i = 0; i < count; i++) {
          const bay = f.length / count,
            u = (i + 0.5) * bay,
            r = 0.37 * bay;
          trimArch(out, f, u, y + h * (count === 1 ? 0.52 : 0.64), r, 0.15, 0.012, 7);
          column(
            out,
            foot(f, u - r - 0.07, 0.065),
            y + 0.47,
            y + h * (count === 1 ? 0.52 : 0.64),
            0.16,
            warm,
            0,
          );
        }
      }
    }
  }
  const lantern = polygon(t, 2.56, 8);
  for (const f of faceList(lantern))
    openArcade(out, f, {
      count: 1,
      bottom: 42.59,
      top: 47.64,
      spring: 45.91,
      depth: 0.46,
      slot: 'trim',
      color: pale,
      steps: level > 1 ? 7 : 3,
      openRatio: 0.36,
    });
  tower(out, 'trim', t, 2.74, 8, 47.6, 48.12, cream, { rotation });
  spire(out, 'stone', t, 2.67, 8, 48.11, 6.5, cream, { rotation });
  if (level) {
    block(out, 'dark', t, 0.072, 0.072, 54.53, 56.29, dark);
    block(out, 'dark', t, 0.37, 0.076, 55.56, 55.68, dark);
  }
}
function peristyle(out, level) {
  const [a, b] = site.arcade,
    f = wallFace(a, b);
  const l = f.length;
  const place = (u, d) => foot(f, u, d);
  for (const [depth, height] of [
    [0.61, 0.21],
    [0.43, 0.41],
    [0.22, 0.65],
  ]) {
    band(out, 'stone', f, 0, l, 0.04, height, -1.33, depth, weathered);
  }
  const bay = l / 6,
    s = level > 1 ? 10 : level ? 6 : 3;
  for (let i = 0; i <= 6; i++) {
    const u = i * bay;
    band(out, 'trim', f, u - 0.59, u + 0.59, 0.65, 0.94, -0.62, 0.55, pale);
    column(out, place(u, 0), 0.94, 7.3, 0.41, i === 0 || i === 6 ? cream : warm, level);
  }
  openArcade(out, f, {
    count: 6,
    bottom: 7.29,
    top: 10.57,
    spring: 7.49,
    depth: 0.76,
    slot: 'stone',
    color: cream,
    steps: s,
    openRatio: 0.46,
  });
  if (level)
    for (let i = 0; i < 6; i++) trimArch(out, f, (i + 0.5) * bay, 7.49, 0.46 * bay, 0.23, 0.04, s);
  band(out, 'trim', f, -0.38, l + 0.38, 10.56, 10.96, -1.05, 0.34, pale);
  if (level) band(out, 'stone', f, -0.48, l + 0.48, 10.72, 11.09, -0.93, 0.5, weathered);
  const port = wallFace(...site.portico);
  const w = port.length;
  for (const [reach, h] of [
    [0.65, 0.42],
    [0.42, 0.71],
    [0.2, 0.99],
  ])
    band(out, 'trim', port, -0.22, w + 0.22, -0.11, h, -2.8, reach, cream);
  for (const u of [0.6, w * 0.26, w * 0.74, w - 0.6])
    column(out, foot(port, u), 0.99, 9.4, 0.54, warm, level);
  for (const [u, U] of [
    [-0.15, w * 0.25],
    [w * 0.75, w + 0.15],
  ])
    band(out, 'trim', port, u, U, 9.38, 11.15, -0.72, 0.31, pale);
  openArcade(out, port, {
    count: 1,
    start: w * 0.25,
    end: w * 0.75,
    bottom: 8.65,
    top: 11.65,
    spring: 8.46,
    depth: 0.77,
    slot: 'stone',
    color: cream,
    steps: s,
    openRatio: 0.47,
  });
  if (level) trimArch(out, port, w * 0.5, 8.46, w * 0.5 * 0.47, 0.18, 0.024, s);
  const face = (u, y) => port.P(u, y, 0.22);
  quad4(
    out,
    'trim',
    face(-0.27, 10.98),
    face(w + 0.27, 10.98),
    face(w * 0.6, 12.5),
    face(w * 0.4, 12.5),
    pale,
  );
  quad4(
    out,
    'trim',
    face(w * 0.4, 12.5),
    face(w * 0.6, 12.5),
    face(w * 0.51, 13.19),
    face(w * 0.49, 13.19),
    cream,
  );
  gableRoof(
    out,
    'roof',
    foot(port, w * 0.5, 0.4),
    foot(port, w * 0.5, -3),
    w + 0.48,
    11.11,
    13.41,
    roof,
    { overhang: 0.16, endSlot: 'stone', endColor: cream },
  );
}
function vestibule(out, level) {
  const { vestibule: ring, oculus: h, domeCenter: c } = site;
  const facets = level > 1 ? 32 : 16;
  for (const [outer, ...holes] of site.vestibuleOpen)
    extrude(out, 'stone', outer, -1.92, 3.86, weathered, { holes });
  extrude(out, 'stone', ring, 3.85, 8.83, weathered, { holes: [h] });
  const top = polygon(c, 3.74, facets),
    base = polygon(c, 5.26, facets);
  const baseOuter = polygon(c, 5.93, facets),
    topOuter = polygon(c, 4.39, facets);
  for (let i = 0; i < facets; i++) {
    const j = (i + 1) % facets;
    const v = (r, k, y) => [r[k][0], y, r[k][1]];
    quad4(out, 'brick', v(base, i, 8.8), v(base, j, 8.8), v(top, j, 14.93), v(top, i, 14.89), warm);
    quad4(
      out,
      'stone',
      v(baseOuter, j, 8.8),
      v(baseOuter, i, 8.8),
      v(topOuter, i, 14.89),
      v(topOuter, j, 14.93),
      weathered,
    );
    quad4(
      out,
      'trim',
      v(top, i, 14.89),
      v(top, j, 14.93),
      v(topOuter, j, 14.93),
      v(topOuter, i, 14.89),
      cream,
    );
  }
  // Both portals cut the rectangular ruin below the retained upper dome.
  // The circle is open to the small floor from the top at every level.
}
function temple(out, level) {
  const ring = site.temple,
    c = center(ring);
  const [a, b] = site.templeAxis;
  const f = facade(c, [a, b]);
  const projection = (p) => [
    (p[0] - c[0]) * a + (p[1] - c[1]) * b,
    -(p[0] - c[0]) * b + (p[1] - c[1]) * a,
  ];
  const uv = ring.map(projection);
  const u = Math.min(...uv.map((p) => p[0])),
    U = Math.max(...uv.map((p) => p[0]));
  const v = Math.min(...uv.map((p) => p[1])),
    V = Math.max(...uv.map((p) => p[1]));
  const hull = ring.map((p) => [c[0] + (p[0] - c[0]) * 0.985, c[1] + (p[1] - c[1]) * 0.985]);
  extrude(out, 'stone', ring, -1.51, 0.89, weathered);
  extrude(out, 'stone', hull, 0.89, 7.24, cream, { top: false });
  gableRoof(out, 'roof', foot(f, u, 0), foot(f, U, 0), V - v, 7.22, 9.49, roof, {
    overhang: 0.1,
    endSlot: 'trim',
    endColor: pale,
  });
  if (level) {
    const facing = facade(foot(f, U, 0.0), [-b, a]);
    opening(out, facing, 0, 1.03, 2.25, 4.82, {
      glassSlot: 'dark',
      frame: pale,
      glass: dark,
      frameWidth: 0.17,
      d: 0.11,
      steps: 7,
    });
    for (let i = 0; i < 5; i++)
      band(out, 'trim', f, U + i * 0.17, U + 0.86, -0.02, 0.89 - i * 0.166, -1.53, 1.53, cream);
  }
}
function gate(out, g, level) {
  const { name, axis, center: c, grade: y, half: w, depth: d, passage: r, spring } = g;
  const n = name === 'gold' || name === 'silver' ? -1 : 1;
  const f = facade(c, [axis[0] * n, axis[1] * n]);
  const front = facade(foot(f, 0, d * 0.5), f.along);
  const steps = level > 1 ? 12 : level ? 7 : 4;
  const h = { gold: 11.3, silver: 7.68, bronze: 6.18, iron: 6.34 }[name];
  const radiusRatio = r / (2 * w);
  const arcade = (params) =>
    openArcade(out, front, { slot: 'stone', color: cream, steps, depth: d, ...params });
  arcade({
    count: 1,
    start: -w,
    end: w,
    bottom: y - 0.91,
    top: y + h,
    spring: y + spring,
    openRatio: radiusRatio,
  });
  band(out, 'trim', front, -w, w, y + h - 0.12, y + h + 0.28, -d - 0.15, 0.22, pale);
  if (level) {
    trimArch(out, front, 0, y + spring, r, 0.26, 0.065, steps);
    for (const u of [-r - 0.18, r + 0.18])
      band(out, 'trim', front, u - 0.1, u + 0.1, y + 0.8, y + spring, -0.035, 0.17, pale);
  }
  if (name === 'silver') {
    band(out, 'trim', front, -r, r, y + 3.21, y + 3.74, -d * 0.49, 0.05, pale);
    arcade({
      count: 4,
      start: -w + 0.14,
      end: w - 0.14,
      bottom: y + h + 0.27,
      top: y + h + 4.84,
      spring: y + h + 3.36,
      openRatio: 0.3,
    });
    band(out, 'trim', front, -w - 0.12, w + 0.12, y + h + 4.61, y + h + 5.17, -d - 0.2, 0.29, pale);
  } else if (name === 'gold') {
    band(out, 'brick', front, -w, w, y + h + 0.28, y + h + 1.73, -d, 0, red);
    band(out, 'brick', front, -w, w, y + h + 2.26, y + h + 2.48, -d, 0, red);
    for (let i = 0; i < 8; i++) {
      const x = -w + i * w * 0.25;
      band(out, 'brick', front, x, x + 0.46, y + h + 1.72, y + h + 2.27, -d, 0, red);
    }
    if (level)
      for (let i = 0; i < 7; i++) {
        const u = (i - 3) * 2.16,
          rn = 0.88;
        trimArch(out, front, u, y + 9.52, rn, 0.15, 0.075, steps);
        for (const dx of [-rn - 0.07, rn + 0.07]) {
          band(
            out,
            'trim',
            front,
            u + dx - 0.1,
            u + dx + 0.1,
            y + 7.67,
            y + 9.53,
            -0.02,
            0.24,
            pale,
          );
          band(
            out,
            'trim',
            front,
            u + dx - 0.18,
            u + dx + 0.18,
            y + 9.37,
            y + 9.54,
            -0.04,
            0.3,
            pale,
          );
        }
        band(out, 'trim', front, u - rn, u + rn, y + 7.54, y + 7.74, -0.03, 0.31, pale);
      }
  } else if (name === 'iron') {
    band(
      out,
      'stone',
      front,
      -w * 0.47,
      w * 0.47,
      y + h + 0.27,
      y + h + 6.38,
      -d - 0.32,
      0.24,
      cream,
    );
    band(
      out,
      'trim',
      front,
      -w * 0.54,
      w * 0.54,
      y + h + 6.36,
      y + h + 6.71,
      -d - 0.46,
      0.39,
      pale,
    );
    const c = foot(front, 0, -d * 0.5);
    spire(out, 'roof', c, 2.84, 4, y + h + 6.66, 1.93, roof, { rotation: rotation + Math.PI / 4 });
    if (level)
      opening(out, front, 0, y + h + 2.04, 1.06, 2.37, {
        head: 'round',
        glassSlot: 'dark',
        frame: pale,
        glass: dark,
        frameWidth: 0.13,
        d: 0.05,
        steps,
      });
  }
  if (level > 1 && (name === 'gold' || name === 'silver')) {
    for (const u of [-w * 0.64, w * 0.64]) {
      trimArch(out, front, u, y + 5.96, 0.81, 0.13, 0.055, steps);
      band(out, 'trim', front, u - 1, u + 1, y + 4.18, y + 4.4, -0.02, 0.3, pale);
    }
  }
}
function wall(out, { p, q, grade, endGrade, height, type }, level) {
  const f = wallFace(p, q),
    d = type === 'riva' ? 1.66 : 2.4;
  const face = type === 'riva' ? f : wallFace(q, p);
  const L = face.length;
  const g = type === 'riva' ? grade : endGrade,
    G = type === 'riva' ? endGrade : grade;
  const at = (s) => g + ((G - g) * s) / L;
  const top = (s) => at(s) + height;
  const span = (u, U, base, crest) => {
    const b = (v) => at(v) + base,
      t = (v) => at(v) + crest;
    quad4(
      out,
      'stone',
      face.P(u, b(u)),
      face.P(U, b(U)),
      face.P(U, t(U)),
      face.P(u, t(u)),
      weathered,
    );
    quad4(
      out,
      'stone',
      face.P(U, b(U), -d),
      face.P(u, b(u), -d),
      face.P(u, t(u), -d),
      face.P(U, t(U), -d),
      cream,
    );
    quad4(
      out,
      'trim',
      face.P(u, t(u)),
      face.P(U, t(U)),
      face.P(U, t(U), -d),
      face.P(u, t(u), -d),
      cream,
    );
  };
  if (type === 'riva') {
    const count = Math.round(L / 7.0),
      spacing = L / count;
    span(0, L, -1.25, 8.75);
    span(0, L, 11.14, height);
    for (let i = 0; i < count; i++) {
      const u = i * spacing,
        U = u + spacing,
        mid = (u + U) * 0.5;
      span(u, mid - 0.77, 8.75, 11.14);
      span(mid + 0.77, U, 8.75, 11.14);
      for (const e of [mid - 0.77, mid + 0.77]) {
        const rev = e > mid;
        const q = [
          face.P(e, at(e) + 8.75),
          face.P(e, at(e) + 8.75, -d),
          face.P(e, at(e) + 11.14, -d),
          face.P(e, at(e) + 11.14),
        ];
        quad4(out, 'stone', ...(rev ? q.slice().reverse() : q), cream);
      }
      if (level > 1) {
        trimArch(out, face, mid, at(mid) + 5.9, spacing * 0.379, 0.17, 0.025, 6, 0.41);
        band(
          out,
          'trim',
          face,
          mid - 1.04,
          mid + 1.04,
          at(mid) + 8.57,
          at(mid) + 8.79,
          -0.08,
          0.29,
          pale,
        );
      }
    }
  } else {
    span(0, L, -1.53, height);
    if (level)
      for (let u = 0.65; u < L - 1.3; u += 3.6) {
        const max = Math.min(u + 1.7, L);
        if ((Math.floor(u / 3.6) + Math.floor(Math.abs(p[0]))) % 5 !== 1)
          band(out, 'stone', face, u, max, top(u) - 0.14, top(u) + 0.96, -d, -0.92, weathered);
      }
  }
  for (const u of [0, L]) {
    const ends = [
      face.P(u, at(u) - 1.53),
      face.P(u, at(u) - 1.53, -d),
      face.P(u, top(u), -d),
      face.P(u, top(u)),
    ];
    quad4(out, 'stone', ...(u === 0 ? ends.slice().reverse() : ends), weathered);
  }
}
function distant(out, level) {
  const base = site.mausoleum;
  const c = center(base);
  extrude(out, 'stone', base, -1.48, 1.36, weathered);
  extrude(
    out,
    'stone',
    base.map(([x, z]) => [c[0] + 0.79 * (x - c[0]), c[1] + 0.79 * (z - c[1])]),
    1.36,
    14.28,
    cream,
  );
  spire(out, 'roof', c, 10.66, 8, 14.28, 3.8, roof, { rotation: rotation + Math.PI / 8 });
  const t = site.towerCenter;
  const towerFace = facade(t, site.east);
  extrude(out, 'stone', site.towerRing, -1.15, 11.75, cream);
  for (const [y, h, half] of [
    [11.72, 6.01, 3.05],
    [17.69, 6.52, 2.9],
    [24.17, 6.15, 2.72],
    [30.27, 6.21, 2.54],
    [36.44, 6.16, 2.27],
  ]) {
    const side = half + 0.22;
    block(out, 'trim', t, side, side, y + h - 0.43, y + h + 0.11, cream);
    for (const u of [-half, half])
      for (const d of [-half, half])
        fbox(
          out,
          'stone',
          towerFace,
          u - 0.35,
          u + 0.35,
          y,
          y + h - 0.42,
          d - 0.35,
          d + 0.35,
          cream,
        );
  }
  tower(out, 'stone', t, 2.48, 8, 42.57, 47.91, pale, { rotation });
  spire(out, 'stone', t, 2.67, 8, 47.91, 6.7, cream, { rotation });
  if (level) {
    vestibule(out, level);
    peristyle(out, level);
    temple(out, level);
    for (const gatePlan of site.gates) gate(out, gatePlan, level);
  } else {
    extrude(out, 'stone', site.vestibule, -1.92, 10.61, weathered, { holes: [site.oculus] });
    extrude(out, 'stone', site.temple, -1.51, 8.1, cream, { topSlot: 'roof', topColor: roof });
    const f = wallFace(...site.arcade);
    for (let i = 0; i < 7; i++) {
      const u = (i * f.length) / 6;
      fbox(out, 'column', f, u - 0.35, u + 0.35, 0.5, 8.3, -0.37, 0.37, warm);
    }
    fbox(out, 'stone', f, 0, f.length, 8.25, 10.9, -0.6, 0.28, cream);
    const port = wallFace(...site.portico);
    for (const u of [0.6, port.length * 0.26, port.length * 0.74, port.length - 0.6])
      fbox(out, 'column', port, u - 0.4, u + 0.4, 0.67, 9.7, -0.46, 0.46, warm);
    fbox(out, 'trim', port, -0.29, port.length + 0.29, 9.66, 11.31, -0.74, 0.24, pale);
    for (const { name, axis, center, grade, half, depth, passage, spring } of site.gates) {
      const g = facade(center, axis);
      const h = { gold: 11.3, silver: 12.52, iron: 8.35, bronze: 6.18 }[name];
      for (const [u, U] of [
        [-half, -passage],
        [passage, half],
      ])
        fbox(out, 'stone', g, u, U, grade - 0.9, grade + h, -depth * 0.5, depth * 0.5, cream);
      fbox(
        out,
        'trim',
        g,
        -passage,
        passage,
        grade + spring,
        grade + h,
        -depth * 0.5,
        depth * 0.5,
        pale,
      );
      if (name === 'gold')
        fbox(
          out,
          'brick',
          g,
          -half,
          half,
          grade + h,
          grade + h + 2.4,
          -depth * 0.5,
          depth * 0.5,
          red,
        );
    }
  }
  for (const span of site.walls) {
    const f = wallFace(span.p, span.q);
    const base = Math.min(span.grade, span.endGrade) - 1.35;
    const top = (span.grade + span.endGrade) * 0.5 + span.height;
    fbox(out, 'stone', f, 0, f.length, base, top, -0.8, 0.8, weathered);
  }
  for (const [i, c] of site.towers.entries()) {
    const g = [3.22, 2.0, -4.44][i];
    tower(out, 'stone', c, [5.7, 6.8, 6.1][i], 8, g - 1.21, g + 13.8, weathered, { rotation });
  }
}
function build(target, level) {
  const out = withFootprintCaps(target);
  if (level < 2) return distant(out, level);
  cathedral(out, level);
  peristyle(out, level);
  vestibule(out, level);
  temple(out, level);
  for (const g of site.gates) gate(out, g, level);
  for (const span of site.walls) wall(out, span, level);
  for (const [i, c] of site.towers.entries()) {
    const g = [3.22, 2.0, -4.44][i];
    const ring = polygon(c, [5.7, 6.8, 6.1][i], 8, rotation + Math.PI / 8);
    extrude(out, 'stone', ring, g - 1.21, g + 13.8, weathered, {
      topSlot: 'trim',
      topColor: cream,
    });
    if (level > 1)
      for (const f of faceList(ring)) {
        band(out, 'trim', f, 0.27, f.length - 0.27, g + 12.84, g + 13.1, -0.09, 0.12, pale);
      }
  }
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
