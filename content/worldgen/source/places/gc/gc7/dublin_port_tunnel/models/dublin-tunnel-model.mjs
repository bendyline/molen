/** Whole twin tunnel: native route axes, authored physical tubes and open terminal canopies. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  { architecturalSections: A } = p.parameters;
const C = {
  concrete: rgb('929a9a'),
  metal: rgb('d4d9d6'),
  tile: rgb('d5d6bf'),
  road: rgb('454b4c'),
};
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  metal: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.54, metallic: 0.65 },
  tile: { slot: 'wall', graph: 'tile_ceramic', roughness: 0.72, metallic: 0 },
  road: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.95, metallic: 0 },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const routes = p.routes,
  partEvidence = [],
  axisEvidence = [],
  portalEvidence = [],
  sectionEvidence = [],
  retainingEvidence = [];
export function grade(r, s) {
  const t = Math.max(0, Math.min(1, s / r.length));
  return r.northFloor * (1 - t) + r.southFloor * t - A.interiorGradeSag * 4 * t * (1 - t);
}
export function station(r, s) {
  s = Math.max(0, Math.min(r.length, s));
  let i = 0;
  while (i < r.stations.length - 2 && r.stations[i + 1] < s) i++;
  const a = r.points[i],
    b = r.points[i + 1],
    L = r.stations[i + 1] - r.stations[i],
    t = (s - r.stations[i]) / L,
    T = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
    N = [T[1], -T[0]];
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, y: grade(r, s), T, N, s };
}
export const P = (st, x, y) => [st.x + st.N[0] * x, st.y + y, st.z + st.N[1] * x];
function T(o, k, q, n, col = C[k]) {
  q = q.map((q) => q.map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && dot(cr, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function segmentNormal(a, b) {
  const t = [b.x - a.x, 0, b.z - a.z],
    L = Math.hypot(...t);
  return [t[2] / L, 0, -t[0] / L];
}
function section(_r, s, lod, inner = false) {
  const cut = s < A.northCutCoverMeters || s > A.northCutCoverMeters + A.boredLengthMeters,
    N = [3, 8, 12, 24][lod],
    R = A.boredOuterRadius - (inner ? A.linerThickness : 0),
    cy = A.tubeCenterAboveDeck;
  if (lod === 0)
    return [
      [-R, cy - R],
      [0, cy + R],
      [R, cy - R],
    ];
  return Array.from({ length: N }, (_, i) => {
    const a = (2 * Math.PI * i) / N,
      u = Math.cos(a),
      v = Math.sin(a);
    if (!cut) return [R * u, cy + R * v];
    const k = 1 / Math.max(Math.abs(u), Math.abs(v));
    return [
      (A.cutCoverHalfWidth - (inner ? A.linerThickness : 0)) * u * k,
      cy + (A.cutCoverHalfHeight - (inner ? A.linerThickness : 0)) * v * k,
    ];
  });
}
function tube(o, r, lod) {
  const tubeStations = [
    A.canopyLength,
    ...r.stations.filter((s) => s > A.canopyLength && s < r.length - A.canopyLength),
    r.length - A.canopyLength,
  ];
  const ss = tubeStations.map((s) => station(r, s)),
    profiles = ss.map((st) => section(r, st.s, lod)),
    N = profiles[0].length;
  for (let i = 0; i < ss.length; i++) {
    const st = ss[i],
      ring = profiles[i].map(([x, y]) => P(st, x, y));
    const nativeIndex = r.stations.findIndex((s) => Math.abs(s - st.s) < 1e-6);
    if (nativeIndex >= 0)
      axisEvidence.push({
        route: r.id,
        node: r.nodeIds[nativeIndex],
        center: [st.x, st.y, st.z],
        station: st.s,
        ring,
        part: 'tube',
      });
    sectionEvidence.push({
      route: r.id,
      station: st.s,
      kind:
        st.s < A.northCutCoverMeters || st.s > A.northCutCoverMeters + A.boredLengthMeters
          ? 'cut-cover'
          : 'bored',
      outerRadius: A.boredOuterRadius,
    });
  }
  for (let i = 0; i < ss.length - 1; i++) {
    const a = ss[i],
      b = ss[i + 1],
      n = segmentNormal(a, b);
    for (let j = 0; j < N; j++) {
      const k = (j + 1) % N,
        pa = profiles[i][j],
        pb = profiles[i][k],
        mid = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2 - A.tubeCenterAboveDeck];
      Q(
        o,
        'concrete',
        [P(a, ...pa), P(b, ...profiles[i + 1][j]), P(b, ...profiles[i + 1][k]), P(a, ...pb)],
        [n[0] * mid[0], mid[1], n[2] * mid[0]],
      );
    }
    if (lod >= 2) {
      const ia = section(r, a.s, lod, true),
        ib = section(r, b.s, lod, true);
      for (let j = 0; j < N; j++) {
        const k = (j + 1) % N,
          mid = [(ia[j][0] + ia[k][0]) / 2, (ia[j][1] + ia[k][1]) / 2 - A.tubeCenterAboveDeck];
        Q(
          o,
          mid[1] < 1 ? 'tile' : 'concrete',
          [P(a, ...ia[j]), P(a, ...ia[k]), P(b, ...ib[k]), P(b, ...ib[j])],
          [-n[0] * mid[0], -mid[1], -n[2] * mid[0]],
        );
      }
    }
    if (lod >= 1) {
      Q(
        o,
        'road',
        [
          P(a, -A.roadHalfWidth, 0),
          P(a, A.roadHalfWidth, 0),
          P(b, A.roadHalfWidth, 0),
          P(b, -A.roadHalfWidth, 0),
        ],
        [0, 1, 0],
      );
      for (const sign of [-1, 1]) {
        const x = sign * A.roadHalfWidth,
          X = sign * (A.cutCoverHalfWidth - A.linerThickness);
        Q(o, 'tile', [P(a, x, 0.12), P(a, X, 0.12), P(b, X, 0.12), P(b, x, 0.12)], [0, 1, 0]);
        if (lod >= 2)
          Q(
            o,
            'tile',
            [P(a, x, 0), P(a, x, 0.12), P(b, x, 0.12), P(b, x, 0)],
            [-sign * a.N[0], 0, -sign * a.N[1]],
          );
      }
    }
  }
  if (lod === 1)
    for (const start of [0, r.length - A.liningDetailLength]) {
      const a = station(r, start),
        b = station(r, start + A.liningDetailLength),
        ia = section(r, a.s, lod, true),
        ib = section(r, b.s, lod, true),
        n = segmentNormal(a, b);
      for (let j = 0; j < N; j++) {
        const k = (j + 1) % N,
          mid = [(ia[j][0] + ia[k][0]) / 2, (ia[j][1] + ia[k][1]) / 2 - A.tubeCenterAboveDeck];
        Q(
          o,
          'tile',
          [P(a, ...ia[j]), P(a, ...ia[k]), P(b, ...ib[k]), P(b, ...ib[j])],
          [-n[0] * mid[0], -mid[1], -n[2] * mid[0]],
        );
      }
    }
}
function canopyProfile(radius, spring, N) {
  const q = [
    [-radius, 0],
    [-radius, spring],
  ];
  for (let j = 1; j <= N; j++) {
    const a = Math.PI * (1 - j / N);
    q.push([radius * Math.cos(a), spring + radius * Math.sin(a)]);
  }
  q.push([radius, 0]);
  return q;
}
function portal(o, r, end, lod) {
  const north = end === 'north',
    s = north ? 0 : r.length,
    inward = north ? 1 : -1,
    base = station(r, s),
    N = [2, 6, 12, 24][lod],
    M = [1, 2, 4, 8][lod],
    outer = canopyProfile(A.canopyFrontOuterRadius, A.canopyFrontSpring, N),
    inner = canopyProfile(A.canopyFrontInnerRadius, A.canopyFrontSpring, N),
    outside = [-base.T[0] * inward, 0, -base.T[1] * inward],
    profileAt = (t, inside) =>
      canopyProfile(
        (inside ? A.canopyFrontInnerRadius : A.canopyFrontOuterRadius) * (1 - t) +
          (A.boredOuterRadius - (inside ? A.linerThickness : 0)) * t,
        A.canopyFrontSpring * (1 - t) + A.canopyRearSpring * t,
        N,
      ),
    at = (t, x, y) => P(station(r, s + inward * A.canopyLength * t), x, y);
  for (let j = 0; j < outer.length - 1; j++)
    Q(
      o,
      'concrete',
      [at(0, ...outer[j]), at(0, ...outer[j + 1]), at(0, ...inner[j + 1]), at(0, ...inner[j])],
      outside,
    );
  const ts = [
    ...new Set([
      0,
      1,
      ...Array.from({ length: M - 1 }, (_, i) => (i + 1) / M),
      ...r.stations.map((q) => (q - s) / (inward * A.canopyLength)).filter((t) => t > 0 && t < 1),
    ]),
  ].sort((a, b) => a - b);
  for (const t of ts) {
    const q = s + inward * A.canopyLength * t,
      idx = r.stations.findIndex((s) => Math.abs(s - q) < 1e-6);
    if (idx >= 0) {
      const st = station(r, q);
      axisEvidence.push({
        route: r.id,
        node: r.nodeIds[idx],
        center: [st.x, st.y, st.z],
        station: q,
        ring: profileAt(t, false).map((q) => at(t, ...q)),
        part: 'portal',
      });
    }
  }
  for (let m = 0; m < ts.length - 1; m++) {
    const a = ts[m],
      b = ts[m + 1],
      oa = profileAt(a, false),
      ob = profileAt(b, false),
      ia = profileAt(a, true),
      ib = profileAt(b, true);
    for (let j = 0; j < oa.length - 1; j++) {
      const n = [
        base.N[0] * (oa[j][0] + oa[j + 1][0]),
        oa[j][1] + oa[j + 1][1] - 2 * A.canopyFrontSpring,
        base.N[1] * (oa[j][0] + oa[j + 1][0]),
      ];
      Q(
        o,
        'metal',
        [at(a, ...oa[j]), at(b, ...ob[j]), at(b, ...ob[j + 1]), at(a, ...oa[j + 1])],
        n,
      );
      Q(
        o,
        'tile',
        [at(a, ...ia[j]), at(a, ...ia[j + 1]), at(b, ...ib[j + 1]), at(b, ...ib[j])],
        n.map((v) => -v),
      );
    }
  }
  const approach = {
    ...base,
    x: base.x + outside[0] * A.portalApproachLength,
    z: base.z + outside[2] * A.portalApproachLength,
  };
  const W = lod === 0 ? A.canopyFrontInnerRadius : A.roadHalfWidth;
  Q(
    o,
    'road',
    [P(approach, -W, 0.025), P(approach, W, 0.025), at(0, W, 0.025), at(0, -W, 0.025)],
    [0, 1, 0],
  );
  Q(o, 'road', [at(0, -W, 0.025), at(0, W, 0.025), at(1, W, 0.025), at(1, -W, 0.025)], [0, 1, 0]);
  if (lod >= 1)
    for (const sign of [-1, 1]) {
      const a = sign * A.roadHalfWidth,
        b = sign * A.canopyFrontInnerRadius;
      Q(o, 'tile', [at(0, a, 0.12), at(0, b, 0.12), at(1, b, 0.12), at(1, a, 0.12)], [0, 1, 0]);
      Q(
        o,
        'tile',
        [at(0, a, 0.025), at(0, a, 0.12), at(1, a, 0.12), at(1, a, 0.025)],
        [-sign * base.N[0], 0, -sign * base.N[1]],
      );
    }
  if (lod >= 1)
    for (const sign of [-1, 1]) {
      const x = sign * (A.canopyFrontOuterRadius + A.canopyWingWidth / 2),
        xs = [x - A.canopyWingWidth / 2, x + A.canopyWingWidth / 2],
        ys = [0, A.canopyWingHeight];
      for (const y of ys)
        Q(
          o,
          y === 0 ? 'concrete' : 'metal',
          [at(0, xs[0], y), at(0, xs[1], y), at(1, xs[1], y), at(1, xs[0], y)],
          [0, y === 0 ? -1 : 1, 0],
        );
      for (const xx of xs)
        Q(
          o,
          'metal',
          [
            at(0, xx, 0),
            at(1, xx, 0),
            at(1, xx, A.canopyWingHeight),
            at(0, xx, A.canopyWingHeight),
          ],
          [(xx === xs[0] ? -1 : 1) * base.N[0], 0, (xx === xs[0] ? -1 : 1) * base.N[1]],
        );
      Q(
        o,
        'concrete',
        [
          at(0, xs[0], 0),
          at(0, xs[1], 0),
          at(0, xs[1], A.canopyWingHeight),
          at(0, xs[0], A.canopyWingHeight),
        ],
        outside,
      );
    }
  if (lod >= 2)
    for (let j = 0; j < outer.length; j++) {
      const rad = j === 0 || j === outer.length - 1 ? null : j;
      if (rad === null) continue;
      const a = outer[j],
        I = inner[j],
        width = 0.09;
      for (const sign of [-1, 1]) {
        const x = a[0] + (sign * width) / 2,
          y = a[1];
        Q(
          o,
          'metal',
          [at(0, x, y), at(1, x, y), at(1, x, y + 0.05), at(0, x, y + 0.05)],
          [base.N[0] * Math.sign(x), 1, base.N[1] * Math.sign(x)],
        );
      }
      if (lod === 3 && j % 4 === 0)
        Q(
          o,
          'tile',
          [
            at(0.015, I[0], I[1]),
            at(0.02, I[0], I[1]),
            at(0.02, I[0] + 0.06, I[1] + 0.06),
            at(0.015, I[0] + 0.06, I[1] + 0.06),
          ],
          [0, -1, 0],
        );
    }
  portalEvidence.push({
    route: r.id,
    end,
    s,
    center: [base.x, base.y, base.z],
    tangent: base.T,
    normal: base.N,
    outside,
    innerRadius: A.canopyFrontInnerRadius,
    outerRadius: A.canopyFrontOuterRadius,
    spring: A.canopyFrontSpring,
    canopyLength: A.canopyLength,
  });
}
function retaining(o, lod) {
  const line = frame.intrinsicLinearFeatures[0].centerline,
    y = routes[0].northFloor - 0.4,
    Y = y + A.retainingHeight;
  for (let i = 0; i < line.length; i++) {
    retainingEvidence.push([line[i][0], y, line[i][1]]);
  }
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i],
      b = line[i + 1],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = [(b[1] - a[1]) / L, 0, -(b[0] - a[0]) / L],
      p = (q, Y, d) => [q[0] + n[0] * d, Y, q[1] + n[2] * d];
    Q(o, 'concrete', [p(a, y, 0), p(b, y, 0), p(b, Y, 0), p(a, Y, 0)], n);
    if (lod >= 1) {
      Q(
        o,
        'concrete',
        [
          p(a, y, -A.retainingThickness),
          p(a, Y, -A.retainingThickness),
          p(b, Y, -A.retainingThickness),
          p(b, y, -A.retainingThickness),
        ],
        n.map((v) => -v),
      );
      Q(
        o,
        'concrete',
        [p(a, Y, 0), p(b, Y, 0), p(b, Y, -A.retainingThickness), p(a, Y, -A.retainingThickness)],
        [0, 1, 0],
      );
    }
  }
}
export function buildDublinTunnel(target, _frame, lod = 3) {
  for (const a of [partEvidence, axisEvidence, portalEvidence, sectionEvidence, retainingEvidence])
    a.length = 0;
  let count = 0;
  const o = {
      addTriangle(...a) {
        count++;
        target.addTriangle(...a);
      },
    },
    part = (name, fn) => {
      const n = count;
      fn();
      partEvidence.push({ name, triangles: count - n });
    };
  for (const r of routes) {
    part(`${r.id}-whole-physical-tube-cutcover-and-bored-shell`, () => tube(o, r, lod));
    for (const end of ['north', 'south'])
      part(`${r.id}-${end}-open-portal-canopy`, () => portal(o, r, end, lod));
  }
  part('native-northern-nineteen-control-retaining-wall', () => retaining(o, lod));
}
export const dublinTunnelSkyline = (o) => buildDublinTunnel(o, null, 0),
  dublinTunnelDistrict = (o) => buildDublinTunnel(o, null, 1),
  dublinTunnelStreet = (o) => buildDublinTunnel(o, null, 2),
  dublinTunnelCloseup = (o) => buildDublinTunnel(o, null, 3);
function camera(r, end, side = 22, dist = 60, height = 20) {
  const s = end === 'north' ? 0 : r.length,
    st = station(r, s),
    out = end === 'north' ? -1 : 1;
  return {
    position: [
      st.x + st.N[0] * side + st.T[0] * out * dist,
      st.y + height,
      st.z + st.N[1] * side + st.T[1] * out * dist,
    ],
    lookAt: [st.x, st.y + 3.5, st.z],
  };
}
const northCamera = camera(routes[0], 'north', -8, 38, 11),
  minY =
    Math.min(...routes.flatMap((r) => r.stations.map((s) => grade(r, s)))) -
    A.boredOuterRadius +
    A.tubeCenterAboveDeck;
export const dublinTunnelModel = {
  id: 'dublin_port_tunnel',
  key: 'dublin_port_tunnel',
  cell: 'gc/gc7',
  title: 'Dublin Tunnel',
  wikidataId: 'Q924978',
  category: 'transport-tunnel',
  recipe: 'dublin-tunnel-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildDublinTunnel,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole native twin Dublin Tunnel:69/73-control complete physical tube axes, circular bored and rectangular cut-cover shell sections, all four true open portal mouths with curved silver canopies/liner reveals/intrinsic approach decks and native19-control northern retaining wall. Native road axes are location controls only; physical walls/grade/transition boundaries/other-end canopy detail are explicit estimates. Exact published Sarah7772006PD portal/2008PD liner photos and primary technical dimensions; no roadway/property extrusion or single-mouth truncation.',
  camera: northCamera.position,
  lookAt: northCamera.lookAt,
  portableGroundY: minY - 0.45,
  mediumFiContext: { cameraYaw: -1, scale: 18, far: 14000, groundY: minY - 0.3 },
  embeddedCanonicalGraphs: ['concrete_plain', 'metal_standing_seam', 'tile_ceramic'],
  qaCameras: [
    {
      name: 'whole-twin-route-and-all-four-portal-ends',
      position: [5800, 4200, 1300],
      lookAt: [0, 0, 0],
    },
    { name: 'north-southbound-open-silver-canopy', ...camera(routes[0], 'north', -8, 38, 11) },
    { name: 'north-northbound-open-silver-canopy', ...camera(routes[1], 'north', 14, 38, 11) },
    { name: 'south-southbound-whole-open-portal', ...camera(routes[0], 'south', -12, 40, 11) },
    { name: 'south-northbound-whole-open-portal', ...camera(routes[1], 'south', 12, 40, 11) },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `north-open-portal-${reviewLod}`,
    ...northCamera,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/dublin-tunnel-runtime-overlay.mjs',
    level: 'skyline',
    export: 'dublinTunnelSkyline',
    errorMeters: 7,
    surfaces,
    authoredLevels: {
      district: { export: 'dublinTunnelDistrict', errorMeters: 2, surfaces },
      street: { export: 'dublinTunnelStreet', errorMeters: 0.7, surfaces },
      closeup: { export: 'dublinTunnelCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.authoringDirection,
    p.sectionBasis,
    'Both complete native routes and all four portal ends retained. Primary technical dimensions define original tube/cut-cover sections; native road centrelines are not measured tube/canopy wall polygons. Grade, cut-cover boundaries, lining thickness and unseen three portal canopies/current equipment are bounded original estimates; no surveyed invert/crown cover or exact current upgrades claimed.',
    'Only exact published Sarah7772006portal/2008liner own public-domain originals supply imagery. Technical operator/TII text used for facts only; no protected diagram/image pixels, wider motorway/toll plaza/neighborhood/vehicles/signage/detached control building or detailed navigable interior. Skyline uses angular closed triangular subsurface tube mass and simplified open canopies; district has coarse sections and local mouth lining, detailed levels have complete inner shell and asphalt deck.',
    'Original8192m129field/64mgrid/zoom12raw tiles/frame/floor/fixed grade and main cross-sections immutable before geometry. Whole buried tubes are exposed in isolated model fixtures; original source field is preserved and ordinarily conceals them. No field fitting/flattening/reframe/reacquisition/replacement/raising. Threshold/crown/foundation contact unverified; geographic preview/replacement false.',
  ],
};
