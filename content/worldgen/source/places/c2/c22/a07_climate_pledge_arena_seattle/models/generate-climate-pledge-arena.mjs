/**
 * Climate Pledge Arena (the 1962 Washington State Coliseum, rebuilt below grade 2018-2021): the
 * preserved square hyperbolic-paraboloid roof, four hypar quadrants between two cardinal main
 * trusses that rise from the facade midpoints to the apex monitor, with the white post-tensioned
 * concrete edge beam sloping from each facade's centred three-legged abutment down to the low
 * corners; the recessed glass curtain wall under the overhang, the V-shaped piers between the
 * abutments, the apex monitor with its rooftop signs, and the 2021 south atrium with its
 * glazed and solar roof. Plan from the mapped roof square in footprint.json (+X east, +Z south).
 */
import { emitPlaceMaster } from '../../../../../../../../packages/worldgen/scripts/place-master-emitter.mjs';
import {
  facade,
  fbox,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const col = {
  roof: rgb('c3c8ca'),
  edge: rgb('dcdeda'),
  edgeShade: rgb('cfd1cd'),
  truss: rgb('4b6467'),
  glass: rgb('3f4b53'),
  louver: rgb('6a7377'),
  mullion: rgb('4a5357'),
  monitor: rgb('cdd1d2'),
  green: rgb('35a84a'),
  blue: rgb('2f6fc4'),
  signFrame: rgb('6b7276'),
  solar: rgb('27303c'),
  skylight: rgb('8fb0c0'),
  atriumFrame: rgb('d6d8d5'),
};
const surfaces = {
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.45, metallic: 0.45 },
  edge: { slot: 'wall', graph: 'concrete_plain', roughness: 0.85, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.55, metallic: 0.3 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.18, metallic: 0.3 },
  solar: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.3, metallic: 0.2 },
  sign: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.5, metallic: 0.05 },
};

// Mapped roof square (feature 35184783610349): x -61.26..61.71, z -62.19..62.18.
const cx = 0.22,
  cz = 0;
const Rx = 61.5,
  Rz = 62.2;
// Plaza datum: the explorer ground sits 2-6 m above the anchor around the building (the
// anchor's ground is the flattened arena floor), so heights are measured from y = 3.5.
const P = 3.5;
const hC = 34.0; // roof skin at the apex (115 ft clear above the original floor)
const hM = 16.5; // edge beam top at each facade midpoint, over the abutment
const hK = 11.5; // edge beam top at the low corners
const band = 8.0; // white edge-beam band (30 ft edge beams)
const fasciaIn = 0.9; // fascia leans in this much at its foot
const G = 4.8; // curtain wall line, inset from the roof edge
const soffitDrop = 2.3; // edge beam depth at the curtain wall line
const base = -1.2; // walls and legs run below the lowest ground (-0.1)

const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const lerp = (a, b, t) => a + (b - a) * t;

/** Triangle oriented so its normal points along `want`. */
function triTo(out, slot, a, b, c, color, want) {
  if (dot(cross(sub(b, a), sub(c, a)), want) >= 0) tri(out, slot, a, b, c, color);
  else tri(out, slot, a, c, b, color);
}
/** Quad (possibly non-planar) as two triangles facing `want`. */
function quadTo(out, slot, a, b, c, d, color, want) {
  triTo(out, slot, a, b, c, color, want);
  triTo(out, slot, a, c, d, color, want);
}
/** Convex hexahedron from 4 bottom and 4 top corners (same order); faces point away from its centre. */
function hexa(out, slot, lo, hi, color) {
  const all = [...lo, ...hi];
  const centre = [0, 1, 2].map((k) => all.reduce((s, p) => s + p[k], 0) / all.length);
  const face = (pts) => {
    const mid = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length);
    quadTo(out, slot, ...pts, color, sub(mid, centre));
  };
  face([lo[0], lo[1], lo[2], lo[3]]);
  face([hi[0], hi[1], hi[2], hi[3]]);
  for (let i = 0; i < 4; i++) face([lo[i], lo[(i + 1) % 4], hi[(i + 1) % 4], hi[i]]);
}
/** Square-section strut from a to b; `side` is a horizontal unit vector for its width. */
function strut(out, slot, a, b, width, depth, color, side) {
  const axis = sub(b, a);
  const len = Math.hypot(...axis);
  const t = axis.map((v) => v / len);
  const w = [side[0], 0, side[1]];
  const dvec = cross(t, w);
  const dn = Math.hypot(...dvec);
  const d = dvec.map((v) => v / dn);
  const ring = (p) =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => p.map((v, k) => v + (w[k] * i * width) / 2 + (d[k] * j * depth) / 2));
  hexa(out, slot, ring(a), ring(b), color);
}

