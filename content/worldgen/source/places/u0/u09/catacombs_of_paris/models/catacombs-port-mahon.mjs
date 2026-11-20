import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { buildDecureAlcoves, decureAlcoves } from './catacombs-decure.mjs';

const ref = 'palette:#ffffff';
const limestone = [0.555, 0.496, 0.398];
const ashlar = [0.646, 0.566, 0.447];
const damp = [0.42, 0.414, 0.336];
const metal = [0.255, 0.23, 0.188];
const shade = (color, t) => color.map((n) => n * t);
const tau = 2 * Math.PI;
const quad = (out, slot, pts, color) => out.addQuad(slot, ref, pts, normalFor(...pts), [], color);
const tri = (out, slot, pts, color) =>
  out.addTriangle(slot, ref, pts, normalFor(...pts), [], color);
const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);
const direction = (a, b) => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
};
const offset = ([x, z], [dx, dz], width) => [x + dz * width, z - dx * width];

// Traced from the two branches shown at Port-Mahon on the 2025 museum plan.
// The upper turn contains the sculpture alcoves and the far end contains the footbath.
export const portMahonSegment = 19;
export const portMahonMouthRange = [0.32, 0.58];
export const portMahonMouthHeight = 2.06;
const bends = [
  [65.15, 302.68],
  [61.23, 299.53],
  [60.33, 296.51],
  [78.35, 283.3],
  [84.02, 286.7],
  [80.67, 295.4],
];
const room = [78.61, 304.52];
const halfWidth = 1.49;
const halfDepth = 2.08;
const wellRadius = 1.31;
const waterDepth = 3.12;
const floorDrop = 0.65;
const roomHeadroom = 2.46;

export function portMahonGeometry(opening) {
  const y = opening[0][1];
  const mouth = mix(opening[0], opening[1], 0.5);
  const forward = direction(bends.at(-1), room);
  const roomEntry = room.map((value, i) => value - forward[i] * halfDepth);
  return {
    y: y - floorDrop,
    room,
    roomHeading: Math.atan2(...forward),
    wellRadius,
    waterDepth,
    sections: [
      { point: [mouth[0], mouth[2]], y, half: 1.38, head: portMahonMouthHeight },
      ...bends.map((point, i) => ({
        point,
        y: y - floorDrop * Math.min(1, i / 3),
        half: i === 3 ? 1.28 : 1.12,
        head: i === 3 ? 2.38 : 2.25,
      })),
      { point: roomEntry, y: y - floorDrop, half: halfWidth, head: roomHeadroom },
    ],
  };
}

function passageFrames(geometry, opening) {
  return geometry.sections.map(({ point, y, half, head }, i, rows) => {
    if (i === 0) return { right: opening[0], left: opening[1], head, rise: 0 };
    const incoming = direction(rows[i - 1].point, point);
    const outgoing = rows[i + 1] ? direction(point, rows[i + 1].point) : incoming;
    const bisector = direction([0, 0], [incoming[0] + outgoing[0], incoming[1] + outgoing[1]]);
    const miter = Math.min(1.35, 1 / (incoming[0] * bisector[0] + incoming[1] * bisector[1]));
    const framePoint = (sign) => {
      const [x, z] = offset(point, bisector, sign * half * miter);
      return [x, y, z];
    };
    return { left: framePoint(-1), right: framePoint(1), head, rise: rows[i + 1] ? 0.39 : 0 };
  });
}
const crossPoint = (f, t, h = 0) => {
  const p = mix(f.left, f.right, t);
  return [p[0], p[1] + h, p[2]];
};
const vaultPoint = (frame, t) =>
  crossPoint(frame, t, frame.head + frame.rise * Math.sin(Math.PI * t));

export function portMahonReliefFrames(opening) {
  const frames = passageFrames(portMahonGeometry(opening), opening);
  return decureAlcoves(frames[4], frames[5]);
}

