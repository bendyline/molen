import { readFileSync } from 'node:fs';
import {
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  mix,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  rect,
  shell,
  surface,
  trimBlock,
  up,
  xz,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const surfaces = {
  stone: surface('wall', 'stone_ashlar'),
  carving: surface('trim', 'stone_marble', 0.81),
  lead: surface('roof', 'metal_painted', 0.72, 0.19),
  floor: surface('foundation', 'stone_limestone_raw', 0.87),
  bronze: surface('trim', 'metal_bronze_cast', 0.72, 0.17),
  window: surface('window', 'window_punched', 0.63, 0.02),
  dark: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
};
const C = palette({
  walls: 'c6b69f',
  trim: 'd5c8b2',
  ceiling: 'c4b59d',
  dark: '564e45',
  bronze: 'ad985f',
  paving: 'b5ae9c',
  lead: '8f9798',
  leadDark: '747d7d',
  pier: 'baaa95',
  sandstone: 'b4947e',
  window: '5b6161',
  warm: 'b6a48d',
  water: '789494',
});
const roofCenter = [0.8, 43.0];
const porchDepth = 7.55;
const porchFront = 12.46;

function ring(out, slot, center, section, n, color) {
  loft(
    out,
    slot,
    section.map(([y, r]) => radialRing(y, r, r, n, center)),
    color,
  );
}
function stone(out, outline, low, high, tint, top = C.leadDark, roof = 'lead', selected) {
  shell(
    out,
    outline,
    typeof low === 'number' ? () => low : low,
    high,
    { wall: 'stone', color: tint, roof, roofColor: top },
    selected,
  );
}
function dome(out, center, r, y, top, lod, small = false) {
  if (small && lod === 0) {
    ring(
      out,
      'lead',
      center,
      [
        [y, r],
        [mix(y, top, 0.56), r * 0.81],
        [top, 0.072],
      ],
      5,
      C.lead,
    );
    return;
  }
  const profile = small
    ? [
        [y, r],
        [mix(y, top, 0.55), r * 0.83],
        [mix(y, top, 0.86), r * 0.51],
        [top, r * 0.11],
      ]
    : [
        [y, r],
        [mix(y, top, 0.31), r * 0.966],
        [mix(y, top, 0.53), r * 0.864],
        [mix(y, top, 0.76), r * 0.649],
        [mix(y, top, 0.92), r * 0.379],
        [top, 0.23],
      ];
  ring(out, 'lead', center, profile, small ? [6, 9, 12, 16][lod] : [12, 24, 36, 48][lod], C.lead);
  if (!small && lod > 0)
    ring(
      out,
      'bronze',
      center,
      [
        [top - 0.15, 0.21],
        [top + 0.43, 0.32],
        [top + 0.66, 0.17],
        [top + 1.03, 0.054],
      ],
      8,
      C.bronze,
    );
}
function arch(half, spring, rise, n) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const v = (Math.PI * i) / n;
    return [-half * Math.cos(v), spring + rise * Math.sin(v)];
  });
}
function window(out, w, u, base, half, spring, rise, depth, lod, round = false) {
  const n = lod === 3 ? 12 : 6;
  const path = round
    ? Array.from({ length: n }, (_, i) => [
        half * Math.cos((i * Math.PI * 2) / n),
        base + half * Math.sin((i * Math.PI * 2) / n),
      ])
    : [[-half, base], ...arch(half, spring, rise, n), [half, base]];
  face(
    out,
    'window',
    path.map(([x, y]) => w.p(u + x, y, depth)),
    w.normal,
    C.window,
  );
  if (lod < 2) return;
  if (round) {
    beamPath(
      out,
      'carving',
      path.map(([x, y]) => w.p(u + x, y, depth + 0.035)),
      0.078,
      0.068,
      C.trim,
      true,
    );
    return;
  }
  panel(out, 'carving', w, u - 0.025, u + 0.025, base, spring + rise - 0.07, depth + 0.036, C.trim);
  panel(out, 'carving', w, u - half, u + half, base - 0.058, base + 0.042, depth + 0.049, C.trim);
  if (lod === 3)
    beamPath(
      out,
      'carving',
      path.slice(1, -1).map(([x, y]) => w.p(u + x, y, depth + 0.04)),
      0.085,
      0.06,
      C.trim,
    );
}

