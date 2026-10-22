/** Buenos Aires planetarium: original circular gallery, three open legs and geometric dome screen. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/69/69y/galileo_galilei_planetarium/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const C = {
  concrete: rgb('c6c3ac'),
  metal: rgb('b4b9af'),
  screen: rgb('c7c2aa'),
  inner: rgb('62685f'),
  glass: rgb('6c8282'),
  darkGlass: rgb('566f70'),
};
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.71, metallic: 0.55 },
  screen: { slot: 'roof', graph: 'metal_painted', roughness: 0.79, metallic: 0.23 },
  inner: { slot: 'roof', graph: 'metal_painted', roughness: 0.94, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.32, metallic: 0.07 },
  darkGlass: { slot: 'window', localRef: 'palette:#fefeff', roughness: 0.38, metallic: 0.06 },
};
const area = (r) =>
    r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0),
  CW = (r) => (area(r) < 0 ? r : [...r].reverse()),
  ring = (n, r) =>
    Array.from({ length: n }, (_, i) => [
      r * Math.cos((-i * 2 * Math.PI) / n),
      r * Math.sin((-i * 2 * Math.PI) / n),
    ]);
function tri(o, s, p, n, col = C[s]) {
  const f = p.map((q) => q.map(Math.fround)),
    cr = cross(
      f[1].map((x, i) => x - f[0][i]),
      f[2].map((x, i) => x - f[0][i]),
    );
  if (Math.hypot(...cr) < 1e-9) return;
  if (n && cr.reduce((a, x, i) => a + x * n[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((q) => [q[0] + q[2], q[1]]),
    col,
  );
}
function Q(o, s, p, n, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], n, col);
  tri(o, s, [p[0], p[2], p[3]], n, col);
}
function cap(o, s, r, y, up = true) {
  const ix = earcut(r.flat());
  for (let j = 0; j < ix.length; j += 3)
    tri(
      o,
      s,
      ix.slice(j, j + 3).map((k) => [r[k][0], typeof y === 'function' ? y(r[k]) : y, r[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function solid(o, s, raw, lo, hi) {
  const r = CW(raw);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      low = (q) => (typeof lo === 'function' ? lo(q) : lo),
      high = (q) => (typeof hi === 'function' ? hi(q) : hi);
    Q(
      o,
      s,
      [
        [a[0], low(a), a[1]],
        [b[0], low(b), b[1]],
        [b[0], high(b), b[1]],
        [a[0], high(a), a[1]],
      ],
      [-(b[1] - a[1]), 0, b[0] - a[0]],
    );
  }
  cap(o, s, r, hi);
  cap(o, s, r, lo, false);
}
function fascia(o, raw, y0, y1, d) {
  solid(o, 'concrete', raw, y0, y1);
  if (d > 1) {
    const r = CW(raw);
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      beam(o, 'metal', [a[0], y1 + 0.015, a[1]], [b[0], y1 + 0.015, b[1]], 0.065, 0.045, C.metal);
    }
  }
}
function gallery(o, d) {
  const r = d === 0 ? ring(16, 17.1) : CW(plan.outline);
  fascia(o, r, 6.65, 7.1, d);
  fascia(o, r, 10.02, 10.4, d);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      normal = [-(b[1] - a[1]), 0, b[0] - a[0]],
      count =
        d === 3
          ? Math.max(1, Math.round(len / 1.25))
          : d === 2
            ? Math.max(1, Math.round(len / 1.8))
            : 1;
    Q(
      o,
      'glass',
      [
        [a[0], 7.1, a[1]],
        [b[0], 7.1, b[1]],
        [b[0], 10.02, b[1]],
        [a[0], 10.02, a[1]],
      ],
      normal,
    );
    if (d > 0) {
      for (let j = 0; j < count; j++) {
        const t = j / count,
          x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t;
        beam(o, 'metal', [x, 7.08, z], [x, 10.06, z], 0.065, 0.08, C.metal);
      }
      if (d > 1) beam(o, 'metal', [a[0], 8.35, a[1]], [b[0], 8.35, b[1]], 0.045, 0.045, C.metal);
      if (d > 2 && i % 3 === 0 && len > 2) {
        const cx = (a[0] + b[0]) / 2,
          cz = (a[1] + b[1]) / 2,
          L = Math.hypot(...normal),
          nx = normal[0] / L,
          nz = normal[2] / L;
        beam(
          o,
          'metal',
          [cx - (b[0] - a[0]) * 0.22 + nx * 0.18, 9.9, cz - (b[1] - a[1]) * 0.22 + nz * 0.18],
          [cx + (b[0] - a[0]) * 0.22 + nx * 0.18, 9.9, cz + (b[1] - a[1]) * 0.22 + nz * 0.18],
          0.05,
          0.05,
          C.metal,
        );
      }
    }
  }
}
function lower(o, d) {
  const raw = plan.lowerGlassOutline,
    r = CW(raw),
    profile = [
      6.5, 2.8, 2.8, 6.5, 6.35, 6.35, 6.5, 2.8, 2.8, 6.5, 6.35, 6.35, 6.5, 2.8, 2.8, 6.5, 6.35,
      6.35,
    ],
    bottom = (p) => profile[raw.indexOf(p)];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      ya = bottom(a),
      yb = bottom(b),
      n = [-(b[1] - a[1]), 0, b[0] - a[0]];
    Q(
      o,
      'glass',
      [
        [a[0], ya, a[1]],
        [b[0], yb, b[1]],
        [b[0], 6.66, b[1]],
        [a[0], 6.66, a[1]],
      ],
      n,
    );
    if (d > 0) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        count = d > 1 ? Math.max(1, Math.round(L / 1.3)) : 1;
      for (let j = 0; j < count; j++) {
        const t = j / count,
          x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t,
          y = ya + (yb - ya) * t;
        beam(o, 'metal', [x, y, z], [x, 6.67, z], 0.055, 0.065, C.metal);
      }
      if (d > 1)
        beam(
          o,
          'metal',
          [a[0], Math.max(ya, 4.3), a[1]],
          [b[0], Math.max(yb, 4.3), b[1]],
          0.04,
          0.04,
          C.metal,
        );
    }
  }
  for (const start of [0, 6, 12])
    for (let j = 0; j < 3; j++) {
      const i = start + j,
        a = raw[i],
        b = raw[(i + 1) % raw.length];
      beam(
        o,
        'concrete',
        [a[0], profile[i] - 0.12, a[1]],
        [b[0], profile[(i + 1) % raw.length] - 0.12, b[1]],
        0.4,
        0.45,
        C.concrete,
      );
    }
  const core = r.map((p) => p.map((v) => v * 0.86));
  solid(o, 'darkGlass', core, -0.05, 2.8);
  fascia(o, core, 2.64, 2.84, d);
  if (d > 0)
    for (let i = 0; i < core.length; i++) {
      const a = core[i],
        b = core[(i + 1) % core.length],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        count = d > 1 ? Math.max(1, Math.round(L / 1.3)) : 1;
      for (let j = 0; j < count; j++) {
        const t = j / count,
          x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t;
        beam(o, 'metal', [x, 0, z], [x, 2.8, z], 0.06, 0.075, C.metal);
      }
    }
  const base = d === 0 ? ring(16, 17.1) : CW(plan.outline);
  solid(o, 'darkGlass', base, -3.2, -0.3);
  fascia(o, base, -0.3, 0, d);
  if (d > 1)
    for (let i = 0; i < base.length; i++) {
      const a = base[i],
        b = base[(i + 1) % base.length],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        count = Math.max(1, Math.round(L / 1.4));
      for (let j = 0; j < count; j++) {
        const t = j / count,
          x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t;
        beam(o, 'metal', [x, -3.2, z], [x, -0.3, z], 0.06, 0.07, C.metal);
      }
    }
}
function legs(o, d) {
  for (const leg of plan.legs) {
    let r = leg.outline;
    if (d === 0) {
      const inn = r
          .map((p, i) => ({ p, i, r: Math.hypot(...p) }))
          .sort((a, b) => a.r - b.r)
          .slice(0, 2)
          .map((x) => x.i),
        out = r
          .map((p, i) => ({ p, i, r: Math.hypot(...p) }))
          .sort((a, b) => b.r - a.r)
          .slice(0, 2)
          .map((x) => x.i);
      r = [...new Set([...inn, ...out])].sort((a, b) => a - b).map((i) => r[i]);
    }
    const min = Math.min(...leg.outline.map((p) => Math.hypot(...p))),
      max = Math.max(...leg.outline.map((p) => Math.hypot(...p))),
      height = (p) => {
        const t = Math.max(0, Math.min(1, (max - Math.hypot(...p)) / (max - min)));
        return 0.35 + 6.45 * Math.sin((t * Math.PI) / 2);
      };
    solid(o, 'concrete', r, (p) => height(p) - 1.05, height);
  }
}
function entrance(o, d) {
  solid(o, 'concrete', plan.bridge, -0.32, 0);
  if (d === 0) return;
  const r = plan.bridge;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    if (Math.min(Math.hypot(...a), Math.hypot(...b)) < 18) continue;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = Math.max(1, Math.round(L / 1.8));
    beam(o, 'metal', [a[0], 0.98, a[1]], [b[0], 0.98, b[1]], 0.05, 0.05, C.metal);
    for (let j = 0; j <= n; j++) {
      const t = j / n,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      beam(o, 'metal', [x, 0, z], [x, 0.98, z], 0.045, 0.045, C.metal);
      if (d > 1 && j < n) {
        const p = t + 0.5 / n,
          xx = a[0] + (b[0] - a[0]) * p,
          zz = a[1] + (b[1] - a[1]) * p;
        beam(o, 'metal', [x, 0.55, z], [xx, 0.55, zz], 0.028, 0.028, C.metal);
        beam(o, 'metal', [xx, 0.55, zz], [xx, 0.85, zz], 0.028, 0.028, C.metal);
      }
    }
  }
}
function dome(o, d) {
  const R = 11.75,
    spring = 10.4,
    segments = [16, 32, 64, 96][d],
    bands = [6, 12, 20, 30][d],
    P = (phi, a, r = R) => [
      r * Math.cos(phi) * Math.cos(a),
      spring + r * Math.sin(phi),
      r * Math.cos(phi) * Math.sin(a),
    ],
    innerR = d === 0 ? R : R - 0.16;
  for (let j = 0; j < bands; j++)
    for (let i = 0; i < segments; i++) {
      const a = (i * 2 * Math.PI) / segments,
        b = ((i + 1) * 2 * Math.PI) / segments,
        f = (j * Math.PI) / 2 / bands,
        g = ((j + 1) * Math.PI) / 2 / bands,
        pts = [P(f, a, innerR), P(f, b, innerR), P(g, b, innerR), P(g, a, innerR)],
        n = pts[0].map((v, k) => v - (k === 1 ? spring : 0));
      Q(o, d === 0 ? 'screen' : 'inner', pts, n);
    }
  if (d === 0) return;
  const N = [0, 20, 64, 144][d],
    M = [0, 10, 22, 42][d],
    width = d === 1 ? 0.13 : d === 2 ? 0.085 : 0.06,
    tip = 1.515;
  for (const sign of [-1, 1])
    for (let i = 0; i < N; i++)
      for (let j = 0; j < M; j++) {
        const f = (j * tip) / M,
          g = ((j + 1) * tip) / M,
          A = (phi) => {
            const a = (i * 2 * Math.PI) / N + sign * 1.1 * phi,
              w = width / (R * Math.cos(phi));
            return [P(phi, a - w / 2), P(phi, a + w / 2)];
          },
          [a, b] = A(f),
          [c, e] = A(g),
          mid = (f + g) / 2,
          ang = (i * 2 * Math.PI) / N + sign * 1.1 * mid,
          n = [Math.cos(mid) * Math.cos(ang), Math.sin(mid), Math.cos(mid) * Math.sin(ang)];
        Q(o, 'screen', [a, b, e, c], n);
      }
  const capR = R * Math.cos(tip);
  cap(o, 'screen', ring(segments, capR), spring + R * Math.sin(tip));
}
function build(o, _frame, d = 3) {
  gallery(o, d);
  lower(o, d);
  legs(o, d);
  entrance(o, d);
  dome(o, d);
}
export const galileoPlanetariumSkyline = (o, f) => build(o, f, 0);
export const galileoPlanetariumDistrict = (o, f) => build(o, f, 1);
export const galileoPlanetariumStreet = (o, f) => build(o, f, 2);
export const galileoPlanetariumModel = {
  id: 'galileo_galilei_planetarium',
  key: 'galileo_galilei_planetarium',
  recipe: 'structure-galileo-galilei-planetarium.mjs',
  cell: '69/69y',
  title: 'Galileo Galilei Planetarium',
  category: 'civic-cultural',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: plan.authoringDirection,
  camera: [-63, 35, 73],
  lookAt: [0, 8, 4],
  portableGroundY: -0.6,
  mediumFiContext: { scale: 1.7, groundY: -0.6 },
  qaCameras: [
    {
      name: 'whole-planetarium-three-curved-legs-and-entry-bridge',
      position: [-56, 22, 65],
      lookAt: [0, 8, 4],
    },
    {
      name: 'diamond-screen-and-circular-glazed-gallery',
      position: [31, 20, 28],
      lookAt: [0, 13, 0],
    },
    {
      name: 'open-undercroft-lower-v-glazing-and-concrete-legs',
      position: [-25, 3, 18],
      lookAt: [0, 4, 0],
    },
    {
      name: 'intrinsic-entry-bridge-rails-and-basement-recess',
      position: [-25, 2.4, 33],
      lookAt: [-4, 0, 5],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent160mrelief frozen at nativeouterbridgevertex beforegeometry; exactbasement/grade/legfeet/hostcontactunverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-galileo-galilei-planetarium.mjs',
    level: 'skyline',
    export: 'galileoPlanetariumSkyline',
    errorMeters: 1.1,
    surfaces,
    authoredLevels: {
      district: { export: 'galileoPlanetariumDistrict', errorMeters: 0.55, surfaces },
      street: { export: 'galileoPlanetariumStreet', errorMeters: 0.2, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Four exact2816x2112ClaudioElias2007ownphotographPDself originals individually inspected; currentpreservedform controlledbytheseviews andexactnativeparts. No bitmap/copiedpixels or generatedimages. CurrentLEDinstallation/finish/hiddenrenovationsunverified; oldbanners/fences/spotlights/antenna omitted.',
    'Outer gallery native28vertexplan,26vertexdomecontrol, lower18vertexglasspart, fullthreecurvedlegplans and13vertexintrinsicentrancebridge retained atnormaldetail. Skyline simplifiescircleandlegs within stated1.1merror. Coarseheighttags preservedraw; hemisphere22.15mtop/10.4mspring/~11.75mradius andlegcurve/section/Vglazedstairs/groundcore/basementsection approximate. Interiorprojectiondiameter20m is notoutergallerydiameter.',
    'Visible lowerVglazing is vertical in its original nativeplan, with photo-basedlowedgeprofiles anddiagonalconcreteframes. Groundfoyerwalls set15percentinsideandbasement/ownentryflooruseuppergalleryprojectiontojoinnativebridge; hiddenplan/sectionestimates,notasurveyofallfloorplans. No interiors/exhibits/meteorites/statues/gardens/lake/externalpublicpaths/otherbuildings orwhole-siteslab. Ownentrybridge footprintisnative; exactlevel/railmotif/supports andconcealedrearentrydetails estimated.',
    'Diamondouterdome rebuilt as intersecting thinmetalstripgeometry withrealapertures over a separateopaqueinnerhemisphere. It is an architectural mediumfi approximation, not exact panel/fastener/LEDcensus. Closeup144stripfamilieseachway, lowerlevelsreducepattern; skylineaverageclosedoutertone preservesradius/silhouette.',
    'Original160m81x81Terrariumfield/6561values/2tiles/heightPNGfrozenbeforegeometry atnativeouterbridgepoint. RawDEMmayblurvegetation/buildingorvoids; no flattening/earthcut/fittedslab. Exactownbasement/legcontactcompatiblelivehostterrainnotverified; previewonly,replaceFootprint=false.',
  ],
};
