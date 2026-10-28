/** Whole ancient dam ruins in the original1843 survey phase; bounded sections, not a restoration. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  D = P.dimensions;
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.95, metallic: 0 },
  earth: { slot: 'foundation', graph: 'earth_rammed', roughness: 0.98, metallic: 0 },
};
const colors = { stone: rgb('b8a17a'), earth: rgb('a8946d') };
export const partEvidence = [],
  gateEvidence = [];
const point = (site, u, y, v) => [
  site.center[0] + site.axis[0] * u - site.axis[1] * v,
  site.y + y,
  site.center[1] + site.axis[1] * u + site.axis[0] * v,
];
export const localPoint = point;
function tri(o, k, ps, color = colors[k]) {
  const p = ps.map((q) => q.map(Math.fround)),
    n = normalFor(...p);
  if (!n.every(Number.isFinite)) throw Error('Degenerate authored triangle');
  o.addTriangle(
    k,
    'palette:#ffffff',
    p,
    n,
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    color,
  );
}
function face(o, k, p, n, color) {
  if (n && normalFor(...p).reduce((s, v, i) => s + v * n[i], 0) < 0) p = p.slice().reverse();
  for (let i = 1; i < p.length - 1; i++) tri(o, k, [p[0], p[i], p[i + 1]], color);
}
function pose(out, site) {
  return {
    addTriangle(k, r, ps, _n, uv, color) {
      const p = ps.map((q) => point(site, ...q));
      out.addTriangle(k, r, p, normalFor(...p), uv, color);
    },
  };
}
function box(o, k, x, y, z, w, h, d, color) {
  const a = x - w / 2,
    b = x + w / 2,
    f = z - d / 2,
    g = z + d / 2,
    e = y + h;
  for (const [p, n] of [
    [
      [
        [a, y, g],
        [b, y, g],
        [b, e, g],
        [a, e, g],
      ],
      [0, 0, 1],
    ],
    [
      [
        [b, y, f],
        [a, y, f],
        [a, e, f],
        [b, e, f],
      ],
      [0, 0, -1],
    ],
    [
      [
        [a, y, f],
        [a, y, g],
        [a, e, g],
        [a, e, f],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [b, y, g],
        [b, y, f],
        [b, e, f],
        [b, e, g],
      ],
      [1, 0, 0],
    ],
    [
      [
        [a, e, g],
        [b, e, g],
        [b, e, f],
        [a, e, f],
      ],
      [0, 1, 0],
    ],
    [
      [
        [a, y, f],
        [b, y, f],
        [b, y, g],
        [a, y, g],
      ],
      [0, -1, 0],
    ],
  ])
    face(o, k, p, n, color);
}
function stoneMole(out, m, lod) {
  const o = pose(out, m),
    segments = lod === 0 ? 1 : Math.ceil(m.length / (lod === 1 ? 12 : 6)),
    step = m.length / segments;
  for (let i = 0; i < segments; i++) {
    const h = m.height * (0.94 + 0.055 * Math.sin(i * 2.1 + 1)),
      x = (i + 0.5) * step;
    box(o, 'stone', x, 0, 0, step, h, m.width);
    if (lod >= 2) {
      const rows = lod === 2 ? 6 : 12,
        course = m.height / rows,
        bw = 5 * D.royalFootMeters;
      for (const side of [-1, 1])
        for (let row = 0; row < rows; row++) {
          const y = row * course + 0.025,
            hh = Math.min(course - 0.05, h - y);
          if (hh <= 0.02) continue;
          for (let start = i * step - ((row % 2) * bw) / 2; start < (i + 1) * step; start += bw) {
            const lo = Math.max(i * step, start) + 0.018,
              hi = Math.min((i + 1) * step, start + bw) - 0.018;
            if (hi - lo < 0.05) continue;
            const col = colors.stone.map(
              (v) => v * (0.88 + 0.1 * Math.sin(row * 1.7 + start * 0.4) ** 2),
            );
            face(
              o,
              'stone',
              [
                [lo, y, side * (m.width / 2 + 0.003)],
                [hi, y, side * (m.width / 2 + 0.003)],
                [hi, y + hh, side * (m.width / 2 + 0.003)],
                [lo, y + hh, side * (m.width / 2 + 0.003)],
              ],
              [0, 0, side],
              col,
            );
          }
        }
    }
  }
  if (lod >= 1) {
    const n = Math.floor(m.length / 22);
    for (let i = 0; i < n; i++)
      box(
        o,
        'stone',
        ((i + 0.5) * m.length) / n,
        0,
        -m.width / 2 - 0.65,
        1.7,
        m.height * 0.78,
        1.3,
      );
  }
  partEvidence.push({
    id: m.id,
    kind: 'retaining-stone-mole',
    length: m.length,
    width: m.width,
    height: m.height,
    floor: m.y,
  });
}
function massif(out, site, v, id, lod) {
  const o = pose(out, site),
    seg = [12, 16, 24, 32][lod],
    rows = [1, 3, 8, 12][lod],
    r0 = D.massifBaseRadiusEstimate,
    r1 = D.massifTopRadiusEstimate,
    H = D.massifHeight,
    ring = (row) =>
      Array.from({ length: seg }, (_, j) => {
        const a = (j / seg) * 2 * Math.PI,
          t = row / rows,
          r = r0 + (r1 - r0) * t,
          y = H * t + (row === rows ? 0.2 * Math.sin(j * 2.31 + v) : 0);
        return [Math.cos(a) * r, y, Math.sin(a) * r + v];
      });
  let a = ring(0);
  face(o, 'stone', a.slice().reverse(), [0, -1, 0]);
  for (let row = 1; row <= rows; row++) {
    const b = ring(row);
    for (let j = 0; j < seg; j++) {
      const k = (j + 1) % seg,
        col = colors.stone.map((x) => x * (0.88 + 0.12 * Math.sin(row * 1.71 + j * 0.8) ** 2));
      face(o, 'stone', [a[k], a[j], b[j], b[k]], null, col);
    }
    a = b;
  }
  const top = [0, H, v];
  for (let j = 0; j < seg; j++) face(o, 'stone', [top, a[j], a[(j + 1) % seg]], [0, 1, 0]);
  partEvidence.push({
    id,
    kind: 'rounded-tapered-gate-massif',
    center: point(site, 0, 0, v),
    height: H,
    baseRadius: r0,
  });
}
function localUV(p, site) {
  const x = p[0] - site.center[0],
    z = p[2] - site.center[1];
  return [x * site.axis[0] + z * site.axis[1], -x * site.axis[1] + z * site.axis[0]];
}
function clip(ps, site, axis, bound, below) {
  const out = [];
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length],
      aa = localUV(a, site)[axis] - bound,
      bb = localUV(b, site)[axis] - bound,
      ia = below ? aa <= 0 : aa >= 0,
      ib = below ? bb <= 0 : bb >= 0;
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = aa / (aa - bb);
      out.push(a.map((v, k) => v + t * (b[k] - v)));
    }
  }
  return out;
}
function subtractGate(ps, site, v) {
  const w = D.sluiceGateWidth / 2,
    parts = [clip(ps, site, 0, -18, true), clip(ps, site, 0, 30, false)],
    mid = clip(clip(ps, site, 0, -18, false), site, 0, 30, true);
  parts.push(clip(mid, site, 1, v - w, true), clip(mid, site, 1, v + w, false));
  return parts.filter((p) => p.length >= 3);
}
function subtractFootprint(ps, ring) {
  let inside = ps;
  const outside = [];
  for (let j = 0; j < ring.length && inside.length >= 3; j++) {
    const a = ring[j],
      b = ring[(j + 1) % ring.length],
      side = (p) => (b[0] - a[0]) * (p[2] - a[2]) - (b[2] - a[2]) * (p[0] - a[0]),
      cut = (keepInside) => {
        const result = [];
        for (let i = 0; i < inside.length; i++) {
          const p = inside[i],
            q = inside[(i + 1) % inside.length],
            pp = side(p),
            qq = side(q),
            ip = keepInside ? pp >= 0 : pp <= 0,
            iq = keepInside ? qq >= 0 : qq <= 0;
          if (ip) result.push(p);
          if (ip !== iq) {
            const t = pp / (pp - qq);
            result.push(p.map((v, k) => v + t * (q[k] - v)));
          }
        }
        return result;
      };
    const part = cut(false),
      remainder = cut(true);
    if (part.length >= 3) outside.push(part);
    inside = remainder;
  }
  return outside;
}
function bankOut(out, lod) {
  return {
    addTriangle(k, r, ps, _n, uv, col) {
      let polygons = [ps];
      for (const [site, v] of [
        [P.north, -10],
        [P.north, 10],
        [P.south, 10],
      ])
        polygons = polygons.flatMap((p) => subtractGate(p, site, v));
      // Constructed backfill abuts the already fixed masonry base footprints.
      // This removes an architectural overlap, without fitting any source field or floor.
      for (const [site, vs] of [
        [P.north, [-20, 0, 20]],
        [P.south, [0, 20]],
      ])
        for (const v of vs) {
          const ring = Array.from({ length: [4, 8, 16, 32][lod] }, (_, i) => {
            const segments = [4, 8, 16, 32][lod],
              a = ((i + (lod === 3 ? 0 : 0.5)) / segments) * 2 * Math.PI,
              radius = D.massifBaseRadiusEstimate / (lod === 3 ? 1 : Math.cos(Math.PI / segments));
            return point(site, Math.cos(a) * radius, 0, v + Math.sin(a) * radius);
          });
          polygons = polygons.flatMap((p) => subtractFootprint(p, ring));
        }
      for (const p of polygons)
        for (let i = 1; i < p.length - 1; i++) {
          const q = [p[0], p[i], p[i + 1]].map((x) => x.map(Math.fround)),
            a = q[1].map((v, j) => v - q[0][j]),
            b = q[2].map((v, j) => v - q[0][j]);
          if (
            Math.hypot(
              a[1] * b[2] - a[2] * b[1],
              a[2] * b[0] - a[0] * b[2],
              a[0] * b[1] - a[1] * b[0],
            ) < 0.00001
          )
            continue;
          out.addTriangle(k, r, q, normalFor(...q), uv, col);
        }
    },
  };
}
function earthBank(out, bank, lod) {
  const o = bankOut(out, lod),
    profile =
      lod < 2
        ? [
            [-0.5, 0],
            [-0.12, 1],
            [0.12, 1],
            [0.5, 0],
          ]
        : [
            [-0.5, 0],
            [-0.3, 0.18],
            [-0.12, 0.85],
            [0.05, 1],
            [0.25, 0.65],
            [0.5, 0],
          ];
  for (let i = 1; i < bank.controls.length; i++) {
    const a = bank.controls[i - 1],
      b = bank.controls[i],
      dx = b.center[0] - a.center[0],
      dz = b.center[1] - a.center[1],
      l = Math.hypot(dx, dz),
      nx = -dz / l,
      nz = dx / l,
      at = (q, p) => [
        q.center[0] + nx * p[0] * bank.width,
        q.y + p[1] * bank.height,
        q.center[1] + nz * p[0] * bank.width,
      ];
    for (let j = 1; j < profile.length; j++)
      face(
        o,
        'earth',
        [at(a, profile[j - 1]), at(b, profile[j - 1]), at(b, profile[j]), at(a, profile[j])],
        [0, 1, 0],
      );
    if (i === 1) face(o, 'earth', profile.map((p) => at(a, p)).reverse());
    if (i === bank.controls.length - 1)
      face(
        o,
        'earth',
        profile.map((p) => at(b, p)),
      );
  }
  partEvidence.push({
    id: bank.id,
    kind: 'constructed-remnant-earthfill',
    controls: bank.controls,
    mainWidth: bank.width,
    mainHeight: bank.height,
  });
}
function gateBeds(out) {
  for (const [site, vs] of [
    [P.north, [-10, 10]],
    [P.south, [10]],
  ]) {
    const o = pose(out, site);
    for (const v of vs) {
      box(
        o,
        'stone',
        6,
        -D.channelDepthEstimate,
        v,
        D.channelLengthEstimate,
        0.22,
        D.sluiceGateWidth,
      );
      gateEvidence.push({
        site: site === P.north ? 'north' : 'south',
        v,
        bed: point(site, 6, -D.channelDepthEstimate + 0.22, v),
        openProbe: point(site, 6, 2, v),
        along: site.axis,
        width: D.sluiceGateWidth,
      });
    }
  }
}
function reservoir(out, lod) {
  const b = P.basin,
    o = pose(out, b),
    w = b.width,
    l = b.length,
    h = b.heightEstimate;
  box(o, 'stone', 0, -0.3, 0, l, 0.3, w);
  for (const side of [-1, 1]) {
    box(o, 'stone', 0, 0, side * (w / 2 - 1), l, h, 2);
    box(o, 'stone', side * (l / 2 - 1), 0, 0, 2, h * 0.85, w - 4);
  }
  if (lod >= 2)
    for (let i = 0; i < 8; i++) box(o, 'stone', -l / 2 + 3 + i * 3.6, 0, w / 2, 1.2, 1.1, 1.2);
  partEvidence.push({
    id: 'northern-distribution-basin',
    kind: 'rectangular-masonry-reservoir',
    center: b.center,
    length: l,
    width: w,
    floor: b.y,
  });
}
function curvedRevetment(out, lod) {
  const site = P.north,
    o = pose(out, site),
    n = [4, 8, 12, 16][lod];
  for (let i = 0; i < n; i++) {
    const a = ((i / n) * Math.PI) / 2,
      b = (((i + 1) / n) * Math.PI) / 2,
      inner = (t) => [30 + Math.sin(t) * 42, 0, 35 + (1 - Math.cos(t)) * 42],
      outer = (t) => [30 + Math.sin(t) * 44.2, 0, 77 - Math.cos(t) * 44.2],
      aa = inner(a),
      bb = inner(b),
      cc = outer(b),
      dd = outer(a),
      h = D.retainingWallHeightEstimate;
    face(o, 'stone', [aa, bb, [bb[0], h, bb[2]], [aa[0], h, aa[2]]]);
    face(o, 'stone', [cc, dd, [dd[0], h, dd[2]], [cc[0], h, cc[2]]]);
    face(
      o,
      'stone',
      [aa, dd, cc, bb].map((p) => [p[0], h, p[2]]),
      [0, 1, 0],
    );
    if (i === 0) face(o, 'stone', [dd, aa, [aa[0], h, aa[2]], [dd[0], h, dd[2]]]);
    if (i === n - 1) face(o, 'stone', [bb, cc, [cc[0], h, cc[2]], [bb[0], h, bb[2]]]);
  }
  partEvidence.push({ id: 'northern-curved-revetment', kind: 'intrinsic-stone-revetment' });
}
const rect = (site, u, v, l, w) =>
  [
    [u - l / 2, v - w / 2],
    [u + l / 2, v - w / 2],
    [u + l / 2, v + w / 2],
    [u - l / 2, v + w / 2],
  ].map(([x, z]) => {
    const p = point(site, x, 0, z);
    return [p[0], p[2]];
  });
export const actualGroundOutlines = [];
for (const m of P.stoneMoles)
  actualGroundOutlines.push(rect(m, m.length / 2, -0.65, m.length, m.width + 1.3));
for (const [site, vs] of [
  [P.north, [-20, 0, 20]],
  [P.south, [0, 20]],
])
  for (const v of vs)
    actualGroundOutlines.push(
      Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * 2 * Math.PI,
          p = point(
            site,
            Math.cos(a) * D.massifBaseRadiusEstimate,
            0,
            v + Math.sin(a) * D.massifBaseRadiusEstimate,
          );
        return [p[0], p[2]];
      }),
    );
for (const [site, vs] of [
  [P.north, [-10, 10]],
  [P.south, [10]],
])
  for (const v of vs)
    actualGroundOutlines.push(rect(site, 6, v, D.channelLengthEstimate, D.sluiceGateWidth));
for (const b of P.banks)
  for (let i = 1; i < b.controls.length; i++) {
    const a = b.controls[i - 1].center,
      c = b.controls[i].center,
      dx = c[0] - a[0],
      dz = c[1] - a[1],
      l = Math.hypot(dx, dz),
      nx = ((-dz / l) * b.width) / 2,
      nz = ((dx / l) * b.width) / 2;
    actualGroundOutlines.push([
      [a[0] + nx, a[1] + nz],
      [c[0] + nx, c[1] + nz],
      [c[0] - nx, c[1] - nz],
      [a[0] - nx, a[1] - nz],
    ]);
  }
actualGroundOutlines.push(rect(P.basin, 0, 0, P.basin.length + 1.2, P.basin.width + 1.2));
for (let i = 0; i < 8; i++) {
  const a = (((i + 0.5) / 8) * Math.PI) / 2;
  actualGroundOutlines.push(rect(P.north, 30 + Math.sin(a) * 43.1, 77 - Math.cos(a) * 43.1, 7, 7));
}
export function buildMarib(out, _frame, lod = 3) {
  partEvidence.length = 0;
  gateEvidence.length = 0;
  for (const b of P.banks) earthBank(out, b, lod);
  for (const m of P.stoneMoles) stoneMole(out, m, lod);
  for (const [site, vs, label] of [
    [P.north, [-20, 0, 20], 'north'],
    [P.south, [0, 20], 'south'],
  ])
    for (let i = 0; i < vs.length; i++)
      massif(out, site, vs[i], `${label}-gate-massif-${i + 1}`, lod);
  gateBeds(out);
  reservoir(out, lod);
  curvedRevetment(out, lod);
}
export const maribSkyline = (o, f) => buildMarib(o, f, 0),
  maribDistrict = (o, f) => buildMarib(o, f, 1),
  maribStreet = (o, f) => buildMarib(o, f, 2),
  maribCloseup = (o, f) => buildMarib(o, f, 3);
const root = 'content/worldgen/source/places/t4/t48/marib_dam',
  northLook = point(P.north, 18, 3, 0),
  southLook = point(P.south, 10, 3, 10),
  basinLook = [P.basin.center[0], P.basin.y + 1, P.basin.center[1]];
export const maribModel = {
  key: 'marib_dam',
  id: 'marib_dam',
  title: 'Ancient Marib Dam, Yemen (1843 remains)',
  cell: 't4/t48',
  wikidataId: 'Q119047189',
  category: 'dam',
  recipe: 'marib-model.mjs',
  surfaces,
  build: buildMarib,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: P.sectionBasis,
  brief: P.geometryBasis,
  appearance: {
    kind: 'historical',
    representedDate: '1843-07-31',
    validFrom: '1843-01-01',
    validUntil: '1844-01-01',
    currentWorldEligible: false,
  },
  camera: [800, 700, 1100],
  lookAt: [0, 5, -100],
  portableGroundY: -40,
  mediumFiContext: {
    scale: 8,
    groundY: -40,
    far: 12000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stone_sandstone', 'earth_rammed'],
  groundCutout: {
    minHeight: -40,
    outline: actualGroundOutlines[0],
    additionalOutlines: actualGroundOutlines.slice(1),
    basis:
      'Only intrinsic masonry/sluice-channel/basin/constructed earthfill physical footprints; central breached wadi and natural mountains unchanged. Source grid/heights/datum retained; historic registration/grade approximate.',
  },
  qaCameras: [
    {
      name: 'whole-ancient-dam-and-open-central-breach',
      position: [1000, 1400, 1800],
      lookAt: [0, 5, -100],
    },
    {
      name: 'northern-three-massifs-open-sluices-and-long-mole',
      position: point(P.north, -110, 75, 145),
      lookAt: northLook,
    },
    {
      name: 'southern-two-massifs-open-channel-and-retaining-mole',
      position: point(P.south, -65, 45, 80),
      lookAt: southLook,
    },
    {
      name: 'northern-distribution-basin-and-curved-revetment',
      position: basinLook.map((x, i) => x + [70, 70, 90][i]),
      lookAt: basinLook,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `northern-sluice-${reviewLod}`,
    position: point(P.north, -110, 75, 145),
    lookAt: northLook,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/marib-model.mjs`,
    level: 'skyline',
    export: 'maribSkyline',
    errorMeters: 7,
    surfaces,
    authoredLevels: {
      district: { export: 'maribDistrict', errorMeters: 3, surfaces },
      street: { export: 'maribStreet', errorMeters: 0.8, surfaces },
      closeup: { export: 'maribCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [P.geometryBasis, P.sectionBasis, ...P.limitations],
  sourceLicense:
    'Original authored geometry under repository license. Cleared published Qualla Ljubabrank PD-user-sl ruin photo first, exact native original1843Arnaud/BnF map published1873 with explicitPD-France/PD-US-expired grant and known1812–1884mapmaker. Primary factual scalar text and CC0 Wikidata historic identities. No modern protected diagrams/photographs, no modern upstream dam or hypothetical intact ancient wall, no copied inscriptions/baked photography.',
};