function compound(out, outline, court, y, grade, lod) {
  const roof = y + 5.32;
  const normal = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    const wall = edge(a, b, normal);
    face(
      out,
      'stone',
      [at(a, grade(a) - 0.24), at(b, grade(b) - 0.24), at(b, roof), at(a, roof)],
      wall.normal,
      C.walls,
    );
    if (lod > 0)
      panel(out, 'carving', wall, 0, wall.length, roof - 0.38, roof - 0.18, 0.035, C.trim);
  }
  const points = [...outline, ...court];
  const tris = earcut(points.flat(), [outline.length]);
  for (let i = 0; i < tris.length; i += 3)
    face(
      out,
      'floor',
      tris.slice(i, i + 3).map((j) => at(points[j], roof)),
      up,
      C.paving,
    );
  cap(out, 'floor', court, y, C.paving);
  if (lod === 0) return;
  for (const [index, count] of [
    [0, 8],
    [1, 15],
    [2, 8],
  ]) {
    const wall = edge(court[index], court[(index + 1) % court.length], -areaSign(court));
    const span = wall.length / count;
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) * span;
      porticoBay(out, wall, u, span, y, roof, 1.85, lod, false);
      if (lod > 1) {
        const center = xz(wall.p(u, 0, -2.8));
        dome(out, center, Math.min(1.73, span * 0.47), roof, roof + 1.25, lod === 3 ? 2 : 1, true);
      }
    }
  }
}

function porticoBay(out, wall, u, span, y, cornice, depth, lod, striped) {
  const half = span * (striped ? 0.465 : 0.44);
  const spring = striped ? y + 4.35 : y + 2.42;
  const curve = arch(half, spring, striped ? 2.82 : 1.44, lod === 3 ? 12 : lod === 2 ? 8 : 4);
  const p = (a, h, d = 0) => wall.p(u + a, h, d);
  panel(out, 'stone', wall, u - span * 0.5, u - half, y, cornice, 0, C.walls);
  panel(out, 'stone', wall, u + half, u + span * 0.5, y, cornice, 0, C.walls);
  panel(out, 'dark', wall, u - span * 0.5, u + span * 0.5, y, cornice, -depth, C.dark);
  for (const [[a, h], [b, k]] of pairs(curve)) {
    face(out, 'stone', [p(a, h), p(b, k), p(b, cornice), p(a, cornice)], wall.normal, C.walls);
    if (lod > 1 && striped)
      face(
        out,
        'carving',
        [p(a, h), p(a, h, -depth), p(b, k, -depth), p(b, k)],
        [0, -1, 0],
        C.sandstone,
      );
  }
  if (striped && lod > 1)
    for (const [i, [[a, h], [b, k]]] of pairs(curve).entries())
      face(
        out,
        'carving',
        [p(a, h, 0.024), p(b, k, 0.024), p(b, k + 0.27, 0.024), p(a, h + 0.27, 0.024)],
        wall.normal,
        i % 2 === 0 ? C.trim : C.sandstone,
      );
  if (!striped || lod < 1) return;
  const base = xz(wall.p(u + span * 0.5, 0, 0.025));
  ring(
    out,
    'carving',
    base,
    [
      [y + 0.02, 0.4],
      [y + 0.33, 0.37],
      [spring - 0.47, 0.32],
      [spring - 0.02, 0.54],
    ],
    lod === 3 ? 12 : 8,
    C.trim,
  );
}

function mainPorch(out, y, lod) {
  const span = 6.09,
    n = 7,
    width = n * span,
    part = width / 2;
  const w = edge([-part, porchFront], [part, porchFront]);
  const top = y + 8.38;
  const inside = rect(-part, porchFront, part, porchFront + porchDepth);
  stone(out, inside, y - 0.22, top, C.walls, C.leadDark, 'lead', (i) => i !== 0);
  const paving = rect(-part - 0.12, porchFront - 1.05, part + 0.12, porchFront + porchDepth - 0.09);
  cap(out, 'floor', paving, y + 0.08, C.trim);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) * span;
    if (lod === 0) panel(out, 'dark', w, u - 2.21, u + 2.21, y + 0.15, y + 6.33, 0.025, C.dark);
    else porticoBay(out, w, u, span, y + 0.08, top, porchDepth - 0.31, lod, true);
    dome(out, xz(w.p(u, 0, -3.87)), 2.48, top - 0.02, top + 2.01, lod, true);
  }
  if (lod === 0) panel(out, 'stone', w, 0, width, y, top, -0.032, C.walls);
  else trimBlock(out, 'carving', w, 0, width, top - 0.32, top + 0.17, 0, 0.28, C.trim);
}