function tunnel(out, frames, detail) {
  const facets = detail.joinery ? 5 : 3;
  for (const [i, b] of frames.slice(1).entries()) {
    const a = frames[i];
    quad(out, 'foundation', [a.left, b.left, b.right, a.right], shade(limestone, 0.83));
    const sideMaterial = i === 3 ? 'ashlar' : 'rough';
    if (i === 4) buildDecureAlcoves(out, a, b, detail);
    else quad(out, sideMaterial, [a.right, b.right, vaultPoint(b, 1), vaultPoint(a, 1)], limestone);
    quad(
      out,
      sideMaterial,
      [a.left, vaultPoint(a, 0), vaultPoint(b, 0), b.left],
      shade(limestone, 0.94),
    );
    for (let j = 0; j < facets; j++) {
      const t = j / facets,
        u = (j + 1) / facets;
      quad(
        out,
        'rough',
        [vaultPoint(a, t), vaultPoint(a, u), vaultPoint(b, u), vaultPoint(b, t)],
        shade(limestone, 0.88 + 0.09 * Math.sin(j * 2 + i)),
      );
    }
  }
}

function vaultRibs(out, a, b, detail) {
  // The press photograph shows closely spaced masonry arches inside the long run.
  const bands = detail.name === 'district' ? 2 : 7;
  const wedges = detail.name === 'master' || detail.name === 'closeup' ? 9 : 5;
  for (let i = 1; i <= bands; i++) {
    const station = (i - 0.3) / (bands + 0.48);
    const frame = (t) => ({
      left: mix(a.left, b.left, t),
      right: mix(a.right, b.right, t),
      head: a.head + (b.head - a.head) * t,
      rise: a.rise,
    });
    const first = frame(station),
      last = frame(station + 0.013);
    const stone = (f, t, inner) => {
      const p = crossPoint(f, t, f.head + f.rise * Math.sin(Math.PI * t));
      return inner ? [p[0], p[1] - 0.145, p[2]] : [p[0], p[1] + 0.02, p[2]];
    };
    for (let j = 0; j < wedges; j++) {
      const t = j / wedges,
        u = (j + 1) / wedges;
      const tone = shade(ashlar, 0.79 + 0.09 * ((i + j) % 4));
      quad(
        out,
        'rough',
        [
          stone(first, u, true),
          stone(first, t, true),
          stone(first, t, false),
          stone(first, u, false),
        ],
        tone,
      );
      quad(
        out,
        'rough',
        [stone(first, t, true), stone(first, u, true), stone(last, u, true), stone(last, t, true)],
        tone,
      );
      if (detail.boneFaces)
        quad(
          out,
          'rough',
          [
            stone(last, t, true),
            stone(last, u, true),
            stone(last, u, false),
            stone(last, t, false),
          ],
          tone,
        );
    }
  }
  if (!detail.joinery) return;
  for (const side of [0.029, 0.971]) {
    const start = crossPoint(a, side, 0.93);
    const end = crossPoint(b, side, 0.93);
    beam(out, 'iron', start, end, 0.046, 0.044, metal);
    if (!detail.boneFaces) continue;
    for (const station of [0.16, 0.38, 0.6, 0.82]) {
      const grip = mix(start, end, station);
      const wall = mix(
        crossPoint(a, Math.round(side), 0.88),
        crossPoint(b, Math.round(side), 0.88),
        station,
      );
      beam(out, 'iron', grip, wall, 0.028, 0.028, metal);
    }
  }
}

