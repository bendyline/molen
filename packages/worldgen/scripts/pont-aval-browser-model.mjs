/** Four budgeted Pont Aval levels retain the signed skew, curved road and unequal spans. */
import { cross, loft, normalize } from './authored-structure-mesh.mjs';
import { buildPontAval, pontAvalDepth, pontAvalPlan, pontAvalRoadY } from './pont-aval-model.mjs';

const supports = [-156.25, -88.78, 3.22, 84.7, 156.25];
const centers = [-12.5, -4.5, 4.5, 12.5];
const concrete = [0.61, 0.595, 0.54],
  pale = [0.73, 0.71, 0.65],
  metal = [0.42, 0.47, 0.455];
const means = {
  concrete: [0.710816, 0.710816, 0.681928],
  paving: [0.701109, 0.701109, 0.701109],
  iron: [0.908889, 0.908889, 0.908889],
  steel: [0.81896, 0.822889, 0.822889],
};
const point = (u, y, z) => {
  const [x, zz] = pontAvalPlan(u, z);
  return [x, y, zz];
};
function tinted(out) {
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, uv, c) =>
        out[k](
          s,
          r,
          p,
          n,
          uv,
          c.map((v, i) => v * (means[s]?.[i] ?? 1)),
        ),
    ]),
  );
}
// Open beam end caps are subpixel at skyline distance; the complete lamp remains in nearer levels.
function farBeam(out, a, b, w, d) {
  const axis = normalize(b.map((v, i) => v - a[i])),
    across = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
    other = cross(axis, across);
  const ring = (p) =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([u, v]) => p.map((x, i) => x + (u * across[i] * w) / 2 + (v * other[i] * d) / 2));
  loft(out, 'steel', [ring(a), ring(b)], metal, { cap: false });
}
export function buildPontAvalSkyline(output) {
  const out = tinted(output),
    samples = supports.flatMap((u, i) =>
      i === supports.length - 1 ? [u] : [u, (u + supports[i + 1]) / 2],
    );
  for (const side of [-1, 1]) {
    const a = side < 0 ? -17.3 : 0.04,
      b = side < 0 ? -0.04 : 17.3;
    loft(
      out,
      'road',
      samples.map((u) => [
        point(u, pontAvalRoadY(u, a), a),
        point(u, pontAvalRoadY(u, b), b),
        point(u, pontAvalRoadY(u, b) - 0.36, b),
        point(u, pontAvalRoadY(u, a) - 0.36, a),
      ]),
      [0.24, 0.25, 0.24],
    );
    // The continuous outer fascia provides the pale concrete outline of each carriageway.
    const z = side * 17.05;
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1],
        b = samples[i];
      out.addQuad(
        'concrete',
        'metric:uv',
        [
          point(a, pontAvalRoadY(a, z) + 0.83, z),
          point(b, pontAvalRoadY(b, z) + 0.83, z),
          point(b, pontAvalRoadY(b, z) - 0.64, z),
          point(a, pontAvalRoadY(a, z) - 0.64, z),
        ],
        [0, 0, side],
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
        pale,
      );
    }
  }
  for (const z of centers) {
    loft(
      out,
      'concrete',
      samples.map((u) => {
        const y = pontAvalRoadY(u, z) - 0.33,
          d = pontAvalDepth(u) - 0.33;
        return [
          [0, -2.78],
          [0, 2.78],
          [-d, 1.75],
          [-d, -1.75],
        ].map(([dy, dz]) => point(u, y + dy, z + dz));
      }),
      concrete,
    );
    for (const u of supports) {
      const h = pontAvalRoadY(u, z) - pontAvalDepth(u) - 0.43;
      const ring = (y, w, d) =>
        [
          [-w / 2, -d / 2],
          [w / 2, -d / 2],
          [w / 2, d / 2],
          [-w / 2, d / 2],
        ]
          .reverse()
          .map(([x, zz]) => point(u + x, y, z + zz));
      loft(out, 'concrete', [ring(0, 4.45, 5.4), ring(h, 2.9, 3.74)], pale);
    }
  }
  for (const u of [supports[0], supports.at(-1)])
    for (const side of [-1, 1]) {
      const a = side < 0 ? -17.3 : 0.07,
        b = side < 0 ? -0.07 : 17.3;
      loft(
        out,
        'concrete',
        [u - 0.55, u + 0.55].map((v) => [
          point(v, pontAvalRoadY(v, a) - 0.35, a),
          point(v, pontAvalRoadY(v, b) - 0.35, b),
          point(v, 4.9, b),
          point(v, 4.9, a),
        ]),
        pale,
      );
    }
  for (let u = -141; u <= 141; u += 35.25) {
    const y = pontAvalRoadY(u) + 0.45;
    farBeam(out, point(u, y, 0), point(u, y + 12.5, 0), 0.15, 0.15);
    for (const side of [-1, 1])
      farBeam(out, point(u, y + 12, 0), point(u, y + 13.05, side * 2.36), 0.09, 0.09);
  }
}
export function buildPontAvalDistrict(out) {
  buildPontAval(out, {
    stripPitch: 100,
    markings: false,
    paving: false,
    precast: false,
    railings: false,
    services: false,
    expansionFingers: false,
    ribs: false,
    simplePiers: true,
    simpleBoxes: true,
    simpleLamps: true,
    drains: false,
  });
}
export function buildPontAvalStreet(out) {
  buildPontAval(out, {
    stripPitch: 24,
    precast: false,
    railPitch: 3,
    railRunPitch: 12,
    services: false,
    expansionFingers: false,
    ribs: false,
    simpleLamps: true,
    drains: false,
  });
}
export function buildPontAvalCloseup(out) {
  buildPontAval(out, {
    stripPitch: 6,
    precastPitch: 9.6,
    railPitch: 1.2,
    railRunPitch: 6,
    pipePitch: 8,
    pipeSegments: 8,
    hangers: false,
    expansionFingers: false,
    ribPitch: 0.66,
    lampSegments: 8,
    lampSteps: 6,
    fixtureSegments: 12,
    fixtureRings: 6,
    drainPitch: 25.6,
    drainBars: 3,
  });
}
