/** Original Dhola–Sadiya exterior from ordinary pictures and the attributed full map route. */
import {
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { bhupenAlignment } from './bhupen-plan.mjs';

const linear = (hex) =>
  hex.match(/\w\w/g).map((v) => {
    const s = Number.parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const color = {
  concrete: linear('c9c6bc'),
  footing: linear('b5b0a2'),
  paving: linear('c8c6bb'),
  white: linear('eeeade'),
  road: linear('515557'),
  yellow: linear('d4ba57'),
  dark: linear('343b3e'),
};
export const bhupenControls = {
  width: 12.9,
  // A regularized ~50m rhythm inferred from the photographs; not an as-built span schedule.
  spans: 183,
  // Provisional standard-terrain fit. Current native renders must establish final attachment.
  nativeOrigin: 120,
  riverY: 8.1448211669922,
  foundationY: 7.6,
  profile: [
    [0, 10.9],
    [2400, 16.3],
    [6500, 16.3],
    [9169.80863340908, 8.45],
  ],
};
export const bhupenSurfaces = {
  skyline: {
    slot: 'foundation',
    localRef: 'palette:#ffffff',
    roughness: 0.98,
    metallic: 0,
    doubleSided: true,
  },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.74, metallic: 0.2 },
};
const C = bhupenControls,
  points = bhupenAlignment,
  distance = [0];
for (let i = 1; i < points.length; i++)
  distance.push(
    distance.at(-1) + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]),
  );