function wellRoom(out, detail) {
  const facets = detail.joinery ? 20 : 12;
  const angles = Array.from({ length: facets }, (_, i) => (i * tau) / facets);
  const corners = [-1, 1].flatMap((x) =>
    [-1, 1].map((z) => Math.atan2(z * halfDepth, x * halfWidth)),
  );
  angles.push(...corners.map((a) => (a + tau) % tau));
  angles.sort((a, b) => a - b);
  const p = (r, a, y) => [r * Math.cos(a), y, r * Math.sin(a)];
  const rim = (a, y) => p(wellRadius, a, y);
  const boundary = (a, y) =>
    p(Math.min(halfWidth / Math.abs(Math.cos(a)), halfDepth / Math.abs(Math.sin(a))), a, y);
  const poolTone = [0.083, 0.31, 0.34];
  const strata = detail.boneFaces
    ? [
        [0, ashlar],
        [-0.34, limestone],
        [-1.1, damp],
        [-1.61, limestone],
        [-2.05, damp],
        [-2.74, limestone],
        [-3.27, damp],
      ]
    : [
        [0, limestone],
        [-0.84, ashlar],
        [-3.27, damp],
      ];
  for (const [i, a] of angles.entries()) {
    const b = angles[(i + 1) % angles.length];
    quad(out, 'foundation', [boundary(a, 0), rim(a, 0), rim(b, 0), boundary(b, 0)], limestone);
    if (detail.boneFaces) {
      const lo = p(wellRadius - 0.11, a, -0.052),
        hi = p(wellRadius - 0.11, b, -0.052);
      quad(out, 'rough', [rim(a, 0), lo, hi, rim(b, 0)], shade(ashlar, 0.95 + 0.08 * Math.sin(i)));
    }
    for (const [j, [bottom, tone]] of strata.slice(1).entries()) {
      const top = strata[j][0];
      quad(
        out,
        'rough',
        [rim(b, bottom), rim(b, top), rim(a, top), rim(a, bottom)],
        shade(tone, 0.91 + 0.076 * Math.sin(i * 1.8 + j)),
      );
    }
    tri(
      out,
      'water',
      [[0, -waterDepth, 0], rim(b, -waterDepth), rim(a, -waterDepth)],
      shade(poolTone, 0.82 + 0.07 * Math.sin(i * 2.3)),
    );
  }
  const l = [-halfWidth, 0, -halfDepth],
    r = [halfWidth, 0, -halfDepth];
  const m = [-halfWidth, 0, halfDepth],
    n = [halfWidth, 0, halfDepth];
  const top = ([x, , z]) => [x, roomHeadroom, z];
  for (const [a, b] of [
    [m, l],
    [n, m],
    [r, n],
  ])
    quad(out, 'rough', [a, b, top(b), top(a)], limestone);
  quad(out, 'rough', [top(l), top(r), top(n), top(m)], shade(limestone, 0.88));
  const treads = detail.joinery ? 19 : 9;
  const start = -Math.PI * 0.76;
  const turn = tau * 0.97;
  const tread = (r, i, y) => p(r, start + (turn * i) / treads, y);
  for (let i = 0; i < treads; i++) {
    const high = (-i * 3.02) / treads,
      low = (-(i + 1) * 3.02) / treads;
    quad(
      out,
      'rough',
      [
        tread(wellRadius, i, high),
        tread(0.65, i, high),
        tread(0.65, i + 1, high),
        tread(wellRadius, i + 1, high),
      ],
      shade(ashlar, 0.74 + 0.12 * Math.cos(i * 0.28)),
    );
    quad(
      out,
      'rough',
      [
        tread(0.65, i + 1, low),
        tread(wellRadius, i + 1, low),
        tread(wellRadius, i + 1, high),
        tread(0.65, i + 1, high),
      ],
      damp,
    );
  }
  const rail = (i, h) => tread(0.666, i, h + 0.69 - (i * 3.02) / treads);
  if (!detail.joinery) return;
  for (let i = 0; i < treads; i++) {
    const a = rail(i, 0.019),
      b = rail(i + 1, 0.019),
      lowA = rail(i, -0.019),
      lowB = rail(i + 1, -0.019);
    quad(out, 'iron', [a, lowA, lowB, b], metal);
    if (detail.boneFaces) {
      quad(out, 'iron', [b, lowB, lowA, a], metal);
      if (i % 3 === 0) beam(out, 'iron', rail(i, -0.69), rail(i, 0), 0.035, 0.035, metal);
      if (i % 5 === 0) {
        const y = 0.43 - (i * 3.02) / treads;
        beam(
          out,
          'iron',
          tread(0.666, i, y - 0.39),
          tread(wellRadius + 0.005, i, y + 0.04),
          0.023,
          0.021,
          metal,
        );
      }
    }
  }
}

export function buildPortMahon(out, opening, detail) {
  const geometry = portMahonGeometry(opening);
  const frames = passageFrames(geometry, opening);
  tunnel(out, frames, detail);
  vaultRibs(out, frames[3], frames[4], detail);
  const [x, z] = geometry.room;
  wellRoom(transform(out, geometry.roomHeading, [x, geometry.y, z]), detail);
}
