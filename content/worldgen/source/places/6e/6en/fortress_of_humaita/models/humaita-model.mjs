/** Whole1867 fortress and connected Quadrilateral, using original plan-derived controls. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  D = P.dimensions;
export const surfaces = {
  earth: { slot: 'foundation', graph: 'earth_rammed', roughness: 0.98, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_weatherboard', roughness: 0.92, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.12 },
};
const C = {
  earth: rgb('8f8560'),
  brick: rgb('b77f5c'),
  plaster: rgb('e2d7bb'),
  roof: rgb('88644d'),
  wood: rgb('5c5442'),
  metal: rgb('3b403b'),
};
export const partEvidence = [],
  archEvidence = [],
  defenceEvidence = [];
let count = 0;
function T(o, k, p) {
  p = p.map((v) => v.map(Math.fround));
  const n = normalFor(...p);
  if (!n.every(Number.isFinite)) throw Error('Bad triangle');
  o.addTriangle(
    k,
    'palette:#ffffff',
    p,
    n,
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    C[k],
  );
  count++;
}
function face(o, k, p, n) {
  if (n && normalFor(...p).reduce((v, x, i) => v + x * n[i], 0) < 0) p = p.slice().reverse();
  for (let i = 1; i < p.length - 1; i++) T(o, k, [p[0], p[i], p[i + 1]]);
}
function pose(o, center, y, heading = P.heading) {
  const c = Math.cos(heading),
    s = Math.sin(heading),
    v = (p) => [center[0] + c * p[0] + s * p[2], y + p[1], center[1] - s * p[0] + c * p[2]];
  return {
    addTriangle(k, r, p, _n, uv, color) {
      const q = p.map(v);
      o.addTriangle(k, r, q, normalFor(...q), uv, color);
    },
  };
}
function box(o, k, x, y, z, w, h, d, closed = true) {
  const a = x - w / 2,
    b = x + w / 2,
    f = z - d / 2,
    g = z + d / 2,
    e = y + h;
  face(
    o,
    k,
    [
      [a, y, g],
      [b, y, g],
      [b, e, g],
      [a, e, g],
    ],
    [0, 0, 1],
  );
  face(
    o,
    k,
    [
      [a, y, f],
      [b, y, f],
      [b, e, f],
      [a, e, f],
    ],
    [0, 0, -1],
  );
  face(
    o,
    k,
    [
      [a, y, f],
      [a, y, g],
      [a, e, g],
      [a, e, f],
    ],
    [-1, 0, 0],
  );
  face(
    o,
    k,
    [
      [b, y, f],
      [b, y, g],
      [b, e, g],
      [b, e, f],
    ],
    [1, 0, 0],
  );
  if (closed) {
    face(
      o,
      k,
      [
        [a, e, f],
        [b, e, f],
        [b, e, g],
        [a, e, g],
      ],
      [0, 1, 0],
    );
    face(
      o,
      k,
      [
        [a, y, f],
        [b, y, f],
        [b, y, g],
        [a, y, g],
      ],
      [0, -1, 0],
    );
  }
}
function gable(o, x, z, w, d, y, h, k = 'roof') {
  face(
    o,
    'plaster',
    [
      [x - w / 2, y, z - d / 2],
      [x + w / 2, y, z - d / 2],
      [x, y + h, z - d / 2],
    ],
    [0, 0, -1],
  );
  face(
    o,
    'plaster',
    [
      [x - w / 2, y, z + d / 2],
      [x + w / 2, y, z + d / 2],
      [x, y + h, z + d / 2],
    ],
    [0, 0, 1],
  );
  for (const s of [-1, 1])
    face(
      o,
      k,
      [
        [x + (s * w) / 2, y, z - d / 2],
        [x + (s * w) / 2, y, z + d / 2],
        [x, y + h, z + d / 2],
        [x, y + h, z - d / 2],
      ],
      [0, 1, 0],
    );
}
function pyramid(o, k, x, z, w, d, y, h) {
  for (const [a, b] of [
    [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
    ],
    [
      [w / 2, -d / 2],
      [w / 2, d / 2],
    ],
    [
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ],
    [
      [-w / 2, d / 2],
      [-w / 2, -d / 2],
    ],
  ])
    face(
      o,
      k,
      [
        [x + a[0], y, z + a[1]],
        [x + b[0], y, z + b[1]],
        [x, y + h, z],
      ],
      [0, 1, 0],
    );
}
function tube(o, k, a, b, r, n = 6) {
  const d = b.map((x, i) => x - a[i]),
    l = Math.hypot(...d),
    v = d.map((x) => x / l),
    q = Math.abs(v[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0],
    u = [v[1] * q[2] - v[2] * q[1], v[2] * q[0] - v[0] * q[2], v[0] * q[1] - v[1] * q[0]],
    ul = Math.hypot(...u);
  for (let i = 0; i < 3; i++) u[i] /= ul;
  const w = [v[1] * u[2] - v[2] * u[1], v[2] * u[0] - v[0] * u[2], v[0] * u[1] - v[1] * u[0]],
    at = (p, t) => p.map((x, j) => x + r * (u[j] * Math.cos(t) + w[j] * Math.sin(t)));
  for (let i = 0; i < n; i++)
    face(o, k, [
      at(a, (i * 2 * Math.PI) / n),
      at(a, ((i + 1) * 2 * Math.PI) / n),
      at(b, ((i + 1) * 2 * Math.PI) / n),
      at(b, (i * 2 * Math.PI) / n),
    ]);
}
const profileFull = [
    [-4.3, 0],
    [-3.8428, -D.ditchDepth],
    [-1.0996, -D.ditchDepth],
    [-0.6424, 0],
    [0, D.parapetHeightEstimate],
    [3, D.parapetHeightEstimate],
    [3.5, D.banquetteHeight],
    [4.4144, D.banquetteHeight],
    [4.4144, 0],
    [7, 0],
  ],
  profileMedium = [
    [-4.3, 0],
    [-2.5, -D.ditchDepth],
    [-0.6424, 0],
    [1.5, D.parapetHeightEstimate],
    [4.4144, 0],
    [7, 0],
  ],
  profileFar = [
    [-4.3, 0],
    [1.5, D.parapetHeightEstimate],
    [7, 0],
  ];
function sectionControls(line) {
  const closed =
    Math.hypot(
      line[0].center[0] - line.at(-1).center[0],
      line[0].center[1] - line.at(-1).center[1],
    ) < 0.001;
  return line.map((q, i) => {
    const before = line[i === 0 ? (closed ? line.length - 2 : 0) : i - 1],
      after = line[i === line.length - 1 ? (closed ? 1 : i) : i + 1],
      norm = (a, b) => {
        const dx = b.center[0] - a.center[0],
          dz = b.center[1] - a.center[1],
          l = Math.hypot(dx, dz);
        return l ? [-dz / l, dx / l] : null;
      },
      a = norm(before, q),
      b = norm(q, after),
      one = a ?? b,
      other = b ?? a,
      m = one.map((v, k) => v + other[k]),
      len = Math.hypot(...m),
      n = len > 1e-6 ? m.map((v) => v / len) : one,
      scale = Math.min(3, 1 / Math.max(0.333, n[0] * one[0] + n[1] * one[1]));
    return { ...q, n: n.map((v) => v * scale) };
  });
}
const offset = (p, d, y = 0) => [p.center[0] + p.n[0] * d, p.y + y, p.center[1] + p.n[1] * d];
// The casemate replaces this part of the earthen curtain. Clip only that intrinsic
// physical opening; keep original lines, independent source field and fixed floors.
export function inCasemateClearance(p) {
  const dx = p[0] - P.london.center[0],
    dz = p[2] - P.london.center[1],
    c = Math.cos(P.heading),
    s = Math.sin(P.heading),
    x = c * dx - s * dz,
    z = s * dx + c * dz;
  return Math.abs(x) < 40.45 && z > -24 && z < 20;
}
function casemateCurtainOpening(o) {
  const c = Math.cos(P.heading),
    s = Math.sin(P.heading),
    local = (p) => {
      const dx = p[0] - P.london.center[0],
        dz = p[2] - P.london.center[1];
      return [c * dx - s * dz, s * dx + c * dz];
    },
    clip = (ps, axis, bound, keepBelow) => {
      const out = [];
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i],
          b = ps[(i + 1) % ps.length],
          aa = local(a)[axis] - bound,
          bb = local(b)[axis] - bound,
          insideA = keepBelow ? aa <= 0 : aa >= 0,
          insideB = keepBelow ? bb <= 0 : bb >= 0;
        if (insideA) out.push(a);
        if (insideA !== insideB) {
          const t = aa / (aa - bb);
          out.push(a.map((v, k) => v + t * (b[k] - v)));
        }
      }
      return out;
    };
  return {
    addTriangle(k, r, ps, _normal, uv, col) {
      const parts = [];
      parts.push(clip(ps, 0, -40.45, true));
      parts.push(clip(ps, 0, 40.45, false));
      const mid = clip(clip(ps, 0, -40.45, false), 0, 40.45, true);
      parts.push(clip(mid, 1, -24, true));
      parts.push(clip(mid, 1, 20, false));
      let n = 0;
      for (const poly of parts)
        for (let i = 1; i < poly.length - 1; i++) {
          const p = [poly[0], poly[i], poly[i + 1]].map((q) => q.map(Math.fround)),
            normal = normalFor(...p);
          if (!normal.every(Number.isFinite)) continue;
          const a = p[1].map((v, j) => v - p[0][j]),
            b = p[2].map((v, j) => v - p[0][j]);
          if (
            Math.hypot(
              a[1] * b[2] - a[2] * b[1],
              a[2] * b[0] - a[0] * b[2],
              a[0] * b[1] - a[1] * b[0],
            ) < 1e-5
          )
            continue;
          o.addTriangle(k, r, p, normal, uv, col);
          n++;
        }
      count += n - 1;
    },
  };
}
function earthworks(out, line, id, lod, river = false) {
  const o = casemateCurtainOpening(out);
  const chosen = lod === 0 ? line.filter((_, i) => i % 2 === 0 || i === line.length - 1) : line,
    controls = sectionControls(chosen),
    prof = river
      ? [
          [-7, 0],
          [-2, 2.3],
          [4, 2.3],
          [8, 0],
        ]
      : lod === 0
        ? profileFar
        : lod === 1
          ? profileMedium
          : profileFull;
  for (let i = 1; i < controls.length; i++) {
    const a = controls[i - 1],
      b = controls[i],
      at = (p, v) => offset(p, ...v);
    for (let j = 1; j < prof.length; j++)
      face(
        o,
        'earth',
        [at(a, prof[j - 1]), at(b, prof[j - 1]), at(b, prof[j]), at(a, prof[j])],
        [0, 1, 0],
      );
    defenceEvidence.push({
      id,
      segment: i,
      start: a.center,
      end: b.center,
      startFloor: a.y,
      endFloor: b.y,
      profile: prof,
    });
  }
}
export const actualGroundOutlines = [];
for (const [line, lo, hi] of [
  [P.core, -4.3, 7],
  [P.outer, -4.3, 7],
  [P.river, -7, 8],
]) {
  const c = sectionControls(line);
  for (let i = 0; i < c.length - 1; i += 5) {
    const chunk = c.slice(i, Math.min(i + 6, c.length));
    actualGroundOutlines.push(
      [
        ...chunk.map((p) => offset(p, lo)),
        ...chunk
          .slice()
          .reverse()
          .map((p) => offset(p, hi)),
      ].map((v) => [v[0], v[2]]),
    );
  }
}
actualGroundOutlines.push(
  ...P.physicalGroundOutlines.slice(P.core.length + P.outer.length + P.river.length - 3),
);

function archWall(
  o,
  k,
  {
    center = 0,
    width,
    height,
    spring,
    radius,
    front,
    back,
    bottom = 0,
    segments = 8,
    closed = false,
    id,
  },
) {
  const left = center - width / 2,
    right = center + width / 2,
    arc = Array.from({ length: segments + 1 }, (_, i) => {
      const t = Math.PI - (i * Math.PI) / segments;
      return [center + radius * Math.cos(t), bottom + spring + radius * Math.sin(t)];
    });
  for (const z of [front, back]) {
    const n = [0, 0, z === front ? -1 : 1];
    for (const [a, b] of [
      [left, center - radius],
      [center + radius, right],
    ])
      face(
        o,
        k,
        [
          [a, bottom, z],
          [b, bottom, z],
          [b, bottom + height, z],
          [a, bottom + height, z],
        ],
        n,
      );
    for (let i = 1; i < arc.length; i++) {
      const a = arc[i - 1],
        b = arc[i];
      face(
        o,
        k,
        [
          [a[0], a[1], z],
          [b[0], b[1], z],
          [b[0], bottom + height, z],
          [a[0], bottom + height, z],
        ],
        n,
      );
    }
  }
  face(
    o,
    k,
    [
      [center - radius, bottom, front],
      [center - radius, bottom + spring, front],
      [center - radius, bottom + spring, back],
      [center - radius, bottom, back],
    ],
    [1, 0, 0],
  );
  face(
    o,
    k,
    [
      [center + radius, bottom, front],
      [center + radius, bottom + spring, front],
      [center + radius, bottom + spring, back],
      [center + radius, bottom, back],
    ],
    [-1, 0, 0],
  );
  for (let i = 1; i < arc.length; i++) {
    const a = arc[i - 1],
      b = arc[i];
    face(
      o,
      k,
      [
        [a[0], a[1], front],
        [b[0], b[1], front],
        [b[0], b[1], back],
        [a[0], a[1], back],
      ],
      [0, -1, 0],
    );
  }
  if (closed)
    face(
      o,
      'brick',
      [
        [center - radius, bottom, back + 0.05],
        [center + radius, bottom, back + 0.05],
        ...arc
          .slice()
          .reverse()
          .map(([x, y]) => [x, y, back + 0.05]),
      ],
      [0, 0, -1],
    );
  archEvidence.push({ id, center, width, height, spring, radius, front, back, bottom, closed });
}
function casemate(out, lod) {
  const o = pose(out, P.london.center, P.london.y),
    pitch = D.londonBayWidthEstimate + D.londonPierWidthEstimate,
    w = 16 * pitch + D.londonPierWidthEstimate,
    depth = D.londonTotalDepthEstimate,
    h = D.londonWallHeightEstimate;
  box(o, 'brick', 0, -1, 0, w, 1, depth);
  if (lod === 0) box(o, 'brick', 0, 0, 0, w, h, depth);
  else {
    for (let i = 0; i < 16; i++) {
      const x = -w / 2 + D.londonPierWidthEstimate + D.londonBayWidthEstimate / 2 + i * pitch;
      archWall(o, 'brick', {
        center: x,
        width: pitch,
        height: h,
        spring: D.londonArchSpringEstimate,
        radius: D.londonBayWidthEstimate / 2,
        front: -depth / 2,
        back: -depth / 2 + D.londonFrontWallDepth,
        segments: lod === 1 ? 4 : lod === 2 ? 8 : 12,
        closed: i % 2 === 1,
        id: `londres-${i}`,
      });
    }
    for (const s of [-1, 1]) box(o, 'brick', s * (w / 2 - 0.55), 0, 0, 1.1, h, depth);
    box(o, 'brick', 0, 0, depth / 2 - 0.55, w, h, 1.1);
    box(o, 'brick', 0, h - 0.4, 0, w, 0.4, depth);
  }
  box(o, 'earth', 0, h, 1, w + 1, D.londonRoofEarthDepthEstimate, depth - 2);
  if (lod >= 2) {
    for (let i = 0; i <= 16; i++)
      box(o, 'brick', -w / 2 + i * pitch, 0, -depth / 2 - 0.3, 0.65, h, 0.6);
    box(o, 'plaster', 0, h - 0.42, -depth / 2 - 0.35, w + 0.8, 0.22, 0.7);
  }
}
function room(out, q, lod, thatched = false) {
  const o = pose(out, q.center, q.y, q.heading ?? P.heading),
    w = q.width,
    d = q.length,
    h = q.height;
  if (lod) box(o, 'brick', 0, -0.65, 0, w, 0.65, d, lod >= 2);
  box(o, thatched ? 'wood' : 'plaster', 0, 0, 0, w, h, d, false);
  gable(o, 0, 0, w + 0.5, d + 0.5, h, Math.min(w * 0.25, 3), thatched ? 'wood' : 'roof');
  if (lod >= 1) {
    for (const s of [-1, 1]) {
      const n = Math.max(2, Math.floor(d / 10));
      for (let i = 0; i < n; i++) {
        const z = -d / 2 + ((i + 0.5) * d) / n;
        if (lod === 1)
          face(
            o,
            'wood',
            [
              [(s * w) / 2, 1.6, z - 0.7],
              [(s * w) / 2, 1.6, z + 0.7],
              [(s * w) / 2, 3.1, z + 0.7],
              [(s * w) / 2, 3.1, z - 0.7],
            ],
            [s, 0, 0],
          );
        else box(o, 'wood', s * (w / 2 + 0.02), 1.6, z, 0.08, 1.5, 1.4);
      }
    }
    if (lod >= 2) {
      for (const s of [-1, 1]) box(o, 'plaster', (s * w) / 2, h - 0.15, 0, 0.4, 0.3, d + 0.7);
      box(o, 'wood', 0, 0, -d / 2 - 0.03, 1.4, 2.7, 0.1);
    }
  }
}
function church(out, lod) {
  const q = P.church,
    o = pose(out, q.center, q.y),
    w = D.churchWidth,
    d = D.churchLength,
    h = D.churchNaveWallHeightEstimate,
    front = -d / 2,
    porch = 5.8;
  box(o, 'brick', 0, -0.75, 0, w, 0.75, d);
  box(o, 'plaster', 0, 0, porch / 2, w, h, d - porch, false);
  gable(o, 0, porch / 2, w + 0.7, d - porch + 0.6, h, 3.2);
  const towerW = D.churchTowerWidth;
  for (const x of [-w * 0.35, 0, w * 0.35]) {
    const H = x === 0 ? D.churchCentralTowerHeight : D.churchSideTowerHeightEstimate,
      base = lod === 0 ? 0 : 5.2;
    if (lod === 0) box(o, 'plaster', x, 0, front + 2.8, towerW, H - 2.4, 5.6);
    else {
      box(o, 'plaster', x, base, front + 2.8, towerW, H - base - 2.4, 5.6);
      for (const yy of [9, H - 6, H - 2.6])
        box(o, 'plaster', x, yy, front + 2.8, towerW + 0.5, 0.3, 6);
      for (const s of [-1, 1]) {
        box(o, 'wood', x, Math.min(H - 5, H * 0.73), front + 2.8 + s * 2.84, 1.3, 2.1, 0.08);
        box(
          o,
          'wood',
          x + s * (towerW / 2 + 0.03),
          Math.min(H - 5, H * 0.73),
          front + 2.8,
          0.07,
          2.1,
          1.3,
        );
      }
    }
    pyramid(o, 'roof', x, front + 2.8, towerW + 0.6, 6.2, H - 2.4, 2.4);
  }
  if (lod >= 1) {
    for (let i = 0; i < D.churchFrontArchCount; i++) {
      const pitch = w / 7,
        x = -w / 2 + (i + 0.5) * pitch;
      archWall(o, 'plaster', {
        center: x,
        width: pitch,
        height: 5.2,
        spring: 2.15,
        radius: pitch * 0.37,
        front,
        back: front + porch,
        segments: lod === 1 ? 4 : lod === 2 ? 8 : 12,
        id: `church-front-${i}`,
      });
    }
    box(o, 'plaster', 0, 5, front + porch / 2, w, 0.3, porch);
    for (const s of [-1, 1]) {
      for (let j = 0; j < 4; j++)
        box(
          o,
          'wood',
          s * (w / 2 + 0.02),
          2.1,
          -d / 2 + porch + 5 + (j * (d - porch - 10)) / 3,
          0.08,
          2.5,
          1.65,
        );
      if (lod >= 2)
        for (let i = 0; i < 8; i++)
          box(
            o,
            'plaster',
            s * (w / 2 + 0.15),
            0,
            -d / 2 + porch + (i * (d - porch)) / 7,
            0.45,
            h,
            0.5,
          );
    }
    for (const x of [-w / 3, 0, w / 3]) box(o, 'wood', x, 0, front + porch + 0.03, 1.6, 3, 0.12);
  }
  if (lod >= 2) {
    box(o, 'plaster', 0, h, porch / 2, w * 0.34, 1.7, d - porch);
    gable(o, 0, porch / 2, w * 0.34 + 0.4, d - porch + 0.4, h + 1.7, 2.2);
    for (const x of [-w * 0.35, 0, w * 0.35]) {
      box(
        o,
        'metal',
        x,
        D.churchCentralTowerHeight + (x === 0 ? 0.1 : -7.2),
        front + 2.8,
        0.12,
        1.5,
        0.12,
      );
      box(
        o,
        'metal',
        x,
        D.churchCentralTowerHeight + (x === 0 ? 1 : -6.3),
        front + 2.8,
        0.85,
        0.12,
        0.12,
      );
    }
  }
}
function cannon(o, x, y, z, lod) {
  box(o, 'wood', x, y, z, 1.5, 0.65, 2.5);
  if (lod >= 2) {
    tube(o, 'metal', [x, y + 1, z + 0.7], [x, y + 1.5, z - 2], 0.24, lod === 2 ? 6 : 10);
    for (const s of [-1, 1])
      tube(
        o,
        'wood',
        [x + s * 0.7, y + 0.5, z],
        [x + s * 0.9, y + 0.5, z],
        0.55,
        lod === 2 ? 6 : 10,
      );
  }
}
function platforms(out, lod) {
  for (const q of [...P.batteries, ...P.outworkSites]) {
    const o = pose(out, q.center, q.y);
    box(o, 'earth', 0, 0, 0, q.width, 1.4, q.depth);
    if (lod >= 1) {
      box(o, 'brick', 0, 1.4, -q.depth / 2 + 0.55, q.width, 1.1, 1.1);
      if (lod >= 2)
        for (let i = 0; i < (q.gunCountEstimate ?? 3); i++)
          cannon(o, -q.width / 2 + ((i + 0.5) * q.width) / (q.gunCountEstimate ?? 3), 1.4, 0, lod);
    }
  }
}
function headquarters(out, lod) {
  const q = P.headquarters,
    o = pose(out, q.center, q.y);
  for (const s of [-1, 1]) {
    box(
      o,
      'earth',
      s * 24,
      0,
      0,
      D.headquartersTraverseWidth,
      D.headquartersTraverseHeight,
      D.headquartersTraverseLength,
    );
    box(
      o,
      'earth',
      0,
      0,
      s * 24,
      D.headquartersTraverseLength,
      D.headquartersTraverseHeight,
      D.headquartersTraverseWidth,
    );
  }
  if (lod >= 1) {
    for (let i = 0; i < 5; i++)
      room(
        out,
        {
          id: `headquarters-rancho-${i}`,
          center: [q.center[0] + ((i % 3) - 1) * 14, q.center[1] + (Math.floor(i / 3) - 0.5) * 14],
          y: q.y,
          width: 9,
          length: 12,
          height: 3.3,
        },
        lod,
        true,
      );
    for (const x of [-2.8, 2.8])
      for (const z of [-2.8, 2.8]) box(o, 'wood', x, 0, z, 0.5, D.watchtowerHeightEstimate, 0.5);
    box(o, 'wood', 0, 13.8, 0, 7, 0.4, 7);
    pyramid(o, 'wood', 0, 0, 8, 8, D.watchtowerHeightEstimate, 2.2);
    if (lod >= 2)
      for (const s of [-1, 1]) {
        for (let j = 0; j < 3; j++) {
          tube(o, 'wood', [-2.8, j * 4, s * 2.8], [2.8, (j + 1) * 4, s * 2.8], 0.15, 4);
          tube(o, 'wood', [2.8, j * 4, s * 2.8], [-2.8, (j + 1) * 4, s * 2.8], 0.15, 4);
        }
      }
  }
}
function boom(out, lod) {
  const q = P.london,
    o = pose(out, P.batteries.at(-1).center, q.y),
    n = lod === 0 ? 3 : lod === 1 ? 6 : lod === 2 ? 12 : 20,
    span = D.chainSpanEstimate;
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < n; i++) {
      const at = (t) => [
        -5 + j * 0.55,
        -0.8 - 7 * Math.sin(Math.PI * t),
        -D.londonTotalDepthEstimate / 2 - t * span,
      ];
      tube(
        o,
        'metal',
        at(i / n),
        at((i + 1) / n),
        lod === 0 ? 0.32 : 0.15,
        lod === 0 ? 3 : lod === 1 ? 4 : 6,
      );
    }
  if (lod >= 1) {
    box(o, 'brick', -4, -1, D.londonTotalDepthEstimate / 2 + 80, 8, 2.5, 6);
    tube(
      o,
      'wood',
      [-7, 2, D.londonTotalDepthEstimate / 2 + 80],
      [-1, 2, D.londonTotalDepthEstimate / 2 + 80],
      0.65,
      8,
    );
  }
}
export function buildHumaita(o, _frame, lod = 3) {
  count = 0;
  partEvidence.length = 0;
  archEvidence.length = 0;
  defenceEvidence.length = 0;
  const part = (id, fn) => {
    const n = count;
    fn();
    partEvidence.push({ id, triangles: count - n });
  };
  part('whole-core-enclosure-and-connected-Quadrilateral', () => {
    earthworks(o, P.core, 'core', lod);
    earthworks(o, P.outer, 'Quadrilateral', lod);
    earthworks(o, P.river, 'river-batteries', lod, true);
  });
  part('all-mapped-major-core-buildings-and-stores', () => {
    for (const q of P.rooms) room(o, q, lod);
  });
  part('complete-Londres-sixteen-bay-casemate', () => casemate(o, lod));
  part('whole-three-tower-SanCarlos-church', () => church(o, lod));
  part('all-eight-river-batteries-and-six-named-outworks', () => platforms(o, lod));
  part('PasoPucu-headquarters-earthworks-and-watchtower', () => headquarters(o, lod));
  part('intrinsic-three-strand-river-chain-boom', () => boom(o, lod));
}
export const humaitaSkyline = (o) => buildHumaita(o, null, 0),
  humaitaDistrict = (o) => buildHumaita(o, null, 1),
  humaitaStreet = (o) => buildHumaita(o, null, 2),
  humaitaCloseup = (o) => buildHumaita(o, null, 3);
const root = 'content/worldgen/source/places/6e/6en/fortress_of_humaita',
  l = P.london.center,
  whole = [-3300, 0, 2500],
  core = [-700, 8, -400],
  view = (x, y, z) => {
    const c = Math.cos(P.heading),
      s = Math.sin(P.heading);
    return [l[0] + c * x + s * z, P.london.y + y, l[1] - s * x + c * z];
  };
export const humaitaModel = {
  id: 'fortress_of_humaita',
  key: 'fortress_of_humaita',
  cell: '6e/6en',
  title: 'Fortress of Humaita, Paraguay (1867)',
  wikidataId: 'Q5404163',
  category: 'palace-castle-fort',
  recipe: 'humaita-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildHumaita,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: P.sectionBasis,
  brief: P.geometryBasis,
  appearance: {
    kind: 'historical',
    representedDate: '1867-09-05',
    validFrom: '1867-03-01',
    validUntil: '1868-02-18',
    currentWorldEligible: false,
  },
  camera: [-2200, 1100, 1300],
  lookAt: core,
  portableGroundY: -20,
  mediumFiContext: {
    scale: 45,
    groundY: -20,
    far: 40000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'earth_rammed',
    'brick',
    'plaster_lime',
    'tile_ceramic',
    'wood_weatherboard',
    'metal_painted',
  ],
  groundCutout: {
    minHeight: -20,
    outline: actualGroundOutlines[0],
    additionalOutlines: actualGroundOutlines.slice(1),
    basis:
      'Only actual joined-profile earthwork boundaries and authored building/battery footprints; coarse24m research buffers replaced by physical mesh extents without altering original field/floors/main sections. No broad site pad. Original source heights retained. Historic controls/grade are approximate.',
  },
  qaCameras: [
    {
      name: 'whole-fortress-and-outer-quadrilateral',
      position: [1000, 11500, 15000],
      lookAt: whole,
    },
    {
      name: 'complete-riverfront-core-and-internal-buildings',
      position: [-2200, 1100, 1300],
      lookAt: core,
    },
    {
      name: 'londres-arched-ports-vault-depth-and-earth-roof',
      position: view(75, 20, -60),
      lookAt: view(0, 3, -5),
    },
    {
      name: 'three-tower-san-carlos-open-front-arcade',
      position: [-75, 35, 70],
      lookAt: [0, 13, 0],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `fortress-core-${reviewLod}`,
    position: [-2200, 1100, 1300],
    lookAt: core,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/humaita-model.mjs`,
    level: 'skyline',
    export: 'humaitaSkyline',
    errorMeters: 12,
    surfaces,
    authoredLevels: {
      district: { export: 'humaitaDistrict', errorMeters: 5, surfaces },
      street: { export: 'humaitaStreet', errorMeters: 1, surfaces },
      closeup: { export: 'humaitaCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [P.geometryBasis, P.sectionBasis, ...P.limits],
  sourceLicense:
    'Original authored geometry under repository license. Three already-cleared published Qualla named nineteenth-century engineer/Agostini prints and independently cleared original fullplan/Thompson1869librarybook. OSMODbL/WikidataCC0 historical site controls, primary factual scalar dimensions. No modern reconstruction images or baked photographs. Whole1867architectural interpretation with explicit estimated hidden details/registration/grade.',
};
