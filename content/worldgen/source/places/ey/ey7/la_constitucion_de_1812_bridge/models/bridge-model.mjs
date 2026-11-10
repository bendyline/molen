/** La Constitución de 1812 Bridge, built in meters around the signed Cádiz Bay map frame. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  chamferedRectangle,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { tubePath } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const bridgeSurfaces = {
  concrete: { slot: 'foundation', graph: 'concrete_plain' },
  asphalt: { slot: 'wall', graph: 'gravel' },
  steel: { slot: 'trim', graph: 'metal_painted' },
  cable: { slot: 'trim', graph: 'metal_painted' },
};

const levelIndex = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const palette = {
  pale: 'd8d8ce',
  tower: 'e6e4d8',
  towerInset: 'a9afac',
  stem: 'afb4ae',
  foot: '999d95',
  rail: '426284',
  railTop: 'aabac8',
  steel: 'b4c0c1',
  steelShadow: '949fa4',
  steelRemovable: 'a8b6ba',
  asphalt: '55585b',
  bus: '626467',
  marking: 'e1dfd5',
  joint: '454b51',
  cable: 'f1efe6',
  collar: 'd2dad8',
  lamp: 'ece6cf',
};
const color = Object.fromEntries(
  Object.entries(palette).map(([name, hex]) => [
    name,
    hex.match(/../g).map((s) => {
      const c = parseInt(s, 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const ref = 'palette:#ffffff';
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (t) => Math.max(0, Math.min(1, t));
const [west, east] = layout.ends;
function interpolate(value, rows, column = 1) {
  const index = rows.findIndex((row) => row[0] >= value);
  if (index === -1) return rows.at(-1)[column];
  if (index === 0) return rows[0][column];
  const [a, b] = [rows[index - 1], rows[index]];
  return mix(a[column], b[column], (value - a[0]) / (b[0] - a[0]));
}
export const centerZ = (x) => interpolate(x, layout.alignment);
export const halfDeck = (x) => interpolate(x, layout.alignment, 2) / 2;

export function deckY(x) {
  const index = layout.profile.findIndex((row) => row[0] >= x);
  if (index === -1) return layout.profile.at(-1)[1];
  if (index === 0) return layout.profile[0][1];
  const [a, b] = [layout.profile[index - 1], layout.profile[index]];
  const run = b[0] - a[0],
    t = (x - a[0]) / run,
    t2 = t * t,
    t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * a[1] +
    (t3 - 2 * t2 + t) * run * a[2] +
    (-2 * t3 + 3 * t2) * b[1] +
    (t3 - t2) * run * b[2]
  );
}

const endSections = [layout.west, layout.east].map((laneJoins) =>
  laneJoins.map(([x, z]) => [z, x]),
);
export function deckPoint(x, z = 0, y = 0) {
  const lateral = centerZ(x) + z;
  const adjustment =
    (interpolate(lateral, endSections[0]) - west) * clamp(1 - (x - west) / 42) +
    (interpolate(lateral, endSections[1]) - east) * clamp(1 - (east - x) / 55);
  return [x + adjustment, deckY(x) + y, lateral];
}

function face(out, slot, name, points, outward) {
  const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
  if (dot(normalFor(...points), outward) < 0) points = points.toReversed();
  const triangles =
    points.length === 3 ? [points] : [points.slice(0, 3), [points[0], points[2], points[3]]];
  for (const triangle of triangles) {
    out.addTriangle(slot, ref, triangle, normalFor(...triangle), undefined, color[name]);
  }
}

const endsAndJoints = [west, ...layout.removableSpan, ...layout.stayedSpan, east];
const sorted = (xs) => [...new Set(xs)].sort((a, b) => a - b);
function deckStations(tier) {
  return sorted([
    ...layout.alignment.filter((_, i) => i % [8, 6, 2, 1, 1][tier] === 0).map(([x]) => x),
    ...layout.profile.map(([x]) => x),
    ...endsAndJoints,
  ]);
}

function horizontal(out, slot, name, a, b, left, right, height) {
  face(
    out,
    slot,
    name,
    [
      deckPoint(a, left(a), height),
      deckPoint(b, left(b), height),
      deckPoint(b, right(b), height),
      deckPoint(a, right(a), height),
    ],
    [0, 1, 0],
  );
}

export function soffitDepth(x) {
  const [a, b] = layout.removableSpan;
  if (x > a && x < b) return 3.6;
  if (x >= layout.stayedSpan[0] && x <= layout.stayedSpan[1]) return 5.15;
  return 4.2;
}

function deck(out, tier) {
  const xs = deckStations(tier),
    negative = (x) => -halfDeck(x);
  const profile = tier
    ? [
        [-1, 0],
        [-1, -0.9],
        [-0.68, -1],
        [0.68, -1],
        [1, -0.9],
        [1, 0],
      ]
    : [
        [-1, 0],
        [-0.68, -1],
        [0.68, -1],
        [1, 0],
      ];
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i],
      middle = (a + b) / 2;
    const landing = a - west < 42 ? layout.west : east - b < 55 ? layout.east : null;
    const edges = [
      negative,
      ...(landing ?? []).map(([, z]) => {
        const t = (z - centerZ(landing === layout.west ? west : east)) / 17.5;
        return (x) => t * halfDeck(x);
      }),
      halfDeck,
    ];
    for (let band = 1; band < edges.length; band++) {
      horizontal(out, 'asphalt', 'asphalt', a, b, edges[band - 1], edges[band], 0);
    }
    const depth = soffitDepth(middle);
    const shape = (x, [z, y]) => deckPoint(x, z * halfDeck(x), y >= -0.9 ? y : -depth);
    for (let j = 1; j < profile.length; j++) {
      const u = profile[j - 1],
        v = profile[j];
      const lower = u[1] === -1 && v[1] === -1;
      const removable = middle > layout.removableSpan[0] && middle < layout.removableSpan[1];
      const member = middle > layout.stayedSpan[0] && middle < layout.stayedSpan[1];
      const slot = removable || member ? 'steel' : 'concrete';
      const name = lower ? 'steelShadow' : removable ? 'steelRemovable' : 'steel';
      face(
        out,
        slot,
        name,
        [shape(a, u), shape(b, u), shape(b, v), shape(a, v)],
        [0, lower ? -1 : -0.25, Math.sign(u[0] + v[0])],
      );
    }
    if (!tier) continue;
    horizontal(
      out,
      'asphalt',
      'bus',
      a,
      b,
      (x) => -halfDeck(x) + 1.4,
      () => -5.65,
      0.025,
    );
    for (const offset of [
      (x) => -halfDeck(x) + 1.23,
      () => -5.45,
      () => 4.25,
      (x) => halfDeck(x) - 1.23,
    ]) {
      horizontal(
        out,
        'concrete',
        'marking',
        a,
        b,
        (x) => offset(x) - 0.09,
        (x) => offset(x) + 0.09,
        0.041,
      );
    }
  }
  for (const x of endsAndJoints) {
    const w = halfDeck(x),
      d = Math.max(soffitDepth(x - 0.5), soffitDepth(x + 0.5));
    const outward = [x === east ? 1 : -1, 0, 0];
    const p = (z, y) => deckPoint(x, z * w, y);
    if (!tier) {
      face(out, 'steel', 'steelShadow', [p(-1, 0), p(-0.68, -d), p(0.68, -d), p(1, 0)], outward);
      continue;
    }
    face(out, 'steel', 'steelShadow', [p(-1, 0), p(-1, -0.9), p(-0.68, -d), p(-0.68, 0)], outward);
    face(
      out,
      'steel',
      'steelShadow',
      [p(-0.68, 0), p(-0.68, -d), p(0.68, -d), p(0.68, 0)],
      outward,
    );
    face(out, 'steel', 'steelShadow', [p(0.68, 0), p(0.68, -d), p(1, -0.9), p(1, 0)], outward);
  }
  return xs;
}

function roadDetails(out, tier, stations) {
  if (!tier) return;
  if (tier === 1) {
    for (const side of [-1, 1]) {
      const points = stations.map((x) => deckPoint(x, side * (halfDeck(x) - 0.7), 0.48));
      beamPath(out, 'steel', points, 0.48, 0.96, color.rail);
    }
    return;
  }
  for (const side of [-1, 1]) {
    const z = (x) => side * (halfDeck(x) - 0.7);
    beamPath(
      out,
      'concrete',
      stations.map((x) => deckPoint(x, z(x), 0.26)),
      0.63,
      0.52,
      color.pale,
    );
    beamPath(
      out,
      'steel',
      stations.map((x) => deckPoint(x, z(x), 1.21)),
      0.18,
      0.25,
      color.rail,
    );
    if (tier >= 3)
      beamPath(
        out,
        'steel',
        stations.map((x) => deckPoint(x, z(x), 0.83)),
        0.13,
        0.15,
        color.railTop,
      );
    const spacing = tier === 2 ? 36 : tier === 3 ? 11 : 7;
    for (let x = west + 4; x < east - 4; x += spacing) {
      beam(out, 'steel', deckPoint(x, z(x), 0.48), deckPoint(x, z(x), 1.21), 0.19, 0.2, color.rail);
    }
  }
  for (const divider of [-5.38, 4.25]) {
    beamPath(
      out,
      'concrete',
      stations.map((x) => deckPoint(x, divider, 0.36)),
      0.49,
      0.72,
      color.pale,
    );
  }
  for (let x = west + 4; x < east - 12; x += tier === 2 ? 17 : 12) {
    for (const offset of [-0.54, 9.1]) {
      horizontal(
        out,
        'concrete',
        'marking',
        x,
        x + 5.0,
        () => offset - 0.07,
        () => offset + 0.07,
        0.044,
      );
    }
  }
  for (const x of [...layout.removableSpan, ...layout.stayedSpan]) {
    horizontal(
      out,
      'steel',
      'joint',
      x - 0.27,
      x + 0.27,
      (x) => -halfDeck(x) + 0.4,
      (x) => halfDeck(x) - 0.4,
      0.057,
    );
  }
  if (tier < 3) return;
  for (let x = west + 41; x < east - 15; x += 56) {
    for (const side of [-1, 1]) {
      const edge = side * (halfDeck(x) - 1.0),
        head = edge - side * 2.5;
      beam(out, 'steel', deckPoint(x, edge, 0.5), deckPoint(x, edge, 9.0), 0.16, 0.16, color.steel);
      beam(
        out,
        'steel',
        deckPoint(x, edge, 8.92),
        deckPoint(x, head, 9.68),
        0.14,
        0.14,
        color.steel,
      );
      beam(
        out,
        'concrete',
        deckPoint(x - 0.22, head, 9.61),
        deckPoint(x + 0.22, head, 9.61),
        0.47,
        0.15,
        color.lamp,
      );
    }
  }
}

function ring(x, y, z, w, d, tier) {
  if (tier) return chamferedRectangle(x, y, z, w, d, Math.min(w, d) * 0.1);
  return [
    [x - w / 2, y, z - d / 2],
    [x - w / 2, y, z + d / 2],
    [x + w / 2, y, z + d / 2],
    [x + w / 2, y, z - d / 2],
  ];
}

function tower(out, t, tier) {
  const { x, z, topY, pierBaseY, legSide } = t,
    y = deckY(x);
  const rootY = y - 24,
    forkTop = topY - 37,
    shoulderY = y + 0.4;
  const r = (y, w, d, offset = 0) => ring(x, y, z + offset, w, d, tier);
  loft(
    out,
    'concrete',
    [r(pierBaseY, 23.0, 29.0), r(Math.max(1.4, t.ground + 1), 22, 27.2)],
    color.foot,
  );
  loft(
    out,
    'concrete',
    [r(Math.max(1.3, t.ground + 0.9), 12.8, 14.7), r(rootY, 11.4, 12.6)],
    color.stem,
  );
  for (const side of [-1, 1]) {
    const sections = [
      r(rootY - 0.4, 11.5, 7.1, side * 3.95),
      r(y - 9.7, 10.3, 7.2, side * 12.2),
      r(shoulderY, 9.0, 6.45, side * legSide),
      r(shoulderY + 10.7, 8.2, 5.8, side * (legSide - 2.3)),
      r(forkTop - 12.0, 6.6, 5.15, side * 4.75),
      r(forkTop + 0.4, 6.15, 4.5, side * 2.1),
    ];
    loft(out, 'concrete', tier ? sections : [sections[0], sections[2], sections[5]], color.tower);
  }
  loft(
    out,
    'concrete',
    [r(forkTop - 2.7, 6.45, 8.55), r(topY - 1.0, 5.55, 6.1), r(topY, 5.31, 5.85)],
    color.tower,
  );
  if (!tier) return;
  for (const direction of [-1, 1]) {
    const offset = (y) => direction * mix(3.28, 2.8, clamp((y - forkTop) / 37));
    const a = forkTop + 3,
      b = topY - 2.4;
    face(
      out,
      'steel',
      'towerInset',
      [
        [x + offset(a), a, z - 1.7],
        [x + offset(b), b, z - 1.42],
        [x + offset(b), b, z + 1.42],
        [x + offset(a), a, z + 1.7],
      ],
      [direction, 0, 0],
    );
  }
  if (tier < 3) return;
  for (const side of [-1, 1]) {
    beam(
      out,
      'steel',
      [x, topY - 0.05, z + side * 1.8],
      [x, topY + 1.3, z + side * 1.8],
      0.15,
      0.15,
      color.collar,
    );
    const fx = x + side * 10.0;
    if (x < 0)
      loft(
        out,
        'concrete',
        [ring(fx, -4, z + 30 * side, 6.4, 6.0, tier), ring(fx, 1.7, z + 30 * side, 5.4, 5.0, tier)],
        color.foot,
      );
  }
}

function cables(out, tower, tier, inward) {
  const { x, z, topY, outwardRun } = tower;
  const count = [3, 11, 22, 22, 22][tier],
    radial = [3, 4, 5, 6, 8][tier];
  for (const side of [-1, 1]) {
    for (const direction of [-1, 1]) {
      const run = direction === inward ? 260.5 : outwardRun;
      for (let i = 0; i < count; i++) {
        const f = i / (count - 1),
          station = x + direction * mix(31, run, f);
        const a = [
          x + direction * mix(3.26, 2.76, f),
          mix(topY - 51.1, topY - 4.6, f),
          z + side * mix(4.75, 1.65, f),
        ];
        const b = deckPoint(station, side * (halfDeck(station) - 1.47), 0.72);
        tubePath(out, 'cable', [a, b], [0.54, 0.32, 0.22, 0.166, 0.155][tier], color.cable, radial);
        if (tier >= 3) {
          const fraction = 2.1 / Math.hypot(...a.map((n, j) => n - b[j]));
          const sleeve = b.map((n, j) => mix(n, a[j], fraction));
          tubePath(out, 'steel', [b, sleeve], 0.255, color.collar, 6);
        }
      }
    }
  }
}

function pier(out, p, tier) {
  const { x, z, footY, marine, special } = p,
    upper = deckY(x) - soffitDepth(x) + 0.19;
  if (upper - footY < 0.3) return;
  const wide = special ? 1.24 : 1;
  const r = (y, w, d) => ring(x, y, z, w * wide, d * wide, tier >= 2);
  if (!tier) {
    loft(out, 'concrete', [r(footY, 5.6, 7.5), r(upper, 5.4, special ? 14 : 8.7)], color.pale, {
      cap: false,
    });
    return;
  }
  const capBase = upper - Math.min(4.8, (upper - footY) * 0.44);
  const footing = Math.min(capBase - 0.08, marine ? Math.max(0.42, footY + 0.55) : footY + 0.8);
  if (tier >= 2 && footing > footY + 0.02)
    loft(out, 'concrete', [r(footY, 9.8, 12.6), r(footing, 8.8, 11.2)], color.foot);
  const sections = [
    r(tier >= 2 ? footing : footY, 5.6, 7.5),
    r(capBase, 4.5, 6.1),
    r(upper - 0.36, 5.75, 20.0),
    r(upper, 5.95, 20.5),
  ];
  loft(
    out,
    'concrete',
    tier === 1 ? [sections[0], sections[1], sections[3]] : sections,
    color.pale,
  );
  if (tier >= 2 && special)
    loft(out, 'steel', [r(upper, 4.2, 11.4), r(upper + 0.28, 4.2, 11.4)], color.joint);
}

export function buildBridgeLevel(out, level = 'master') {
  const tier = levelIndex[level];
  if (tier === undefined) throw new Error(`Unknown Cádiz bridge level ${level}`);
  const stations = deck(out, tier);
  roadDetails(out, tier, stations);
  layout.towers.forEach((t, i) => {
    tower(out, t, tier);
    cables(out, t, tier, i === 0 ? 1 : -1);
  });
  for (const p of layout.piers) pier(out, p, tier);
}

export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');
