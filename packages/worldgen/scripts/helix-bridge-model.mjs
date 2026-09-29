/** Original exterior reconstruction from COX/Arup descriptions and the mapped curved crossing. */
import { beam, loft, normalFor } from './authored-structure-mesh.mjs';
import { quad, tube } from './structure-mesh.mjs';

const white = [0.88, 0.9, 0.91],
  polished = [0.96, 0.97, 0.98];
const paving = [0.66, 0.67, 0.62],
  glass = [0.6, 0.73, 0.75];
const half = 135.7,
  radius = 292.72479475323627;
const podCenters = [-94.17, -33.96, 28.47, 91.69],
  podRadiusAlong = 6,
  podRadiusAcross = 4.5,
  podOffset = 10.7,
  podOpeningHalf = 1.5,
  podRailStart = -Math.acos(podOpeningHalf / podRadiusAlong);
// Centerline and viewing POIs resolve the incorrect pod side in the coarse bridge-area relation.
// +X runs north; native −Z faces Marina Bay, inside the curved crossing.
const curve = (x) =>
  -277.93985817099406 + Math.sqrt(radius * radius - (x + 2.8000709363171694) ** 2);
const grade = (x) => 2.8 * Math.max(0, 1 - (x / half) ** 2);
const frame = (x) => {
  const dx = x + 2.8000709363171694;
  const slope = -dx / Math.sqrt(radius * radius - dx * dx);
  const d = Math.hypot(1, slope);
  return { tangent: [1 / d, 0, slope / d], across: [-slope / d, 0, 1 / d] };
};
const point = (x, y, lateral = 0) => {
  const n = frame(x).across;
  return [x + n[0] * lateral, y + (y > 1 ? grade(x) : 0), curve(x) + n[2] * lateral];
};
const stroke = (out, slot, points, r, color, sides = 12) => {
  const rings = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)];
    const length = Math.hypot(...b.map((v, k) => v - a[k]));
    const axis = b.map((v, k) => (v - a[k]) / length);
    let u = [-axis[2], 0, axis[0]];
    let len = Math.hypot(...u);
    if (len < 0.01) {
      u = [1, 0, 0];
      len = 1;
    }
    u = u.map((v) => v / len);
    const v = [
      axis[1] * u[2] - axis[2] * u[1],
      axis[2] * u[0] - axis[0] * u[2],
      axis[0] * u[1] - axis[1] * u[0],
    ];
    return Array.from({ length: sides }, (_, j) => {
      const angle = (2 * Math.PI * j) / sides;
      const localRadius = typeof r === 'function' ? r(i / (points.length - 1)) : r;
      return p.map(
        (value, k) => value + localRadius * (u[k] * Math.cos(angle) + v[k] * Math.sin(angle)),
      );
    });
  });
  loft(out, slot, rings, color);
};
const cylinder = (out, a, b, r, color = white, slot = 'steel') =>
  tube(out, slot, a, b, r, color, 12);
