/** All thirty GMRT antennas at the operator's relative 3D station coordinates. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/te/tek/giant_metrewave_radio_telescope/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  E = (plan.estimatedParameters.elevationDegrees * Math.PI) / 180,
  n = [0, Math.sin(E), Math.cos(E)],
  t = [0, Math.cos(E), -Math.sin(E)],
  radius = 22.5,
  focal = 18.54,
  vertex = 18;
const C = {
  mesh: rgb('bec5b5'),
  steel: rgb('b3bcae'),
  dark: rgb('737e74'),
  concrete: rgb('c0c1b2'),
};
const surfaces = {
  mesh: {
    slot: 'roof',
    graph: 'metal_perforated_square',
    roughness: 0.85,
    metallic: 0.25,
    doubleSided: true,
    alphaMode: 'MASK',
    alphaCutoff: 0.5,
  },
  steel: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.85,
    metallic: 0.2,
    doubleSided: true,
  },
  dark: {
    slot: 'trim',
    graph: 'metal_stainless_beadblasted',
    roughness: 0.87,
    metallic: 0.35,
    doubleSided: true,
  },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
};
function T(o, s, p, normal) {
  p = p.map((q) => q.map(Math.fround));
  const nn = normalFor(...p);
  if (nn.every((v) => v === 0)) return;
  if (normal && nn.reduce((a, v, i) => a + v * normal[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((q) => [q[0] + q[2], q[1]]),
    C[s],
  );
}
function Q(o, s, p, normal) {
  T(o, s, p.slice(0, 3), normal);
  T(o, s, [p[0], p[2], p[3]], normal);
}
function rod(o, s, a, b, r, d) {
  if (d < 3) {
    const axis = b.map((q, i) => q - a[i]),
      u0 = cross(axis, Math.abs(axis[1]) < 0.98 * Math.hypot(...axis) ? [0, 1, 0] : [1, 0, 0]),
      l = Math.hypot(...u0),
      u = u0.map((v) => (v / l) * r),
      p = [
        a.map((v, i) => v - u[i]),
        b.map((v, i) => v - u[i]),
        b.map((v, i) => v + u[i]),
        a.map((v, i) => v + u[i]),
      ];
    Q(o, s, p);
    if (d) Q(o, s, p.toReversed());
    return;
  }
  const u = b.map((v, i) => v - a[i]),
    L = Math.hypot(...u);
  if (L < 1e-6) return;
  for (let i = 0; i < 3; i++) u[i] /= L;
  const v0 = cross(u, Math.abs(u[1]) < 0.98 ? [0, 1, 0] : [1, 0, 0]),
    l = Math.hypot(...v0),
    v = v0.map((q) => q / l),
    w = cross(u, v),
    P = (p, a) => p.map((q, i) => q + r * (v[i] * Math.cos(a) + w[i] * Math.sin(a)));
  for (let i = 0; i < 3; i++) {
    const a0 = (i * 2 * Math.PI) / 3,
      a1 = ((i + 1) * 2 * Math.PI) / 3;
    Q(
      o,
      s,
      [P(a, a0), P(a, a1), P(b, a1), P(b, a0)],
      v.map((q, k) => q * Math.cos((a0 + a1) / 2) + w[k] * Math.sin((a0 + a1) / 2)),
    );
  }
}
function cube(o, s, c, w, h, z) {
  const [x, y, zz] = c,
    a = x - w / 2,
    b = x + w / 2,
    lo = y - h / 2,
    hi = y + h / 2,
    f = zz - z / 2,
    g = zz + z / 2;
  for (const [p, n] of [
    [
      [
        [a, lo, f],
        [b, lo, f],
        [b, hi, f],
        [a, hi, f],
      ],
      [0, 0, -1],
    ],
    [
      [
        [a, lo, g],
        [a, hi, g],
        [b, hi, g],
        [b, lo, g],
      ],
      [0, 0, 1],
    ],
    [
      [
        [a, lo, f],
        [a, hi, f],
        [a, hi, g],
        [a, lo, g],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [b, lo, f],
        [b, lo, g],
        [b, hi, g],
        [b, hi, f],
      ],
      [1, 0, 0],
    ],
    [
      [
        [a, hi, f],
        [b, hi, f],
        [b, hi, g],
        [a, hi, g],
      ],
      [0, 1, 0],
    ],
    [
      [
        [a, lo, f],
        [a, lo, g],
        [b, lo, g],
        [b, lo, f],
      ],
      [0, -1, 0],
    ],
  ])
    Q(o, s, p, n);
}
const plus = (a, b) => a.map((v, i) => v + b[i]);
function antenna(o, station, d) {
  const base = station.local,
    P = (x, y, z) => [base[0] + x, base[1] + y, base[2] + z],
    B = (r, a, back = 0) => {
      const x = r * Math.cos(a),
        y = r * Math.sin(a),
        q = (r * r) / (4 * focal) - back;
      return P(x, vertex + t[1] * y + n[1] * q, t[2] * y + n[2] * q);
    },
    tip = P(0, vertex + n[1] * focal, n[2] * focal),
    N = [6, 8, 16, 24][d],
    R = [1, 2, 3, 4][d];
  // The actual reflector is wire mesh. This canonical alpha-coverage graph leaves genuine pixel openings.
  for (let k = 0; k < R; k++)
    for (let i = 0; i < N; i++) {
      const a = (i * 2 * Math.PI) / N,
        b = ((i + 1) * 2 * Math.PI) / N,
        r0 = (radius * k) / R,
        r1 = (radius * (k + 1)) / R;
      if (k === 0) T(o, 'mesh', [B(0, 0), B(r1, a), B(r1, b)], n);
      else Q(o, 'mesh', [B(r0, a), B(r1, a), B(r1, b), B(r0, b)], n);
    }
  if (d) {
    const loops = d === 1 ? [1] : d === 2 ? [0.5, 1] : [0.25, 0.5, 0.75, 1];
    for (const r of loops) {
      const count = d === 2 && r < 1 ? 8 : N;
      for (let i = 0; i < count; i++)
        rod(
          o,
          'steel',
          B(radius * r, (i * 2 * Math.PI) / count, 0.11),
          B(radius * r, ((i + 1) * 2 * Math.PI) / count, 0.11),
          d === 1 ? 0.17 : 0.095,
          d,
        );
    }
  }
  if (d > 1) {
    const spokes = d === 2 ? 8 : 12;
    for (let i = 0; i < spokes; i++) {
      const a = (i * 2 * Math.PI) / spokes;
      for (let k = 0; k < R; k++)
        rod(o, 'steel', B((radius * k) / R, a, 0.28), B((radius * (k + 1)) / R, a, 0.28), 0.12, d);
      if (d > 2) {
        rod(o, 'steel', B(radius, a, 0.35), B(7, a, 3.0), 0.15, d);
        rod(o, 'dark', B(7, a, 3), B(0, 0, 3), 0.13, d);
        rod(o, 'dark', B(7, a, 3), B(7, ((i + 1) * 2 * Math.PI) / spokes, 3), 0.13, d);
      }
    }
  }
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    rod(o, 'steel', B(radius * 0.84, a, -0.12), tip, d === 0 ? 0.3 : 0.16, d);
  }
  if (d) cube(o, 'steel', tip, 1.8, 1.6, 1.8);
  else {
    Q(o, 'steel', [
      plus(tip, [-0.8, -0.7, 0]),
      plus(tip, [0.8, -0.7, 0]),
      plus(tip, [0.8, 0.7, 0]),
      plus(tip, [-0.8, 0.7, 0]),
    ]);
  }
  const feet = [
      [-3, -3],
      [3, -3],
      [3, 3],
      [-3, 3],
    ],
    tops = feet.map(([x, z]) => [x * 0.55, 14, z * 0.55]);
  for (let k = 0; k < 4; k++) {
    const a = feet[k],
      b = tops[k];
    rod(o, 'dark', P(a[0], 0, a[1]), P(...b), d === 0 ? 0.5 : 0.26, d);
    if (d > 1) {
      rod(o, 'dark', P(a[0], 0, a[1]), P(...tops[(k + 1) % 4]), 0.15, d);
      rod(
        o,
        'dark',
        P(a[0] * 0.8, 6.5, a[1] * 0.8),
        P(feet[(k + 1) % 4][0] * 0.8, 6.5, feet[(k + 1) % 4][1] * 0.8),
        0.16,
        d,
      );
    }
    if (d > 2) cube(o, 'concrete', P(a[0], -0.2, a[1]), 1.45, 0.8, 1.45);
  }
  if (d) {
    cube(o, 'concrete', P(0, -0.5, 0), 6.9, 0.6, 6.9);
    for (const x of [-2, 2]) {
      rod(o, 'steel', P(x, 13, -1.7), P(x, 17.2, 0), 0.43, d);
      rod(o, 'steel', P(x, 13, 1.7), P(x, 17.2, 0), 0.43, d);
    }
    rod(o, 'steel', P(-2.1, 17.2, 0), P(2.1, 17.2, 0), 0.5, d);
  } else {
    Q(o, 'dark', [P(-1.8, 13, 0), P(1.8, 13, 0), P(1.8, 17.4, 0), P(-1.8, 17.4, 0)]);
    Q(
      o,
      'concrete',
      [P(-3.4, -0.3, -3.4), P(3.4, -0.3, -3.4), P(3.4, -0.3, 3.4), P(-3.4, -0.3, 3.4)],
      [0, 1, 0],
    );
  }
}
function build(o, _f, d = 3) {
  for (const station of plan.stations) antenna(o, station, d);
}
export const gmrtSkyline = (o, f) => build(o, f, 0);
export const gmrtDistrict = (o, f) => build(o, f, 1);
export const gmrtStreet = (o, f) => build(o, f, 2);
export const gmrtCloseup = (o, f) => build(o, f, 3);
export const giantMetrewaveRadioTelescopeModel = {
  id: 'giant_metrewave_radio_telescope',
  key: 'giant_metrewave_radio_telescope',
  recipe: 'structure-giant-metrewave-radio-telescope.mjs',
  cell: 'te/tek',
  title: 'Giant Metrewave Radio Telescope',
  category: 'radio-telescope-array',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  embeddedCanonicalGraphs: ['metal_perforated_square'],
  recipeDependencies: ['embed-graph-fallbacks.mjs'],
  brief: plan.authoringDirection,
  camera: [72, 44, 79],
  lookAt: [0, 21, 0],
  portableGroundY: -34.6,
  mediumFiContext: { scale: 1, groundY: -34.6, far: 84000 },
  qaCameras: [
    {
      name: 'complete-thirty-station-y-array-at-operator-coordinates',
      position: [-21000, 18000, 26500],
      lookAt: [0, 20, 2200],
    },
    {
      name: 'central-array-fourteen-dishes-at-real-stations',
      position: [-900, 700, 1550],
      lookAt: [0, 30, 400],
    },
    {
      name: 'c02-open-parabolic-mesh-radial-framework-and-focal-feed',
      position: [64, 39, 65],
      lookAt: [0, 21, 0],
    },
    {
      name: 'c02-backside-quadrupod-altaz-fork-and-splayed-tower',
      position: [-52, 34, -48],
      lookAt: [0, 17, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent30km121x121field/20rawTerrariumtilesfrozenbeforegeometryatC02southbasepoint. RawDEMandprimaryrelativeUpbothpreservedwithoutfitting; exactcompatiblehostcontactandcurvature/projectionoffsetsatouterstationsuncertified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-giant-metrewave-radio-telescope.mjs',
    level: 'skyline',
    export: 'gmrtSkyline',
    errorMeters: 2.5,
    surfaces,
    embeddedCanonicalGraphs: ['metal_perforated_square'],
    authoredLevels: {
      district: {
        export: 'gmrtDistrict',
        errorMeters: 1.2,
        surfaces,
        embeddedCanonicalGraphs: ['metal_perforated_square'],
      },
      street: {
        export: 'gmrtStreet',
        errorMeters: 0.5,
        surfaces,
        embeddedCanonicalGraphs: ['metal_perforated_square'],
      },
      closeup: {
        export: 'gmrtCloseup',
        errorMeters: 0,
        surfaces,
        embeddedCanonicalGraphs: ['metal_perforated_square'],
      },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Full30stationarrayfromprimary2025-12-15operatornumericTable3andnativeC02identity; 14centralstations/16outerstations,nofabricatedregularrows. AllrelativeUpvaluespreserved. Coarselocalcartographicprojection/EarthcurvatureandrawDEMdiffer; exactlivehostcontactunverified. No whole25kmground/roads/farmsmesh.',
    'Exactpublished640x480SankashidownmobilePDoriginalindividuallyinspected/nativeSHA1matched; correctcase-sensitivefilenameGMRT.jpgisdistinctfromattributionGmrt.JPG. Selectionbugfixedwithfocusedregressionswithoutalteringsiblingmedia. Allattributionimages/NASAcelestialphotosunused. No externalphotographneeded/copiedor generatedbitmaptextures.',
    '45mdiameter,18.54mfocallengthandfourfeedsupportlegsareoperatorfacts. Realparabolicwiremeshusescanonicalalpha-coverageperforatedsquaregraph,8.5cmrepeatcoarserthanactual10/15/20mmwirecellsasanexplicitmedium-fiapproximation. Palephysicalconcentric/radialsteelmembers,openrearlatticeandfork/fourlegs/feedhousingareoriginalboundedforms. No opaqueparabolicdishsubstituteintheworldmaterials.',
    'Sourcephotographisblurry; fineconnections/actualpedestal/fork/rearsection/census/servocoversandpaint/currentequipmentchangesestimated. 18mvertex/14mmountheight,60degreeelevation/southwardstaticpointingareboundedrepresentativeparameterswithintheoperatorrange, notcurrenttrackingstate orsurvey. Templateconsistentacross30stations.',
    'LowerLODsreducereflectorsegments/ribs/mountdetailsbutretainall30actualstationlocations,theentire45mspan/parabolicprofile,quadrupodfeeds/supporttower. Administration/control/guesthouse/labs/canteen/electronics/fibercables/fences/landscape/signs/vehicles/peopleexcluded.',
    'Independent30km250mgrid/14641values/20originalTerrariumtilesfrozenbeforegeometry. Pixelspacingabout36mdoesnotimplysurveyaccuracy; fieldincludesurban/vegetationheightreturns. FrozenC02datumpointnotfittedtoprimarytable. Portable/sharedflatgroundonlygeometryfixture, remainingstationbasesnaturallyshowrelativeheightoffsetsagainstflatplane; nothost-groundproof. PreviewreplaceFootprint=false.',
  ],
};