/** Roof surface height: four bilinear (hyperbolic-paraboloid) quadrants. */
function hyp(x, z) {
  const u = Math.min(1, Math.abs(x - cx) / Rx),
    v = Math.min(1, Math.abs(z - cz) / Rz);
  return hC * (1 - u) * (1 - v) + hM * (u * (1 - v) + v * (1 - u)) + hK * u * v;
}
/** Grid stations along one axis: the edge band, then six cells in to the crease at 0. */
function stations(R) {
  const a = -1 + band / R;
  const half = [-1, a];
  for (let i = 1; i <= 6; i++) half.push(a * (1 - i / 7));
  half.push(0);
  return [
    ...half,
    ...half
      .slice(0, -1)
      .reverse()
      .map((v) => -v),
  ];
}
const sx = stations(Rx),
  sz = stations(Rz);
const n = sx.length - 1;

const sides = [
  { name: 'north', out: [0, -1], params: sx.map((s) => [s, -1]) },
  { name: 'east', out: [1, 0], params: sz.map((s) => [1, s]) },
  { name: 'south', out: [0, 1], params: sx.map((s) => [-s, 1]) },
  { name: 'west', out: [-1, 0], params: sz.map((s) => [-1, -s]) },
];
const ringPoint = ([px, pz], inset) => [cx + px * (Rx - inset), cz + pz * (Rz - inset)];
const fasciaDepth = (along) => 2.4 + 0.6 * (1 - Math.abs(along));
const glassTop = (x, z) => hyp(x, z) - soffitDrop;

/** Underside of the overhang at plan point (x, z) near the side with outward `o`. */
function soffitY(x, z, o) {
  const along = o[0] !== 0 ? (z - cz) / Rz : (x - cx) / Rx;
  const inset = o[0] !== 0 ? Rx - Math.abs(x - cx) : Rz - Math.abs(z - cz);
  const edge = o[0] !== 0 ? [cx + o[0] * Rx, z] : [x, cz + o[1] * Rz];
  const fb = hyp(edge[0], edge[1]) - fasciaDepth(along);
  const gl = glassTop(edge[0] - o[0] * G, edge[1] - o[1] * G);
  return lerp(fb, gl, Math.max(0, Math.min(1, (inset - fasciaIn) / (G - fasciaIn))));
}

function roof(out) {
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const p = (a, b) => {
        const x = cx + sx[a] * Rx,
          z = cz + sz[b] * Rz;
        return [x, hyp(x, z), z];
      };
      const edge = i === 0 || j === 0 || i === n - 1 || j === n - 1;
      const slot = edge ? 'edge' : 'roof';
      const color = edge ? col.edge : col.roof;
      // Split each cell along the diagonal that points at the apex, so the quadrant creases
      // stay on the main trusses and the sag reads along the diagonals.
      const a = p(i, j),
        b = p(i + 1, j),
        c = p(i + 1, j + 1),
        d = p(i, j + 1);
      const towardApex = i < n / 2 === j < n / 2;
      if (towardApex) {
        triTo(out, slot, a, b, c, color, [0, 1, 0]);
        triTo(out, slot, a, c, d, color, [0, 1, 0]);
      } else {
        triTo(out, slot, a, b, d, color, [0, 1, 0]);
        triTo(out, slot, b, c, d, color, [0, 1, 0]);
      }
    }
}