export const bhupenLength = distance.at(-1);
const normalize = ([x, z]) => {
  const d = Math.hypot(x, z) || 1;
  return [x / d, z / d];
};
const tangents = points.map((p, i) => {
  const a = i ? normalize([p[0] - points[i - 1][0], p[1] - points[i - 1][1]]) : null;
  const b =
    i + 1 < points.length ? normalize([points[i + 1][0] - p[0], points[i + 1][1] - p[1]]) : null;
  return a && b ? normalize([a[0] + b[0], a[1] + b[1]]) : (a ?? b);
});
export function bhupenFrame(station) {
  if (station < 0 || station > bhupenLength) {
    const edge = station < 0 ? 0 : bhupenLength;
    const frame = bhupenFrame(edge);
    return { ...frame, point: frame.point.map((v, i) => v + frame.tangent[i] * (station - edge)) };
  }
  station = Math.max(0, Math.min(bhupenLength, station));
  let i = 1;
  while (i < distance.length - 1 && distance[i] < station) i++;
  const t = (station - distance[i - 1]) / (distance[i] - distance[i - 1]);
  const a = points[i - 1],
    b = points[i],
    ta = tangents[i - 1],
    tb = tangents[i];
  const tangent = normalize([ta[0] + (tb[0] - ta[0]) * t, ta[1] + (tb[1] - ta[1]) * t]);
  return {
    point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    tangent,
    normal: [-tangent[1], tangent[0]],
  };
}
export function bhupenDeckY(station) {
  const p = C.profile;
  for (let i = 1; i < p.length; i++)
    if (station <= p[i][0]) {
      const t = Math.max(0, (station - p[i - 1][0]) / (p[i][0] - p[i - 1][0]));
      return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
    }
  return p.at(-1)[1];
}
const xyz = ([station, y, offset]) => {
  const f = bhupenFrame(station);
  return [f.point[0] + f.normal[0] * offset, y, f.point[1] + f.normal[1] * offset].map(Math.fround);
};
function writer(out, far) {
  const emit = (slot, ref, vertices, _hint, _uv, tint) => {
    const p = vertices.map(xyz);
    for (let i = 1; i + 1 < p.length; i++) {
      const tri = [p[0], p[i], p[i + 1]];
      out.addTriangle(
        far ? 'skyline' : slot,
        ref,
        tri,
        normalFor(...tri),
        [vertices[0], vertices[i], vertices[i + 1]].map((v) => [
          v[0],
          Math.abs(_hint?.[1] ?? 0) > 0.5 ? v[2] : v[1],
        ]),
        far ? tint.map((v, j) => v * [0.710816, 0.710816, 0.681928][j]) : tint,
      );
    }
  };
  return Object.fromEntries(['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [k, emit]));
}
function face(out, slot, p, tint) {
  out.addQuad(slot, 'palette:#ffffff', p, normalFor(...p), [], tint);
}
function ribbon(out, slot, stations, z0, z1, offset, tint, back = false) {
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1],
      b = stations[i],
      p = [
        [a, bhupenDeckY(a) + offset, z0],
        [a, bhupenDeckY(a) + offset, z1],
        [b, bhupenDeckY(b) + offset, z1],
        [b, bhupenDeckY(b) + offset, z0],
      ];
    face(out, slot, back ? p.toReversed() : p, tint);
  }
}
function upright(out, slot, stations, z, y0, y1, tint, both = false, reverse = false) {
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1],
      b = stations[i],
      p = [
        [a, bhupenDeckY(a) + y0, z],
        [b, bhupenDeckY(b) + y0, z],
        [b, bhupenDeckY(b) + y1, z],
        [a, bhupenDeckY(a) + y1, z],
      ];
    face(out, slot, reverse ? p.toReversed() : p, tint);
    if (both) face(out, slot, reverse ? p : p.toReversed(), tint);
  }
}
function sweep(out, slot, stations, section, tint) {
  const ring = (s) => section.map(([z, y]) => [s, bhupenDeckY(s) + y, z]);
  loft(out, slot, stations.map(ring), tint);
}
function stationsFor(step) {
  const count = Math.ceil(bhupenLength / step);
  return [
    ...new Set([
      ...distance,
      ...Array.from({ length: count + 1 }, (_, i) => (bhupenLength * i) / count),
    ]),
  ].sort((a, b) => a - b);
}
function ovalRing(station, y, along, across, sides) {
  return Array.from({ length: sides }, (_, i) => {
    const a = (-i / sides) * Math.PI * 2;
    return [station + Math.cos(a) * along, y, Math.sin(a) * across];
  });
}
function piers(out, level) {
  for (let i = 1; i < C.spans; i++) {
    const s = (bhupenLength * i) / C.spans,
      y = bhupenDeckY(s);
    const foundation = Math.min(C.foundationY, y - 6.5);
    if (level === 'skyline') {
      const p = [
        [s - 0.95, foundation, 0],
        [s + 0.95, foundation, 0],
        [s + 0.95, y - 1.75, 0],
        [s - 0.95, y - 1.75, 0],
      ];
      face(out, 'concrete', p, color.concrete);
    } else if (level === 'district') {
      box(out, 'concrete', [s - 0.95, foundation, -2.1], [s + 0.95, y - 2.3, 2.1], color.concrete);
      for (const z of [-5.1, 5.1]) {
        const p = [
          [s - 1.15, y - 3.5, z],
          [s + 1.15, y - 3.5, z],
          [s + 1.15, y - 1.75, z],
          [s - 1.15, y - 1.75, z],
        ];
        face(out, 'concrete', z < 0 ? p.toReversed() : p, color.concrete);
      }
    } else {
      const sides = level === 'street' ? 4 : level === 'closeup' ? 8 : 12;
      loft(
        out,
        'concrete',
        [
          ovalRing(s, foundation + 0.9, 1.05, 2.1, sides),
          ovalRing(s, y - 4.1, 0.95, 2.05, sides),
          ovalRing(s, y - 2.05, 1.2, 5.1, sides),
        ],
        color.concrete,
      );
      if (level !== 'street')
        box(
          out,
          'concrete',
          [s - 2.8, foundation, -4.5],
          [s + 2.8, foundation + 0.65, 4.5],
          color.footing,
        );
      for (const z of [-3.6, 3.6])
        box(out, 'iron', [s - 0.5, y - 2.05, z - 0.35], [s + 0.5, y - 1.65, z + 0.35], color.dark);
    }
  }
}
const detail = {
  skyline: { step: 10000, post: 0, mark: 0 },
  district: { step: 10000, post: 0, mark: 0 },
  street: { step: 180, post: 140, mark: 30 },
  closeup: { step: 50, post: 10, mark: 12 },
  master: { step: 12, post: 3, mark: 12 },
};
export function buildBhupenLevel(target, level = 'master') {
  const d = detail[level],
    out = writer(target, level === 'skyline'),
    stations = stationsFor(d.step);
  if (level === 'skyline') {
    // One two-sided pier face frees the budget for the actual girder side silhouette.
    sweep(
      out,
      'concrete',
      stations,
      [
        [-6.45, -1.75],
        [6.45, -1.75],
        [6.45, 0],
        [-6.45, 0],
      ],
      color.concrete,
    );
  } else if (level === 'district') {
    sweep(
      out,
      'concrete',
      stations,
      [
        [-6.45, -1.75],
        [6.45, -1.75],
        [6.45, 0],
        [-6.45, 0],
      ],
      color.concrete,
    );
    ribbon(out, 'concrete', stations, -3.75, 3.75, 0.01, color.road);
    for (const z of [-6.15, 6.15])
      upright(out, 'concrete', stations, z, 0.15, 1.02, color.white, true);
  } else {
    // The broad segmented concrete girder and overhanging deck are continuous over both bends.
    sweep(
      out,
      'concrete',
      stations,
      [
        [-4.1, -1.75],
        [4.1, -1.75],
        [4.8, -0.32],
        [-4.8, -0.32],
      ],
      color.concrete,
    );
    sweep(
      out,
      'concrete',
      stations,
      [
        [-6.45, -0.32],
        [6.45, -0.32],
        [6.45, 0],
        [-6.45, 0],
      ],
      color.concrete,
    );
    ribbon(out, 'concrete', stations, -3.75, 3.75, 0.015, color.road);
    for (const side of [-1, 1]) {
      ribbon(
        out,
        'concrete',
        stations,
        side < 0 ? -5.75 : 3.75,
        side < 0 ? -3.75 : 5.75,
        0.17,
        color.paving,
      );
      upright(out, 'concrete', stations, side * 3.75, 0.015, 0.17, color.white, false, side > 0);
      const section = [
        [-6.45, 0.17],
        [-5.9, 0.17],
        [-6.08, 0.95],
        [-6.4, 0.95],
      ];
      sweep(
        out,
        'concrete',
        stations,
        side < 0 ? section : section.map(([z, y]) => [-z, y]).toReversed(),
        color.white,
      );
      sweep(
        out,
        'iron',
        stations,
        [
          [-0.08, 1.13],
          [0.08, 1.13],
          [0.08, 1.27],
          [-0.08, 1.27],
        ].map(([z, y]) => [z + side * 6.2, y]),
        color.yellow,
      );
      for (let s = 0; s <= bhupenLength; s += d.post) {
        const y = bhupenDeckY(s);
        box(
          out,
          'iron',
          [s - 0.06, y + 0.94, side * 6.2 - 0.07],
          [s + 0.06, y + 1.13, side * 6.2 + 0.07],
          color.dark,
        );
      }
      ribbon(
        out,
        'concrete',
        stations,
        side * 3.65 - 0.055,
        side * 3.65 + 0.055,
        0.025,
        color.white,
      );
      if (level !== 'street')
        for (let s = 0; s < bhupenLength; s += 4) {
          const b = Math.min(s + 2, bhupenLength),
            z = side * 3.75 - side * 0.005;
          const p = [
            [s, bhupenDeckY(s) + 0.02, z],
            [b, bhupenDeckY(b) + 0.02, z],
            [b, bhupenDeckY(b) + 0.17, z],
            [s, bhupenDeckY(s) + 0.17, z],
          ];
          face(out, 'concrete', side > 0 ? p.toReversed() : p, color.dark);
        }
    }
    for (let s = 0; s < bhupenLength; s += d.mark)
      ribbon(out, 'concrete', [s, Math.min(s + 4.5, bhupenLength)], -0.06, 0.06, 0.03, color.white);
    if (level !== 'street')
      for (let i = 1; i < C.spans; i++) {
        const s = (bhupenLength * i) / C.spans;
        ribbon(out, 'concrete', [s - 0.035, s + 0.035], -5.75, 5.75, 0.185, color.dark);
      }
  }
  piers(out, level);
  // A short asphalt threshold covers the ordinary map road's differently angled end cap.
  // It stays within the 7.5m carriageway and neither lengthens the piers nor moves the rail ends.
  for (const span of [
    [-0.75, 0],
    [bhupenLength, bhupenLength + 0.75],
  ])
    ribbon(
      out,
      'concrete',
      span,
      -3.75,
      3.75,
      level === 'skyline' ? 0 : level === 'district' ? 0.01 : 0.015,
      color.road,
    );
  if (level !== 'skyline')
    for (const s of [0, bhupenLength]) {
      const y = bhupenDeckY(s);
      box(
        out,
        'concrete',
        [Math.max(0, s - 2), C.foundationY, -6.45],
        [Math.min(bhupenLength, s + 2), y - 0.32, 6.45],
        color.concrete,
      );
    }
}
export const buildBhupenSkyline = (out) => buildBhupenLevel(out, 'skyline');
export const buildBhupenDistrict = (out) => buildBhupenLevel(out, 'district');
export const buildBhupenStreet = (out) => buildBhupenLevel(out, 'street');
export const buildBhupenCloseup = (out) => buildBhupenLevel(out, 'closeup');