const sampled = (from, to, step, fn) => {
  const count = Math.ceil((to - from) / step);
  return Array.from({ length: count + 1 }, (_, i) => fn(from + ((to - from) * i) / count));
};
function panel(out, corners, color, slot = 'glass') {
  const n = normalFor(...corners);
  quad(out, slot, corners, n, color);
  quad(
    out,
    slot,
    [...corners].reverse(),
    n.map((v) => -v),
    color,
  );
}
function deckCell(out, x0, x1, z0, z1, y0, y1, color, slot = 'paving') {
  const a = point(x0, y0, z0),
    b = point(x1, y0, z0),
    c = point(x1, y0, z1),
    d = point(x0, y0, z1);
  const A = point(x0, y1, z0),
    B = point(x1, y1, z0),
    C = point(x1, y1, z1),
    D = point(x0, y1, z1);
  for (const p of [
    [a, A, B, b],
    [b, B, C, c],
    [c, C, D, d],
    [d, D, A, a],
    [A, D, C, B],
    [a, b, c, d],
  ])
    quad(out, slot, p, normalFor(...p), color);
}
function platform(out, x) {
  const n = frame(x).across.map((v) => -v),
    t = frame(x).tangent,
    center = point(x, 6, -podOffset);
  const at = (angle) =>
    center.map(
      (v, k) =>
        v + t[k] * podRadiusAlong * Math.cos(angle) + n[k] * podRadiusAcross * Math.sin(angle),
    );
  const ring = [
    point(x + podOpeningHalf, 6, -3.03),
    ...Array.from({ length: 81 }, (_, i) =>
      at(podRailStart + (i * (Math.PI - 2 * podRailStart)) / 80),
    ),
    point(x - podOpeningHalf, 6, -3.03),
  ];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      ps = [center, a, b];
    out.addTriangle(
      'paving',
      'palette:#ffffff',
      ps,
      normalFor(...ps),
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      paving,
    );
    const wall = [
      b,
      a,
      a.map((v, k) => v - (k === 1 ? 0.32 : 0)),
      b.map((v, k) => v - (k === 1 ? 0.32 : 0)),
    ];
    quad(out, 'steel', wall, normalFor(...wall), white);
    const under = [
      center.map((v, k) => v - (k === 1 ? 0.32 : 0)),
      b.map((v, k) => v - (k === 1 ? 0.32 : 0)),
      a.map((v, k) => v - (k === 1 ? 0.32 : 0)),
    ];
    out.addTriangle(
      'steel',
      'palette:#ffffff',
      under,
      normalFor(...under),
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      white,
    );
    if (i === ring.length - 1) continue;
    const A = a.map((v, k) => v + (k === 1 ? 1.3 : 0)),
      B = b.map((v, k) => v + (k === 1 ? 1.3 : 0));
    cylinder(out, a, A, 0.034);
    panel(out, [a, b, B, A], glass);
    cylinder(out, A, B, 0.04);
  }
  for (let i = -4; i <= 4; i++) {
    const a = point(x + i * 1.25, 5.72, -1.8),
      b = point(
        x + i * 1.25,
        5.72,
        -podOffset -
          podRadiusAcross * Math.sqrt(Math.max(0, 1 - ((i * 1.25) / podRadiusAlong) ** 2)),
      );
    beam(out, 'steel', a, b, 0.15, 0.32, white);
  }
}