/** Edge-beam fascia and soffit, the recessed curtain wall with its louver band and mullions. */
function perimeter(out) {
  for (const side of sides) {
    const o = [side.out[0], 0, side.out[1]];
    const along = side.out[0] !== 0 ? (p) => p[1] : (p) => p[0];
    const pts = side.params.map((param) => {
      const [tx, tz] = ringPoint(param, 0);
      const top = [tx, hyp(tx, tz), tz];
      const [bx, bz] = ringPoint(param, fasciaIn);
      const fb = [bx, top[1] - fasciaDepth(along(param)), bz];
      const [gx, gz] = ringPoint(param, G);
      const gy = glassTop(gx, gz);
      return { top, fb, g: [gx, gy, gz], gLow: [gx, base, gz], gLouver: [gx, gy - 1.6, gz] };
    });
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i],
        b = pts[i + 1];
      quadTo(out, 'edge', a.top, b.top, b.fb, a.fb, col.edge, o);
      quadTo(out, 'edge', a.fb, b.fb, b.g, a.g, col.edgeShade, [0, -1, 0]);
      quadTo(out, 'glass', a.gLow, b.gLow, b.gLouver, a.gLouver, col.glass, o);
      const lift = (p) => [p[0] + o[0] * 0.06, p[1], p[2] + o[2] * 0.06];
      quadTo(out, 'metal', lift(a.gLouver), lift(b.gLouver), lift(b.g), lift(a.g), col.louver, o);
    }
    // Mullions every ~3.1 m and two transoms, drawn once along each wall.
    const start = ringPoint(side.params[0], G),
      end = ringPoint(side.params.at(-1), G);
    const len = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const F = facade(start, [end[0] - start[0], end[1] - start[1]]);
    const count = Math.round(len / 3.1);
    for (let k = 1; k < count; k++) {
      const u = (len * k) / count;
      const [x, , z] = F.P(u, 0, 0);
      if (side.name === 'south' && Math.abs(x - cx) < 54.3) continue;
      fbox(out, 'metal', F, u - 0.12, u + 0.12, base, glassTop(x, z) - 0.05, 0, 0.16, col.mullion);
    }
    for (const y of [P + 2.9, P + 5.9]) {
      if (side.name === 'south') {
        for (const [u0, u1] of [
          [0, 2.4],
          [len - 2.4, len],
        ])
          fbox(out, 'metal', F, u0, u1, y - 0.1, y + 0.1, 0, 0.14, col.mullion);
        continue;
      }
      fbox(out, 'metal', F, 0, len, y - 0.1, y + 0.1, 0, 0.14, col.mullion);
    }
  }
}

/** Raised dark truss strips along the four main trusses, apex monitor to the edge band. */
function trussStrips(out) {
  const half = 2.25;
  for (const [ax, az] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const R = ax !== 0 ? Rx : Rz;
    const r0 = 6.4,
      r1 = R - band - 0.2;
    const at = (r, s, lift) => {
      const x = cx + ax * r + az * s,
        z = cz + az * r + ax * s;
      return [x, hyp(x, z) + lift, z];
    };
    const sec = (r) => ({
      crest: at(r, 0, 0.85),
      l: at(r, -half, 0.3),
      r: at(r, half, 0.3),
      lb: at(r, -half, -0.15),
      rb: at(r, half, -0.15),
    });
    const a = sec(r0),
      b = sec(r1);
    const outward = [ax, 0, az];
    // `at` offsets s along (az, ax); the s < 0 wall faces the opposite way.
    const sideL = [-az, 0, -ax];
    quadTo(out, 'metal', a.l, b.l, b.crest, a.crest, col.truss, [sideL[0], 1, sideL[2]]);
    quadTo(out, 'metal', a.crest, b.crest, b.r, a.r, col.truss, [-sideL[0], 1, -sideL[2]]);
    quadTo(out, 'metal', a.lb, b.lb, b.l, a.l, col.truss, sideL);
    quadTo(
      out,
      'metal',
      a.r,
      b.r,
      b.rb,
      a.rb,
      col.truss,
      sideL.map((v) => -v),
    );
    for (const [s, dir] of [
      [b, outward],
      [a, outward.map((v) => -v)],
    ]) {
      quadTo(out, 'metal', s.lb, s.rb, s.r, s.l, col.truss, dir);
      triTo(out, 'metal', s.l, s.r, s.crest, col.truss, dir);
    }
  }
}

