/** Whole closed Willemstad pontoon bridge: native deck, sixteen boats and transverse lights. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, loft, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/d6/d6n/queen_emma_bridge/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  L = p.nativeMovingSpanLength,
  ref = 'palette:#ffffff',
  C = {
    steel: rgb('dddeda'),
    hull: rgb('42494a'),
    wood: rgb('928774'),
    cabin: rgb('b9c7c2'),
    glass: rgb('49676d'),
    machine: rgb('616c69'),
  },
  surfaces = {
    steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.83, metallic: 0.13 },
    hull: { slot: 'wall', graph: 'metal_stainless_beadblasted', roughness: 0.9, metallic: 0.16 },
    wood: { slot: 'roof', graph: 'wood_plain', roughness: 0.94, metallic: 0 },
    cabin: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.88, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.38, metallic: 0.08 },
    machine: { slot: 'trim', localRef: ref, roughness: 0.9, metallic: 0.1 },
  };
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const c = cross(
    q[1].map((v, i) => v - q[0][i]),
    q[2].map((v, i) => v - q[0][i]),
  );
  if (Math.hypot(...c) < 1e-8) return;
  if (n && c.reduce((a, v, i) => a + v * n[i], 0) < 0) q = [q[0], q[2], q[1]];
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
      ix.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function prism(o, s, r, y0, y1) {
  cap(o, s, r, y0, false);
  cap(o, s, r, y1);
  const winding = Math.sign(
    r.reduce((a, q, i) => a + q[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * q[1], 0),
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      s,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [winding * (b[1] - a[1]), 0, winding * (a[0] - b[0])],
    );
  }
}
function B(o, s, x, y, z, w, h, l, col = C[s]) {
  box(o, s, [x - w / 2, y, z - l / 2], [x + w / 2, y + h, z + l / 2], col);
}
function ribbon(o, s, a, b, w, n, col = C[s]) {
  const v = b.map((x, i) => x - a[i]),
    l = Math.hypot(...v),
    u = cross(
      n,
      v.map((x) => x / l),
    ),
    q = [
      a.map((v, i) => v + (u[i] * w) / 2),
      b.map((v, i) => v + (u[i] * w) / 2),
      b.map((v, i) => v - (u[i] * w) / 2),
      a.map((v, i) => v - (u[i] * w) / 2),
    ];
  Q(o, s, q, n, col);
  Q(
    o,
    s,
    [...q].reverse(),
    n.map((x) => -x),
    col,
  );
}
function bar(o, s, a, b, w, d, n = [0, 0, 1]) {
  if (d === 0) ribbon(o, s, a, b, Math.max(w, 0.16), n);
  else beam(o, s, a, b, w, w, C[s]);
}
function deck(o, d) {
  prism(o, 'wood', p.outline, -0.28, 0);
  const a = p.approach[1],
    q = [
      [a[0], a[1] - 5.36],
      [0, -5.36],
      [0, 5.36],
      [a[0], a[1] + 5.36],
    ];
  prism(o, 'wood', q, -0.32, 0);
  for (const z of [-3.4, 3.4]) B(o, 'hull', L / 2, -1, z, L, 0.72, 0.24);
  for (const z of [-5.02, 5.02]) {
    bar(o, 'steel', [-12, 0.1, z], [L, 0.1, z], d === 0 ? 0.18 : 0.12, d, [0, 1, 0]);
    for (const y of [0.58, 1.15])
      bar(o, 'steel', [-12, y, z], [L, y, z], d === 0 ? 0.16 : 0.065, d, [0, 0, 1]);
    const n = d === 0 ? 17 : d === 1 ? 45 : d === 2 ? 130 : 220;
    for (let i = 0; i <= n; i++) {
      const x = -12 + ((L + 12) * i) / n;
      bar(o, 'steel', [x, 0, z], [x, 1.15, z], d < 2 ? 0.12 : 0.065, d, [0, 0, 1]);
    }
  }
  if (d >= 2) {
    const step = d === 3 ? 0.22 : 0.55;
    for (let x = 0.12; x < L; x += step)
      Q(
        o,
        'wood',
        [
          [x, 0.001, -4.9],
          [x + 0.018, 0.001, -4.9],
          [x + 0.018, 0.001, 4.9],
          [x, 0.001, 4.9],
        ],
        [0, 1, 0],
        C.wood.map((v) => v * 0.72),
      );
    for (let x = 2; x < L; x += 9.5) B(o, 'machine', x, -0.18, 0, 0.055, 0.012, 9.8);
  }
}
function hull(o, x, d) {
  const w = 3.65,
    h = 7.9,
    r =
      d === 0
        ? [
            [0, -h],
            [w / 2, -h + 1.6],
            [w / 2, h - 1.6],
            [0, h],
            [-w / 2, h - 1.6],
            [-w / 2, -h + 1.6],
          ]
        : [
            [-0.55, -h],
            [0.55, -h],
            [w / 2, -h + 1.5],
            [w / 2, h - 1.5],
            [0.55, h],
            [-0.55, h],
            [-w / 2, h - 1.5],
            [-w / 2, -h + 1.5],
          ],
    rings = [
      [-2.7, 0.62],
      [-1.12, 1],
    ].map(([y, s]) => r.map((q) => [x + q[0] * s, y, q[1] * s]));
  loft(o, 'hull', rings, C.hull);
  if (d >= 2)
    cap(
      o,
      'steel',
      r.map((q) => [x + q[0], q[1]]),
      -1.105,
    );
  if (d >= 2) {
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      beam(o, 'steel', [x + a[0], -1.06, a[1]], [x + b[0], -1.06, b[1]], 0.07, 0.07, C.steel);
    }
    for (const z of [-6.6, 6.6]) B(o, 'machine', x, -1.1, z, 1.1, 0.22, 0.7);
    for (const z of [-2.8, 2.8]) B(o, 'hull', x, -1.1, z, 1.45, 0.82, 0.32);
  } else if (d === 1) B(o, 'hull', x, -1.1, 0, 1.6, 0.82, 8.8);
  if (d === 3) {
    for (const z of [-6.4, 6.4])
      for (const dx of [-0.4, 0.4]) B(o, 'machine', x + dx, -0.9, z, 0.09, 0.24, 0.1);
    for (const z of [-7.8, 7.8])
      beam(o, 'machine', [x - 0.45, -1.6, z], [x + 0.45, -1.6, z], 0.08, 0.08, C.machine);
  }
}
function arches(o, d) {
  const n = [4, 8, 14, 24][d];
  for (let i = 0; i < 16; i++) {
    const x = (L * (i + 0.5)) / 16,
      profile = [];
    for (let k = 0; k <= n; k++) {
      const t = (Math.PI * k) / n;
      profile.push([x, 1.4 + 3.9 * Math.sin(t), -4.65 * Math.cos(t)]);
    }
    for (const z of [-4.65, 4.65])
      bar(
        o,
        'steel',
        [x, 0, z],
        [x, 1.4, z],
        d === 0 ? 0.22 : d === 1 ? 0.17 : 0.105,
        d,
        [1, 0, 0],
      );
    for (let k = 0; k < n; k++)
      bar(
        o,
        'steel',
        profile[k],
        profile[k + 1],
        d === 0 ? 0.24 : d === 1 ? 0.17 : 0.105,
        d,
        [1, 0, 0],
      );
    if (d >= 2)
      for (const z of [-4.65, 4.65]) {
        B(o, 'steel', x, 0.08, z, 0.24, 0.16, 0.24);
        beam(o, 'steel', [x, 1.5, z], [x, 1.5, z + (z < 0 ? 0.75 : -0.75)], 0.065, 0.065, C.steel);
        B(o, 'machine', x, 1.39, z + (z < 0 ? 0.7 : -0.7), 0.23, 0.1, 0.32);
      }
    if (d === 3)
      for (let k = 2; k < n; k += 3) {
        const q = profile[k];
        B(o, 'steel', q[0], q[1] - 0.075, q[2], 0.16, 0.15, 0.13);
      }
  }
}
function cabin(o, d) {
  const x = L - 3.2,
    z = -3.6;
  B(o, 'cabin', x, 0, z, 2.3, 0.85, 2.15);
  if (d === 0) {
    B(o, 'glass', x, 0.85, z, 2.18, 1.55, 2.05);
  } else {
    for (const dx of [-1, 1])
      for (const dz of [-1, 1]) B(o, 'steel', x + dx * 1.1, 0.85, z + dz * 1.02, 0.13, 1.65, 0.13);
    for (const [side, dx, dz] of [
      ['x', 1, 0],
      ['x', -1, 0],
      ['z', 0, 1],
      ['z', 0, -1],
    ]) {
      const y0 = 0.92,
        y1 = 2.35;
      if (side === 'x') {
        const X = x + dx * 1.01;
        Q(
          o,
          'glass',
          [
            [X, y0, z - 0.93],
            [X, y0, z + 0.93],
            [X, y1, z + 0.93],
            [X, y1, z - 0.93],
          ],
          [dx, 0, 0],
        );
        beam(o, 'steel', [X + dx * 0.05, 0.85, z], [X + dx * 0.05, 2.45, z], 0.065, 0.065, C.steel);
      } else {
        const Z = z + dz * 0.94;
        Q(
          o,
          'glass',
          [
            [x - 1.01, y0, Z],
            [x + 1.01, y0, Z],
            [x + 1.01, y1, Z],
            [x - 1.01, y1, Z],
          ],
          [0, 0, dz],
        );
        beam(o, 'steel', [x, 0.85, Z + dz * 0.05], [x, 2.45, Z + dz * 0.05], 0.065, 0.065, C.steel);
      }
    }
  }
  B(o, 'steel', x, 2.4, z, 2.7, 0.16, 2.5);
  if (d >= 2) {
    B(o, 'machine', x - 1.17, 0.9, z, 0.03, 0.9, 0.66);
    B(o, 'steel', x, 2.56, z, 0.6, 0.12, 0.6);
  }
  B(o, 'machine', L - 1.4, -1.7, 2.9, 1.1, 0.75, 1.4);
  if (d >= 1) {
    const N = d === 3 ? 16 : 8;
    for (let j = 0; j < N; j++) {
      const a = (Math.PI * 2 * j) / N,
        b = (Math.PI * 2 * (j + 1)) / N;
      Q(o, 'machine', [
        [0.65 * Math.cos(a), -1.1, 0.65 * Math.sin(a)],
        [0.65 * Math.cos(b), -1.1, 0.65 * Math.sin(b)],
        [0.65 * Math.cos(b), -0.32, 0.65 * Math.sin(b)],
        [0.65 * Math.cos(a), -0.32, 0.65 * Math.sin(a)],
      ]);
    }
    for (const s of [-1, 1]) B(o, 'machine', -10, -1.4, s * 4.4, 1.2, 1.1, 0.6);
  }
}
function build(o, _f, d = 3) {
  deck(o, d);
  for (let i = 0; i < 16; i++) hull(o, (L * (i + 0.5)) / 16, d);
  arches(o, d);
  cabin(o, d);
}
export const pontoonSkyline = (o, f) => build(o, f, 0),
  pontoonDistrict = (o, f) => build(o, f, 1),
  pontoonStreet = (o, f) => build(o, f, 2),
  pontoonCloseup = (o, f) => build(o, f, 3);
export const pontoonModel = {
  id: 'queen_emma_bridge',
  key: 'queen_emma_bridge',
  cell: 'd6/d6n',
  recipe: 'structure-queen-emma-bridge.mjs',
  title: 'Queen Emma Bridge, Willemstad',
  category: 'bridge',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [205, 70, 160],
  lookAt: [73, 1, 0],
  portableGroundY: -3.2,
  mediumFiContext: { scale: 3, groundY: -3.2 },
  qaCameras: [
    {
      name: 'whole-native-pontoon-bridge-and-hinge-approach',
      position: [210, 85, 140],
      lookAt: [70, 1, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'sixteen-boat-pontoons-stringers-and-open-water-gaps',
      position: [83, 8, 32],
      lookAt: [73, -1.25, 0],
    },
    {
      name: 'transverse-light-arches-woodwalk-and-open-rails',
      position: [41, 3.6, 2],
      lookAt: [76, 2.3, 0],
    },
    {
      name: 'punda-freeend-glazed-operator-cabin-and-intrinsic-hardware',
      position: [166, 8, -19],
      lookAt: [149, 1, -2],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent400mfield frozen atdrywesternapproachbeforegeometry; lownegativewaterDEMretaineddiagnosticonly/noinferredbathymetry, actualwaterline/shoregradeunverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-queen-emma-bridge.mjs',
    level: 'skyline',
    export: 'pontoonSkyline',
    errorMeters: 0.85,
    surfaces,
    authoredLevels: {
      district: { export: 'pontoonDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'pontoonStreet', errorMeters: 0.1, surfaces },
      closeup: { export: 'pontoonCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Wholeclosed152.816mmovingbridge/original12.013mhingeapproach,16separateorthogonalboatpontoons and16representativetransversearchedlightframes. Nativeoriginal6deckvertices retained. Thinraisedwoodwalk/openrails/intrinsicoperatorcabin andboundedhinge/pushgear. Not a lonearch/genericfootbridge/citywaterfront. Staticclosedpose; noanimation/collision-clearancecertification/active2026machinerysimulation.',
    'Qualla-first27families/0conflicts; anonymouspublishedmuseumphotos/attributionimages/unverifiedmodernagencycandidateexcluded. Threeexactnativephotographicoriginalsindividuallyinspected/SHA1matched, primaryNationaalArchiefitem-specificownCC0boundbyexistingvalidator:927-8469BertVerhoeff1975wholebridge,252-3109and252-3538WillemvandePoll1955deck/night. Deckviewcorrectlyresolvestransversearchesoverwalkway. No newpolicyexception/siblingmetadatachange, phototexture/generatedbitmap/downloadedmesh/royalornamentalcolumns/flags/copyofnearbycity.',
    'Owner2026electrificationretainsappearance; tourismboard16pontoons/restoredwooddeck textcontrols principalstableform. Historicphotosshowasphaltlane/royaldecorations, notadopted ascurrent. Exactpresentpaintcolors/unrecordedinterimrefits/cabinwindowcount/archcensus/beamgauges/underwaterhullpropulsion/draft are boundedoriginalmediumfiestimates. Mutedwhite/gray/brownwood palette doesnotclaimsurveyedcolorfromblackandwhitephotos.',
    'Deck0/pontoons-1..-2.7m/estimatedwaterline-1.85m/archcrown5.3m arephotoestimates. Floatingcraftareintrinsic bridge supports, nottrafficprops. Actualbarechannel/banks/ships/ferries/quay/facades/trees/people/roadmarkings/renovationequipment/watermesh excluded; no whole-site floor. Openairheadroom/between-boatgaps real atallLODs.',
    'Independent400m129x129field/16641samples/rawtilebytes acquired atfixedlandwardwestapproachbeforegeometry andunchanged. Compositewatercellsincludedeeplowoutliersdown to-379.8896m; diagnosticrawvaluesareNOTsurveyedbathymetry/waterclassification/hostshoregrade. Do notflatten/fit/resampleawaynegativecells. Flatinspectionstage-3.2mseparate; ordinarynativepreview/replaceFootprint=false, realwater/shore/threshold/compatiblehostcontactunverified.',
  ],
};