export function buildHelix(out) {
  // Slab, individually jointed granite panels and longitudinal floor beams.
  for (let x = -half; x < half; x += 0.8) {
    const end = Math.min(half, x + 0.8);
    deckCell(out, x, end, -3, 3, 5.58, 5.94, [0.45, 0.49, 0.49], 'concrete');
    for (let lane = 0; lane < 6; lane++)
      deckCell(
        out,
        x + 0.007,
        end - 0.007,
        -2.97 + lane * 0.99,
        -2.97 + (lane + 1) * 0.99 - 0.016,
        5.94,
        6,
        paving.map((v) => v + (((Math.floor(x / 0.8) + lane + 600) % 3) - 1) * 0.015),
      );
  }
  for (const side of [-1, 1]) {
    stroke(
      out,
      'steel',
      sampled(-half, half, 0.75, (x) => point(x, 5.55, side * 3.03)),
      0.1,
      white,
    );
    const cuts =
      side === -1
        ? [-half, ...podCenters.flatMap((x) => [x - podOpeningHalf, x + podOpeningHalf]), half]
        : [-half, half];
    for (let section = 0; section < cuts.length - 1; section += 2) {
      const from = cuts[section],
        to = cuts[section + 1];
      for (const y of [6.04, 7.34])
        stroke(
          out,
          'steel',
          sampled(from, to, 0.75, (x) => point(x, y, side * 3.03)),
          0.037,
          white,
        );
      for (let x = from; x < to; x += 1.5) {
        const end = Math.min(to, x + 1.5);
        cylinder(out, point(x, 6.02, side * 3.03), point(x, 7.34, side * 3.03), 0.032);
        panel(
          out,
          [
            point(x + 0.035, 6.15, side * 3.03),
            point(end - 0.035, 6.15, side * 3.03),
            point(end - 0.035, 7.27, side * 3.03),
            point(x + 0.035, 7.27, side * 3.03),
          ],
          glass,
        );
      }
    }
  }
  const helixPoint = (x, j, count, r, cy, pitch, hand) => {
    const phase = count === 6 ? 0.892 : 0.516;
    const endStart = 111;
    const station = Math.max(-endStart, Math.min(endStart, x));
    const angle =
      Math.PI -
      (phase + (2 * Math.PI * j) / count + (hand * 2 * Math.PI * (station + half)) / pitch);
    let y = cy + r * Math.sin(angle),
      z = r * Math.cos(angle);
    if (Math.abs(x) > endStart) {
      // Architect's end-span drawing gathers the tubes into the deck-edge
      // bearings. Move overhead tubes outside the walking width before lowering
      // them, leaving a clear entrance rather than cutting a full helix at shore.
      const t = (Math.abs(x) - endStart) / (half - endStart);
      const spread = Math.min(1, t * 2);
      const ease = spread * spread * (3 - 2 * spread);
      z += ((z >= 0 ? 3.3 : -3.3) - z) * ease;
      const fall = Math.max(0, (t - 0.5) * 2);
      y += (5.6 - y) * fall * fall * (3 - 2 * fall);
    }
    return point(x, y, z);
  };
  // Secondary rods stop at the open viewing bays. Main helical tubes remain continuous.
  const clearsWalk = (a, b, x) => {
    const origin = point(x, 0),
      n = frame(x).across;
    return sampled(0, 1, 0.025, (t) => a.map((v, k) => v + (b[k] - v) * t)).every((p) => {
      if (p[1] - grade(x) < 5.85 || p[1] - grade(x) > 8.45) return true;
      const lateral = p.reduce((sum, v, k) => sum + (v - origin[k]) * n[k], 0);
      if (Math.abs(lateral) < 3.08) return false;
      return !podCenters.some(
        (center) =>
          ((x - center) / podRadiusAlong) ** 2 + ((lateral + podOffset) / podRadiusAcross) ** 2 <
            1.06 ||
          (Math.abs(x - center) < podOpeningHalf + 0.2 && lateral < -3),
      );
    });
  };
  for (const [count, r, cy, pitch, hand, color] of [
    [6, 5.4, 8.4, 73.6, 1, white],
    [5, 4.7, 7.7, 51.4, -1, polished],
  ]) {
    for (let j = 0; j < count; j++) {
      stroke(
        out,
        'steel',
        sampled(-half, half, 0.4, (x) => helixPoint(x, j, count, r, cy, pitch, hand)),
        0.1365,
        color,
        16,
      );
      for (let x = -half + 2; x < half - 2; x += 5) {
        const a = helixPoint(x, j, count, r, cy, pitch, hand),
          b = helixPoint(x, j + 1, count, r, cy, pitch, hand);
        if (clearsWalk(a, b, x)) cylinder(out, a, b, 0.026, white);
        // Collar and pin at the real tube/rod junction, modeled independently of surface grain.
        const t = frame(x).tangent;
        cylinder(
          out,
          a.map((v, k) => v - t[k] * 0.1),
          a.map((v, k) => v + t[k] * 0.1),
          0.18,
          polished,
        );
      }
    }
  }
  // Short tension struts connect the counter-rotating systems without closing the walking tube.
  for (let x = -half + 3; x < half; x += 5)
    for (let j = 0; j < 6; j++) {
      const a = helixPoint(x, j, 6, 5.4, 8.4, 73.6, 1);
      const candidates = Array.from({ length: 5 }, (_, k) =>
        helixPoint(x, k, 5, 4.7, 7.7, 51.4, -1),
      );
      candidates.sort(
        (p, q) =>
          Math.hypot(...p.map((v, k) => v - a[k])) - Math.hypot(...q.map((v, k) => v - a[k])),
      );
      if (clearsWalk(a, candidates[0], x)) cylinder(out, a, candidates[0], 0.027, polished);
    }
  // The alternating overhead fritted-glass and mesh leaves preserve open sides and sky slots.
  for (let x = -110; x < 110; x += 3.5) {
    const end = Math.min(110, x + 3.3);
    for (let side = -1; side <= 1; side += 2) {
      for (let leaf = 0; leaf < 3; leaf++) {
        const z0 = side * (0.12 + leaf * 1.193),
          z1 = side * (0.12 + (leaf + 1) * 1.193 - 0.018),
          height = (z) => 7.7 + Math.sqrt(4.5 ** 2 - z ** 2);
        const points = [
          point(x, height(z0), z0),
          point(end, height(z0), z0),
          point(end, height(z1), z1),
          point(x, height(z1), z1),
        ];
        panel(
          out,
          points,
          Math.floor((x + half) / 3.5) % 3 === 0 ? [0.66, 0.69, 0.66] : [0.52, 0.66, 0.68],
          Math.floor((x + half) / 3.5) % 3 === 0 ? 'mesh' : 'glass',
        );
        for (let k = 0; k < 4; k++) cylinder(out, points[k], points[(k + 1) % 4], 0.027, white);
      }
    }
  }
  for (const x of podCenters) platform(out, x);
  // Each of the four pile caps carries two inverted tripods, as in the architect's detail.
  for (const x of podCenters) {
    const cap = Array.from({ length: 8 }, (_, i) =>
      point(x + 2.8 * Math.cos((-i * Math.PI) / 4), 0, 4.8 * Math.sin((-i * Math.PI) / 4)),
    );
    loft(out, 'concrete', [cap, cap.map((p) => [p[0], 0.8, p[2]])], [0.66, 0.66, 0.61]);
    for (const side of [-1, 1])
      for (const [dx, z] of [
        [-2.5, side * 4.3],
        [2.5, side * 4.3],
        [0, side * 0.8],
      ]) {
        const bottom = point(x, 0.8, side * 3.1),
          top = point(x + dx, 5.6, z);
        stroke(out, 'steel', [bottom, top], (t) => 0.3 - t * 0.1, white, 20);
      }
  }
  // Low shore caps and paired struts support the converging end tubes.
  for (const x of [-half, half]) {
    deckCell(
      out,
      x < 0 ? x : x - 2,
      x < 0 ? x + 2 : x,
      -3.4,
      3.4,
      0,
      1.0,
      [0.62, 0.63, 0.59],
      'concrete',
    );
    const station = x < 0 ? x + 1 : x - 1;
    for (const side of [-1, 1])
      stroke(
        out,
        'steel',
        [point(station, 1, side * 1.5), point(station, 5.58, side * 3.2)],
        (t) => 0.22 - 0.06 * t,
        white,
        20,
      );
  }
}