/** Three-legged abutment centred on a facade: two legs splayed along it, one thrown outward. */
function abutment(out, o) {
  const along = [o[1], -o[0]];
  const mid = [cx + o[0] * Rx, cz + o[1] * Rz];
  const apexXZ = [mid[0] - o[0] * 3.6, mid[1] - o[1] * 3.6];
  const ay = soffitY(apexXZ[0], apexXZ[1], o) + 0.3;
  const apex = [apexXZ[0], ay - 1.6, apexXZ[1]];
  const foot = (u, d) => [mid[0] + along[0] * u + o[0] * d, base, mid[1] + along[1] * u + o[1] * d];
  // Outward leg (the mapped 4.4 m part runs ~13.7 m past the roof edge).
  strut(out, 'edge', apex, foot(0, 13.6), 4.4, 2.6, col.edge, along);
  for (const s of [-1, 1]) strut(out, 'edge', apex, foot(s * 10.8, 0.4), 2.4, 2.8, col.edge, o);
  // Apex block under the edge beam.
  const F = facade([apexXZ[0], apexXZ[1]], along);
  fbox(out, 'edge', F, -3.0, 3.0, ay - 3.2, ay, -2.6, 2.6, col.edge);
}

/** V-shaped concrete piers between the abutments and under each corner. */
function piers(out) {
  const pier = (x, z, o) => {
    const footP = [x + o[0] * 1.7, base, z + o[1] * 1.7];
    for (const d of [0.5, 3.4]) {
      const tx = x + o[0] * d,
        tz = z + o[1] * d;
      const top = [tx, soffitY(tx, tz, o) + 0.25, tz];
      strut(out, 'edge', footP, top, 1.0, 1.0, col.edge, [o[1], -o[0]]);
    }
  };
  for (const side of sides) {
    const o = side.out;
    for (const u of [-38, -19, 19, 38]) {
      const along = [o[1], -o[0]];
      const [gx, gz] = [cx + o[0] * (Rx - G) + along[0] * u, cz + o[1] * (Rz - G) + along[1] * u];
      if (side.name === 'south') continue; // inside the atrium
      pier(gx, gz, o);
    }
  }
  // Corner piers lean out along the diagonal.
  for (const [px, pz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    const g = ringPoint([px, pz], G);
    const o = [px / Math.SQRT2, pz / Math.SQRT2];
    const footP = [g[0] + o[0] * 1.4, base, g[1] + o[1] * 1.4];
    for (const d of [0.6, 3.6]) {
      const [tx, tz] = ringPoint([px, pz], G - d * Math.SQRT1_2 * 1.0);
      const ty = Math.min(soffitY(tx, tz, [px, 0]), soffitY(tx, tz, [0, pz])) + 0.25;
      strut(out, 'edge', footP, [tx, ty, tz], 1.0, 1.0, col.edge, [o[1], -o[0]]);
    }
  }
}

// --- Rooftop monitor and signs ------------------------------------------------------------

const glyphs = {
  C: [
    [1, 1, 0, 1],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
  ],
  L: [
    [0, 1, 0, 0],
    [0, 0, 1, 0],
  ],
  I: [[0.5, 0, 0.5, 1]],
  M: [
    [0, 0, 0, 1],
    [0, 1, 0.5, 0.45],
    [0.5, 0.45, 1, 1],
    [1, 1, 1, 0],
  ],
  A: [
    [0, 0, 0.5, 1],
    [0.5, 1, 1, 0],
    [0.24, 0.4, 0.76, 0.4],
  ],
  T: [
    [0, 1, 1, 1],
    [0.5, 1, 0.5, 0],
  ],
  E: [
    [1, 1, 0, 1],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0.5, 0.8, 0.5],
  ],
  P: [
    [0, 0, 0, 1],
    [0, 1, 1, 1],
    [1, 1, 1, 0.5],
    [1, 0.5, 0, 0.5],
  ],
  D: [
    [0, 0, 0, 1],
    [0, 1, 0.65, 1],
    [0.65, 1, 1, 0.65],
    [1, 0.65, 1, 0.35],
    [1, 0.35, 0.65, 0],
    [0.65, 0, 0, 0],
  ],
  G: [
    [1, 1, 0, 1],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [1, 0, 1, 0.45],
    [1, 0.45, 0.55, 0.45],
  ],
  R: [
    [0, 0, 0, 1],
    [0, 1, 1, 1],
    [1, 1, 1, 0.5],
    [1, 0.5, 0, 0.5],
    [0.4, 0.5, 1, 0],
  ],
  N: [
    [0, 0, 0, 1],
    [0, 1, 1, 0],
    [1, 0, 1, 1],
  ],
};

