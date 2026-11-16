/** Dodger Stadium's open hillside bowl and its two separately roofed outfield pavilions. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const field = read('terrain-grid.json');
const { features } = read('map-frame.json');
const mapped = new Map(
  features.map(({ id, points }) => [Number(id.slice(4)), points.slice(0, -1)]),
);
const palette = 'palette:#ffffff';
const up = [0, 1, 0];
const colors = Object.fromEntries(
  Object.entries({
    concrete: 'c5c3b8',
    riser: 'b4b6b6',
    roof: 'dddcd4',
    steel: 'a4b3b8',
    wallBlue: '507994',
    rail: '719bb3',
    belowSeats: '435c68',
    yellow: 'dabf71',
    orange: 'c59067',
    turquoise: '81a897',
    reserve: '80a1af',
    topDeck: '7194ae',
    navy: '324b67',
    scoreBlue: '6586ab',
    glass: '496170',
    grass: '719651',
    grassLight: '81a354',
    grassDark: '73984d',
    dirt: 'b87c56',
    track: 'a8755b',
    chalk: 'e5e1ce',
    gold: 'd2af61',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.89, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.79, metallic: 0.08 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.81, metallic: 0.12 },
  color: { slot: 'trim', localRef: palette, roughness: 0.86, metallic: 0 },
  glass: { slot: 'window', graph: 'glass_frit_triangular', roughness: 0.44, metallic: 0 },
  field: { slot: 'foundation', localRef: palette, roughness: 0.97, metallic: 0 },
};
const mix = (a, b, t) => a + (b - a) * t;
const blend = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const xyz = ([x, z], y) => [x, y, z];
const length = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mean = (ring) => [0, 1].map((i) => ring.reduce((sum, p) => sum + p[i], 0) / ring.length);
const yField = 0.3;

function ground(x, z) {
  const u = (x - field.origin[0]) / field.stepMeters;
  const v = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  return (
    mix(
      mix(field.heightsMeters[j][i], field.heightsMeters[j][i + 1], u - i),
      mix(field.heightsMeters[j + 1][i], field.heightsMeters[j + 1][i + 1], u - i),
      v - j,
    ) - field.modelDatumElevationMeters
  );
}

function polygon(out, part, vertices, outward, color) {
  out.addConvexPolygon(
    part,
    palette,
    vertices,
    outward,
    ([x, y, z]) => [x - z, y + 0.2 * (x + z)],
    color,
  );
}

function ribbon(out, part, p, desired, color) {
  for (const triangle of [
    [p[0], p[1], p[2]],
    [p[0], p[2], p[3]],
  ]) {
    const [anchor, ...other] = triangle.map((corner) => corner.map(Math.fround));
    const edges = other.map((point) => point.map((v, i) => v - anchor[i]));
    if (Math.hypot(...cross(...edges)) < 1e-10) continue;
    const n = normalFor(...triangle);
    const dot = n[0] * desired[0] + n[1] * desired[1] + n[2] * desired[2];
    polygon(out, part, triangle, dot < 0 ? n.map((v) => -v) : n, color);
  }
}

function fill(out, part, ring, y, color, holes = []) {
  const mesh = new MeshBufferBuilder();
  if (
    !mesh.addCap(
      part,
      palette,
      ring,
      holes,
      () => y,
      up,
      (p) => p,
      color,
    )
  )
    throw Error('Invalid Dodger Stadium outline');
  const baked = mesh.finalize();
  for (let i = 0; i < baked.indices.length; i += 3) {
    const vertices = Array.from(baked.indices.slice(i, i + 3), (index) =>
      Array.from(baked.positions.slice(index * 3, index * 3 + 3)),
    );
    polygon(out, part, vertices, up, color);
  }
}

function frame([x, z], facing) {
  const m = Math.hypot(...facing);
  const [nx, nz] = facing.map((v) => v / m);
  return {
    point: (u, y, v) => [x + nz * u + nx * v, y, z - nx * u + nz * v],
    vector: ([u, y, v]) => [nz * u + nx * v, y, -nx * u + nz * v],
    local: ([u, v]) => [(u - x) * nz - (v - z) * nx, (u - x) * nx + (v - z) * nz],
  };
}

function oriented(out, axes) {
  return {
    addQuad(part, ref, p, n, uv, c) {
      out.addQuad(
        part,
        ref,
        p.map((v) => axes.point(...v)),
        axes.vector(n),
        uv,
        c,
      );
    },
    addConvexPolygon(part, ref, p, n, uv, c) {
      out.addConvexPolygon(
        part,
        ref,
        p.map((v) => axes.point(...v)),
        axes.vector(n),
        uv,
        c,
      );
    },
  };
}

function circle([x, z], radius, lod) {
  const count = [8, 12, 16, 24][lod];
  return Array.from({ length: count }, (_, i) => {
    const angle = (i * Math.PI * 2) / count;
    return [x + radius * Math.cos(angle), z + radius * Math.sin(angle)];
  });
}

const fieldAxis = plan.centerfieldAxis;
const fieldCross = [-fieldAxis[1], fieldAxis[0]];
const home = plan.homePlate;
const fieldPoint = (u, v) => [
  home[0] + fieldCross[0] * u + fieldAxis[0] * v,
  home[1] + fieldCross[1] * u + fieldAxis[1] * v,
];
const fieldU = (p) => (p[0] - home[0]) * fieldCross[0] + (p[1] - home[1]) * fieldCross[1];

function clipStripe(ring, boundary, sign) {
  const points = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const u = fieldU(a) - boundary,
      v = fieldU(b) - boundary;
    if (u * sign >= 0) points.push(a);
    if ((u * sign > 0 && v * sign < 0) || (u * sign < 0 && v * sign > 0))
      points.push(blend(a, b, u / (u - v)));
  }
  return points;
}

function playingField(out, lod) {
  const turf = mapped.get(126712489);
  const soil = mapped.get(401848961);
  const grass = mapped.get(401848962);
  const [x, z] = mean(turf);
  const track = turf.map(([u, v]) => [mix(x, u, 1.073), mix(z, v, 1.073)]);
  fill(out, 'field', track, yField - 0.03, colors.track, [turf]);
  if (lod === 0) fill(out, 'field', turf, yField, colors.grass);
  else {
    const stripeWidth = lod > 1 ? 8.25 : 14.1;
    for (let i = -Math.ceil(65 / stripeWidth); i <= Math.ceil(65 / stripeWidth); i++) {
      const band = clipStripe(clipStripe(turf, i * stripeWidth, 1), (i + 1) * stripeWidth, -1);
      if (band.length >= 3)
        fill(out, 'field', band, yField, i % 2 ? colors.grassLight : colors.grassDark);
    }
  }
  fill(out, 'field', soil, yField + 0.014, colors.dirt, [grass]);
  fill(out, 'field', grass, yField + 0.014, colors.grass);
  const mound = fieldPoint(0, 18.44);
  fill(out, 'field', circle(mound, 2.75, lod), yField + 0.082, colors.dirt);
  if (lod > 0) {
    for (const sign of [-1, 1]) {
      const angle = Math.PI / 4;
      const distance = plan.outfieldDistancesFt[sign === -1 ? 0 : 4] * 0.3048;
      const u = Math.sin(angle) * sign,
        v = Math.cos(angle);
      fill(
        out,
        'field',
        [
          fieldPoint(0, 0),
          fieldPoint(u * distance, v * distance),
          fieldPoint(u * distance + 0.075, v * distance),
          fieldPoint(0.075, 0),
        ],
        yField + 0.035,
        colors.chalk,
      );
    }
  }
  if (lod > 1) {
    for (const [u, v] of [
      [0, 0],
      [0, 38.8],
      [-19.398, 19.398],
      [19.398, 19.398],
    ]) {
      const base = fieldPoint(u, v);
      box(
        out,
        'field',
        [base[0] - 0.23, yField + 0.04, base[1] - 0.23],
        [base[0] + 0.23, yField + 0.14, base[1] + 0.23],
        colors.chalk,
      );
    }
  }

  // The outfield wall uses the documented distances from the plate. Curvature is inferred between marks.
  const divisions = [8, 12, 20, 36][lod];
  const marks = Array.from({ length: divisions + 1 }, (_, i) => {
    const t = (4 * i) / divisions;
    const n = Math.min(3, Math.floor(t));
    const r = 0.3048 * mix(plan.outfieldDistancesFt[n], plan.outfieldDistancesFt[n + 1], t - n);
    const angle = ((i / divisions - 0.5) * Math.PI) / 2;
    return fieldPoint(r * Math.sin(angle), r * Math.cos(angle));
  });
  for (let i = 0; i < divisions; i++) {
    const a = marks[i],
      b = marks[i + 1];
    const h = Math.abs((i + 0.5) / divisions - 0.5) > 0.35 ? 1.39 : 2.44;
    const toField = [home[0] - a[0], 0, home[1] - a[1]];
    ribbon(
      out,
      'metal',
      [xyz(a, yField - 0.08), xyz(b, yField - 0.08), xyz(b, yField + h), xyz(a, yField + h)],
      toField,
      colors.rail,
    );
    ribbon(
      out,
      'metal',
      [xyz(b, yField - 0.08), xyz(a, yField - 0.08), xyz(a, yField + h), xyz(b, yField + h)],
      toField.map((v) => -v),
      colors.wallBlue,
    );
  }
  for (const p of [marks[0], marks.at(-1)])
    box(
      out,
      'metal',
      [p[0] - 0.11, yField, p[1] - 0.11],
      [p[0] + 0.11, 20.2, p[1] + 0.11],
      colors.gold,
    );
}

const mainStand = plan.mainStandSections;
const bowlCenter = plan.bowlSectionCenter;
const tiers = [
  {
    front: 0.0,
    back: 0.42,
    bottom: 1.13,
    top: 8.05,
    edge: 115,
    counts: [1, 3, 7, 16],
    tint: colors.yellow,
  },
  {
    front: 0.34,
    back: 0.62,
    bottom: 9.03,
    top: 16.15,
    edge: 111,
    counts: [1, 3, 6, 13],
    tint: colors.orange,
  },
  {
    front: 0.55,
    back: 0.74,
    bottom: 17.05,
    top: 21.36,
    edge: 100,
    counts: [1, 2, 4, 8],
    tint: colors.turquoise,
  },
  {
    front: 0.62,
    back: 0.97,
    bottom: 22.28,
    top: 32.48,
    edge: 96,
    counts: [1, 3, 7, 15],
    tint: colors.reserve,
  },
  {
    front: 0.78,
    back: 1.01,
    bottom: 32.54,
    top: 41.88,
    edge: 60,
    counts: [1, 2, 6, 14],
    tint: colors.topDeck,
  },
];

function tierHeight(station, target, radius) {
  const factor = Math.min(1, Math.max(0, (Math.abs(station.angle) - 42) / 74));
  const h = target * (1 - factor * Math.max(0, radius * 0.285)) + 0.11;
  return radius < 0.12
    ? h
    : Math.max(h, ground(...blend(station.low, station.high, radius)) + 0.43 + target * 0.12);
}

function standPoint(station, t, h) {
  return xyz(blend(station.low, station.high, t), tierHeight(station, h, t));
}

function tier(out, a, b, definition, lod, aisle) {
  const { front, back, counts, tint, bottom, top: crown } = definition;
  const n = [bowlCenter[0] - a.low[0], 0, bowlCenter[1] - a.low[1]];
  const rowCount = counts[lod];
  const color = aisle ? colors.concrete : tint;
  for (let i = 0; i < rowCount; i++) {
    const t0 = mix(front, back, i / rowCount);
    const t1 = mix(front, back, (i + 1) / rowCount);
    const y0 = mix(bottom, crown, i / rowCount);
    const y1 = mix(bottom, crown, (i + 1) / rowCount);
    const lower = lod === 0 ? y0 : y1;
    ribbon(
      out,
      'color',
      [
        standPoint(a, t0, lower),
        standPoint(b, t0, lower),
        standPoint(b, t1, y1),
        standPoint(a, t1, y1),
      ],
      up,
      color,
    );
    if (lod > 0)
      ribbon(
        out,
        'concrete',
        [
          standPoint(a, t0, y0),
          standPoint(b, t0, y0),
          standPoint(b, t0, y1),
          standPoint(a, t0, y1),
        ],
        n,
        colors.riser,
      );
  }
  ribbon(
    out,
    'metal',
    [
      standPoint(a, front - 0.006, bottom - 1.02),
      standPoint(b, front - 0.006, bottom - 1.02),
      standPoint(b, front - 0.006, bottom + 0.22),
      standPoint(a, front - 0.006, bottom + 0.22),
    ],
    n,
    front < 0.06 ? colors.rail : colors.wallBlue,
  );
}

function standWall(out, a, b, height, lod) {
  const [x, z] = a.high,
    [u, v] = b.high;
  const baseA = ground(x, z) - 0.75,
    baseB = ground(u, v) - 0.75;
  const topA = tierHeight(a, height, 1),
    topB = tierHeight(b, height, 1);
  const normal = [(x + u) / 2 - bowlCenter[0], 0, (z + v) / 2 - bowlCenter[1]];
  ribbon(
    out,
    'concrete',
    [xyz(a.high, baseA), xyz(b.high, baseB), xyz(b.high, topB), xyz(a.high, topA)],
    normal,
    colors.concrete,
  );
  if (lod < 1) return;
  const n = Math.hypot(normal[0], normal[2]);
  const façade = (p) => [p[0] + (normal[0] * 0.36) / n, p[1] + (normal[2] * 0.36) / n];
  const ap = façade(a.high),
    bp = façade(b.high);
  for (const h of [6.8, 14.8, 23.1, 31.5, 40.8]) {
    if (h > Math.min(topA, topB) + 0.06 || h < Math.min(baseA, baseB) + 0.18) continue;
    ribbon(
      out,
      'metal',
      [xyz(ap, h - 0.47), xyz(bp, h - 0.47), xyz(bp, h + 0.42), xyz(ap, h + 0.42)],
      normal,
      h > 36 ? colors.roof : colors.wallBlue,
    );
  }
  if (lod < 2) return;
  const wide = length(a.high, b.high);
  if (wide < 1.6 || topA < baseA + 2.0 || topB < baseB + 2.0) return;
  const local = oriented(out, frame(blend(a.high, b.high, 0.5), [normal[0], normal[2]]));
  const lo = Math.max(baseA, baseB) + 0.54;
  const hi = Math.min(topA, topB);
  for (let h = 4 * Math.ceil(lo / 4); h < hi - 1.8; h += 4) {
    box(local, 'glass', [-wide * 0.34, h, 0.31], [wide * 0.34, h + 1.37, 0.71], colors.glass);
  }
  const pier = Math.min(wide * 0.11, 0.42);
  box(local, 'concrete', [-pier, lo - 0.6, 0.21], [pier, hi - 0.22, 0.86], colors.riser);
}

function upperCanopy(out, a, b, lod, index) {
  const yA = tierHeight(a, 41.88, 1) + 4.27,
    yB = tierHeight(b, 41.88, 1) + 4.27;
  const points = (s, y) => [
    xyz(blend(s.low, s.high, 0.87), y - 0.38),
    xyz(blend(s.low, s.high, 1.055), y),
  ];
  const [af, ar] = points(a, yA),
    [bf, br] = points(b, yB);
  ribbon(out, 'roof', [af, bf, br, ar], up, colors.roof);
  if (lod < 1) return;
  const dip = ([x, y, z]) => [x, y - 0.54, z];
  ribbon(
    out,
    'roof',
    [dip(af), dip(bf), bf, af],
    [bowlCenter[0] - af[0], 0, bowlCenter[1] - af[2]],
    colors.steel,
  );
  ribbon(out, 'roof', [dip(bf), dip(af), dip(ar), dip(br)], [0, -1, 0], colors.roof);
  if (index % (lod === 3 ? 4 : 2) === 0) {
    const [x, z] = blend(a.low, a.high, 0.99);
    box(
      out,
      'concrete',
      [x - 0.43, yA - 4.8, z - 0.43],
      [x + 0.43, yA - 0.19, z + 0.43],
      colors.roof,
    );
  }
}

function enclosedSection(out, a, b, rows, lod) {
  const n = [bowlCenter[0] - a.low[0], 0, bowlCenter[1] - a.low[1]];
  const lowFront = 0.0;
  const apron = -0.048;
  ribbon(
    out,
    'concrete',
    [
      standPoint(a, apron, 0.42),
      standPoint(b, apron, 0.42),
      standPoint(b, lowFront, 1.17),
      standPoint(a, lowFront, 1.17),
    ],
    up,
    colors.concrete,
  );
  for (let i = 1; i < rows.length; i++) {
    const lower = rows[i - 1];
    const upper = rows[i];
    const underside = upper.bottom - 0.36;
    const loose = upper.front + 0.045;
    ribbon(
      out,
      'concrete',
      [
        standPoint(a, lower.back, lower.top),
        standPoint(b, lower.back, lower.top),
        standPoint(b, lower.back, underside),
        standPoint(a, lower.back, underside),
      ],
      n,
      colors.belowSeats,
    );
    ribbon(
      out,
      'concrete',
      [
        standPoint(a, loose, underside),
        standPoint(b, loose, underside),
        standPoint(b, lower.back, underside),
        standPoint(a, lower.back, underside),
      ],
      [0, -1, 0],
      colors.concrete,
    );
    const rail = upper.front - 0.003;
    if (lod > 0)
      ribbon(
        out,
        'metal',
        [
          standPoint(a, rail, underside - 0.3),
          standPoint(b, rail, underside - 0.3),
          standPoint(b, rail, upper.bottom + 0.03),
          standPoint(a, rail, upper.bottom + 0.03),
        ],
        n,
        colors.wallBlue,
      );
  }
  const last = rows.at(-1);
  if (last.back < 1) {
    ribbon(
      out,
      'concrete',
      [
        standPoint(a, last.back, last.top - 0.05),
        standPoint(b, last.back, last.top - 0.05),
        standPoint(b, 1.0, last.top + 0.19),
        standPoint(a, 1.0, last.top + 0.19),
      ],
      up,
      colors.concrete,
    );
  }
}

function tierEnds(out, a, b, rows, lastRows, nextRows) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    for (const [station, limit, sign] of [
      [a, lastRows, -1],
      [b, nextRows, 1],
    ]) {
      if (i < limit) continue;
      const outward = [sign * (b.high[0] - a.high[0]), 0, sign * (b.high[1] - a.high[1])];
      const lower = rows[i - 1];
      const outside = [
        standPoint(station, row.front, row.bottom),
        standPoint(station, row.back, row.top),
        standPoint(station, row.back, lower ? lower.top : ground(...station.high)),
        standPoint(station, row.front, lower ? lower.bottom : 0.48),
      ];
      ribbon(out, 'concrete', outside, outward, colors.concrete);
    }
  }
}

function seatBowl(out, lod) {
  const stride = [14, 5, 2, 1][lod];
  const selected = mainStand.filter((s, i) => i % stride === 0 || s === mainStand.at(-1));
  const slices = selected.slice(1).map((b, i) => {
    const a = selected[i];
    const angle = Math.abs((a.angle + b.angle) / 2);
    return { a, b, angle, rows: tiers.filter((row) => angle <= row.edge) };
  });
  for (const [i, { a, b, angle, rows }] of slices.entries()) {
    const aisle = lod > 1 && i % (lod === 3 ? 7 : 6) === 0;
    for (const row of rows) tier(out, a, b, row, lod, aisle);
    enclosedSection(out, a, b, rows, lod);
    tierEnds(out, a, b, rows, slices[i - 1]?.rows.length ?? 0, slices[i + 1]?.rows.length ?? 0);
    const topY = rows.at(-1).top + 0.19;
    standWall(out, a, b, topY, lod);
    if (angle < 63) upperCanopy(out, a, b, lod, i);
    if (lod > 0 && angle < 20) {
      const f = 0.78;
      const n = [bowlCenter[0] - a.low[0], 0, bowlCenter[1] - a.low[1]];
      ribbon(
        out,
        'glass',
        [
          standPoint(a, f, 23.55),
          standPoint(b, f, 23.55),
          standPoint(b, f, 26.55),
          standPoint(a, f, 26.55),
        ],
        n,
        colors.glass,
      );
    }
  }
}

function pavilion(out, id, outward, lod) {
  const ring = mapped.get(id);
  const origin = mean(ring);
  const axes = frame(origin, outward),
    local = oriented(out, axes);
  const extent = ring.map((p) => axes.local(p));
  const left = Math.min(...extent.map(([x]) => x)) + 2.6;
  const right = Math.max(...extent.map(([x]) => x)) - 2.6;
  const near = Math.min(...extent.map(([, z]) => z)) + 5.4;
  const far = Math.max(...extent.map(([, z]) => z)) - 3.9;
  const rowCount = [1, 4, 8, 15][lod];
  const top = 7.6;
  fill(out, 'concrete', ring, yField + 0.46, colors.concrete);
  for (let i = 0; i < rowCount; i++) {
    const z0 = mix(near, far, i / rowCount);
    const z1 = mix(near, far, (i + 1) / rowCount);
    const y0 = mix(1.5, top, i / rowCount);
    const y1 = mix(1.5, top, (i + 1) / rowCount);
    const inset = 2.4 * Math.abs(i / rowCount - 0.5);
    ribbon(
      local,
      'color',
      [
        [left + inset, lod === 0 ? y0 : y1, z0],
        [right - inset, lod === 0 ? y0 : y1, z0],
        [right - inset, y1, z1],
        [left + inset, y1, z1],
      ],
      up,
      i % 4 === 0 ? colors.reserve : colors.rail,
    );
    if (lod > 0)
      ribbon(
        local,
        'concrete',
        [
          [left + inset, y0, z0],
          [right - inset, y0, z0],
          [right - inset, y1, z0],
          [left + inset, y1, z0],
        ],
        [0, 0, -1],
        colors.riser,
      );
  }
  box(
    local,
    'concrete',
    [left, yField, far - 0.7],
    [right, top + 1.08, far + 1.45],
    colors.concrete,
  );
  const modules = lod === 0 ? 4 : 8;
  for (let i = 0; i < modules; i++) {
    const a = mix(left - 0.95, right + 0.95, i / modules);
    const b = mix(left - 0.95, right + 0.95, (i + 1) / modules);
    const p = [
      [a, 10.74, far - 7.3],
      [b, 12.76, far - 7.3],
      [b, 12.16, far + 2.03],
      [a, 10.43, far + 2.03],
    ];
    ribbon(local, 'roof', p, up, colors.roof);
    if (lod > 0) {
      ribbon(
        local,
        'roof',
        p.map(([x, y, z]) => [x, y - 0.17, z]),
        [0, -1, 0],
        colors.roof,
      );
      box(local, 'metal', [a + 0.3, 7.64, far - 0.65], [a + 0.61, 11.0, far - 0.18], colors.steel);
    }
  }
}

function scoreboard(out, point, facing, lod) {
  const axes = frame(point, facing);
  const local = oriented(out, axes);
  const board = (width, z, pad) => [
    [-width, 16.7 - pad, z],
    [0, 14.4 - pad, z],
    [width, 16.7 - pad, z],
    [width, 23.64 + pad, z],
    [0, 26.1 + pad, z],
    [-width, 23.64 + pad, z],
  ];
  const rear = board(13.6, -1.12, 0.27);
  const front = board(13.6, 1.14, 0.27);
  polygon(local, 'roof', rear, [0, 0, -1], colors.roof);
  polygon(local, 'roof', front, [0, 0, 1], colors.roof);
  for (let i = 0; i < front.length; i++) {
    const a = front[i],
      b = front[(i + 1) % front.length];
    const next = (i + 1) % front.length;
    ribbon(
      local,
      'metal',
      [a, b, rear[next], rear[i]],
      [a[0] + b[0], a[1] + b[1] - 40, 0],
      colors.steel,
    );
  }
  const view = board(12.85, 1.165, -0.12);
  polygon(local, 'color', view, [0, 0, 1], colors.navy);
  for (const x of [-7.4, 7.4])
    box(local, 'concrete', [x - 0.34, 2.3, -0.7], [x + 0.34, 17.63, 0.35], colors.steel);
  if (lod > 0) {
    box(local, 'color', [-8.9, 19.35, 1.18], [1.0, 22.72, 1.205], colors.scoreBlue);
    for (let i = 0; i < 4; i++)
      box(
        local,
        'color',
        [2.9, 17.68 + i * 1.12, 1.18],
        [10.12, 18.05 + i * 1.12, 1.205],
        colors.rail,
      );
  }
}

function floodlight(out, position, facing, mastTop, lod) {
  const axes = frame(position, facing);
  const local = oriented(out, axes);
  const width = 27.6;
  for (const x of lod === 0 ? [-9.7, 9.7] : [-11.8, -3.95, 3.95, 11.8]) {
    const [wx, , wz] = axes.point(x, 0, 0);
    const grade = ground(wx, wz) - 0.55;
    box(local, 'metal', [x - 0.23, grade, -0.31], [x + 0.23, mastTop - 0.46, 0.31], colors.steel);
  }
  box(
    local,
    'metal',
    [-width / 2, mastTop - 4.43, -0.53],
    [width / 2, mastTop, 0.48],
    colors.glass,
  );
  if (lod === 0) return;
  const rows = lod === 1 ? 2 : 3,
    count = [0, 11, 18, 26][lod];
  for (let row = 0; row < rows; row++) {
    const y = mastTop - 4.04 + row * 1.33;
    for (let i = 0; i < count; i++) {
      const x = width * ((i + 0.5) / count - 0.5);
      polygon(
        local,
        'color',
        [
          [x - 0.33, y, 0.51],
          [x + 0.33, y, 0.51],
          [x + 0.33, y + 0.72, 0.51],
          [x - 0.33, y + 0.72, 0.51],
        ],
        [0, 0, 1],
        colors.chalk,
      );
    }
  }
}

function outfield(out, lod) {
  pavilion(out, 425651387, [-0.13, -0.992], lod);
  pavilion(out, 425651385, [0.84, -0.54], lod);
  for (const pt of [
    [-25, -77],
    [65, -53],
  ]) {
    const facing = [bowlCenter[0] - pt[0], bowlCenter[1] - pt[1]];
    scoreboard(out, pt, facing, lod);
    floodlight(out, [pt[0] - facing[0] * 0.18, pt[1] - facing[1] * 0.18], facing, 51.5, lod);
  }
  const plaza = oriented(out, frame([34, -77], [-0.46, 0.89]));
  box(plaza, 'concrete', [-11.8, 0.0, -16], [11.8, 1.41, 5.3], colors.concrete);
  box(plaza, 'metal', [-11.8, 1.4, 2.0], [11.8, 7.4, 5.1], colors.belowSeats);
  if (lod > 0) box(plaza, 'metal', [-10.4, 7.4, 0.25], [10.4, 8.27, 4.85], colors.navy);
}

function dugouts(out) {
  for (const side of [-1, 1]) {
    const p = fieldPoint(42.1 * side, 26);
    const facing = [bowlCenter[0] - p[0], bowlCenter[1] - p[1]];
    const local = oriented(out, frame(p, facing));
    box(local, 'concrete', [-11.0, 0.12, -2.0], [11.0, 0.86, 2.6], colors.concrete);
    box(local, 'roof', [-11.8, 1.71, -2.15], [11.8, 2.25, 2.4], colors.wallBlue);
    for (const x of [-11.5, -3.7, 3.7, 11.5])
      box(local, 'metal', [x - 0.13, 0.8, 2.0], [x + 0.13, 1.8, 2.25], colors.steel);
  }
}

function draw(out, lod) {
  playingField(out, lod);
  seatBowl(out, lod);
  if (lod > 0) dugouts(out);
  outfield(out, lod);
  for (const [point, height] of [
    [[-101, -24], 60.5],
    [[-85, 102], 69.4],
    [[23, 137], 65.2],
    [[111, 61], 55.8],
  ]) {
    floodlight(out, point, [bowlCenter[0] - point[0], bowlCenter[1] - point[1]], height, lod);
  }
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [217, 140, 224];
const lookAt = [1, 16, 21];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;

export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: slug + '-model.mjs',
  recipeDependencies: ['generate-motat-building.mjs'],
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Dodger Stadium in Chávez Ravine, with a terraced main stand, low outfield pavilions, twin hexagonal scoreboards, four-post light banks and a baseball diamond.',
  camera,
  lookAt,
  sunDirection: [148, 188, -67],
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : []))),
  ],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -0.25,
    focus: { center: lookAt },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'from-home-plate-to-center-field', position: [-46, 39, 106], lookAt: [15, 11, -29] },
    {
      name: 'outfield-pavilions-and-scoreboards',
      position: [117, 60, -147],
      lookAt: [20, 11, -28],
    },
    { name: 'grandstands-from-the-west-lot', position: [-206, 36, 39], lookAt: [-58, 30, 23] },
    { name: 'open-bowl-from-right-field', position: [153, 71, -35], lookAt: [-9, 13, 46] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 8.3,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 3.9, surfaces },
      street: { export: 'street', errorMeters: 1.22, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.4, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Independent geographic reconstruction using exact author-CC0 Qualla photographs, ODbL footprints and original USGS 3DEP terrain.',
};
