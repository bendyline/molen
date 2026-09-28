/** Completed 2018 RSHP tower: stepped cruciform shaft and external corner K frames. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  commonLimit,
  face,
  grid,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
} from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';

const silver = [0.62, 0.67, 0.69],
  glass = [0.28, 0.39, 0.43],
  dark = [0.07, 0.095, 0.11];
const levels = { podium: 62.484, south: 218.8464, north: 284.988, top: 328.8792 };
const rect = (x0, z0, x1, z1) => [
  [x0, z0],
  [x0, z1],
  [x1, z1],
  [x1, z0],
];
function cleanPlan(plan) {
  return plan.filter((p, i) => {
    const a = plan[(i + plan.length - 1) % plan.length],
      b = plan[(i + 1) % plan.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return (
      length < 0.01 ||
      Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / length > 0.025
    );
  });
}
function edges(plan) {
  return plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, length, n: [-(b[1] - a[1]) / length, 0, (b[0] - a[0]) / length] };
    })
    .filter((e) => e.length > 0.06);
}
function inside([x, z], plan) {
  let hit = false;
  for (let i = 0, j = plan.length - 1; i < plan.length; j = i++) {
    const a = plan[i],
      b = plan[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      hit = !hit;
  }
  return hit;
}
function exposed(block, blocks, bottom) {
  const result = [];
  for (const edge of edges(block.plan)) {
    const { a, b, n, length } = edge,
      d = [b[0] - a[0], b[1] - a[1]],
      cuts = [0, 1];
    for (const other of blocks) {
      if (other === block) continue;
      for (const p of other.plan) {
        const t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / (length * length);
        if (t > 1e-6 && t < 1 - 1e-6) cuts.push(t);
      }
    }
    cuts.sort((a, b) => a - b);
    for (let j = 1; j < cuts.length; j++) {
      if ((cuts[j] - cuts[j - 1]) * length < 0.06) continue;
      const aa = lerp(a, b, cuts[j - 1]),
        bb = lerp(a, b, cuts[j]),
        mid = lerp(aa, bb, 0.5);
      const outward = [mid[0] + n[0] * 0.03, mid[1] + n[2] * 0.03];
      const low = Math.max(
        bottom,
        ...blocks.filter((o) => o !== block && inside(outward, o.plan)).map((o) => o.top),
      );
      if (low < block.top - 0.03) result.push({ a: aa, b: bb, n, bottom: low, top: block.top });
    }
  }
  return result;
}
function facade(out, edge, y0, y1, pitch = 4.1148, paneWidth = 1.524) {
  const { a, b, n } = edge,
    width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const at = (u, y, d = 0) => [
    a[0] + (b[0] - a[0]) * u + n[0] * d,
    y,
    a[1] + (b[1] - a[1]) * u + n[2] * d,
  ];
  // Keep module positions stable when a neighboring shoulder hides part of a wall.
  const cuts = [y0],
    datum = pitch === 3.048 ? 0 : levels.podium;
  for (let y = datum + Math.ceil((y0 - datum) / pitch) * pitch; y < y1 - 0.01; y += pitch)
    if (y > y0 + 0.01) cuts.push(y);
  cuts.push(y1);
  const nx = Math.max(1, Math.round(width / paneWidth));
  for (let j = 1; j < cuts.length; j++) {
    const lo = cuts[j - 1],
      hi = cuts[j],
      spandrel = Math.min(0.63, (hi - lo) * 0.23);
    for (let i = 0; i < nx; i++) {
      const u = i / nx,
        v = (i + 1) / nx;
      if (hi - lo - spandrel > 0.03)
        grid(
          out,
          [at(u, lo), at(v, lo), at(v, hi - spandrel), at(u, hi - spandrel)],
          glass,
          width / nx + 0.01,
          hi - lo,
          0.047,
          silver,
          'stainless',
        );
      face(
        out,
        'glass',
        [at(u, hi - spandrel), at(v, hi - spandrel), at(v, hi), at(u, hi)],
        [0.2, 0.29, 0.33],
      );
      beam(out, 'stainless', at(v, lo, 0.045), at(v, hi, 0.045), 0.065, 0.09, silver);
    }
    beam(out, 'stainless', at(0, hi, 0.075), at(1, hi, 0.075), 0.11, 0.15, silver);
  }
}
function louvers(out, edge, y0, y1) {
  const { a, b, n } = edge;
  const at = (p, y, d = 0) => [p[0] + n[0] * d, y, p[1] + n[2] * d];
  face(
    out,
    'recess',
    [at(a, y0, -0.15), at(b, y0, -0.15), at(b, y1, -0.15), at(a, y1, -0.15)],
    dark,
  );
  for (let y = y0 + 0.16; y < y1; y += 0.43)
    beam(out, 'stainless', at(a, y, 0.045), at(b, y, 0.045), 0.14, 0.24, silver);
  const count = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3.048));
  for (let i = 0; i <= count; i++) {
    const p = lerp(a, b, i / count);
    beam(out, 'stainless', at(p, y0, 0.2), at(p, y1, 0.2), 0.15, 0.22, silver);
  }
}
function kFrame(out, x, z0, z1, top, side) {
  const low = levels.podium + 0.45,
    hi = top - 1.2,
    depth = 0.7;
  const at = (z, y) => [x, y, z];
  for (const z of [z0, z1]) beam(out, 'stainless', at(z, low), at(z, hi), 0.8, depth, silver);
  const inner = Math.abs(z0) < Math.abs(z1) ? z0 : z1,
    outer = inner === z0 ? z1 : z0;
  const count = Math.max(1, Math.round((hi - low) / (6 * 4.1148)));
  for (let k = 0; k < count; k++) {
    const a = low + ((hi - low) * k) / count,
      b = low + ((hi - low) * (k + 1)) / count,
      mid = (a + b) / 2;
    beam(out, 'stainless', at(outer, a), at(inner, mid), 0.65, 0.72, silver);
    beam(out, 'stainless', at(inner, mid), at(outer, b), 0.65, 0.72, silver);
    beam(out, 'stainless', at(z0, a), at(z1, a), 0.48, 0.58, silver);
    for (const [z, y] of [
      [outer, a],
      [inner, mid],
      [outer, b],
    ]) {
      box(
        out,
        'stainless',
        [x - 0.5, y - 0.6, z - 0.6],
        [x + 0.5, y + 0.6, z + 0.6],
        [0.56, 0.61, 0.63],
      );
      // Narrow plate seams are physical cover joints, without invented bolt arrays.
      beam(
        out,
        'metal',
        [x + side * 0.52, y, z - 0.5],
        [x + side * 0.52, y, z + 0.5],
        0.022,
        0.027,
        dark,
      );
    }
  }
  beam(out, 'stainless', at(z0, hi), at(z1, hi), 0.48, 0.58, silver);
}
function glassGuard(out, a, b, y) {
  const d = [b[0] - a[0], b[1] - a[1]],
    length = Math.hypot(...d),
    n = [-d[1] / length, d[0] / length];
  const at = (t, v) => [a[0] + d[0] * t, y + v, a[1] + d[1] * t];
  const count = Math.max(1, Math.ceil(length / 1.524));
  for (let i = 0; i < count; i++) {
    const p = [
      at(i / count, 0.12),
      at((i + 1) / count, 0.12),
      at((i + 1) / count, 1.13),
      at(i / count, 1.13),
    ];
    face(out, 'glass', p, [0.35, 0.46, 0.49]);
    face(out, 'glass', p.toReversed(), [0.35, 0.46, 0.49]);
    tube(out, 'stainless', at(i / count, 0.03), at(i / count, 1.18), 0.035, silver, 8);
  }
  beam(out, 'stainless', at(0, 1.18), at(1, 1.18), 0.055, 0.08, silver);
  beam(
    out,
    'metal',
    [a[0] + n[0] * 0.03, y + 0.1, a[1] + n[1] * 0.03],
    [b[0] + n[0] * 0.03, y + 0.1, b[1] + n[1] * 0.03],
    0.15,
    0.19,
    silver,
  );
}
function planter(out, x, z, y, w = 2.4, d = 1.7) {
  box(out, 'stone', [x - w / 2, y, z - d / 2], [x + w / 2, y + 0.55, z + d / 2], [0.38, 0.4, 0.39]);
  box(
    out,
    'recess',
    [x - w / 2 + 0.12, y + 0.55, z - d / 2 + 0.12],
    [x + w / 2 - 0.12, y + 0.6, z + d / 2 - 0.12],
    [0.12, 0.1, 0.07],
  );
  for (let i = 0; i < 4; i++)
    sphere(
      out,
      'foliage',
      [x + ((i % 2) - 0.5) * w * 0.55, y + 0.83, z + (Math.floor(i / 2) - 0.5) * d * 0.55],
      [w * 0.28, 0.36, d * 0.29],
      [0.18, 0.29, 0.14],
      12,
      6,
    );
}
function entrance(out, base) {
  // The oblique Greenwich elevation is the full-height cable-net lobby.
  const westPoints = base.filter((p) => p[0] < -30).sort((a, b) => a[1] - b[1]);
  // The map inserts collinear nodes halfway along the Greenwich wall; retain
  // the whole lobby frontage instead of treating one half as the entrance wall.
  const west = edges([westPoints[0], westPoints.at(-1)])[0];
  const at = (u, y, d = 0) => [
    west.a[0] + (west.b[0] - west.a[0]) * u + west.n[0] * d,
    y,
    west.a[1] + (west.b[1] - west.a[1]) * u + west.n[2] * d,
  ];
  const count = Math.max(1, Math.round(west.length / 3.048));
  for (let i = 0; i <= count; i++) {
    tube(out, 'stainless', at(i / count, 0.2, 0.1), at(i / count, 18.288, 0.1), 0.027, silver, 6);
    for (let y = 3.048; y < 18.2; y += 3.048)
      sphere(out, 'stainless', at(i / count, y, 0.14), [0.065, 0.065, 0.065], silver, 8, 4);
  }
  for (let y = 3.048; y < 18.2; y += 3.048)
    tube(out, 'stainless', at(0, y, 0.1), at(1, y, 0.1), 0.022, silver, 6);
  for (const u of [0.28, 0.5, 0.72]) {
    const c = at(u, 0, 0.2),
      r = 1.48;
    const rings = [
      radialRing(0.12, r, r, 36, [c[0], c[2]]),
      radialRing(3.08, r, r, 36, [c[0], c[2]]),
    ];
    for (let i = 0; i < 36; i++) {
      const pane = [rings[0][i], rings[0][(i + 1) % 36], rings[1][(i + 1) % 36], rings[1][i]];
      face(out, 'clear_glass', pane, [0.68, 0.8, 0.83]);
      if (i % 9 === 0) tube(out, 'stainless', rings[0][i], rings[1][i], 0.035, silver, 8);
    }
    tube(out, 'stainless', [c[0], 0.12, c[2]], [c[0], 3.08, c[2]], 0.055, silver, 10);
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3,
        x = c[0] + r * Math.cos(angle),
        z = c[2] + r * Math.sin(angle);
      const pane = [
        [c[0], 0.18, c[2]],
        [x, 0.18, z],
        [x, 3.03, z],
        [c[0], 3.03, c[2]],
      ];
      face(out, 'clear_glass', pane, [0.68, 0.8, 0.83]);
      tube(out, 'stainless', [x, 0.18, z], [x, 3.03, z], 0.03, silver, 8);
    }
    loft(
      out,
      'stainless',
      [
        radialRing(3.08, r + 0.13, r + 0.13, 36, [c[0], c[2]]),
        radialRing(3.4, r + 0.13, r + 0.13, 36, [c[0], c[2]]),
      ],
      silver,
    );
  }
  // Shallow entrance eyebrow, aligned to the actual skew street wall.
  const roof = [at(0.16, 3.62, 0.0), at(0.84, 3.62, 0.0), at(0.84, 3.62, 2.2), at(0.16, 3.62, 2.2)];
  face(out, 'glass', roof, [0.32, 0.43, 0.46]);
  face(out, 'glass', roof.toReversed(), [0.32, 0.43, 0.46]);
  for (let i = 0; i < 4; i++)
    beam(out, 'stainless', roof[i], roof[(i + 1) % 4], 0.13, 0.17, silver);
}
export function build3Wtc(out, mapped) {
  const ev = partsEvidence('n0195_3_world_trade_center'),
    base = cleanPlan(localOutline(mapped));
  // Raw mapped shoulder traces are irregular/overlapping; the architect's typical
  // floor plan confirms four reentrant corners and eight corner offices.
  const raw = ev
    .filter((p) => p.id >= 960146508 && p.id <= 960146511)
    .map((p) => partPlan(mapped, p));
  if (raw.length !== 4) throw Error('3 WTC needs four attributed component footprints');
  const blocks = [
    { name: 'central', plan: rect(-8.9, -16.2, 48.51, 16.2), top: levels.top },
    { name: 'north', plan: rect(-3.08, -30.432, 43.996, -16.2), top: levels.north },
    { name: 'south', plan: rect(-3.08, 16.2, 43.996, 30.432), top: levels.south },
  ];
  mappedCap(out, 'foundation', base, 0, [0.39, 0.4, 0.39], [], true);
  for (const edge of edges(base)) {
    facade(out, edge, 0, 18.288, 3.048, 3.048);
    louvers(out, edge, 18.288, 32.004);
    facade(out, edge, 32.004, levels.podium, 6.096, 3.048);
  }
  mappedCap(out, 'stone', base, levels.podium, [0.48, 0.49, 0.46]);
  for (const edge of edges(base)) glassGuard(out, edge.a, edge.b, levels.podium);
  for (let z = -20; z <= 20; z += 8) planter(out, -25, z, levels.podium, 3.4, 1.4);
  for (const block of blocks) {
    for (const edge of exposed(block, blocks, levels.podium)) {
      const hi = block.name === 'central' ? Math.min(edge.top, 310.8) : edge.top;
      if (edge.bottom < hi - 0.01) facade(out, edge, edge.bottom, hi);
      if (hi < edge.top) louvers(out, edge, hi, edge.top - 0.65);
      if (block.name === 'central')
        beam(
          out,
          'stainless',
          [edge.a[0], levels.top - 0.35, edge.a[1]],
          [edge.b[0], levels.top - 0.35, edge.b[1]],
          0.55,
          0.65,
          silver,
        );
    }
    mappedCap(
      out,
      'metal',
      block.plan,
      block.top - (block.name === 'central' ? 0.7 : 0),
      [0.34, 0.39, 0.4],
    );
    const higher = blocks.filter((b) => b.top > block.top);
    for (const e of exposed({ ...block, top: block.top + 0.1 }, higher, block.top)) {
      if (block.name !== 'central') glassGuard(out, e.a, e.b, block.top);
    }
    if (block.name !== 'central') {
      const z = block.name === 'north' ? -26.3 : 26.3;
      for (let x = 0; x <= 36; x += 9) planter(out, x, z, block.top);
      for (let x = 5; x <= 32; x += 9)
        box(
          out,
          'metal',
          [x - 1.2, block.top + 0.08, z - 3.6],
          [x + 1.2, block.top + 0.52, z - 3.0],
          [0.46, 0.42, 0.34],
        );
    }
  }
  for (const [x, side] of [
    [-3.53, -1],
    [44.446, 1],
  ]) {
    kFrame(out, x, -26.1, -16.45, levels.north, side);
    kFrame(out, x, 16.45, 26.1, levels.south, side);
  }
  // Full-height exposed corner columns project above the glass into the crown.
  for (const x of [-9.25, 48.86])
    for (const z of [-16.55, 16.55])
      box(
        out,
        'stainless',
        [x - 0.34, levels.podium, z - 0.34],
        [x + 0.34, levels.top, z + 0.34],
        silver,
      );
  // Roof mechanical deck and small service equipment below the parapet.
  for (let x = 2; x < 39; x += 9)
    for (const z of [-8, 5]) {
      box(
        out,
        'metal',
        [x - 2.8, levels.top - 0.68, z - 2.7],
        [x + 2.8, levels.top - 0.12, z + 2.7],
        [0.44, 0.49, 0.5],
      );
      for (let j = 0; j < 8; j++)
        beam(
          out,
          'metal',
          [x - 2.6, levels.top - 0.08, z - 2.4 + j * 0.66],
          [x + 2.6, levels.top - 0.08, z - 2.4 + j * 0.66],
          0.12,
          0.1,
          dark,
        );
    }
  entrance(out, base);
}
export const threeWtcStudy = {
  id: 'N0195',
  key: '3_world_trade_center',
  wikidataId: 'Q941908',
  title: '3 World Trade Center',
  height: levels.top,
  build: build3Wtc,
  brief:
    'Completed RSHP tower with three unequal glazed planes, external stainless-steel K braces, eight corner offices, three landscaped terraces and the skew Greenwich Street cable-net lobby.',
  sourceFacts: {
    architect: 'Rogers Stirk Harbour + Partners',
    completed: 2018,
    architecturalHeightFeet: 1079,
    architecturalHeightMeters: levels.top,
    terracesFeet: { level17: 205, level60: 718, level76: 935 },
    terracesMeters: levels,
    typicalOfficeFloorMeters: 4.1148,
    tradingFloorMeters: 6.096,
    facadeModuleMeters: { tower: 1.524, podium: 3.048 },
    lobbyHeightMeters: 18.288,
    cladding: 'Glass curtain wall and stainless-steel-clad external corner K bracing',
  },
  reconstruction: {
    plan: 'The exact ground foot and four independently mapped component outlines retain the tower location and separate western podium. The architect published typical floor plan resolves the incomplete/overlapping raw shoulder traces into three connected rectangular planes with four reentrant corner zones. Northern shoulder is higher than southern.',
    facade:
      'Physical mullions, transoms and dark glass spandrels follow published five-foot and ten-foot unit pitches. Stainless corner columns, repeated K frames and cover plates project outside the glazing; the high mechanical crown has individually modeled louvers.',
    terraces:
      'Three primary published terrace elevations have separate decks, glass guards, planters and simple benches. The sixty-foot skew western lobby has modeled cable-net nodes and revolving-door enclosures.',
  },
  refs: [
    'https://rshp.com/projects/office/3-world-trade-center/',
    'https://rshp.com/assets/uploads/5270_3WorldTradeCenter_JS_en.pdf',
    'https://rshp.com/news/archive/rshp-celebrates-the-completion-of-3-world-trade-center-in-new-york/',
    'https://wtc.com/work-place/3wtc/',
    'https://www.openstreetmap.org/way/166839381',
  ],
  nativeAxes: {
    up: '+Y',
    front: '-X toward Greenwich Street and the memorial',
    north: '-Z toward Dey Street',
  },
  geographic: (m) => ({
    heading: m.heading,
    notes:
      'Exact-QID ground way166839381 and separately mapped podium/northern/southern/central parts retain the signed site frame. Native-X is Greenwich Street, +X Church Street, -Z Dey Street and +Z Cortlandt Street. RSHP corroborates the higher northern shoulder and western lobby. Primary completed1079ft height supersedes obsolete352m part tags; primary terrace datums supersede coarse map heights. GroundY0 is street entry.',
  }),
  limitations: [
    commonLimit,
    'The mapped shoulder outlines contain small overlaps and an incomplete corner; the architect typical-floor diagram governs the regularized cruciform plan within the measured envelope. Exact facade phase, K-brace cadence and section, mechanical crown depth, entry hardware and planted terrace layout are reconstructed from completed architect photographs. Separate Oculus, memorial, surrounding landscaping and subterranean/interior fit-out are excluded.',
  ],
  camera: { position: [-252, 215, -252], lookAt: [0, 162, 0], fov: 40 },
  qaCameras: [
    { name: 'three-stepped-planes', position: [-176, 205, -145], lookAt: [10, 174, 0] },
    { name: 'church-street-east', position: [177, 188, 123], lookAt: [20, 171, 0] },
    { name: 'stainless-k-braces', position: [-47, 156, -51], lookAt: [-9, 147, -22] },
    { name: 'unitized-curtain-wall', position: [-37, 125, 7], lookAt: [-8.9, 118, 1] },
    { name: 'higher-northern-terrace', position: [-41, 302, -69], lookAt: [11, 284, -24] },
    { name: 'lower-southern-terrace', position: [-38, 241, 70], lookAt: [14, 219, 25] },
    { name: 'level17-western-garden', position: [-92, 88, -78], lookAt: [-26, 63, 0] },
    { name: 'mechanical-crown', position: [-56, 355, 75], lookAt: [17, 319, 0] },
    { name: 'lobby-cable-net', position: [-77, 19, -34], lookAt: [-43, 10, 0] },
    { name: 'greenwich-entry-doors', position: [-67, 8, -13], lookAt: [-42, 3, 0] },
    { name: 'podium-trading-floors', position: [-107, 46, 69], lookAt: [-27, 44, 0] },
    { name: 'far-memorial-profile', position: [-370, 101, 200], lookAt: [0, 164, 0] },
  ],
};
