/** Exterior of the standing marble shrine at Hazratbal, Srinagar. */
import {
  areaSign,
  bands,
  block,
  cap,
  closed,
  edge,
  face,
  mix,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  ring,
  shell,
  stairs,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  marble: surface('wall', 'stone_marble', 0.87),
  carved: surface('trim', 'stone_limestone_raw', 0.87),
  base: surface('foundation', 'stone_ashlar', 0.91),
  glass: surface('window', 'window_grid', 0.58, 0.03),
  metal: surface('roof', 'metal_painted', 0.68, 0.23),
  wood: surface('door', 'wood_plain', 0.83),
};
const colors = palette({
  marble: 'e2e0d5',
  light: 'f2ede0',
  stone: 'd1cfc0',
  joints: 'bab6a4',
  roof: 'c2c4bc',
  shadow: '8c8d82',
  glaze: '687d80',
  deep: '4a605c',
  wood: '765538',
  gold: 'b29449',
});

const pointedRise = (ratio) => 1 - 0.57 * Math.abs(ratio) - 0.43 * ratio * ratio;

function lancet(out, wall, center, bottom, spring, width, rise, lod, fill = 'glass') {
  const n = [2, 4, 7, 9][lod],
    depth = 0.031,
    radius = width * 0.5;
  const outline = (padding) =>
    Array.from({ length: 2 * n + 1 }, (_, step) => {
      const t = step / n - 1;
      return [center + t * (radius + padding), spring + (rise + padding) * pointedRise(t)];
    });
  const shade = fill === 'wood' ? colors.wood : colors.deep;
  panel(out, fill, wall, center - radius, center + radius, bottom, spring, depth, shade);
  const inner = outline(0);
  face(
    out,
    fill,
    inner.map(([x, y]) => wall.p(x, y, depth)),
    wall.normal,
    shade,
  );
  if (lod === 0) return;
  const outer = outline(0.14);
  for (let i = 0; i < inner.length - 1; i++) {
    const [a, b] = inner[i],
      [c, d] = inner[i + 1],
      [e, f] = outer[i + 1],
      [g, h] = outer[i];
    face(
      out,
      'carved',
      [
        wall.p(a, b, depth + 0.02),
        wall.p(c, d, depth + 0.02),
        wall.p(e, f, depth + 0.06),
        wall.p(g, h, depth + 0.06),
      ],
      wall.normal,
      colors.light,
    );
  }
  for (const x of [center - radius - 0.14, center + radius])
    panel(out, 'carved', wall, x, x + 0.14, bottom, spring, 0.091, colors.light);
  panel(
    out,
    'carved',
    wall,
    center - radius - 0.16,
    center + radius + 0.16,
    bottom - 0.08,
    bottom + 0.035,
    0.1,
    colors.stone,
  );
  if (lod < 2) return;
  for (const t of [-0.47, 0, 0.47]) {
    const x = center + t * radius;
    panel(
      out,
      'carved',
      wall,
      x - 0.037,
      x + 0.037,
      bottom + 0.03,
      spring + rise * pointedRise(t) - 0.045,
      0.046,
      colors.stone,
    );
  }
  if (lod === 3)
    for (let k = 1; k < 5; k++) {
      const y = mix(bottom, spring, k / 5);
      panel(
        out,
        'carved',
        wall,
        center - radius + 0.03,
        center + radius - 0.03,
        y - 0.019,
        y + 0.019,
        0.046,
        colors.joints,
      );
    }
}

function outlineCircle(center, r, count, start = 0) {
  return Array.from({ length: count }, (_, i) => {
    const a = start + (i * 2 * Math.PI) / count;
    return [center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r];
  });
}

