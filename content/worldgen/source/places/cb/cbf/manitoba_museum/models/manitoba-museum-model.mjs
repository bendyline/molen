/** Manitoba Museum and Planetarium on Main Street, October 2012. */
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  S = plan.section,
  grid = read('terrain-grid');
const [gallery, alloway, festival, dome] = read('map-frame').geometry.polygons;
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_panel', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_copper', roughness: 0.91, metallic: 0.04 },
  inset: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.58, metallic: 0.05 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.88, metallic: 0.09 },
};
const tone = Object.fromEntries(
  Object.entries({
    concrete: 'b9b5a5',
    light: 'c7c1af',
    shade: 'a4a395',
    darker: '878b7c',
    base: '77796e',
    metal: '627267',
    metalDark: '56675f',
    metalLight: '6c7c6f',
    gray: '858780',
    glass: '505453',
    shadow: '353e3d',
    amber: '86564b',
  }).map(([key, v]) => [key, rgb(v)]),
);
const up = [0, 1, 0],
  mix = (a, b, t) => a + (b - a) * t;
const interpolate = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const point = ([x, z], y) => [x, y, z];
function ground([x, z]) {
  const u = (x - grid.origin[0]) / grid.stepMeters,
    v = (z - grid.origin[1]) / grid.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = grid.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    grid.modelDatumElevationMeters
  );
}
function draw(out, slot, p, n, color) {
  const k = normalFor(...p);
  if (!k.some(Boolean)) return;
  (p.length === 3 ? triangle : face)(
    out,
    slot,
    k.reduce((sum, x, i) => sum + x * n[i], 0) > 0 ? p : p.toReversed(),
    color,
  );
}
function fill(out, slot, shape, y, color) {
  const tris = earcut(shape.flat());
  for (let i = 0; i < tris.length; i += 3)
    draw(
      out,
      slot,
      tris.slice(i, i + 3).map((j) => point(shape[j], y)),
      up,
      color,
    );
}
function edge(a, b, sign = 1) {
  const x = b[0] - a[0],
    z = b[1] - a[1],
    L = Math.hypot(x, z),
    n = [(sign * z) / L, (-sign * x) / L],
    u = [x / L, z / L];
  return {
    L,
    n: [n[0], 0, n[1]],
    u,
    p: (s, y, d = 0) => [a[0] + u[0] * s + n[0] * d, y, a[1] + u[1] * s + n[1] * d],
  };
}
function panel(out, slot, f, u, v, b, t, d, color) {
  draw(out, slot, [f.p(u, b, d), f.p(v, b, d), f.p(v, t, d), f.p(u, t, d)], f.n, color);
}
const winding = (p) =>
  Math.sign(
    p.reduce((sum, [x, z], i) => {
      const [a, b] = p[(i + 1) % p.length];
      return sum + x * b - z * a;
    }, 0),
  );