/** Flat channel-letter stroke in a facade frame, (u, y) to (u, y), d0..d1 out from the plane. */
function stroke(out, F, u0, y0, u1, y1, w, d0, d1, color) {
  const len = Math.hypot(u1 - u0, y1 - y0);
  const tu = (u1 - u0) / len,
    ty = (y1 - y0) / len;
  const nu = -ty * (w / 2),
    ny = tu * (w / 2);
  const a0 = [u0 - (tu * w) / 2, y0 - (ty * w) / 2],
    a1 = [u1 + (tu * w) / 2, y1 + (ty * w) / 2];
  const corners = [
    [a0[0] + nu, a0[1] + ny],
    [a1[0] + nu, a1[1] + ny],
    [a1[0] - nu, a1[1] - ny],
    [a0[0] - nu, a0[1] - ny],
  ];
  hexa(
    out,
    'sign',
    corners.map(([u, y]) => F.P(u, y, d0)),
    corners.map(([u, y]) => F.P(u, y, d1)),
    color,
  );
}
function word(out, F, text, uCentre, y0, height, color) {
  const cw = height * 0.72,
    gap = height * 0.24;
  const total = text.length * cw + (text.length - 1) * gap;
  const w = height * 0.2;
  for (let i = 0; i < text.length; i++) {
    const u0 = uCentre - total / 2 + i * (cw + gap) + w / 2;
    const span = cw - w;
    for (const [a, b, c, d] of glyphs[text[i]])
      stroke(
        out,
        F,
        u0 + a * span,
        y0 + w / 2 + b * (height - w),
        u0 + c * span,
        y0 + w / 2 + d * (height - w),
        w,
        -0.12,
        0.12,
        color,
      );
  }
}

function monitor(out) {
  const h = 6.6;
  const y0 = 31.6,
    y1 = 36.6;
  const ring = [
    [cx - h, cz - h],
    [cx + h, cz - h],
    [cx + h, cz + h],
    [cx - h, cz + h],
  ];
  hexa(
    out,
    'metal',
    ring.map(([x, z]) => [x, y0, z]),
    ring.map(([x, z]) => [x, y1, z]),
    col.monitor,
  );
  for (const side of sides) {
    const o = side.out;
    const along = [o[1], -o[0]];
    const F = facade([cx + o[0] * h - along[0] * h, cz + o[1] * h - along[1] * h], along);
    // Louvered band around the monitor.
    fbox(out, 'metal', F, 0.4, 2 * h - 0.4, 33.4, 35.6, 0, 0.12, col.louver);
    // Sign frame on the monitor roof, set back from its edge, carrying the three words.
    const S = facade(
      [cx + o[0] * (h - 0.8) - along[0] * h, cz + o[1] * (h - 0.8) - along[1] * h],
      along,
    );
    for (const u of [1.6, 2 * h - 1.6])
      fbox(out, 'metal', S, u - 0.15, u + 0.15, y1, 41.4, -0.7, -0.4, col.signFrame);
    // Dark backing behind the letters, so the far sign never shows through mirrored.
    fbox(out, 'metal', S, 0.9, 2 * h - 0.9, y1 + 0.1, 41.5, -0.4, -0.2, col.mullion);
    word(out, S, 'ARENA', h, y1 + 0.25, 1.15, col.blue);
    word(out, S, 'PLEDGE', h, 38.5, 1.35, col.green);
    word(out, S, 'CLIMATE', h, 40.05, 1.35, col.green);
  }
}

