/** Exterior of Mukden Palace, aligned to the mapped ceremonial courts and roofs. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const earcut = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut').default;
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  timber: { slot: 'wall', graph: 'wood_plain', roughness: 0.81 },
  tile: { slot: 'roof', graph: 'tile_glazed', roughness: 0.62 },
  clay: { slot: 'roof', graph: 'tile_flat', roughness: 0.83 },
  brick: { slot: 'foundation', graph: 'brick_flemish', roughness: 0.89 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.88 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.64, metallic: 0.34 },
};
const palette = {
  red: 'b24d3d',
  vermilion: 'bd5040',
  redShadow: '7d342a',
  door: '502f26',
  amberDoor: '9d6838',
  teal: '3e6558',
  jade: '578259',
  pine: '345448',
  rail: '653626',
  soffit: '633d2f',
  yellow: 'd6a542',
  ochre: 'ae7d32',
  gold: 'e0b05a',
  darkRoof: '3d4545',
  grayRoof: '6c766a',
  greenRoof: '52724b',
  ridge: '8a9b54',
  pale: 'c8c3a9',
  stone: '9e9c8c',
  footing: '858a80',
  grayBrick: '81857c',
  shadeBrick: '6f736b',
  wall: '9e5140',
  greenWall: '557367',
  cream: 'c9bda2',
  cast: 'b78c45',
  lattice: '76563b',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([k, h]) => [
    k,
    h.match(/../g).map((v) => {
      const x = parseInt(v, 16) / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const mix = (a, b, t) => a + (b - a) * t;
const up = [0, 1, 0];
const identity = (x, y, z) => [x, y, z];
const corners = (a, b) => [
  [-a, -b],
  [a, -b],
  [a, b],
  [-a, b],
];
const sideNormal = ([x, z], [a, b]) => [b - z, 0, x - a];
const at = (p, y) => [p[0], y, p[1]];
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
function triangle(out, slot, tint, points, want) {
  let n = normalFor(...points);
  if (Math.hypot(...n) < 0.99) return;
  if (n.reduce((sum, v, i) => sum + v * want[i], 0) < 0) {
    points = points.toReversed();
    n = n.map((v) => -v);
  }
  out.addTriangle(slot, '', points, n, undefined, colors[tint]);
}
function face(out, slot, tint, [a, b, c, d], want) {
  triangle(out, slot, tint, [a, b, c], want);
  triangle(out, slot, tint, [a, c, d], want);
}
function frame(b) {
  const c = Math.cos(b.angle),
    s = Math.sin(b.angle),
    [cx, cz] = b.center;
  return (x, y, z) => [cx + c * x + s * z, y, cz - s * x + c * z];
}
function direction(p, [x, y, z]) {
  const q = p(x, y, z),
    o = p(0, 0, 0);
  return q.map((v, i) => v - o[i]);
}
function ground(x, z) {
  const { origin, step, size, heights } = layout.grade;
  const [u, v] = [x, z].map((p, i) =>
    Math.max(0, Math.min(size[i] - 1.001, (p - origin[i]) / step)),
  );
  const i = Math.floor(u),
    j = Math.floor(v),
    k = j * size[0] + i;
  return mix(
    mix(heights[k], heights[k + 1], u - i),
    mix(heights[k + size[0]], heights[k + size[0] + 1], u - i),
    v - j,
  );
}
function plane(out, slot, tint, ring, y, p = identity) {
  const indices = earcut(ring.flat(), [], 2);
  for (let i = 0; i < indices.length; i += 3)
    triangle(
      out,
      slot,
      tint,
      indices.slice(i, i + 3).map((j) => p(ring[j][0], y, ring[j][1])),
      up,
    );
}
function walls(out, slot, tint, ring, base, top, p = identity) {
  const winding = Math.sign(
    ring.reduce((sum, [x, z], i) => {
      const [u, v] = ring[(i + 1) % ring.length];
      return sum + x * v - u * z;
    }, 0),
  );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      A = p(a[0], top, a[1]),
      B = p(b[0], top, b[1]);
    const height = (v) => (typeof base === 'number' ? base : base(v[0], v[2]));
    face(
      out,
      slot,
      tint,
      [[A[0], height(A), A[2]], [B[0], height(B), B[2]], B, A],
      direction(
        p,
        sideNormal(a, b).map((v) => v * winding),
      ),
    );
  }
}
function box(out, slot, tint, p, x0, x1, y0, y1, z0, z1) {
  const ring = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
  walls(out, slot, tint, ring, y0, y1, p);
  plane(out, slot, tint, ring, y1, p);
}
function panel(out, slot, tint, p, x0, x1, y0, y1, z, sign) {
  face(
    out,
    slot,
    tint,
    [p(x0, y0, z), p(x1, y0, z), p(x1, y1, z), p(x0, y1, z)],
    direction(p, [0, 0, sign]),
  );
}
function footing(out, p, a, b, y, d) {
  const ring = corners(a, b);
  walls(out, 'stone', 'footing', ring, (x, z) => ground(x, z) - 0.5, y, p);
  if (d >= 1) plane(out, 'stone', 'stone', ring, y, p);
}
function stairs(out, p, width, z0, z1, top, d, tint = 'stone') {
  if (z1 - z0 < 0.05) return;
  const w = width / 2,
    contact = p(0, 0, z1),
    low = ground(contact[0], contact[2]) - 0.12;
  const rise = top - low,
    n =
      d === 0
        ? 1
        : Math.max(2, Math.min(d >= 3 ? 24 : 12, Math.ceil(rise / (d >= 3 ? 0.22 : 0.39))));
  for (let i = 0; i < n; i++) {
    const a = mix(z0, z1, i / n),
      b = mix(z0, z1, (i + 1) / n),
      y = top - (i * rise) / n;
    box(out, 'stone', tint, p, -w, w, low - 0.4, y, a, b);
  }
}
function balustrade(out, p, a, b, y, d, gap = 0) {
  if (d < 2) return;
  for (const sign of [-1, 1]) {
    const z = sign * b;
    const ranges =
      sign === 1 && gap
        ? [
            [-a, -gap],
            [gap, a],
          ]
        : [[-a, a]];
    for (const [start, end] of ranges) {
      box(out, 'stone', 'pale', p, start, end, y + 0.62, y + 0.78, z - 0.13, z + 0.13);
      const n = Math.max(1, Math.ceil((end - start) / 2.2));
      for (let i = 0; i <= n; i++) {
        const x = mix(start, end, i / n);
        box(out, 'stone', 'pale', p, x - 0.105, x + 0.105, y, y + 0.8, z - 0.105, z + 0.105);
      }
    }
  }
}
function hipRoof(out, p, { a, b, y, rise, primary, tile, tint, edge }, d) {
  const detail = primary ? d : Math.max(0, d - 1);
  const steps =
    detail === 0
      ? [0, 1]
      : detail === 1
        ? [0, 0.22, 1]
        : detail === 2
          ? [0, 0.15, 0.55, 1]
          : [0, 0.12, 0.37, 0.68, 1];
  const divisions = detail >= 3 ? 4 : detail === 2 ? 2 : 1;
  const ridge = Math.max(a * 0.26, a - b * 0.69);
  const profile = (side, t, u) => {
    const ring = corners(mix(a, ridge, u), b * (1 - u));
    const A = ring[side],
      B = ring[(side + 1) % 4];
    const lift =
      detail === 0 ? 0 : Math.min(0.55, b * 0.11) * Math.pow(Math.abs(t * 2 - 1), 3) * (1 - u);
    return p(
      mix(A[0], B[0], t),
      y + rise * Math.pow(u, detail === 0 ? 1 : 1.36) + lift,
      mix(A[1], B[1], t),
    );
  };
  for (let side = 0; side < 4; side++) {
    for (let j = 0; j + 1 < steps.length; j++)
      for (let k = 0; k < divisions; k++) {
        const [u, v] = [steps[j], steps[j + 1]],
          [a, b] = [k / divisions, (k + 1) / divisions];
        face(
          out,
          tile,
          j === 0 && steps.length > 2 ? edge : tint,
          [profile(side, a, u), profile(side, b, u), profile(side, b, v), profile(side, a, v)],
          up,
        );
      }
    if (d >= 2)
      for (let k = 0; k < divisions; k++) {
        const u = k / divisions,
          v = (k + 1) / divisions,
          A = profile(side, u, 0),
          B = profile(side, v, 0);
        const lower = ([x, y, z]) => [x, y - 0.22, z];
        const normal = direction(p, sideNormal(corners(a, b)[side], corners(a, b)[(side + 1) % 4]));
        face(out, 'timber', 'pine', [A, B, lower(B), lower(A)], normal);
        triangle(out, 'timber', 'soffit', [lower(A), lower(B), p(0, y - 0.25, 0)], [0, -1, 0]);
      }
    if (primary && d >= 3) {
      const rafterCount = Math.ceil((side % 2 === 0 ? 2 * a : 2 * b) / 0.67);
      for (let i = 1; i < rafterCount; i++) {
        const t = i / rafterCount,
          w = 0.1 / rafterCount;
        const A = profile(side, t - w, 0),
          B = profile(side, t + w, 0);
        const q = ([x, y, z], down) => [x, y - down, z];
        face(
          out,
          'timber',
          i % 3 === 0 ? 'gold' : 'red',
          [q(A, 0.23), q(B, 0.23), q(B, 0.1), q(A, 0.1)],
          direction(p, sideNormal(corners(a, b)[side], corners(a, b)[(side + 1) % 4])),
        );
      }
    }
    if (primary && d >= 3) {
      const n = Math.min(28, Math.ceil((side % 2 === 0 ? 2 * a : 2 * b) / 0.75));
      for (let i = 1; i < n; i++)
        for (let j = 1; j + 1 < steps.length; j++) {
          const t = i / n,
            w = 0.027 / n,
            [u, v] = [steps[j], steps[j + 1]];
          const rib = (t, u) => {
            const p = profile(side, t, u);
            p[1] += 0.045;
            return p;
          };
          face(out, tile, tint, [rib(t - w, u), rib(t + w, u), rib(t + w, v), rib(t - w, v)], up);
        }
    }
  }
  if (d === 1 && primary)
    face(
      out,
      'timber',
      'soffit',
      corners(a, b).map(([x, z]) => p(x, y - 0.045, z)),
      [0, -1, 0],
    );
  if (d >= 2 && (primary || d === 4)) {
    box(
      out,
      tile,
      edge,
      p,
      -ridge - 0.1,
      ridge + 0.1,
      y + rise - 0.05,
      y + rise + 0.16,
      -0.13,
      0.13,
    );
    if (primary)
      for (const side of [-1, 1]) {
        const q = p(side * ridge, y + rise + 0.26, 0);
        sphere(out, 'bronze', q, [0.26, 0.36, 0.18], colors.cast, d >= 3 ? 10 : 6, d >= 3 ? 6 : 4);
      }
  }
}
function façade(
  out,
  p,
  a,
  b,
  y,
  h,
  bays,
  d,
  { gate = false, green = false, recess = false, major = false, balcony = false } = {},
) {
  const wallSlot = green ? 'timber' : 'plaster',
    wallTint = green ? 'greenWall' : 'wall',
    post = green ? 'pine' : 'vermilion';
  if (!gate && d === 0) {
    walls(out, wallSlot, wallTint, corners(a, b), y, y + h, p);
    return;
  }
  for (const sign of [-1, 1]) {
    const z = sign * b,
      detail = d >= 2 && (major || sign === 1);
    if (d === 0) {
      panel(out, wallSlot, wallTint, p, -a, -a / bays, y, y + h, z, sign);
      panel(out, wallSlot, wallTint, p, a / bays, a, y, y + h, z, sign);
      panel(out, 'timber', 'pine', p, -a / bays, a / bays, y + h * 0.77, y + h, z, sign);
      continue;
    }
    for (let i = 0; i < bays; i++) {
      const x0 = mix(-a, a, i / bays),
        x1 = mix(-a, a, (i + 1) / bays),
        span = x1 - x0;
      const opening = gate && i === Math.floor(bays / 2);
      const inset = recess ? 0.3 : 0.09,
        w = 0.18 * span;
      const tint = opening
        ? 'redShadow'
        : green
          ? 'pine'
          : balcony
            ? 'door'
            : major
              ? 'amberDoor'
              : 'redShadow';
      if (!opening) {
        panel(out, wallSlot, wallTint, p, x0, x0 + w, y, y + h, z, sign);
        panel(out, wallSlot, wallTint, p, x1 - w, x1, y, y + h, z, sign);
        panel(out, 'timber', tint, p, x0 + w, x1 - w, y, y + h * 0.77, z - inset * sign, sign);
        if (detail) {
          for (const [x, n] of [
            [x0 + w, 1],
            [x1 - w, -1],
          ]) {
            face(
              out,
              'timber',
              post,
              [
                p(x, y, z),
                p(x, y, z - inset * sign),
                p(x, y + h * 0.77, z - inset * sign),
                p(x, y + h * 0.77, z),
              ],
              direction(p, [n, 0, 0]),
            );
          }
          const x = (x0 + x1) / 2;
          panel(
            out,
            'timber',
            post,
            p,
            x - 0.034,
            x + 0.034,
            y,
            y + h * 0.77,
            z - inset * 0.55 * sign,
            sign,
          );
          panel(
            out,
            'timber',
            green ? 'teal' : 'lattice',
            p,
            x0 + w,
            x1 - w,
            y + h * 0.55,
            y + h * 0.61,
            z - inset * 0.55 * sign,
            sign,
          );
          if (d >= 3 && major)
            for (let k = 1; k <= (balcony ? 10 : 6); k++) {
              const q = mix(x0 + w, x1 - w, k / (balcony ? 11 : 7));
              panel(
                out,
                'timber',
                balcony ? 'rail' : 'lattice',
                p,
                q - 0.024,
                q + 0.024,
                y + h * (balcony ? 0.18 : 0.58),
                y + h * 0.77,
                z - inset * 0.53 * sign,
                sign,
              );
            }
        }
      } else {
        for (const [x, n] of [
          [x0, 1],
          [x1, -1],
        ]) {
          face(
            out,
            'timber',
            'redShadow',
            [
              p(x, y, z),
              p(x, y, z - sign * 0.35),
              p(x, y + h * 0.77, z - sign * 0.35),
              p(x, y + h * 0.77, z),
            ],
            direction(p, [n, 0, 0]),
          );
        }
      }
      panel(out, 'timber', green ? 'teal' : 'pine', p, x0, x1, y + h * 0.77, y + h, z, sign);
      if (detail) {
        const w = Math.min(0.17, span * 0.08);
        box(out, 'timber', post, p, x0 - w, x0 + w, y, y + h, z - 0.17, z + 0.17);
        if (major && d >= 3) {
          for (let k = 0; k < 3; k++) {
            const ledge = (k + 1) * 0.09,
              at = y + h - 0.25 + k * 0.077;
            box(
              out,
              'timber',
              k === 1 ? 'gold' : 'teal',
              p,
              x0 - w - ledge * 0.42,
              x0 + w + ledge * 0.42,
              at,
              at + 0.064,
              z - ledge,
              z + ledge,
            );
          }
          const center = (x0 + x1) / 2;
          panel(
            out,
            'timber',
            'gold',
            p,
            center - span * 0.34,
            center + span * 0.34,
            y + h * 0.88,
            y + h * 0.9,
            z + 0.034 * sign,
            sign,
          );
          for (let k = 1; k <= 5; k++) {
            const x = mix(x0, x1, k / 6);
            panel(
              out,
              'timber',
              k % 2 ? 'jade' : 'gold',
              p,
              x - 0.053,
              x + 0.053,
              y + h * 0.84,
              y + h * 0.945,
              z + 0.037 * sign,
              sign,
            );
          }
        }
      }
    }
    if (d >= 1)
      panel(
        out,
        'timber',
        green ? 'jade' : 'teal',
        p,
        -a,
        a,
        y + h - 0.14,
        y + h + 0.06,
        z + 0.015 * sign,
        sign,
      );
    if (detail) box(out, 'timber', post, p, a - 0.12, a + 0.12, y, y + h, z - 0.16, z + 0.16);
  }
  for (const sign of [-1, 1]) {
    const x = a * sign;
    face(
      out,
      wallSlot,
      wallTint,
      [p(x, y, -b), p(x, y, b), p(x, y + h, b), p(x, y + h, -b)],
      direction(p, [sign, 0, 0]),
    );
  }
}
function simple(out, b, d) {
  const p = frame(b),
    a = b.width / 2,
    c = b.depth / 2,
    y = b.floor;
  const banner = b.role.startsWith('banner'),
    tall = b.role === 'tower',
    rear = b.role === 'eastRear',
    wing = b.role === 'libraryWing';
  const hall = b.role === 'inner' || b.role === 'shrine',
    major = banner || tall || hall || rear;
  const h = tall ? 5.65 : banner ? 3.25 : hall ? 3.9 : rear ? 3.35 : 2.7;
  const rise = tall ? 3.8 : banner ? 2.55 : Math.min(2.8, 1.7 + c * 0.1);
  const tile = tall || hall ? 'tile' : 'clay',
    tint = tall || hall ? 'yellow' : wing ? 'darkRoof' : 'grayRoof';
  const edge = wing ? 'greenRoof' : tall || hall ? 'greenRoof' : 'ridge';
  if (d === 0 && !major) {
    hipRoof(
      out,
      p,
      { a, b: c, y: y + 0.8, rise: h + rise - 0.8, primary: false, tile, tint, edge },
      d,
    );
    return;
  }
  if (d >= 1 && major && b.role !== 'inner') footing(out, p, a * 0.91, c * 0.9, y, d);
  const bottom = d === 0 && b.role !== 'inner' ? y - 0.55 : y;
  façade(
    out,
    p,
    a * 0.8,
    c * 0.72,
    bottom,
    h + (y - bottom),
    banner ? 3 : Math.min(7, Math.max(1, Math.round(a / 2.8) | 1)),
    major ? d : 0,
    { green: wing, major: d >= 3 && banner },
  );
  hipRoof(
    out,
    p,
    { a, b: c, y: y + h, rise, primary: d >= 2 && (banner || tall), tile, tint, edge },
    d,
  );
  if (banner && d >= 2) stairs(out, p, a * 0.58, c * 0.73, c * 0.9, y, d);
}
function irregular(out, b, d) {
  const p = frame(b),
    [cx, cz] = b.center;
  const ring = b.outline.map(([x, z]) => [x - cx, z - cz]);
  const base = b.floor,
    h = b.role === 'theater' ? 3.15 : 2.65;
  const inner = ring.map(([x, z]) => {
    const w = b.width / 2,
      c = b.depth / 2;
    const f = w < c ? [0.52, 0.88] : [0.88, 0.52];
    return [x * f[0], z * f[1]];
  });
  const minEdge = ring.map((a, i) =>
    Math.hypot(...a.map((v, j) => v - ring[(i + 1) % ring.length][j])),
  );
  if (d === 0) {
    plane(out, 'clay', 'grayRoof', ring, base + h + 0.85, p);
    if (b.role === 'theater') walls(out, 'plaster', 'wall', ring, base, base + h + 0.85, p);
    return;
  }
  const flat = b.role === 'corridor' || b.role === 'theater';
  const roof = ring.map(([x, z], i) => (flat ? [x, z] : inner[i]));
  walls(out, 'plaster', 'wall', ring, (x, z) => ground(x, z) - 0.25, base + h, p);
  if (!flat) {
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      face(
        out,
        'clay',
        'grayRoof',
        [
          p(...at(ring[i], base + h)),
          p(...at(ring[j], base + h)),
          p(...at(inner[j], base + h + 1.65)),
          p(...at(inner[i], base + h + 1.65)),
        ],
        up,
      );
    }
  }
  if (flat) {
    const rise = b.role === 'theater' ? 1.92 : 1.48;
    const original = earcut(roof.flat(), [], 2);
    for (let i = 0; i < original.length; i += 3) {
      const pts = original.slice(i, i + 3).map((k) => roof[k]),
        mid = pts.reduce(([x, z], [a, b]) => [x + a / 3, z + b / 3], [0, 0]);
      for (let j = 0; j < 3; j++)
        triangle(
          out,
          'clay',
          j === 1 ? 'greenRoof' : 'grayRoof',
          [
            p(...at(pts[j], base + h)),
            p(...at(pts[(j + 1) % 3], base + h)),
            p(...at(mid, base + h + rise)),
          ],
          up,
        );
    }
    if (d >= 2)
      for (let i = 0; i < ring.length; i++) {
        if (minEdge[i] < 3) continue;
        const a = ring[i],
          v = ring[(i + 1) % ring.length];
        face(
          out,
          'timber',
          'teal',
          [
            p(...at(a, base + h - 0.27)),
            p(...at(v, base + h - 0.27)),
            p(...at(v, base + h + 0.005)),
            p(...at(a, base + h + 0.005)),
          ],
          direction(p, sideNormal(a, v)),
        );
      }
  } else plane(out, 'clay', 'greenRoof', roof, base + h + 1.65, p);
}
function hall(out, b, d) {
  const p = frame(b),
    a = b.width / 2,
    c = b.depth / 2,
    y = b.floor;
  const library = b.role === 'library',
    qingning = b.role === 'qingning',
    h = library ? 4.25 : qingning ? 4.65 : 5.0;
  const theme = library
    ? { tile: 'tile', tint: 'darkRoof', edge: 'greenRoof' }
    : { tile: 'tile', tint: 'yellow', edge: 'greenRoof' };
  footing(out, p, a * 0.99, c * 0.92, y, d);
  façade(out, p, a * 0.82, c * 0.68, y, h, 5, d, { green: library, recess: true, major: true });
  hipRoof(
    out,
    p,
    { a, b: c, y: y + h, rise: library ? 1.35 : qingning ? 3.3 : 4.05, primary: true, ...theme },
    d,
  );
  if (library) {
    façade(out, p, a * 0.77, c * 0.62, y + h + 0.64, 3.0, 5, d, {
      green: true,
      recess: true,
      major: true,
    });
    hipRoof(
      out,
      p,
      { a: a * 0.91, b: c * 0.83, y: y + h + 3.64, rise: 3.6, primary: true, ...theme },
      d,
    );
  }
  stairs(out, p, a * (library ? 0.62 : 1.18), c * 0.89, c + 0.85, y, d);
  balustrade(out, p, a * 0.91, c * 0.87, y, d, a * 0.59);
}
function gate(out, b, d) {
  const p = frame(b),
    a = b.width / 2,
    c = b.depth / 2,
    y = b.floor - 0.35;
  const middle = a * 0.605,
    side = (a - middle) / 2;
  const main = { tile: 'tile', tint: 'yellow', edge: 'greenRoof' };
  façade(out, p, middle * 0.92, c * 0.78, y, 5.15, 5, d, { gate: true, recess: true, major: true });
  hipRoof(out, p, { a: middle, b: c, y: y + 5.15, rise: 3.65, primary: true, ...main }, d);
  for (const sign of [-1, 1]) {
    const q = (x, y, z) => p(x + sign * (middle + side), y, z);
    façade(out, q, side * 0.93, c * 0.62, y, 3.65, 3, d, { major: true });
    hipRoof(
      out,
      q,
      { a: side + 0.05, b: c * 0.73, y: y + 3.65, rise: 2.25, primary: false, ...main },
      d,
    );
  }
}
function phoenix(out, b, d) {
  const p = frame(b),
    a = b.width / 2,
    c = b.depth / 2,
    y = b.floor;
  const style = { tile: 'tile', tint: 'yellow', edge: 'greenRoof' };
  const width = 3.5,
    front = c * 0.84,
    back = -c * 0.78;
  const groundPoint = p(0, 0, front + 9),
    g = ground(groundPoint[0], groundPoint[2]) - 0.25;
  for (const sign of [-1, 1]) {
    const [x0, x1] = sign === 1 ? [width / 2, a * 1.05] : [-a * 1.05, -width / 2];
    box(out, 'brick', 'grayBrick', p, x0, x1, g, y, back, front + 0.3);
    const x = sign * width * 0.61;
    if (d >= 1)
      for (let i = 0; i < 7; i++) {
        const a = i / 7,
          z = mix(front, front + 10, a);
        box(
          out,
          'stone',
          'footing',
          p,
          x - 0.15,
          x + 0.15,
          g,
          mix(y, g, a) + 0.35,
          z,
          mix(front, front + 10, (i + 1) / 7),
        );
      }
  }
  stairs(out, p, width, front, front + 10, y, d);
  const stories =
    d === 0
      ? [
          [0.93, 0.88, 3.6, 1.5],
          [0.76, 0.72, 5.0, 2.9],
        ]
      : [
          [0.93, 0.9, 3.2, 1.42],
          [0.83, 0.81, 2.77, 1.37],
          [0.75, 0.73, 2.8, 3.12],
        ];
  let base = y;
  for (let i = 0; i < stories.length; i++) {
    const [w, v, h, rise] = stories[i];
    façade(out, p, a * w * 0.78, c * v * 0.75, base, h, 5, d, {
      gate: i === 0,
      major: true,
      recess: true,
      balcony: i > 0,
    });
    if (i > 0 && d >= 1)
      box(
        out,
        'timber',
        'soffit',
        p,
        -a * w * 0.93,
        a * w * 0.93,
        base - 0.22,
        base,
        c * v * -0.87,
        c * v * 0.87,
      );
    if (i > 0 && d >= 2)
      for (const sign of [-1, 1]) {
        const z = sign * c * v * 0.83;
        box(
          out,
          'timber',
          'rail',
          p,
          -a * w * 0.88,
          a * w * 0.88,
          base + 0.42,
          base + 0.56,
          z - 0.09,
          z + 0.09,
        );
        for (let k = 0; k <= 10; k++) {
          const x = mix(-a * w * 0.86, a * w * 0.86, k / 10);
          box(out, 'timber', 'red', p, x - 0.062, x + 0.062, base, base + 0.55, z - 0.07, z + 0.07);
        }
      }
    hipRoof(out, p, { a: a * w, b: c * v, y: base + h, rise, primary: true, ...style }, d);
    base += h + rise * 0.61;
  }
}
function octagon(out, b, d) {
  const [cx, cz] = b.center,
    ring = b.outline.map(([x, z]) => [x - cx, z - cz]);
  const p = frame(b),
    y = b.floor;
  const scale = (f) => ring.map(([x, z]) => [x * f, z * f]);
  const base = scale(1.08);
  walls(out, 'stone', 'footing', base, (x, z) => ground(x, z) - 0.4, y, p);
  plane(out, 'stone', 'stone', base, y, p);
  stairs(out, p, 7, b.depth * 0.41, b.depth * 0.56 + 2.35, y, d);
  const body = scale(0.64),
    h = 4.25;
  walls(out, 'plaster', 'wall', body, y, y + h, p);
  if (d >= 1)
    for (let i = 0; i < ring.length; i++) {
      const A = body[i],
        B = body[(i + 1) % body.length],
        n = sideNormal(A, B);
      const q = (u, h) =>
        p(mix(A[0], B[0], u) + n[0] * 0.006, h, mix(A[1], B[1], u) + n[2] * 0.006);
      face(
        out,
        'timber',
        'amberDoor',
        [q(0.12, y + 0.22), q(0.88, y + 0.22), q(0.88, y + 3.67), q(0.12, y + 3.67)],
        n,
      );
      for (const t of d >= 3 ? [0.25, 0.5, 0.75] : [0.5]) {
        face(
          out,
          'timber',
          'red',
          [
            q(t - 0.019, y + 0.22),
            q(t + 0.019, y + 0.22),
            q(t + 0.019, y + 3.67),
            q(t - 0.019, y + 3.67),
          ],
          n,
        );
      }
      const [x, z] = ring[i].map((v) => v * 0.87);
      const sides = d >= 3 ? 10 : 6;
      loft(
        out,
        'timber',
        [
          radialRing(y, 0.19, 0.19, sides, [x + cx, z + cz]),
          radialRing(y + h, 0.175, 0.175, sides, [x + cx, z + cz]),
        ],
        colors.vermilion,
        { cap: false },
      );
    }
  const tiers = [
    [1, y + h, 0.58, 2.62],
    [0.66, y + h + 2.55, 0.045, 4.15],
  ];
  for (const [outer, height, end, rise] of tiers) {
    const steps = d === 0 ? [0, 1] : d < 3 ? [0, 0.17, 1] : [0, 0.1, 0.32, 0.59, 1];
    const n = d >= 3 ? 5 : d === 2 ? 2 : 1;
    const point = (i, t, u) => {
      const A = ring[i],
        B = ring[(i + 1) % ring.length],
        f = mix(outer, end, u);
      const lifted = d >= 1 ? 0.44 * Math.pow(Math.abs(t * 2 - 1), 3) * (1 - u) : 0;
      return p(
        f * mix(A[0], B[0], t),
        height + rise * Math.pow(u, d === 0 ? 1 : 1.36) + lifted,
        f * mix(A[1], B[1], t),
      );
    };
    for (let i = 0; i < ring.length; i++)
      for (let j = 0; j + 1 < steps.length; j++)
        for (let k = 0; k < n; k++) {
          const t = k / n,
            v = (k + 1) / n,
            [u, w] = [steps[j], steps[j + 1]];
          face(
            out,
            'tile',
            j === 0 && d > 0 ? 'greenRoof' : 'yellow',
            [point(i, t, u), point(i, v, u), point(i, v, w), point(i, t, w)],
            up,
          );
        }
  }
  const top = y + h + 6.7,
    sides = d >= 3 ? 16 : d === 0 ? 4 : 8;
  const cap =
    d === 0
      ? [
          [top - 0.23, 0.56],
          [top + 1.04, 0.07],
        ]
      : [
          [top - 0.23, 0.56],
          [top + 0.24, 0.48],
          [top + 0.8, 0.19],
          [top + 1.04, 0.07],
        ];
  loft(
    out,
    'bronze',
    cap.map(([y, r]) => radialRing(y, r, r, sides, b.center)),
    colors.cast,
  );
}
function terrace(out, d) {
  const { outline, top } = layout.terrace;
  walls(out, 'brick', 'grayBrick', outline, (x, z) => ground(x, z) - 0.5, top);
  plane(out, 'stone', 'stone', outline, top);
  const front = outline[2][1],
    cx = layout.principal.phoenix.center[0],
    gate = 2.18;
  for (const [x0, x1] of [
    [outline[0][0], cx - gate],
    [cx + gate, outline[1][0]],
  ]) {
    box(
      out,
      'plaster',
      'wall',
      identity,
      x0,
      x1,
      top - 0.05,
      top + 1.42,
      front - 0.61,
      front - 0.1,
    );
    if (d >= 2) {
      box(
        out,
        'tile',
        'greenRoof',
        identity,
        x0 - 0.1,
        x1 + 0.1,
        top + 1.4,
        top + 1.57,
        front - 0.73,
        front + 0.02,
      );
      const x = x0 < cx ? x1 : x0;
      box(
        out,
        'brick',
        'shadeBrick',
        identity,
        x - 0.19,
        x + 0.19,
        top - 0.04,
        top + 1.77,
        front - 0.69,
        front + 0.06,
      );
    }
  }
  if (d >= 2) {
    const [a, b, c, e] = outline;
    for (const [p, q] of [
      [a, b],
      [b, c],
      [e, a],
    ]) {
      const x0 = Math.min(p[0], q[0]) - 0.08,
        x1 = Math.max(p[0], q[0]) + 0.08;
      const z0 = Math.min(p[1], q[1]) - 0.08,
        z1 = Math.max(p[1], q[1]) + 0.08;
      box(out, 'brick', 'shadeBrick', identity, x0, x1, top - 0.04, top + 0.76, z0, z1);
    }
  }
}
export function buildPalaceLevel(out, level) {
  const d = levels[level];
  if (d === undefined) throw Error(`Unknown palace level ${level}`);
  terrace(out, d);
  for (const b of layout.buildings) {
    switch (b.role) {
      case 'octagon':
        octagon(out, b, d);
        break;
      case 'phoenix':
        phoenix(out, b, d);
        break;
      case 'gate':
        gate(out, b, d);
        break;
      case 'chongzheng':
      case 'qingning':
      case 'library':
        hall(out, b, d);
        break;
      case 'theater':
      case 'corridor':
        irregular(out, b, d);
        break;
      default:
        if (b.outline.length > 4) irregular(out, b, d);
        else simple(out, b, d);
    }
  }
}
export const buildSkyline = (out) => buildPalaceLevel(out, 'skyline');
export const buildDistrict = (out) => buildPalaceLevel(out, 'district');
export const buildStreet = (out) => buildPalaceLevel(out, 'street');
export const buildCloseup = (out) => buildPalaceLevel(out, 'closeup');
export const buildMaster = (out) => buildPalaceLevel(out, 'master');