function prayerHall(out, y, grade, lod, height, diameter) {
  const front = 21.9,
    back = 58.15;
  const base = (p) => Math.min(grade(p) - 0.11, y - 0.33);
  stone(out, rect(-19.4, front, 20.9, back), base, y + 13.3, C.walls);
  for (const x of [-15.85, 17.2])
    for (const z of [29.0, 40.87, 52.75]) dome(out, [x, z], 3.81, y + 13.27, y + 16.45, lod, true);
  const box = rect(-12.2, 26.55, 13.5, 56.65);
  stone(out, box, y + 11.71, y + 25.6, C.walls);
  const r = diameter / 2;
  ring(
    out,
    'stone',
    roofCenter,
    [
      [y + 25, r + 0.44],
      [y + 26.1, r + 0.55],
      [y + 29.5, r + 0.47],
    ],
    [10, 18, 32, 48][lod],
    C.pier,
  );
  dome(out, roofCenter, r, y + 29.5, y + height, lod);
  for (const x of [-11.96, 13.22])
    for (const z of [27.1, 56.32]) {
      const center = [x, z];
      ring(
        out,
        'stone',
        center,
        [
          [y + 11.95, 2.08],
          [y + 25.4, 2.08],
        ],
        lod > 1 ? 12 : 7,
        C.pier,
      );
      if (lod > 0) dome(out, center, 2.12, y + 25.38, y + 27.1, lod, true);
    }
  if (lod === 0) return;
  for (const [i, [a, b]] of pairs(closed(box)).entries()) {
    const wall = edge(a, b, areaSign(box)),
      mid = wall.length / 2;
    const span = Math.min(12.04, wall.length * 0.46);
    const rim = arch(span, y + 13.26, 11.2, lod === 3 ? 20 : 12);
    const p = (u, h) => wall.p(mid + u, h, 0.065);
    if (lod > 1)
      beamPath(
        out,
        'carving',
        rim.map(([u, h]) => p(u, h)),
        0.35,
        0.24,
        C.trim,
      );
    for (const [row, n] of [
      [0, 7],
      [1, 5],
      [2, 3],
    ]) {
      const start = y + 13.85 + 3.3 * row;
      if (lod === 1 && row === 1) continue;
      for (let j = 0; j < n; j++) {
        const u = mid + 2.95 * (j - (n - 1) / 2);
        window(out, wall, u, start, 1.02, start + 1.72, 0.65, 0.055, lod);
      }
    }
    for (const sign of [-1, 1])
      window(out, wall, mid + sign * 7.1, y + 21.95, 0.91, 0, 0, 0.053, lod, true);
    panel(out, 'carving', wall, 0, wall.length, y + 25.17, y + 25.49, 0.08, C.trim);
    if (lod > 1 && i !== 0) {
      const outer = rect(-19.4, front, 20.9, back);
      const low = edge(outer[i], outer[(i + 1) % 4], areaSign(outer));
      for (let j = 0; j < 6; j++) {
        const u = (low.length * (j + 0.5)) / 6;
        opening(
          out,
          low,
          u - 0.72,
          u + 0.72,
          y + 4.8,
          y + 7.83,
          'carving',
          C.window,
          'window',
          C.trim,
          lod,
          0.03,
        );
      }
    }
  }
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI) / 8;
    const dx = Math.cos(angle),
      dz = Math.sin(angle),
      rr = r + 0.54;
    const [x, z] = roofCenter;
    const w = edge(
      [x + rr * dx + dz * 0.73, z + rr * dz - dx * 0.73],
      [x + rr * dx - dz * 0.73, z + rr * dz + dx * 0.73],
      -1,
    );
    window(out, w, w.length / 2, y + 26.48, 0.5, y + 27.95, 0.49, 0.005, lod);
  }
}