export const helixStudy = {
  id: 'N0007',
  key: 'the_helix_bridge',
  title: 'The Helix Bridge',
  wikidataId: 'Q2681107',
  category: 'bridge',
  build: buildHelix,
  brief:
    'Curved Singapore crossing with opposing six-strand and five-strand stainless helices, transparent rails, shaded walkway, four bay-side viewing pods and slender tripod piers.',
  refs: [
    'https://www.coxarchitecture.com.au/project/the-helix-bridge/',
    'https://teamstainless.org/wp-content/uploads/2025/04/Helix_Pedestrian_Bridge.pdf',
    'https://www.imoa.info/download_files/molyreview/IMOA_MolyReview_2-2011.pdf',
    'https://www.archdaily.com/185400/helix-bridge-cox-architecture-with-architects-61',
  ],
  sourceFacts: {
    overallDescriptionMeters: 280,
    spanSequenceMeters: [45, 65, 65, 65, 45],
    spanSumMeters: 285,
    majorHelixDiameterMeters: 10.8,
    minorHelixDiameterMeters: 9.4,
    majorStrands: 6,
    minorStrands: 5,
    tubeDiameterMeters: 0.273,
    viewingPlatforms: 4,
    metal: 'duplex stainless grade1.4462',
    evidence:
      'COX architect project and SCI2011 case study supplied by Arup, including all four diagram/photo pages visually inspected.',
  },
  reconstruction: {
    nativeDeckLengthMeters: 271.4,
    curvedDeckLengthMeters: 2 * radius * Math.asin(half / radius),
    curveRadiusMeters: radius,
    walkWidthMeters: 6,
    deckAboveLocalWaterMeters: [6, 8.8],
    majorPitchMeters: 73.6,
    minorPitchMeters: 51.4,
    majorPhaseRadians: 0.892,
    minorPhaseRadians: 0.516,
    podPlanRadiiMeters: [6, 4.5],
    podCentersNativeX: podCenters,
    podBaySide: '-Z',
    endTransitionLengthMeters: 24.7,
    note: 'Mapped pedestrian centerline determines curved plan. Four west-side viewpoint POIs and architect plan resolve the bay-facing pods, correcting the coarse area relation. Approximate four/five helical turns, clear platform connections, canopy leaves and hardware are photo/drawing reconstructions. The deck rises from shore to a reconstructed8.8m central height.',
  },
  nativeAxes: {
    x: 'from Marina Bay Sands end toward Marina Centre in the exact-QID outline frame',
    y: 'up; Y0 is the reconstructed local reservoir surface/pier-cap base',
    z: 'east toward Bayfront roadway; four viewing platforms face native−Z toward Marina Bay',
  },
  geographic: (m) => ({
    anchor: m.anchor,
    heading: m.heading,
    elevationMode: 'sea-level',
    elevationMeters: 0,
    notes:
      'Mapped pedestrian ways164881537/687965211/687965212/687965213 and four viewpoint POIs fix curved plan and west bay-facing pods. The coarse area relation has erroneous east-side protrusions and is retained only as contextual overlay. Y0 is reservoir-level0m in the viewer datum; deck rises6–8.8m. Host reservoir offset can be supplied; do not terrain-drape the midpoint.',
  }),
  limitations: [
    'Exterior reconstruction, not fabrication geometry. Spans total285m in the source although narrative length is280m; mapped curve is used for fit.',
    'Helix phase and pitch, small rods, canopy panel boundaries and joint hardware are reconstructed from primary photographs.',
    'Local reservoir water/pier-cap elevation is provisionally0m in the viewer. Geographic approval requires rendered fit; no survey datum is claimed.',
    'Adjacent vehicular Bayfront bridge, city promenade, interior foundation piles and dynamic lighting control are outside this asset.',
  ],
  camera: { position: [165, 83, 185], lookAt: [0, 6, 0], fov: 42 },
  qaCameras: [
    { name: 'walkway', position: [-49, 10.5, 10], lookAt: [-23, 10.3, 14], fov: 55 },
    { name: 'helix-joints', position: [12, 19, -10], lookAt: [0, 12, 15] },
    { name: 'viewing-pod', position: [39, 20, -25], lookAt: [28.47, 8.7, 2] },
    { name: 'under-deck', position: [-28, 2.5, -15], lookAt: [-33.96, 6, 10] },
    { name: 'far-crossing', position: [25, 95, 330], lookAt: [0, 6, 0] },
    { name: 'shore-entrance', position: [143, 9, -17], lookAt: [115, 8, -10], fov: 52 },
  ],
};