function marbleDome(out, lod, plan) {
  const center = [0, 0],
    { domeRadius: r, mainEave: eave, drumTop: drum, tip } = plan;
  const drumOutline = outlineCircle(center, r * 1.045, 12, Math.PI / 12);
  shell(out, drumOutline, () => eave - 0.025, drum - 0.68, {
    wall: 'marble',
    color: colors.marble,
  });
  const sign = areaSign(drumOutline);
  for (const [a, b] of pairs(closed(drumOutline))) {
    const w = edge(a, b, sign),
      u = w.length * 0.5;
    if (lod > 0) lancet(out, w, u, eave + 0.59, drum - 2.16, w.length * 0.58, 0.94, lod);
    else panel(out, 'glass', w, u - 0.54, u + 0.54, eave + 0.67, drum - 1.5, 0.025, colors.glaze);
  }
  const n = [8, 16, 24, 36][lod];
  ring(
    out,
    'carved',
    center,
    [
      [drum - 0.72, r * 1.04],
      [drum - 0.46, r * 1.083],
      [drum - 0.22, r * 1.083],
      [drum, r * 0.97],
    ],
    n,
    colors.light,
  );
  const profile = [
    [drum, r * 0.968],
    [drum + 0.77, r * 0.995],
    [drum + 2.36, r],
    [drum + 4.12, r * 0.964],
    [drum + 5.68, r * 0.875],
    [drum + 7.19, r * 0.72],
    [drum + 8.47, r * 0.53],
    [drum + 9.53, r * 0.3],
    [drum + 10.19, r * 0.054],
  ];
  const visible = lod === 0 ? profile.filter((_, i) => i % 2 === 0) : profile;
  ring(out, 'marble', center, visible, n, colors.light);
  if (lod === 0) {
    ring(
      out,
      'metal',
      center,
      [
        [drum + 10.14, r * 0.054],
        [drum + 10.95, 0.19],
        [tip, 0.025],
      ],
      6,
      colors.gold,
    );
    return;
  }
  ring(
    out,
    'carved',
    center,
    [
      [drum + 9.63, r * 0.25],
      [drum + 9.95, r * 0.22],
      [drum + 10.22, r * 0.103],
      [drum + 10.36, 0.23],
    ],
    n,
    colors.stone,
  );
  ring(
    out,
    'metal',
    center,
    [
      [drum + 10.31, 0.13],
      [drum + 10.77, 0.12],
      [drum + 10.97, 0.34],
      [drum + 11.2, 0.12],
      [drum + 11.49, 0.31],
      [drum + 11.72, 0.13],
      [drum + 12.04, 0.26],
      [drum + 12.27, 0.095],
      [tip, 0.029],
    ],
    Math.min(n, 16),
    colors.gold,
  );
  if (lod < 2) return;
  const rim = outlineCircle(center, r * 1.076, n * 2);
  for (const [x, z] of rim) {
    const w = lod === 2 ? 0.117 : 0.073;
    block(out, 'carved', x - w, drum - 0.41, z - w, w * 2, 0.22, w * 2, colors.stone);
  }
}

function minaret(out, lod, plan, grade) {
  const center = plan.minaret;
  const start = grade(center) - 0.47;
  const octagon = outlineCircle(center, 1.62, 8, Math.PI / 8);
  shell(out, octagon, () => start, 10.8, { wall: 'marble', color: colors.stone });
  if (lod === 0) {
    ring(
      out,
      'marble',
      center,
      [
        [10.59, 1.66],
        [11.2, 1.48],
        [16.7, 1.6],
        [17.51, 1.33],
        [29.68, 1.12],
        [30.2, 1.72],
        [30.53, 1.59],
        [31.73, 1.15],
        [32.03, 1.59],
        [32.6, 1.36],
        [33.8, 0.69],
        [34.19, 0.11],
      ],
      6,
      colors.light,
    );
    ring(
      out,
      'metal',
      center,
      [
        [34.15, 0.15],
        [35.1, 0.07],
        [plan.minaretTip, 0.024],
      ],
      4,
      colors.gold,
    );
    return;
  }
  const n = 8;
  ring(
    out,
    'marble',
    center,
    [
      [10.59, 1.66],
      [11.12, 1.48],
      [16.23, 1.39],
      [16.7, 1.53],
      [17.1, 1.53],
      [17.51, 1.33],
      [29.25, 1.09],
      [29.68, 1.21],
      [30.1, 1.52],
      [30.57, 1.51],
    ],
    n,
    colors.light,
  );
  ring(
    out,
    'carved',
    center,
    [
      [16.36, 1.44],
      [16.62, 1.66],
      [17.07, 1.66],
      [17.17, 1.46],
    ],
    n,
    colors.stone,
  );
  ring(
    out,
    'carved',
    center,
    [
      [29.45, 1.24],
      [29.86, 1.72],
      [30.21, 1.79],
      [30.49, 1.77],
      [30.57, 1.51],
    ],
    n,
    colors.stone,
  );
  cap(out, 'carved', outlineCircle(center, 1.53, n), 30.54, colors.light);
  const spire = outlineCircle(center, 1.19, n);
  for (const [u, v] of spire)
    block(out, 'carved', u - 0.13, 30.52, v - 0.13, 0.26, 1.2, 0.26, colors.light);
  ring(
    out,
    'carved',
    center,
    [
      [31.62, 1.34],
      [31.85, 1.67],
      [32.05, 1.54],
    ],
    n,
    colors.stone,
  );
  ring(
    out,
    'marble',
    center,
    [
      [31.95, 1.43],
      [32.25, 1.4],
      [32.94, 1.25],
      [33.54, 0.9],
      [33.96, 0.44],
      [34.19, 0.13],
    ],
    lod < 2 ? 12 : 20,
    colors.light,
  );
  ring(
    out,
    'metal',
    center,
    [
      [34.13, 0.1],
      [34.4, 0.19],
      [34.57, 0.075],
      [34.95, 0.14],
      [35.2, 0.06],
      [plan.minaretTip, 0.02],
    ],
    8,
    colors.gold,
  );
  if (lod < 2) return;
  for (const [a, b] of pairs(closed(outlineCircle(center, 1.38, 8)))) {
    const w = edge(a, b, 1),
      m = w.length / 2;
    panel(out, 'carved', w, m - 0.09, m + 0.09, 11.4, 16.13, 0.012, colors.stone);
  }
  const ledge = outlineCircle(center, 1.59, lod === 3 ? 24 : 16);
  for (const [u, v] of ledge)
    block(out, 'carved', u - 0.05, 30.12, v - 0.05, 0.1, 0.32, 0.1, colors.stone);
}