function envelope(out, p, top, lod, col, base = undefined) {
  const sign = winding(p);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      f = edge(a, b, sign);
    const y0 = base ?? ground(a) - 0.35,
      y1 = base ?? ground(b) - 0.35;
    draw(
      out,
      'concrete',
      [f.p(0, y0), f.p(f.L, y1), f.p(f.L, top), f.p(0, top)],
      f.n,
      i % 4 ? col : tone.shade,
    );
    if (lod >= 1 && f.L > 3) {
      panel(out, 'trim', f, 0, f.L, top - 0.33, top + 0.045, 0.063, tone.light);
      if (lod >= 2 && f.L > 13) {
        panel(
          out,
          'trim',
          f,
          0,
          f.L,
          Math.max(y0, y1) + 0.45,
          Math.max(y0, y1) + 0.66,
          0.045,
          tone.shade,
        );
        const count = Math.floor(f.L / 4);
        for (let q = 1; q < count; q++) {
          const s = (f.L * q) / count;
          panel(
            out,
            'trim',
            f,
            s - 0.032,
            s + 0.032,
            Math.max(y0, y1) + 0.67,
            top - 0.33,
            0.058,
            tone.shade,
          );
        }
      }
    }
  }
  fill(out, 'trim', p, top, tone.gray);
}
function tower(out, lod) {
  const [a, b] = S.festivalFacade.map((i) => festival[i]),
    dir = edge(a, b, winding(festival));
  const facadeWidth = dir.L,
    high = S.festivalHeight,
    base = -0.22;
  const f0 = dir.p(0.65, 0, 2.4),
    f1 = dir.p(facadeWidth - 0.48, 0, 2.4);
  const front = edge([f0[0], f0[2]], [f1[0], f1[2]], winding(festival)),
    w = front.L;
  envelope(out, festival, high - 0.48, lod, tone.concrete);
  // The concrete perimeter frame stands outside the dark window bands and recessed entry.
  for (const u of [0, w]) {
    const normal = [front.u[0] * (u ? 1 : -1), 0, front.u[1] * (u ? 1 : -1)];
    draw(
      out,
      'concrete',
      [
        front.p(u, base, 0.1),
        front.p(u, base, -2.56),
        front.p(u, high, -2.56),
        front.p(u, high, 0.1),
      ],
      normal,
      tone.concrete,
    );
  }
  draw(
    out,
    'trim',
    [
      front.p(0, high, 0.14),
      front.p(w, high, 0.14),
      front.p(w, high, -2.52),
      front.p(0, high, -2.52),
    ],
    up,
    tone.light,
  );
  const rows = lod === 0 ? 4 : 6,
    cols = lod === 0 ? 3 : 5;
  const minY = 4.15,
    maxY = high - 1.8;
  for (let r = 0; r < rows; r++) {
    const lo = mix(minY, maxY, r / rows),
      hi = mix(minY, maxY, (r + 1) / rows);
    panel(out, 'inset', front, 0.58, w - 0.52, lo + 0.48, hi - 0.12, 0.041, tone.shadow);
    panel(out, 'trim', front, 0, w, lo - 0.06, lo + 0.48, 0.083, tone.light);
    if (lod >= 1) {
      for (let j = 0; j < cols; j++) {
        const x = ((j + 0.5) * w) / cols;
        panel(
          out,
          'inset',
          front,
          x - (w / cols) * 0.315,
          x + (w / cols) * 0.315,
          lo + 1.24,
          hi - 0.46,
          0.062,
          tone.glass,
        );
        if (lod >= 2)
          for (const k of [-1, 0, 1]) {
            const xbar = x + ((k * w) / cols) * 0.16;
            panel(
              out,
              'steel',
              front,
              xbar - 0.026,
              xbar + 0.026,
              lo + 1.24,
              hi - 0.46,
              0.074,
              tone.shadow,
            );
          }
      }
    }
  }
  for (let j = 0; j <= cols; j++) {
    const x = (j * w) / cols,
      col = j === 0 || j === cols ? 0.49 : 0.31;
    panel(
      out,
      'trim',
      front,
      Math.max(0, x - col),
      Math.min(w, x + col),
      minY - 0.12,
      high,
      0.13,
      tone.light,
    );
  }
  panel(out, 'trim', front, 0, w, high - 0.79, high, 0.136, tone.light);
  panel(out, 'inset', front, 0.88, w - 0.86, base + 0.57, minY, 0.068, tone.shadow);
  panel(out, 'trim', front, 0, 0.84, base, minY, 0.13, tone.light);
  panel(out, 'trim', front, w - 0.84, w, base, minY, 0.13, tone.light);
  if (lod > 0) {
    for (const x of [w * 0.28, w * 0.47, w * 0.65, w * 0.82])
      panel(out, 'trim', front, x - 0.19, x + 0.19, base + 0.26, minY - 0.03, 0.17, tone.shade);
    for (const x of [w * 0.051, w * 0.072, w * 0.093]) {
      panel(out, 'steel', front, x - 0.043, x + 0.043, 3.15, high + 1.65, 0.199, tone.amber);
    }
  }
  const p = (x, y, d) => front.p(x, y, d);
  const length = lod === 0 ? 2 : 4;
  for (let j = 0; j < length; j++) {
    const lo = 0.4 + 0.41 * j,
      hi = lo + 0.43,
      y = 0.56 - 0.2 * j;
    draw(out, 'trim', [p(0, y, lo), p(w, y, lo), p(w, y, hi), p(0, y, hi)], up, tone.shade);
    panel(out, 'trim', front, 0, w, y - 0.2, y, hi, tone.base);
  }
}
function planetarium(out, lod) {
  const c = dome.reduce((s, p) => [s[0] + p[0] / dome.length, s[1] + p[1] / dome.length], [0, 0]);
  const base = -0.22,
    eave = S.domeStart,
    apex = S.domeHeight,
    sign = winding(dome);
  for (let j = 0; j < dome.length; j++) {
    const a = dome[j],
      b = dome[(j + 1) % dome.length],
      f = edge(a, b, sign);
    panel(out, 'concrete', f, 0, f.L, base, eave, 0, j % 3 === 0 ? tone.base : tone.darker);
    if (lod >= 1) panel(out, 'steel', f, 0, f.L, eave - 0.07, eave + 0.075, 0.025, tone.shadow);
  }
  const rows =
    lod === 0
      ? [0, 0.43, 1]
      : lod === 1
        ? [0, 0.25, 0.53, 0.77, 1]
        : [0, 0.14, 0.28, 0.43, 0.57, 0.71, 0.85, 1];
  function vertex(p, t) {
    const angle = (t * Math.PI) / 2;
    return [
      mix(c[0], p[0], Math.cos(angle)),
      mix(eave, apex, Math.sin(angle)),
      mix(c[1], p[1], Math.cos(angle)),
    ];
  }
  for (let j = 0; j < dome.length; j++) {
    const a = dome[j],
      b = dome[(j + 1) % dome.length];
    for (let k = 1; k < rows.length; k++) {
      const lo = rows[k - 1],
        hi = rows[k];
      const panels = lod === 3 ? 3 : lod === 2 ? 2 : 1;
      for (let q = 0; q < panels; q++) {
        const x = interpolate(a, b, q / panels),
          y = interpolate(a, b, (q + 1) / panels);
        const skin = [vertex(x, lo), vertex(y, lo), vertex(y, hi)];
        if (hi < 1) skin.push(vertex(x, hi));
        draw(
          out,
          'roof',
          skin,
          up,
          [tone.metal, tone.metalLight, tone.metal, tone.metalDark][
            (j + q + (k % 3 === 0 ? 1 : 0)) % 4
          ],
        );
      }
    }
  }
}
function build(out, lod) {
  envelope(out, gallery, S.galleryHeight, lod, tone.concrete);
  envelope(out, alloway, S.allowayHeight, lod, tone.light);
  tower(out, lod);
  planetarium(out, lod);
}
export const museumSkyline = (out) => build(out, 0);
export const museumDistrict = (out) => build(out, 1);
export const museumStreet = (out) => build(out, 2);
export const museumCloseup = (out) => build(out, 3);
const camera = [-156, 61, -95],
  lookAt = [-15, 6, 0],
  recipe = 'manitoba-museum-model.mjs';
const outline = gallery;
export const museumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: museumCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Winnipeg’s Manitoba Museum with broad concrete galleries, the tall street entrance grid, and the low copper planetarium dome.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-22, 35, -18],
  portableGroundY: -0.6,
  mediumFiContext: {
    scale: 0.91,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.85,
    basis: 'Mapped principal gallery footprint; museum wings and planetarium separately mapped.',
  },
  embeddedCanonicalGraphs: ['concrete_panel', 'concrete_plain', 'metal_copper', 'metal_painted'],
  qaCameras: [
    { name: 'main-street-dome-and-grid', position: [-120, 14, -20], lookAt: [-63, 12, -20] },
    { name: 'copper-planetarium-and-plaza', position: [-101, 10, 16], lookAt: [-70, 6, 1] },
    { name: 'mapped-wings-and-festival-hall', position: [118, 80, 91], lookAt: [-12, 8, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `museum-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 0.79,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'museumDistrict', 0.39],
        ['street', 'museumStreet', 0.15],
        ['closeup', 'museumCloseup', 0.058],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Mapped building outlines are ODbL. The Qualla photo is CC0 own work by Ccyyrree (ElatedCoder).',
};
