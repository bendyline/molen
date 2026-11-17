/** The prestressed-concrete road pair at the northern Jordan River Crossing. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  chamferedRectangle,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  cast: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.92 },
  deck: { slot: 'roof', graph: 'concrete_plain', roughness: 0.94 },
  rail: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.14 },
};
const tones = {
  pavement: [0.28, 0.29, 0.28],
  patch: [0.33, 0.329, 0.31],
  seam: [0.17, 0.174, 0.163],
  concrete: [0.62, 0.591, 0.534],
  kerb: [0.67, 0.644, 0.588],
  girder: [0.555, 0.527, 0.478],
  weather: [0.51, 0.483, 0.424],
  bearing: [0.269, 0.253, 0.233],
  steel: [0.237, 0.287, 0.298],
  railTop: [0.27, 0.316, 0.335],
  cream: [0.82, 0.797, 0.718],
};
const mix = (a, b, t) => a + (b - a) * t;
const detail = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
function face(out, slot, points, normal, color) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * normal[i], 0) < 0) {
    points = points.toReversed();
    n = n.map((v) => -v);
  }
  out.addQuad(slot, '', points, n, undefined, color);
}
function sampler(route) {
  const { a, b, rows } = route;
  return (x, width = 0, height = 0) => {
    const t = Math.max(0, Math.min(16, (16 * (x - a)) / (b - a))),
      i = Math.min(15, Math.floor(t));
    return [
      x,
      mix(rows[i][1], rows[i + 1][1], t - i) + height,
      mix(rows[i][2], rows[i + 1][2], t - i) + width,
    ];
  };
}
function strip(out, sample, slot, color, x0, x1, z0, z1, y, steps = 1) {
  for (let i = 0; i < steps; i++) {
    const a = mix(x0, x1, i / steps),
      b = mix(x0, x1, (i + 1) / steps);
    face(
      out,
      slot,
      [sample(a, z0, y), sample(b, z0, y), sample(b, z1, y), sample(a, z1, y)],
      [0, 1, 0],
      color,
    );
  }
}
function taper(out, sample, x0, x1, section, color, steps) {
  // Cross-section winds counterclockwise when viewed from positive X.
  const rings = Array.from({ length: steps + 1 }, (_, i) => {
    const x = mix(x0, x1, i / steps);
    return section.map(([z, y]) => sample(x, z, y));
  });
  loft(out, 'cast', rings, color);
}
function foundations(out, route, sample, d) {
  const { a, b, halfWidth, piers } = route;
  for (const [i, [x, base, z, y]] of piers.entries()) {
    const isBank = i === 0 || i === piers.length - 1;
    const width = isBank ? 2.72 : 1.53,
      depth = isBank ? 2 * halfWidth - 0.34 : halfWidth * 1.55;
    const head = y - (d === 0 ? 0.83 : 1.23),
      shoulder = head - 0.3;
    const bottom = chamferedRectangle(x, base, z, width, depth, 0.22);
    const middle = chamferedRectangle(x, shoulder, z, width * 0.8, depth * 0.92, 0.2);
    const top = chamferedRectangle(x, head, z, width + 0.29, depth + 0.48, 0.17);
    loft(out, 'cast', d === 0 ? [bottom, top] : [bottom, middle, top], tones.concrete);
    if (d >= 1) {
      for (const side of [-1, 1]) {
        const z0 = z + side * (halfWidth - 0.65);
        box(
          out,
          'cast',
          [x - 0.52, head, z0 - 0.3],
          [x + 0.52, head + 0.16, z0 + 0.3],
          tones.bearing,
        );
        if (isBank) {
          const r = i === 0 ? -1 : 1,
            t = x + r * 2.6,
            z2 = z + side * (halfWidth + 0.46);
          loft(
            out,
            'cast',
            [
              chamferedRectangle(t, base, z2, 4.55, 0.58, 0.13),
              chamferedRectangle(t, y - 0.76, z2, 4.55, 0.52, 0.13),
            ],
            tones.weather,
          );
        }
      }
    }
  }
  const stations = [a, ...piers.slice(1, -1).map((p) => p[0]), b];
  if (d === 0) return;
  const girders = d === 1 ? 3 : 4;
  for (let k = 0; k < girders; k++) {
    const z = mix(-halfWidth + 1.04, halfWidth - 1.04, k / (girders - 1));
    for (let i = 1; i < stations.length; i++) {
      const x0 = stations[i - 1] + 0.018,
        x1 = stations[i] - 0.018;
      taper(
        out,
        sample,
        x0,
        x1,
        [
          [z - 0.52, -0.33],
          [z - 0.43, -0.57],
          [z - 0.29, -1.24],
          [z + 0.33, -1.24],
          [z + 0.45, -0.59],
          [z + 0.53, -0.33],
        ],
        tones.girder,
        d >= 3 ? 4 : 2,
      );
    }
  }
}
function railings(out, route, sample, d) {
  const { a, b, halfWidth, roadHalf } = route,
    n = d === 0 ? 4 : 8;
  for (const side of [-1, 1]) {
    const at = (z) => z * side;
    const rail = at(halfWidth - 0.12);
    strip(
      out,
      sample,
      'deck',
      tones.kerb,
      a,
      b,
      Math.min(at(roadHalf), at(halfWidth)),
      Math.max(at(roadHalf), at(halfWidth)),
      0.135,
      d === 0 ? 8 : 16,
    );
    for (let k = 0; k < n; k++) {
      const x0 = mix(a, b, k / n),
        x1 = mix(a, b, (k + 1) / n);
      const front = at(roadHalf);
      face(
        out,
        'cast',
        [
          sample(x0, front, 0.135),
          sample(x1, front, 0.135),
          sample(x1, front, 0),
          sample(x0, front, 0),
        ],
        [0, 0, -side],
        tones.kerb,
      );
    }
    const line = (y) => Array.from({ length: n + 1 }, (_, i) => sample(mix(a, b, i / n), rail, y));
    beamPath(out, 'rail', line(1.045), 0.092, 0.105, tones.railTop);
    if (d >= 1) beamPath(out, 'rail', line(0.43), 0.052, 0.073, tones.steel);
    const posts = d === 0 ? 3 : d === 1 ? 20 : d === 2 ? 40 : 54;
    for (let i = 0; i <= posts; i++) {
      const x = mix(a + 0.24, b - 0.24, i / posts);
      beam(out, 'rail', sample(x, rail, 0.11), sample(x, rail, 1.05), 0.097, 0.092, tones.steel);
    }
    if (d < 2) continue;
    const pickets = d === 2 ? 100 : d === 3 ? 175 : 220;
    for (let i = 1; i < pickets; i++) {
      const x = mix(a + 0.1, b - 0.1, i / pickets);
      beam(out, 'rail', sample(x, rail, 0.42), sample(x, rail, 1.02), 0.037, 0.035, tones.steel);
    }
  }
}
function bridge(out, route, d) {
  const { a, b, halfWidth, roadHalf } = route,
    sample = sampler(route);
  const deckDepth = d === 0 ? 0.84 : 0.36,
    segments = d === 0 ? 8 : 16;
  taper(
    out,
    sample,
    a,
    b,
    [
      [-halfWidth, 0],
      [-halfWidth, -deckDepth * 0.65],
      [-halfWidth + 0.31, -deckDepth],
      [halfWidth - 0.31, -deckDepth],
      [halfWidth, -deckDepth * 0.65],
      [halfWidth, 0],
    ],
    tones.concrete,
    segments,
  );
  strip(out, sample, 'deck', tones.pavement, a, b, -halfWidth, halfWidth, 0.004, segments);
  foundations(out, route, sample, d);
  railings(out, route, sample, d);
  if (d === 0) return;
  for (const s of [-1, 1]) {
    const z = s * (roadHalf - 0.16);
    strip(out, sample, 'deck', tones.cream, a + 0.3, b - 0.3, z - 0.042, z + 0.042, 0.012, 16);
  }
  for (let i = 1; i < 11; i++) {
    const x = mix(a, b, i / 11);
    strip(out, sample, 'deck', tones.cream, x - 1.45, x + 1.45, -0.043, 0.043, 0.011, 1);
  }
  if (d >= 2) {
    for (const x of [a + 0.39, b - 0.42, ...route.piers.slice(1, -1).map((p) => p[0])]) {
      strip(out, sample, 'deck', tones.seam, x - 0.055, x + 0.055, -roadHalf, roadHalf, 0.012);
    }
    for (let i = 0; i < 7; i++) {
      const x = mix(a + 2, b - 4, (i + 0.5) / 7),
        z = ((i % 3) - 1) * 0.98;
      strip(out, sample, 'deck', tones.patch, x - 0.43, x + 0.58, z - 0.28, z + 0.29, 0.009);
    }
  }
}
function build(out, d) {
  for (const route of layout.routes) bridge(out, route, d);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
export function buildBridgeLevel(out, level) {
  build(out, detail[level]);
}
