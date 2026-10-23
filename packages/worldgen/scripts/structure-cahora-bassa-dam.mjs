/** Whole native Cahora Bassa concrete arch; lower-wall sections remain explicit estimates. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { cross, normalFor, normalize } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/kt/ktp/cahora_bassa_dam/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  A = p.parameters.architecturalSections,
  Y = p.parameters.crestY,
  C = {
    concrete: rgb('c0bdb0'),
    metal: rgb('687471'),
    road: rgb('7f8279'),
    gate: rgb('4c5e5a'),
    joint: rgb('8f9389'),
  },
  surfaces = {
    concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.83, metallic: 0.2 },
    road: { slot: 'roof', localRef: ref, roughness: 0.99, metallic: 0 },
    gate: { slot: 'door', graph: 'metal_painted', roughness: 0.88, metallic: 0.18 },
    joint: { slot: 'trim', localRef: ref, roughness: 1, metallic: 0 },
  },
  mix = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
function pathInfo(points) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(
      lengths.at(-1) + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]),
    );
  return { points, lengths, total: lengths.at(-1), knots: lengths.map((v) => v / lengths.at(-1)) };
}
const up = pathInfo(p.outline.slice(0, 14)),
  down = pathInfo(p.outline.slice(14, 30).reverse());
function tangent(line, i) {
  const a = line.points[Math.max(0, i - 1)],
    b = line.points[Math.min(line.points.length - 1, i + 1)];
  return normalize([b[0] - a[0], 0, b[1] - a[1]]);
}
function at(line, t) {
  const s = Math.max(0, Math.min(1, t)) * line.total;
  let i = line.lengths.findIndex((v) => v >= s);
  i = Math.max(1, i);
  const a = line.points[i - 1],
    b = line.points[i],
    q = (s - line.lengths[i - 1]) / (line.lengths[i] - line.lengths[i - 1]),
    u = normalize(mix(tangent(line, i - 1), tangent(line, i), q));
  return { p: mix(a, b, q), u, n: [u[2], 0, -u[0]] };
}
const depth = (t) =>
  A.abutmentWallHeight +
  (A.maximumWallHeight - A.abutmentWallHeight) * Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.8);
function point(t, y, side, offset = 0) {
  const a = at(up, t),
    b = at(down, t),
    q = Math.max(0, Math.min(1, (Y - y) / depth(t))),
    top = side < 0 ? a.p : b.p,
    n = a.n,
    shift =
      (A.lowerArchDownstreamShift * Math.pow(q, 1.5) +
        side * A.additionalBaseThickness * 0.5 * Math.pow(q, 1.15)) *
      Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.8);
  return [top[0] + n[0] * (shift + offset), y, top[1] + n[2] * (shift + offset)];
}
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, i) => v - q[0][i]),
    q[2].map((v, i) => v - q[0][i]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((s, v, i) => s + v * n[i], 0) < 0) q = [q[0], q[2], q[1]];
  o.addTriangle(
    k,
    ref,
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, k, q, n, col = C[k]) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function B(o, k, center, size, frame, col = C[k]) {
  const v = (x, y, z) => [
      center[0] + frame.u[0] * x + frame.n[0] * z,
      center[1] + y,
      center[2] + frame.u[2] * x + frame.n[2] * z,
    ],
    n = (x, y, z) => [frame.u[0] * x + frame.n[0] * z, y, frame.u[2] * x + frame.n[2] * z],
    [x, y, z] = size.map((v) => v / 2);
  for (const [q, N] of [
    [
      [
        [-x, -y, z],
        [x, -y, z],
        [x, y, z],
        [-x, y, z],
      ],
      n(0, 0, 1),
    ],
    [
      [
        [x, -y, -z],
        [-x, -y, -z],
        [-x, y, -z],
        [x, y, -z],
      ],
      n(0, 0, -1),
    ],
    [
      [
        [-x, -y, -z],
        [-x, -y, z],
        [-x, y, z],
        [-x, y, -z],
      ],
      n(-1, 0, 0),
    ],
    [
      [
        [x, -y, z],
        [x, -y, -z],
        [x, y, -z],
        [x, y, z],
      ],
      n(1, 0, 0),
    ],
    [
      [
        [-x, y, z],
        [x, y, z],
        [x, y, -z],
        [-x, y, -z],
      ],
      n(0, 1, 0),
    ],
    [
      [
        [-x, -y, -z],
        [x, -y, -z],
        [x, -y, z],
        [-x, -y, z],
      ],
      n(0, -1, 0),
    ],
  ])
    Q(
      o,
      k,
      q.map((q) => v(...q)),
      N,
      col,
    );
}
const gates = Array.from(
    { length: A.estimatedOutletCount },
    (_, i) =>
      A.outletGroupStart +
      ((A.outletGroupEnd - A.outletGroupStart) * i) / (A.estimatedOutletCount - 1),
  ),
  half = A.outletWidth / 2 / up.total,
  sill = Y - A.outletSillBelowCrest,
  crown = sill + A.outletHeight;
const inGate = (t) => gates.some((g) => Math.abs(t - g) < half - 1e-8);
function grid(d) {
  const ts = new Set([...up.knots, ...down.knots, 0.5]);
  for (let i = 1; i < [0, 32, 80, 160][d]; i++) ts.add(i / [0, 32, 80, 160][d]);
  if (d)
    for (const g of gates) {
      ts.add(g - half);
      ts.add(g + half);
    }
  const ys = new Set([Y, Y - A.maximumWallHeight]);
  if (d) {
    ys.add(crown);
    ys.add(sill);
  }
  for (let j = 1; j <= [2, 6, 12, 24][d]; j++)
    ys.add(Y - (A.maximumWallHeight * j) / ([2, 6, 12, 24][d] + 1));
  return { ts: [...ts].sort((a, b) => a - b), ys: [...ys].sort((a, b) => b - a) };
}
function body(o, d) {
  const { ts, ys } = grid(d);
  for (let i = 1; i < ts.length; i++) {
    const a = ts[i - 1],
      b = ts[i],
      f = at(up, (a + b) / 2),
      gate = d && inGate((a + b) / 2),
      clamp = (t, y) => Math.max(y, Y - depth(t));
    for (let j = 1; j < ys.length; j++) {
      if (gate && ys[j - 1] <= crown + 1e-7 && ys[j] >= sill - 1e-7) continue;
      for (const side of [-1, 1])
        Q(
          o,
          'concrete',
          [
            point(a, clamp(a, ys[j - 1]), side),
            point(b, clamp(b, ys[j - 1]), side),
            point(b, clamp(b, ys[j]), side),
            point(a, clamp(a, ys[j]), side),
          ],
          f.n.map((v) => v * side),
        );
    }
    Q(
      o,
      'concrete',
      [point(a, Y, -1), point(b, Y, -1), point(b, Y, 1), point(a, Y, 1)],
      [0, 1, 0],
      rgb('c8c6b9'),
    );
    Q(
      o,
      'concrete',
      [
        point(a, Y - depth(a), -1),
        point(b, Y - depth(b), -1),
        point(b, Y - depth(b), 1),
        point(a, Y - depth(a), 1),
      ],
      [0, -1, 0],
    );
    if (gate)
      for (const [y, s] of [
        [crown, -1],
        [sill, 1],
      ])
        Q(
          o,
          'concrete',
          [point(a, y, -1), point(b, y, -1), point(b, y, 1), point(a, y, 1)],
          [0, s, 0],
        );
  }
  for (const t of [0, 1])
    for (let j = 1; j < ys.length; j++)
      Q(
        o,
        'concrete',
        [
          point(t, Math.max(ys[j - 1], Y - depth(t)), -1),
          point(t, Math.max(ys[j - 1], Y - depth(t)), 1),
          point(t, Math.max(ys[j], Y - depth(t)), 1),
          point(t, Math.max(ys[j], Y - depth(t)), -1),
        ],
        at(up, t).u.map((v) => v * (t === 0 ? -1 : 1)),
      );
  if (d)
    for (const g of gates) {
      const l = g - half,
        r = g + half,
        n = at(up, g).n,
        back = (t, y) => mix(point(t, y, -1), point(t, y, 1), 0.1);
      for (const [t, s] of [
        [l, 1],
        [r, -1],
      ])
        Q(
          o,
          'concrete',
          [point(t, crown, -1), point(t, crown, 1), point(t, sill, 1), point(t, sill, -1)],
          at(up, t).u.map((v) => v * s),
        );
      Q(o, 'gate', [back(l, sill), back(r, sill), back(r, crown), back(l, crown)], n);
      Q(
        o,
        'gate',
        [back(l, crown), back(r, crown), back(r, sill), back(l, sill)],
        n.map((v) => -v),
      );
      if (d >= 2)
        for (const y of [sill + 1, sill + 3, sill + 5]) {
          const c = mix(back(l, y), back(r, y), 0.5);
          B(o, 'metal', c, [A.outletWidth, 0.2, 0.25], at(up, g));
        }
    }
}
function crest(o, d) {
  const { ts } = grid(d),
    P = (t, y, offset = 0) => {
      const a = point(t, Y, -1),
        b = point(t, Y, 1),
        v = mix(a, b, 0.5),
        n = at(up, t).n;
      return [v[0] + n[0] * offset, y, v[2] + n[2] * offset];
    };
  for (let i = 1; i < ts.length; i++) {
    const a = ts[i - 1],
      b = ts[i];
    Q(
      o,
      'road',
      [
        P(a, Y + 0.035, -A.crestRoadWidth / 2),
        P(b, Y + 0.035, -A.crestRoadWidth / 2),
        P(b, Y + 0.035, A.crestRoadWidth / 2),
        P(a, Y + 0.035, A.crestRoadWidth / 2),
      ],
      [0, 1, 0],
    );
    for (const side of [-1, 1]) {
      const n = at(up, (a + b) / 2).n.map((v) => v * side),
        V = (t, y, q = 0) => point(t, y, side, q);
      Q(o, 'concrete', [V(a, Y), V(b, Y), V(b, Y + A.parapetHeight), V(a, Y + A.parapetHeight)], n);
      if (d) {
        Q(
          o,
          'concrete',
          [
            V(a, Y, -side * 0.36),
            V(a, Y + A.parapetHeight, -side * 0.36),
            V(b, Y + A.parapetHeight, -side * 0.36),
            V(b, Y, -side * 0.36),
          ],
          n.map((v) => -v),
        );
        Q(
          o,
          'concrete',
          [
            V(a, Y + A.parapetHeight),
            V(b, Y + A.parapetHeight),
            V(b, Y + A.parapetHeight, -side * 0.36),
            V(a, Y + A.parapetHeight, -side * 0.36),
          ],
          [0, 1, 0],
        );
      }
    }
  }
  for (const t of A.gantryStations) {
    const f = at(up, t),
      c = P(t, Y + 0.2),
      local = (x, y, z) => [c[0] + f.u[0] * x + f.n[0] * z, Y + y, c[2] + f.u[2] * x + f.n[2] * z];
    for (const x of [-A.gantryWidth / 2, A.gantryWidth / 2])
      B(
        o,
        'concrete',
        local(x, A.gantryHeight / 2, 0),
        [1.5, A.gantryHeight, 4.4],
        f,
        rgb('cac9bb'),
      );
    B(
      o,
      'concrete',
      local(0, A.gantryHeight, 0),
      [A.gantryWidth + 1.5, 1.4, 4.4],
      f,
      rgb('d0cdbf'),
    );
    if (d) {
      B(o, 'metal', local(0, A.gantryHeight - 2.1, 0), [A.gantryWidth - 1.5, 0.45, 0.8], f);
      B(o, 'concrete', local(0, A.gantryHeight + 1.4, -0.6), [3.2, 1.3, 2.6], f);
    }
    if (d >= 2) {
      B(o, 'gate', local(0, A.gantryHeight + 1.4, 0.72), [2.2, 0.6, 0.05], f);
      for (const x of [-3.3, 3.3]) B(o, 'metal', local(x, 2.2, 2.35), [0.12, 4.4, 0.15], f);
    }
  }
  if (d >= 2)
    for (let i = 1; i < [0, 0, 60, 140][d]; i++)
      for (const side of [-1, 1]) {
        const t = i / [0, 0, 60, 140][d],
          q = point(t, Y, side, -side * 0.2),
          f = at(up, t);
        B(o, 'metal', [q[0], Y + 1.3, q[2]], [0.05, 0.5, 0.05], f);
      }
}
function joints(o, d) {
  if (d < 2) return;
  const { ts, ys } = grid(d);
  let last = -100;
  for (let i = 1; i < ts.length - 1; i++) {
    const t = ts[i];
    if (t * up.total - last < 12) continue;
    last = t * up.total;
    const f = at(up, t),
      offset = 0.11,
      w = 0.055;
    for (let j = 1; j < ys.length; j++) {
      const a = Math.max(ys[j - 1], Y - depth(t)),
        b = Math.max(ys[j], Y - depth(t));
      if (a - b < 0.1 || (inGate(t) && b < crown && a > sill)) continue;
      for (const side of [-1, 1]) {
        const N = f.n.map((v) => v * side),
          P = (y, s) => point(t, y, side, side * offset).map((v, k) => v + s * w * f.u[k]);
        Q(o, 'joint', [P(a, -1), P(a, 1), P(b, 1), P(b, -1)], N);
      }
    }
  }
  if (d === 3)
    for (let i = 1; i < ts.length; i++)
      for (let j = 2; j < ys.length - 1; j += 3) {
        const a = ts[i - 1],
          b = ts[i],
          y = ys[j];
        if (
          y < Y - depth(a) + 1 ||
          y < Y - depth(b) + 1 ||
          (inGate((a + b) / 2) && y < crown && y > sill)
        )
          continue;
        Q(
          o,
          'joint',
          [
            point(a, y - 0.025, 1, 0.13),
            point(b, y - 0.025, 1, 0.13),
            point(b, y + 0.025, 1, 0.13),
            point(a, y + 0.025, 1, 0.13),
          ],
          at(up, (a + b) / 2).n,
          rgb('a2a398'),
        );
      }
}
function build(o, _f, d = 3) {
  body(o, d);
  crest(o, d);
  joints(o, d);
}
export const cahoraBassaSkyline = (o, f) => build(o, f, 0);
export const cahoraBassaDistrict = (o, f) => build(o, f, 1);
export const cahoraBassaStreet = (o, f) => build(o, f, 2);
export const cahoraBassaCloseup = (o, f) => build(o, f, 3);
export const cahoraBassaDamModel = {
  id: 'cahora_bassa_dam',
  key: 'cahora_bassa_dam',
  cell: 'kt/ktp',
  recipe: 'structure-cahora-bassa-dam.mjs',
  title: 'Cahora Bassa Dam',
  category: 'dam',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [390, 140, 380],
  lookAt: [0, -50, 0],
  portableGroundY: -165,
  mediumFiContext: { scale: 3, groundY: -165 },
  qaCameras: [
    {
      name: 'whole-native-double-curved-arch-and-both-abutments',
      position: [440, 110, 200],
      lookAt: [0, -50, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'crest-road-open-service-gantries-and-parapets',
      position: [-170, 75, 80],
      lookAt: [-27, 9, 14],
    },
    {
      name: 'downstream-double-curvature-and-recessed-outlets',
      position: [215, -47, 70],
      lookAt: [-13, -90, 8],
    },
    {
      name: 'upstream-whole-arch-and-native-crest-return',
      position: [-370, 115, -130],
      lookAt: [0, -45, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.sectionBasis}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-cahora-bassa-dam.mjs',
    level: 'skyline',
    export: 'cahoraBassaSkyline',
    errorMeters: 4,
    surfaces,
    authoredLevels: {
      district: { export: 'cahoraBassaDistrict', errorMeters: 1.5, surfaces },
      street: { export: 'cahoraBassaStreet', errorMeters: 0.5, surfaces },
      closeup: { export: 'cahoraBassaCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Full original native30control crestoutline retained at everyLOD, both concave/convex wall faces with verticalcurvature/basewidening/taperedend exposure, native-shaped crestroad/continuous lowconcreteparapets and twoopen servicegantries. Skyline omits estimated lowoutletmechanics; higherlevels include eight genuine deep concrete tunnels with gateleaves recessed near upstream face. Native mapped area is coarse and not stretched to story303m crestlength.',
    'Exact existing cleared Qualla500x333 Nic2005 own-photo/explicit My photo. Placed in public domain./PD-author original/nativeSHA1matched, individually inspected. Upstream water obscureslowerwall. Hiddenwall taper, outletcount/shape/elevation and towercensus/geometry/rail/post/contractionjoint detail are bounded original mediumfi estimates, not measured present machinery. Conflictedhero and attribution/sharealike alternatives excluded withoutpixels; no image textures/generatedbitmaps or protectedplans.',
    'Independent1000mfield/two raw tiles/16641samples frozen before geometry. Native SWdatum322.0773m, crest+8m near supplied330m. Implausible negative lake/gorge elevation down to-3146.5546m remains immutable and is never interpreted as bathymetry/foundation. Portable/context reviewground is separate below model; actual mapterrain dam/water/toe contact remains unverified, preview/replaceFootprintfalse.',
    'Separate underground generatingstationQ11962991/nativeway849296590, reservoirQ755015, gorge/river/landscape/settlement/transmissionlines and private plant interiors excluded. No arbitrary whole-site groundplate/water mesh.',
  ],
};