function minaret(out, center, y, height, lod) {
  const n = [7, 10, 14, 20][lod];
  if (lod === 0) {
    ring(
      out,
      'stone',
      center,
      [
        [y, 2.1],
        [y + 7.33, 1.29],
        [y + 29.7, 0.92],
        [y + 30.43, 1.52],
        [y + 31.26, 0.83],
        [y + 38.52, 0.62],
        [y + height, 0.04],
      ],
      n,
      C.trim,
    );
    return;
  }
  const shaft = y + 30.1;
  ring(
    out,
    'stone',
    center,
    [
      [y - 0.17, 2.07],
      [y + 6.4, 1.96],
      [y + 7.76, 1.19],
      [shaft - 1.82, 0.97],
    ],
    n,
    C.walls,
  );
  ring(
    out,
    'carving',
    center,
    [
      [shaft - 1.87, 0.99],
      [shaft - 0.54, 1.57],
      [shaft + 0.05, 1.59],
      [shaft + 0.72, 1.57],
      [shaft + 0.77, 0.79],
    ],
    n,
    C.trim,
  );
  ring(
    out,
    'stone',
    center,
    [
      [shaft + 0.75, 0.82],
      [y + 37.35, 0.69],
    ],
    n,
    C.trim,
  );
  ring(
    out,
    'lead',
    center,
    [
      [y + 37.29, 0.74],
      [y + 40.62, 0.34],
      [y + height - 0.31, 0.065],
    ],
    n,
    C.leadDark,
  );
  ring(
    out,
    'bronze',
    center,
    [
      [y + height - 0.49, 0.1],
      [y + height - 0.29, 0.18],
      [y + height, 0.053],
    ],
    8,
    C.bronze,
  );
}
function courtyardFountain(out, y, lod) {
  const center = [-0.8, 0.33],
    n = lod < 2 ? 10 : 18;
  ring(
    out,
    'carving',
    center,
    [
      [y, 2.89],
      [y + 0.18, 2.88],
      [y + 0.22, 2.39],
      [y + 1.35, 2.24],
      [y + 1.43, 2.35],
      [y + 1.52, 2.25],
    ],
    n,
    C.trim,
  );
  const basin = radialRing(0, 2.22, 2.22, n, center).map(xz);
  cap(out, 'floor', basin, y + 1.54, C.water);
  if (lod > 1)
    for (let i = 0; i < 8; i++) {
      const phi = (i * Math.PI) / 4;
      const x = center[0] + 2.27 * Math.cos(phi),
        z = center[1] + 2.27 * Math.sin(phi);
      block(out, 'carving', x - 0.115, y + 0.46, z - 0.115, 0.23, 1.07, 0.23, C.trim);
    }
}

function draw(out, lod, controls, grade) {
  const {
    outline,
    parts,
    courtyardFloor: y,
    mainDomeHeight,
    mainDomeDiameter,
    minaret: center,
    minaretHeight,
  } = controls;
  compound(out, outline, parts.court, y, grade, lod);
  prayerHall(out, y, grade, lod, mainDomeHeight, mainDomeDiameter);
  mainPorch(out, y, lod);
  minaret(out, center, y, minaretHeight, lod);
  courtyardFountain(out, y, lod);
}
const mosque = pavilion(
  import.meta.url,
  {
    surfaces,
    camera: [-102, 70, -115],
    lookAt: [0, 11, 23],
    sun: [-270, 530, -700],
    yaw: -2.08,
    brief:
      'The Edirnekapı Mihrimah Sultan Mosque, with seven marble porch bays, a windowed dome, tall single minaret and enclosed madrasa court.',
    views: [
      {
        name: 'courtyard-porch-and-windowed-tympanum',
        position: [15, 12, -9],
        lookAt: [-1, 18, 39],
      },
      {
        name: 'single-minaret-and-ottoman-roofline',
        position: [-79, 39, 32],
        lookAt: [-6, 20, 38],
      },
      { name: 'mapped-madrasa-enclosure-and-basin', position: [59, 94, -35], lookAt: [0, 8, 18] },
      { name: 'side-galleries-and-domes', position: [78, 37, 91], lookAt: [1, 16, 42] },
    ],
  },
  draw,
);

export const { skyline, district, street, closeup } = mosque;
const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const model = {
  ...mosque.model,
  category: 'religious',
  recipeDependencies: [...mosque.model.recipeDependencies, 'authored-structure-mesh.mjs'],
  embeddedCanonicalGraphs: mosque.model.embeddedCanonicalGraphs.filter(Boolean),
  buildingCutout: {
    outline: plan.dimensions.outline,
    minimumCoverage: 0.9,
    basis:
      'The named mosque and madrasa enclosure replaces the procedural building around its open courtyard.',
  },
};