/** 2021 south atrium: glass walls on the mapped outline, a solar roof and a glazed front band. */
function atrium(out) {
  const zb = cz + Rz - G;
  const xl = -54.26,
    xr = 54.62;
  const front = [
    [xl, 81.45],
    [0.36, 91.47],
    [xr, 81.37],
  ];
  const backY = (x) => glassTop(x, zb) - 0.08;
  const yFrontSide = P + 6.4,
    yFrontMid = P + 8.2;
  const B = [
    [xl, backY(xl), zb],
    [0.36, backY(0.36), zb],
    [xr, backY(xr), zb],
  ];
  const Fr = [
    [front[0][0], yFrontSide, front[0][1]],
    [front[1][0], yFrontMid, front[1][1]],
    [front[2][0], yFrontSide, front[2][1]],
  ];
  const mix = (p, q, t) => p.map((v, k) => lerp(v, q[k], t));
  for (const k of [0, 1]) {
    // Roof halves: solar behind, glazing toward the front edge.
    const [b0, b1, f0, f1] = [B[k], B[k + 1], Fr[k], Fr[k + 1]];
    for (const [t0, t1, slot, color] of [
      [0, 0.6, 'solar', col.solar],
      [0.6, 0.66, 'metal', col.atriumFrame],
      [0.66, 1, 'glass', col.skylight],
    ]) {
      const a = mix(b0, f0, t0),
        b = mix(b1, f1, t0),
        c = mix(b1, f1, t1),
        d = mix(b0, f0, t1);
      quadTo(out, slot, a, b, c, d, color, [0, 1, 0]);
    }
  }
  // Walls: the two front faces and the two sides, glass with a light fascia and mullions.
  const walls = [
    [[xl, zb], front[0], B[0][1], yFrontSide],
    [front[0], front[1], yFrontSide, yFrontMid],
    [front[1], front[2], yFrontMid, yFrontSide],
    [front[2], [xr, zb], yFrontSide, B[2][1]],
  ];
  for (const [p, q, yp, yq] of walls) {
    // Walk each wall so that facade()'s normal points away from the atrium's middle.
    const F0 = facade(p, [q[0] - p[0], q[1] - p[1]]);
    const midX = (p[0] + q[0]) / 2 - 0,
      midZ = (p[1] + q[1]) / 2 - 70;
    const keep = F0.normal[0] * midX + F0.normal[1] * midZ > 0;
    const [a, b, ya, yb] = keep ? [p, q, yp, yq] : [q, p, yq, yp];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const W = facade(a, [b[0] - a[0], b[1] - a[1]]);
    const yAt = (u) => lerp(ya, yb, u / len);
    const o = [W.normal[0], 0, W.normal[1]];
    quadTo(
      out,
      'glass',
      W.P(0, base, 0),
      W.P(len, base, 0),
      W.P(len, yAt(len) - 0.8, 0),
      W.P(0, yAt(0) - 0.8, 0),
      col.glass,
      o,
    );
    quadTo(
      out,
      'metal',
      W.P(0, yAt(0) - 0.8, 0.05),
      W.P(len, yAt(len) - 0.8, 0.05),
      W.P(len, yAt(len) + 0.05, 0.05),
      W.P(0, yAt(0) + 0.05, 0.05),
      col.atriumFrame,
      o,
    );
    const count = Math.max(1, Math.round(len / 3.0));
    for (let k = 1; k < count; k++) {
      const u = (len * k) / count;
      fbox(out, 'metal', W, u - 0.1, u + 0.1, base, yAt(u) - 0.8, 0, 0.14, col.atriumFrame);
    }
    fbox(out, 'metal', W, 0, len, P + 3.6, P + 3.8, 0, 0.14, col.atriumFrame);
  }
}

