/** Whole native bent main mansion, open entrance canopy and three perforated screen bands. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/ec/ec0/executive_mansion_monrovia/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('b9c1b7'),
    frame: rgb('74867e'),
    screen: rgb('aaa583'),
    glass: rgb('2d4145'),
    trim: rgb('dedfd2'),
    metal: rgb('88908b'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.97, metallic: 0 },
    frame: { slot: 'wall', graph: 'concrete_panel', roughness: 0.98, metallic: 0 },
    screen: { slot: 'wall', graph: 'stone_limestone', roughness: 0.98, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.45, metallic: 0.03 },
    trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.25 },
  };
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const c = cross(
    q[1].map((v, i) => v - q[0][i]),
    q[2].map((v, i) => v - q[0][i]),
  );
  if (Math.hypot(...c) < 1e-8) return;
  if (n && c.reduce((s, v, i) => s + v * n[i], 0) < 0) q = [q[0], q[2], q[1]];
  const nn = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    nn,
    q.map((v) => (Math.abs(nn[1]) > 0.7 ? [v[0], v[2]] : [v[0] + v[2], v[1]])),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function cap(o, s, r, y, up = true) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function prism(o, s, r, y0, y1) {
  cap(o, s, r, y0, false);
  cap(o, s, r, y1);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(o, s, [
      [a[0], y0, a[1]],
      [b[0], y0, b[1]],
      [b[0], y1, b[1]],
      [a[0], y1, a[1]],
    ]);
  }
}
const rectangle = (x, z, w, l) => [
    [x - w / 2, z - l / 2],
    [x + w / 2, z - l / 2],
    [x + w / 2, z + l / 2],
    [x - w / 2, z + l / 2],
  ],
  box = (o, s, x, y, z, w, h, l) => prism(o, s, rectangle(x, z, w, l), y, y + h);
function frame(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [u[1], 0, -u[0]];
  return {
    len,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
function panel(o, s, f, x0, x1, y0, y1, z = 0, col = C[s]) {
  Q(o, s, [f.P(x0, y0, z), f.P(x1, y0, z), f.P(x1, y1, z), f.P(x0, y1, z)], f.n, col);
}
function ribbon(o, f, a, b, w, d) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l = Math.hypot(dx, dy),
    u = [((-dy / l) * w) / 2, ((dx / l) * w) / 2],
    r = [
      [a[0] + u[0], a[1] + u[1]],
      [a[0] - u[0], a[1] - u[1]],
      [b[0] - u[0], b[1] - u[1]],
      [b[0] + u[0], b[1] + u[1]],
    ];
  Q(
    o,
    'screen',
    r.map((q) => f.P(...q, 0.55)),
    f.n,
  );
  if (d === 3)
    Q(
      o,
      'screen',
      [...r].reverse().map((q) => f.P(...q, 0.47)),
      f.n.map((v) => -v),
    );
}
function screen(o, f, x0, x1, y0, y1, d) {
  if (d === 0) {
    panel(o, 'screen', f, x0, x1, y0, y1, 0.55);
    return;
  }
  const cols = [0, 1, 3, 5][d],
    rows = [0, 2, 5, 9][d],
    w = (x1 - x0) / cols,
    h = (y1 - y0) / rows;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const x = x0 + (i + 0.5) * w,
        y = y0 + (j + 0.5) * h,
        r = [
          [x - w * 0.5, y],
          [x, y + h * 0.5],
          [x + w * 0.5, y],
          [x, y - h * 0.5],
        ];
      for (let k = 0; k < 4; k++) ribbon(o, f, r[k], r[(k + 1) % 4], Math.min(w, h) * 0.25, d);
    }
  if (d >= 2) {
    for (const x of [x0, x1])
      beam(o, 'screen', f.P(x, y0, 0.55), f.P(x, y1, 0.55), 0.1, 0.1, C.screen);
    for (const y of [y0, y1])
      beam(o, 'screen', f.P(x0, y, 0.55), f.P(x1, y, 0.55), 0.1, 0.1, C.screen);
  }
}
function facade(o, f, d, isFront) {
  const n = Math.max(1, Math.round(f.len / (d === 0 ? 11 : 6))),
    step = f.len / n;
  panel(o, 'wall', f, 0, f.len, 0, 6.3);
  panel(o, 'glass', f, 0, f.len, 6.3, 28, -0.55);
  if (!isFront) {
    for (let k = 0; k < n; k++) {
      const x = (k + 0.5) * step,
        w = step * 0.68;
      for (const y of d === 0 ? [3] : [2.0, 4.4])
        panel(o, 'glass', f, x - w / 2, x + w / 2, y, y + 1.35, 0.015);
    }
  }
  for (const y of d === 0 ? [6.3, 27.8] : [6.3, 13.1, 20.2, 27.8]) {
    panel(o, 'trim', f, 0, f.len, y, y + 0.35, 0.08);
    if (d > 0)
      Q(
        o,
        'trim',
        [
          f.P(0, y + 0.35, -0.55),
          f.P(f.len, y + 0.35, -0.55),
          f.P(f.len, y + 0.35, 0.35),
          f.P(0, y + 0.35, 0.35),
        ],
        [0, 1, 0],
      );
  }
  if (isFront) {
    for (let i = 0; i < n; i++) {
      const x0 = i * step + 0.45,
        x1 = (i + 1) * step - 0.45;
      if (x1 <= x0) continue;
      for (const [y0, y1] of p.parameters.screenBands) screen(o, f, x0, x1, y0, y1, d);
    }
    for (let i = 0; i <= n; i++) {
      const x = i * step;
      if (d === 0) panel(o, 'frame', f, x - 0.36, x + 0.36, 5.9, 29.1, 0.8);
      else {
        beam(o, 'frame', f.P(x, 5.5, 0.75), f.P(x, 29.1, 0.75), 0.72, 0.8, C.frame);
        for (const y of [6.3, 13.1, 20.2, 27.8])
          panel(o, 'trim', f, x - 0.39, x + 0.39, y - 0.08, y + 0.68, 1.17);
      }
    }
  } else if (d > 0) {
    for (let i = 0; i <= n; i++) {
      const x = i * step;
      panel(o, 'frame', f, x - 0.17, x + 0.17, 6.4, 27.8, -0.35);
      if (d >= 2)
        for (const y of [9.5, 16.6, 23.7])
          panel(
            o,
            'trim',
            f,
            Math.max(0, x - step / 2),
            Math.min(f.len, x + step / 2),
            y,
            y + 0.16,
            -0.2,
          );
    }
  }
}
function body(o, d) {
  cap(o, 'wall', p.core, 0.03, false);
  prism(o, 'trim', p.core, 27.95, 28.45);
  for (let i = 0; i < p.core.length; i++) {
    const a = p.core[i],
      b = p.core[(i + 1) % p.core.length],
      f = frame(a, b);
    facade(o, f, d, p.frontEdgeIndices.includes(i));
  }
}
function canopy(o, d) {
  // Original roof-projection vertices are retained; they are not claimed as surveyed footings.
  prism(o, 'trim', p.portico, 12.6, 13.15);
  const corners = [p.portico[0], p.portico[1], p.portico[3], p.portico[4]];
  for (const [x, z] of corners)
    beam(
      o,
      'frame',
      [x, 0.15, z],
      [x, 12.6, z],
      d === 0 ? 0.9 : 1.05,
      d === 0 ? 0.9 : 1.05,
      C.frame,
    );
  const rear = [p.portico[0], p.portico[4]],
    back = rear.map((q) => [q[0], q[1]]),
    landing = [back[0], back[1], [back[1][0], 6.8], [back[0][0], 6.8]];
  prism(o, 'trim', landing, 6.0, 6.35);
  if (d > 0) {
    beam(o, 'frame', [rear[0][0], 7.3, 6.8], [rear[1][0], 7.3, 6.8], 0.16, 0.16, C.frame);
    for (let i = 0; i <= [4, 6, 10, 16][d]; i++) {
      const x = rear[0][0] + ((rear[1][0] - rear[0][0]) * i) / [4, 6, 10, 16][d];
      beam(o, 'frame', [x, 6.35, 6.8], [x, 7.3, 6.8], 0.09, 0.09, C.frame);
    }
  }
  // Bounded integral approach stair, kept inside the mapped entrance canopy.
  const steps = [2, 4, 7, 10][d];
  for (let j = 0; j < steps; j++) {
    const z0 = 6.9 + (j / steps) * 8.0,
      z1 = 6.9 + ((j + 1) / steps) * 8.0,
      y = ((steps - j) / steps) * 2.1;
    Q(
      o,
      'trim',
      [
        [-5, y, z0],
        [5, y, z0],
        [5, y, z1],
        [-5, y, z1],
      ],
      [0, 1, 0],
    );
    Q(o, 'trim', [
      [-5, y, z1],
      [5, y, z1],
      [5, Math.max(0, y - 2.1 / steps), z1],
      [-5, Math.max(0, y - 2.1 / steps), z1],
    ]);
  }
}
function penthouse(o, d) {
  const r = p.penthouse;
  for (let i = 0; i < r.length; i++) {
    const f = frame(r[i], r[(i + 1) % r.length]);
    panel(o, 'glass', f, 0, f.len, 28.4, 32.7, -0.25);
    const n = d === 0 ? 2 : Math.max(2, Math.round(f.len / 3.5));
    for (let j = 0; j <= n; j++) {
      const x = (j / n) * f.len;
      if (d === 0) panel(o, 'wall', f, x - 0.18, x + 0.18, 28.4, 33.1, 0.05);
      else beam(o, 'frame', f.P(x, 28.4), f.P(x, 33.2), 0.28, 0.35, C.frame);
    }
  }
  const cx = r.reduce((s, v) => s + v[0], 0) / r.length,
    cz = r.reduce((s, v) => s + v[1], 0) / r.length,
    roof = r.map((q) => [cx + (q[0] - cx) * 1.12, cz + (q[1] - cz) * 1.12]);
  prism(o, 'trim', roof, 33.1, 33.55);
  if (d >= 2)
    for (let i = 0; i < r.length; i++) {
      const f = frame(r[i], r[(i + 1) % r.length]);
      for (let j = 1; j < 4; j++) {
        const x = (f.len * j) / 4;
        beam(o, 'trim', f.P(x, 33.3, -0.1), f.P(x, 33.6, 1.7), 0.2, 0.4, C.trim);
      }
    }
  for (const [x, z, h] of [
    [-3, -8, 3.95],
    [2, -9, 3.2],
    [6, -10, 2.8],
  ])
    beam(
      o,
      'metal',
      [x, 33.55, z],
      [x, 33.55 + h, z],
      d === 0 ? 0.12 : 0.08,
      d === 0 ? 0.12 : 0.08,
      C.metal,
    );
  if (d > 0) box(o, 'metal', 4, 28.5, -17, 2.2, 1.6, 1.4);
}
function build(o, _f, d = 3) {
  body(o, d);
  canopy(o, d);
  penthouse(o, d);
}
export const mansionSkyline = (o, f) => build(o, f, 0);
export const mansionDistrict = (o, f) => build(o, f, 1);
export const mansionStreet = (o, f) => build(o, f, 2);
export const mansionCloseup = (o, f) => build(o, f, 3);
export const mansionModel = {
  id: 'executive_mansion_monrovia',
  key: 'executive_mansion_monrovia',
  cell: 'ec/ec0',
  recipe: 'structure-executive-mansion-monrovia.mjs',
  title: 'Executive Mansion, Monrovia',
  category: 'residence',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [165, 82, 180],
  lookAt: [0, 16, -6],
  portableGroundY: -0.15,
  mediumFiContext: { scale: 3, groundY: -0.15 },
  qaCameras: [
    {
      name: 'whole-bent-wings-screened-front-and-raised-roofpavilion',
      position: [120, 80, 150],
      lookAt: [0, 15, -6],
      reviewLod: 'skyline',
    },
    {
      name: 'three-perforated-screenbands-and-concrete-pilasters',
      position: [-38, 20, 42],
      lookAt: [-34, 17, 6],
    },
    {
      name: 'whole-native-rear-wing-returns-and-roof-envelope',
      position: [-115, 85, -105],
      lookAt: [0, 15, -7],
    },
    {
      name: 'native-open-columned-entrance-canopy-and-balcony',
      position: [33, 19, 47],
      lookAt: [0, 9, 6],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent400mfield frozen at fixedNEapproach before geometry; exact grade/threshold/hostcontact remains preview-only.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-executive-mansion-monrovia.mjs',
    level: 'skyline',
    export: 'mansionSkyline',
    errorMeters: 2.8,
    surfaces,
    authoredLevels: {
      district: { export: 'mansionDistrict', errorMeters: 1.2, surfaces },
      street: { export: 'mansionStreet', errorMeters: 0.4, surfaces },
      closeup: { export: 'mansionCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Whole original27vertex bent modernist mansion envelope and projectedcanopy, complete rear/side/core and raisedroofpavilion. Main28m/pavilion33.2m/masts37.5m/floor partitions are photographic estimates; exactcurrentrestoration/hiddenrear fenestration/services not surveyed. Three defining frontscreenbands/verticalpilasters/whitebands/darkglazing and openentrancecanopy/landing preserve the visible2009structuralcharacter.',
    'Exact2048x1536publishedQuallaPD-selforiginal individually inspected/nativeSHA1matched. First native revision20747356/singleoriginalupload by Nimba-travellor at2009-04-28T15:29:17Z explicitly declaresSourceCamera/Author=my-self/PD-self. Literalcreatorcredit retained with originalaccount evidence, no inventedrealname or siblingmetadata edits. Old1850/1922presidentialresidenceimages are different structures and excluded. No other agency/restricted imagery, photo/generatedbitmap texture, downloadedmesh or fine presidentialseal artwork used.',
    'Detailedscreenbands are genuine open original geometricdiamond lattice with recessedglassbehind; exactoriginalbreezeblock motif/cellcensus/finish is approximated, not claimed reproduced. District uses coarseopenlattice and skyline solidcoloredscreen cues. Lower obscuredstoreys/wingrear/finebalcony/rooftopservices and post2022renovationpaint/glazing repairs remain bounded from a singlewholefront original. Stable principalstructure represented; exact2026cosmeticfitout unverified.',
    'Native projectedcanopy controlpoints locate its upperroof envelope, not surveyedgroundfootings; wholeoriginal maincore and structuralfrontprojection retained. Fourcanopyposts and boundedmidlanding/approachstair are intrinsic, separatefence/gates/yardplatform/nearbyCapitol/officebuildings/landscape/trees/roads/people/vehicles/flags and undergroundshelter/pool/rooms excluded. No whole-site floor.',
    'Independent400m129x129field/16641samples and originalrawsource tilebytes frozen beforegeometry; no fitting/flattening/reacquisition. CompositeDEMmay containstructure/vegetation/outliers, not surveyed thresholddatum. Portable/shared/context use separateflatinspectionground. Nativeplacement preview/replaceFootprint=false; exactestategrade/threshold/footing/compatiblehostattachment unverified.',
  ],
};