function terrace(out, lod, outline, eave) {
  const sign = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    const w = edge(a, b, sign);
    if (w.length < 0.25) continue;
    if (lod < 2 || w.length < 3) {
      panel(out, 'carved', w, 0, w.length, eave - 0.05, eave + 0.45, 0.051, colors.stone);
      continue;
    }
    panel(out, 'carved', w, 0, w.length, eave - 0.06, eave + 0.13, 0.06, colors.stone);
    panel(out, 'carved', w, 0, w.length, eave + 0.37, eave + 0.47, 0.067, colors.light);
    const n = Math.ceil(w.length / (lod === 3 ? 1.01 : 1.8));
    for (let i = 1; i < n; i++) {
      const x = (i * w.length) / n;
      panel(out, 'carved', w, x - 0.068, x + 0.068, eave + 0.1, eave + 0.39, 0.07, colors.light);
    }
  }
}

function draw(out, lod, plan, grade) {
  const { footprint, mainEave: eave } = plan;
  const sign = areaSign(footprint);
  shell(out, footprint, (p) => grade(p) - 0.64, eave, {
    wall: 'marble',
    roof: 'carved',
    color: colors.marble,
    roofColor: colors.roof,
  });
  const edges = pairs(closed(footprint));
  for (const [[a, b], index] of edges.map((pair, index) => [pair, index])) {
    const wall = edge(a, b, sign);
    if (wall.length < 2.5) continue;
    bands(
      out,
      wall,
      0,
      wall.length,
      [
        [0.49, 0.82],
        [6.92, 7.08],
        [8.11, 8.58],
      ],
      'carved',
      colors.light,
      0.088,
    );
    if (index === 0) {
      const center = wall.length * 0.48;
      lancet(out, wall, center, 0.81, 4.05, 4.1, 1.76, lod, 'wood');
      for (const u of [center - 5.38, center + 5.38])
        lancet(out, wall, u, 2.11, 4.01, 2.62, 1.4, lod);
      continue;
    }
    if (wall.length < 7.5) continue;
    const n = Math.max(1, Math.floor(wall.length / (lod === 0 ? 8.7 : 4.4)));
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) * wall.length) / n;
      lancet(out, wall, u, 2.07, 4.03, Math.min(2.53, (wall.length / n) * 0.56), 1.53, lod);
      if (lod > 1) panel(out, 'carved', wall, u - 1.37, u + 1.37, 1.87, 2.04, 0.12, colors.stone);
    }
  }
  stairs(out, grade, 'base', -8.6, 1.0, -62.2, -57.54, 0.8, lod > 0 ? 6 : 3, colors.stone);
  terrace(out, lod, footprint, eave);
  for (const [x, z, w, h] of [
    [14.2, -25.8, 16, 21],
    [-6.7, -53.7, 8.4, 13.7],
    [1, 24.6, 7.8, 9],
  ]) {
    const panelOutline = rect(x, z, x + w, z + h);
    shell(out, panelOutline, () => eave - 0.04, eave + 0.67, {
      wall: 'carved',
      roof: 'carved',
      color: colors.stone,
      roofColor: colors.roof,
    });
  }
  marbleDome(out, lod, plan);
  minaret(out, lod, plan, grade);
}

const shrine = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-77, 38, -105],
    lookAt: [3, 12, -9],
    yaw: 0.55,
    sun: [-280, 520, -420],
    brief:
      'White marble lakeside shrine with a separately mapped round dome above its windowed drum, one balcony minaret, pointed arched windows, pale roof terraces and a gilded finial.',
    views: [
      { name: 'north-entrance-and-arcade', position: [-36, 11, -84], lookAt: [-2, 7, -47] },
      { name: 'marble-dome-and-minaret', position: [-34, 24, -24], lookAt: [4, 21, 5] },
      { name: 'dal-lake-side-and-terrace', position: [49, 24, 70], lookAt: [2, 9, 10] },
    ],
  },
  draw,
);
export const { skyline, district, street, closeup } = shrine;
export const model = { ...shrine.model, category: 'religious' };