await emitPlaceMaster({
  generator: import.meta.url,
  planId: 'A07',
  title: 'Climate Pledge Arena, Seattle',
  wikidataId: 'Q977529',
  brief:
    "The 1962 Washington State Coliseum roof preserved over the 2021 arena: a 400 ft square hyperbolic-paraboloid roof in four pale standing-seam quadrants between two dark cardinal truss ridges rising to the apex monitor and its Climate Pledge Arena signs; a broad white concrete edge beam sloping from each facade's centred three-legged abutment down to the low corners; the recessed glass curtain wall under the overhang with V-shaped piers; and the 2021 glass-and-solar south atrium.",
  surfaces,
  build(out) {
    roof(out);
    perimeter(out);
    trussStrips(out);
    for (const side of sides) if (side.name !== 'south') abutment(out, side.out);
    piers(out);
    monitor(out);
    atrium(out);
  },
  dimensions: [
    {
      fact: 'Plan: the mapped OSM building 35184397212588 with its roof part 35184783610349 (the 123 x 124 m square), glass base 35185724736644, truss strips 35185724754940-943, apex monitor 35184783610363, abutment legs 35185724755821-823 and south atrium parts 35185724736639-643',
      source: 'footprint.json',
    },
    {
      fact: 'Hyperbolic paraboloid roof over a 400-foot-square column-free hall 115 feet high; post-tensioned concrete edge beams; four massive concrete abutments and V-shaped concrete piers',
      source:
        'https://www.seattle.gov/documents/Departments/economicDevelopment/KeyArena_Nomination_170330.pdf',
    },
    {
      fact: 'Four sets of three-legged abutments, one centred on each facade, carry the external edge beams and four triangular steel main trusses oriented to the cardinal directions; the glass curtain wall is recessed behind them beneath the overhanging roof; standing-seam aluminium roofing since 1995',
      source:
        'https://www.seattle.gov/documents/Departments/economicDevelopment/KeyArena_Nomination_170330.pdf',
    },
    {
      fact: '12-foot-deep main trusses divide the 400-foot square into four quadrants on buttresses at the midpoints of each wall; diagonal trusses follow the drape of the original cable net; edge beams 30 feet wide',
      source: 'https://www.djc.com/special/design95/10002590.htm',
    },
    {
      fact: 'Roof 110 feet (11 stories) high on four massive concrete abutments, 4-acre site',
      source: 'https://pcad.lib.washington.edu/building/5972/',
    },
    {
      fact: '2018-2021 redevelopment kept the 44-million-pound roof, curtain wall and exterior concrete elements; the roof was carried on temporary steel while the arena was excavated below it; south atrium added for the entrance',
      source: 'https://www.thorntontomasetti.com/project/climate-pledge-arena',
    },
  ],
  limitations: [
    'Roof heights are estimated: the apex from the 110-115 ft published height, the facade midpoints and low corners (about 13 m and 8 m above the plaza) from aerial photographs showing each facade edge falling from its abutment to the corners. The plaza datum is taken 3.5 m above the anchor because the explorer ground under the building is flattened to the arena floor.',
    'Each roof quadrant is an exact bilinear hyperbolic paraboloid on a 16 x 16 grid; the diamond seam pattern, gutters and rooftop equipment are omitted.',
    'The curtain wall is one glass face per bay with full-height mullions and two transoms; its alternating angled lites and the 1995 lower-level entrances are not modelled. The edge beam is a sloped fascia with a flat soffit.',
    'The south abutment and the curtain wall inside the 2021 atrium are omitted; the atrium roof is simplified to solar and glazed bands on two folded planes.',
    'Rooftop signs are block channel letters on a simple frame; the apex monitor is a plain louvered box.',
  ],
});
