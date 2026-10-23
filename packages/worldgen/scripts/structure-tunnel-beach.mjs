/** The human-carved stair tunnel, represented by a bounded cut rock enclosure. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/pz/pzc/tunnel_beach/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  A = p.parameters,
  L = A.horizontalLength,
  R = A.corridorWidthEstimate / 2,
  S = A.corridorVaultHeightEstimate - R,
  ref = 'palette:#ffffff',
  C = { rock: rgb('b9a783'), cut: rgb('a49376'), step: rgb('a4a397') },
  surfaces = {
    rock: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.99, metallic: 0 },
    cut: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.98, metallic: 0 },
    step: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  };
const floor = (t) => A.upperFloorY + (A.lowerFloorY - A.upperFloorY) * t,
  tint = (c, s) => c.map((v) => Math.min(1, v * s)),
  wave = (i, j) => Math.sin(i * 2.137 + j * 1.731) * 0.55 + Math.sin(i * 0.893 - j * 2.103) * 0.45;
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((v, x, k) => v + x * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function profile(N) {
  const P = [
    [-R, -0.16],
    [-R, S],
  ];
  for (let i = 1; i < N; i++) {
    const a = Math.PI - (i * Math.PI) / N;
    P.push([R * Math.cos(a), S + R * Math.sin(a)]);
  }
  P.push([R, S], [R, -0.16]);
  return P;
}
function vertex(q, t, i, j, outer, d) {
  const [x, y] = q,
    rough = d === 0 ? 0.0 : outer ? 0.11 : 0.025,
    w = wave(i, j),
    z = t * L;
  if (!outer) {
    const fade = Math.sin(Math.PI * t);
    return [
      x + (Math.abs(x) > 0.2 ? Math.sign(x) * rough * w * fade : 0),
      floor(t) + y + (y > S ? rough * w * fade : 0),
      z,
    ];
  }
  const W = A.outerRockHalfWidth,
    xx = (x / R) * (W + 0.13 * wave(j, i)),
    yy =
      y < 0
        ? -0.62 - 0.1 * wave(j, i)
        : y === S
          ? S + 0.75 + 0.1 * wave(j, i)
          : S + 0.75 + (y - S) * 1.35;
  return [xx + rough * w, floor(t) + yy + rough * wave(j + 3, i + 1), z];
}
function enclosure(o, d) {
  const N = [6, 10, 18, 28][d],
    M = [6, 12, 36, 72][d],
    P = profile(N),
    K = P.length;
  for (let j = 0; j < M; j++)
    for (let i = 0; i < K - 1; i++) {
      const t = j / M,
        u = (j + 1) / M,
        a = P[i],
        b = P[i + 1],
        mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        inside = [-mid[0], 1 - mid[1], 0],
        outside = inside.map((x) => -x);
      Q(
        o,
        'cut',
        [
          vertex(a, t, i, j, false, d),
          vertex(b, t, i + 1, j, false, d),
          vertex(b, u, i + 1, j + 1, false, d),
          vertex(a, u, i, j + 1, false, d),
        ],
        inside,
        tint(C.cut, 0.93 + 0.055 * wave(i, j)),
      );
      Q(
        o,
        'rock',
        [
          vertex(a, t, i, j, true, d),
          vertex(a, u, i, j + 1, true, d),
          vertex(b, u, i + 1, j + 1, true, d),
          vertex(b, t, i + 1, j, true, d),
        ],
        outside,
        tint(C.rock, 1 + 0.065 * wave(i, j)),
      );
    }
  // Truncated lower rock section closes beneath the stairs, not across the passage.
  for (let j = 0; j < M; j++)
    Q(
      o,
      'rock',
      [
        vertex(P[0], j / M, 0, j, true, d),
        vertex(P[K - 1], j / M, K - 1, j, true, d),
        vertex(P[K - 1], (j + 1) / M, K - 1, j + 1, true, d),
        vertex(P[0], (j + 1) / M, 0, j + 1, true, d),
      ],
      [0, -1, 0],
    );
  for (const t of [0, 1])
    for (let i = 0; i < K; i++) {
      const j = (i + 1) % K,
        n = [0, 0, t === 0 ? -1 : 1],
        a = vertex(P[i], t, i, t * M, false, d),
        b = vertex(P[j], t, j, t * M, false, d),
        c = vertex(P[j], t, j, t * M, true, d),
        e = vertex(P[i], t, i, t * M, true, d);
      Q(o, i === K - 1 ? 'step' : 'rock', [a, b, c, e], n, tint(C.rock, 0.98 + 0.06 * wave(i, t)));
    }
}
function stairs(o, d) {
  const N = 72,
    W = d < 2 ? 1 : d === 2 ? 4 : 8,
    drop = (A.upperFloorY - A.lowerFloorY) / N;
  const worn = (i, k) =>
    d < 2
      ? 0
      : 0.014 *
        Math.pow(Math.max(0, 1 - Math.abs(-1 + (2 * k) / W)), 2) *
        (0.8 + 0.2 * Math.sin(i * 2.04));
  for (let i = 0; i < N; i++) {
    const z = (i * L) / N,
      zz = ((i + 1) * L) / N,
      y = A.upperFloorY - i * drop,
      next = y - drop;
    for (let k = 0; k < W; k++) {
      const x = -R + (2 * R * k) / W,
        xx = -R + (2 * R * (k + 1)) / W,
        wa = worn(i, k),
        wb = worn(i, k + 1),
        a = [x, y - wa, z],
        b = [xx, y - wb, z],
        c = [xx, y - wb, zz],
        e = [x, y - wa, zz];
      Q(o, 'step', [a, b, c, e], [0, 1, 0], tint(C.step, 0.97 + 0.025 * wave(i, k)));
      Q(o, 'step', [[x, next, zz], [xx, next, zz], c, e], [0, 0, 1], tint(C.step, 0.86));
      if (d > 1) {
        const qz = zz - 0.018;
        Q(
          o,
          'step',
          [[x, y - wa + 0.004, qz], [xx, y - wb + 0.004, qz], c, e],
          [0, 1, 0],
          tint(C.step, 1.04),
        );
      }
    }
    for (const x of [-R, R])
      Q(
        o,
        'step',
        [
          [x, y, z],
          [x, y, zz],
          [x, next - 0.26, zz],
          [x, y - 0.26, z],
        ],
        [Math.sign(x), 0, 0],
      );
  }
  // Small threshold landings at both mapped portals; no full coastal path pad.
  for (const [z0, z1, y] of [
    [-1.1, 0, A.upperFloorY],
    [L, L + 1.1, A.lowerFloorY],
  ]) {
    Q(
      o,
      'step',
      [
        [-R, y, z0],
        [R, y, z0],
        [R, y, z1],
        [-R, y, z1],
      ],
      [0, 1, 0],
    );
    Q(
      o,
      'step',
      [
        [-R, y - 0.25, z0],
        [-R, y - 0.25, z1],
        [R, y - 0.25, z1],
        [R, y - 0.25, z0],
      ],
      [0, -1, 0],
    );
    for (const x of [-R, R])
      Q(
        o,
        'step',
        [
          [x, y, z0],
          [x, y, z1],
          [x, y - 0.25, z1],
          [x, y - 0.25, z0],
        ],
        [Math.sign(x), 0, 0],
      );
  }
}
function toolScars(o, d) {
  if (d < 2) return;
  const M = d === 2 ? 42 : 84;
  for (const side of [-1, 1])
    for (let j = 0; j < M; j++)
      for (let k = 0; k < (d === 2 ? 3 : 5); k++) {
        const t = (j + 0.45) / M,
          z = t * L,
          y = floor(t) + 0.23 + k * (d === 2 ? 0.39 : 0.25) + 0.04 * wave(j, k),
          x = side * (R - 0.016),
          span = 0.04 + 0.018 * (1 + wave(k, j));
        T(
          o,
          'cut',
          [
            [x, y, z - 0.07],
            [x - side * 0.004, y + 0.09, z + 0.025],
            [x, y + 0.06, z + span],
          ],
          [-side, 0, 0],
          tint(C.cut, 0.78 + 0.08 * wave(j, k)),
        );
      }
}
function build(o, _frame, d = 3) {
  enclosure(o, d);
  stairs(o, d);
  toolScars(o, d);
}
export const tunnelBeachSkyline = (o, f) => build(o, f, 0),
  tunnelBeachDistrict = (o, f) => build(o, f, 1),
  tunnelBeachStreet = (o, f) => build(o, f, 2),
  tunnelBeachCloseup = (o, f) => build(o, f, 3);
export const tunnelBeachModel = {
  id: 'tunnel_beach',
  key: 'tunnel_beach',
  cell: 'pz/pzc',
  recipe: 'structure-tunnel-beach.mjs',
  title: 'Tunnel Beach stair tunnel',
  category: 'transport',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [14, 6, 26],
  lookAt: [0, -4.4, L / 2],
  portableGroundY: A.lowerFloorY - 1,
  mediumFiContext: { scale: 0.65, groundY: A.lowerFloorY - 0.9 },
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.baseDecision}`,
  qaCameras: [
    {
      name: 'whole-mapped-stair-passage-both-portals-and-bounded-rock-section',
      position: [14, 6, 26],
      lookAt: [0, -4.4, L / 2],
      reviewLod: 'skyline',
    },
    {
      name: 'upper-rough-sandstone-portal-and-descending-concrete-stair-run',
      position: [1.8, 2.8, -4],
      lookAt: [0, -0.5, 1.8],
    },
    {
      name: 'lower-portal-threshold-rough-rock-and-full-passage',
      position: [2, -8, L + 4],
      lookAt: [0, -9.9, L - 0.5],
    },
    {
      name: 'inside-low-end-looking-up-72-steps-to-daylight',
      position: [0, A.lowerFloorY + 1.25, L + 0.65],
      lookAt: [0, A.upperFloorY + 1.05, 0],
    },
    {
      name: 'inside-upper-end-looking-down-rough-vault-and-stairs',
      position: [0, A.upperFloorY + 1.0, -0.65],
      lookAt: [0, A.lowerFloorY + 1.0, L],
    },
    {
      name: 'near-worn-concrete-nosings-chisel-facets-and-barrel-vault',
      position: [0, floor(0.55) + 1.0, L * 0.55],
      lookAt: [0, floor(0.2) + 1.0, L * 0.2],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-tunnel-beach.mjs',
    level: 'skyline',
    export: 'tunnelBeachSkyline',
    errorMeters: 0.7,
    surfaces,
    authoredLevels: {
      district: { export: 'tunnelBeachDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'tunnelBeachStreet', errorMeters: 0.08, surfaces },
      closeup: { export: 'tunnelBeachCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.baseDecision,
    'The human-carved full mapped stair passage and both portals are modeled. The independent natural sea arch/headland/sea stacks/whole coastline/beach/waves/long approach path/fences/vegetation are not this structure. Surrounding rock is a bounded truncated cut section for standalone inspection and compatible embedding, not a claimed freestanding stone tube or reconstruction of the whole cliff.',
    'Original cleared Qualla references individually inspected: Ingolfson native public-domain montage/overview and Pseudopanax2023 ownPD-self tunnel/rock context. Exact originals whose local categories omit the native release are copied unchanged and independently bound using existing creator-release verification; no article/media repair or questionable source. Context-only natural-arch images are not substituted for the human tunnel.',
    'Exact native horizontal centreline length15.2976869m/bearing controls the route. Interior72-riser census comes from the published Qualla story; operator confirms a short stepped dark rock tunnel but not the count. Estimated0.15m riser/1.25m clear width/2.15m vault/portal elevations and rock-cover thickness are not surveyed. Nearby mapped36/7-step paths are separate and excluded.',
    'Rock enclosure has real continuous interior void/rough barrel vault/open portals, concrete stair run and short thresholds. Medium-fi chisel facets/damp stone tones/worn concrete nosings are original deterministic geometry/vertex color with three actual shared canonical slots/two shared graphs; no photographic textures, borrowed mesh, artificial lights/handrail, physics or water effects.',
    'Four detail levels retain the same open full passage and both portals. Every detail level retains all72 story-sourced risers. Near levels add fine faceting/worn nosings/tool scars without filling the void. Independent source terrain/PNG/two tiles remain unchanged; its unresolved underground grade is separate evidence, isolated/flat context views do not certify host contact and geographic replacement stays disabled.',
  ],
};
