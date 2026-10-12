/** Independent dated Salah Ed-Din medium-fi derivative; original detailed master preserved. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/sy/sy3/n0257_citadel_of_salah_ed_din/map-parts.json',
      import.meta.url,
    ),
  ),
);
const stone = [0.63, 0.57, 0.43],
  trim = [0.73, 0.67, 0.52],
  rock = [0.52, 0.5, 0.41];
const master = (o) => !o.detail,
  low = (o) => o.detail === 'skyline';
const near = (o) => !['skyline', 'district'].includes(o.detail);
const fine = (o) => !['skyline', 'district', 'street'].includes(o.detail);
const tint = (c, n) => c.map((v) => v * n),
  mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const face = (o, s, p, c = stone) => quad(o, s, p, normalFor(...p), c);
const tri = (o, s, p, c = stone) =>
  o.addTriangle(
    s,
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    c,
  );
function frame(o, x = 0, y = 0, z = 0, a = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    rot = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
  return {
    detail: o.detail,
    ...Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (slot, ref, p, n, uv, col) =>
          o[k](
            slot,
            ref,
            p.map((v) => {
              const q = rot(v);
              return [q[0] + x, q[1] + y, q[2] + z];
            }),
            rot(n),
            uv,
            col,
          ),
      ]),
    ),
  };
}
const edgeFrame = (o, a, b) => frame(o, a[0], 0, a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
function polygon(p) {
  p = p.map((v) => [...v]);
  if (Math.hypot(...p[0].map((v, i) => v - p.at(-1)[i])) < 0.001) p.pop();
  return area(p) < 0 ? p.reverse() : p;
}
function cap(o, p, y, s = 'limestone', c = stone) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
    if (normalFor(...q)[1] < 0) q.reverse();
    tri(o, s, q, c);
  }
}
function solid(o, p, lo, hi, s = 'limestone', c = stone) {
  p = polygon(p);
  cap(o, p, hi, s, c);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    const bottom = low(o) ? Math.min(lo, ground(...a) - 4, ground(...b) - 4) : lo;
    face(
      o,
      s,
      [
        [a[0], bottom, a[1]],
        [a[0], hi, a[1]],
        [b[0], hi, b[1]],
        [b[0], bottom, b[1]],
      ],
      c,
    );
  }
}
const feature = (id) => polygon(map.mappedFeatures.find((v) => v.id === id).points);
function simplify(p, tolerance = 3) {
  const q = [p[0]];
  for (let i = 1; i < p.length - 1; i++) {
    const a = q.at(-1),
      b = p[i],
      c = p[i + 1];
    const d =
      Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) /
      (Math.hypot(c[0] - a[0], c[1] - a[1]) || 1);
    if (d > tolerance) q.push(b);
  }
  q.push(p.at(-1));
  return q;
}

const grade = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/sy/sy3/n0257_citadel_of_salah_ed_din/site-grade.json',
      import.meta.url,
    ),
  ),
);
export function salahGround(x, z) {
  const g = grade.grid,
    u = Math.max(0, Math.min(g.width - 1.000001, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(g.height - 1.000001, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    fx = u - i,
    fz = v - j,
    at = (a, b) => g.heights[(j + b) * g.width + i + a] - grade.datumMeters;
  return (
    (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fz) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fz
  );
}
const ground = salahGround;
const foundationGround = (x, z) =>
  inside(x, z, grade.moat.outline) ? grade.moat.floor : ground(x, z);
function floorOutline(c) {
  const p = polygon(c.points),
    center = [0, 1].map((k) => p.reduce((s, v) => s + v[k], 0) / p.length),
    pad = (c.thickness ?? 2) * 0.55;
  return p.map((v) => {
    const d = Math.hypot(v[0] - center[0], v[1] - center[1]) || 1;
    return v.map((n, i) => n + ((n - center[i]) / d) * pad);
  });
}
function fittedFloor(o, c) {
  if (low(o) && !c.gate && !['gate', 'ruin', 'chapel'].includes(c.kind)) return;
  const p = floorOutline(c);
  cap(o, p, c.baseY, 'weathered', rock);
  if (low(o) && c.kind !== 'gate' && !c.gate) return;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      o,
      'weathered',
      [
        [a[0], foundationGround(...a) - 4, a[1]],
        [a[0], c.baseY, a[1]],
        [b[0], c.baseY, b[1]],
        [b[0], foundationGround(...b) - 4, b[1]],
      ],
      rock,
    );
  }
}
function gradeWall(o, a, b, h, t) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 0.05) return;
  const nx = (((b[1] - a[1]) / len) * t) / 2,
    nz = ((-(b[0] - a[0]) / len) * t) / 2,
    ya = ground(...a) + 0.25,
    yb = ground(...b) + 0.25;
  for (const side of [-1, 1]) {
    let q = [
      [a[0] + nx * side, ya - 4, a[1] + nz * side],
      [b[0] + nx * side, yb - 4, b[1] + nz * side],
      [b[0] + nx * side, yb + h, b[1] + nz * side],
      [a[0] + nx * side, ya + h, a[1] + nz * side],
    ];
    if (side === -1) q.reverse();
    face(o, 'limestone', q, stone);
  }
  face(
    o,
    'limestone',
    [
      [a[0] + nx, ya + h, a[1] + nz],
      [b[0] + nx, yb + h, b[1] + nz],
      [b[0] - nx, yb + h, b[1] - nz],
      [a[0] - nx, ya + h, a[1] - nz],
    ],
    trim,
  );
}
function terrain(o) {
  const p = polygon(grade.moat.outline),
    floor = grade.moat.floor,
    crest = grade.moat.crest;
  cap(o, p, floor, 'aggregate', [0.59, 0.56, 0.47]);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      nx = (b[1] - a[1]) / len,
      nz = -(b[0] - a[0]) / len;
    const inner = [
      [a[0], floor, a[1]],
      [a[0], crest, a[1]],
      [b[0], crest, b[1]],
      [b[0], floor, b[1]],
    ];
    inner.reverse();
    face(o, 'weathered', inner, rock);
    const aa = [a[0] + nx * 8, a[1] + nz * 8],
      bb = [b[0] + nx * 8, b[1] + nz * 8],
      q = [
        [a[0], crest, a[1]],
        [b[0], crest, b[1]],
        [bb[0], ground(...bb) + 0.025, bb[1]],
        [aa[0], ground(...aa) + 0.025, aa[1]],
      ];
    if (normalFor(...q)[1] < 0) q.reverse();
    face(o, 'weathered', q, rock);
  }
}
function arch(x, y, w, h, steps = 10) {
  const p = [
      [x - w / 2, y],
      [x + w / 2, y],
    ],
    spring = y + h - w / 2;
  for (let i = 0; i <= steps; i++) {
    const a = (i * Math.PI) / steps;
    p.push([x + (Math.cos(a) * w) / 2, spring + (Math.sin(a) * w) / 2]);
  }
  return p;
}
function inside(x, y, p) {
  let flag = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i],
      b = p[j];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
      flag = !flag;
  }
  return flag;
}
function facade(o, w, lo, hi, holes = [], slot = 'limestone', c = stone, depth = 1) {
  const rings = [
      [
        [0, lo],
        [w, lo],
        [w, hi],
        [0, hi],
      ],
      ...holes,
    ],
    p = rings.flat(),
    starts = [];
  let n = 4;
  for (const h of holes) {
    starts.push(n);
    n += h.length;
  }
  const ix = earcut(p.flat(), starts);
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], p[j][1], 0]);
    if (normalFor(...q)[2] < 0) q.reverse();
    tri(o, slot, q, c);
  }
  if (near(o))
    for (const h of holes) {
      for (let i = 0; i < h.length; i++) {
        const a = h[i],
          b = h[(i + 1) % h.length];
        face(
          o,
          'carved',
          [
            [a[0], a[1], 0],
            [b[0], b[1], 0],
            [b[0], b[1], -depth],
            [a[0], a[1], -depth],
          ],
          trim,
        );
      }
    }
  if (!master(o)) return;
  // Mortar joints and shallow, uneven stone faces; only the master carries individual ashlar.
  const step = 0.59;
  for (let row = 0, y = lo + 0.07; y < hi - 0.25; row++, y += step) {
    for (let k = 0, x = -(row % 2) * 0.46; x < w; k++, x += 1.12) {
      const a = Math.max(0.015, x + 0.027),
        b = Math.min(w - 0.015, x + 1.08),
        top = Math.min(hi - 0.018, y + 0.55);
      if (
        b - a < 0.15 ||
        holes.some((h) =>
          [
            [a, y],
            [b, y],
            [a, top],
            [b, top],
            [(a + b) / 2, (y + top) / 2],
          ].some(([x, y]) => inside(x, y, h)),
        )
      )
        continue;
      const d = 0.025 + ((row * 7 + k * 11) % 5) * 0.012,
        col = tint(c, 0.91 + ((row * 13 + k * 7) % 11) * 0.014);
      face(
        o,
        slot,
        [
          [a, y, d],
          [b, y, d],
          [b, top, d],
          [a, top, d],
        ],
        col,
      );
      face(
        o,
        slot,
        [
          [a, top, d],
          [b, top, d],
          [b, top + 0.035, 0],
          [a, top + 0.035, 0],
        ],
        tint(col, 0.88),
      );
    }
  }
}
function wall(
  o,
  a,
  b,
  base,
  height,
  thickness = 1.8,
  { gate = false, slits = false, rough = true } = {},
) {
  const w = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (w < 0.05) return;
  const f = edgeFrame(o, a, b),
    h = base + height;
  if (low(o) && !gate) {
    const bottom = Math.min(base, ground(...a) - 4, ground(...b) - 4);
    face(f, 'limestone', [
      [0, bottom, thickness / 2],
      [w, bottom, thickness / 2],
      [w, h, thickness / 2],
      [0, h, thickness / 2],
    ]);
    face(f, 'limestone', [
      [w, bottom, -thickness / 2],
      [0, bottom, -thickness / 2],
      [0, h, -thickness / 2],
      [w, h, -thickness / 2],
    ]);
    face(f, 'limestone', [
      [0, h, thickness / 2],
      [w, h, thickness / 2],
      [w, h, -thickness / 2],
      [0, h, -thickness / 2],
    ]);
    return;
  }
  const holes = [];
  if (gate)
    holes.push(
      arch(
        w / 2,
        base,
        Math.min(3.2, w * 0.45),
        Math.min(5.6, height * 0.75),
        low(o) ? 2 : near(o) ? 12 : 5,
      ),
    );
  else if (slits && near(o) && height > 6)
    for (let x = 2.5; x < w - 2; x += 6)
      holes.push([
        [x - 0.17, h - 3.8],
        [x + 0.17, h - 3.8],
        [x + 0.17, h - 2.1],
        [x - 0.17, h - 2.1],
      ]);
  facade(frame(f, 0, 0, thickness / 2), w, base, h, holes, 'limestone', stone, thickness);
  const back = frame(f, w, 0, -thickness / 2, Math.PI),
    backHoles = holes.map((p) => p.map(([x, y]) => [w - x, y]).reverse());
  facade(back, w, base, h, backHoles, 'limestone', tint(stone, 0.92), thickness);
  face(
    f,
    'limestone',
    [
      [0, h, thickness / 2],
      [w, h, thickness / 2],
      [w, h, -thickness / 2],
      [0, h, -thickness / 2],
    ],
    trim,
  );
  for (const x of [0, w]) {
    const q = [
      [x, base, -thickness / 2],
      [x, base, thickness / 2],
      [x, h, thickness / 2],
      [x, h, -thickness / 2],
    ];
    if (x === 0) q.reverse();
    face(f, 'limestone', q);
  }
  if (rough && fine(o)) {
    const n = Math.max(1, Math.ceil(w / (master(o) ? 0.83 : 2.7)));
    for (let i = 0; i < n; i++) {
      const a = (i * w) / n,
        b = ((i + 1) * w) / n,
        ya = h + 0.035 + ((i * 11 + Math.floor(w)) % 13) * 0.022,
        yb = h + 0.035 + (((i + 1) * 11 + Math.floor(w)) % 13) * 0.022,
        t = thickness * 0.48;
      const top = [
        [a, ya, t],
        [b, yb, t],
        [b, yb, -t],
        [a, ya, -t],
      ];
      face(f, 'carved', top, tint(stone, 0.93));
      face(f, 'carved', [[a, h, t], [b, h, t], top[1], top[0]], tint(stone, 0.9));
      face(f, 'carved', [[b, h, -t], [a, h, -t], top[3], top[2]], tint(stone, 0.86));
    }
  }
}
function shell(
  o,
  p,
  base,
  height,
  thickness = 1.8,
  { gate = false, slits = false, roof = false, rough = true } = {},
) {
  p = polygon(p);
  for (let i = 0; i < p.length; i++)
    wall(o, p[(i + 1) % p.length], p[i], base, height, thickness, {
      gate: gate && (i === 0 || i === 2),
      slits,
      rough,
    });
  if (roof) cap(o, p, base + height - 0.35, 'plaster', [0.76, 0.72, 0.6]);
}
function ruined(o, c) {
  const p = c.closed === false ? c.points : polygon(c.points);
  if (low(o)) {
    if (
      c.name.startsWith('Palace') ||
      c.name.startsWith('Courtyard') ||
      c.name.startsWith('Industrial')
    )
      return;
    if (c.closed === false) {
      for (let i = 1; i < p.length; i++) wall(o, p[i - 1], p[i], c.baseY, c.height, c.thickness);
    } else shell(o, simplify(p, 1), c.baseY, c.height, c.thickness);
    return;
  }
  for (let i = 0; i < p.length - (c.closed === false ? 1 : 0); i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      height = c.edgeHeights?.[i] ?? c.height * (0.83 + (i % 3) * 0.085);
    wall(o, b, a, c.baseY, height, c.thickness, { gate: c.kind === 'chapel' && i === 0 });
  }
  if (fine(o) && c.height < 8 && c.closed !== false) {
    const a = p[0],
      b = p[1],
      f = edgeFrame(o, a, b),
      length = Math.hypot(a[0] - b[0], a[1] - b[1]);
    for (let k = 0; k < length; k += master(o) ? 1.8 : 4.3) {
      const z = c.thickness + 1 + ((Math.floor(k) * 17) % 7) * 0.22;
      box(
        f,
        'weathered',
        [k, c.baseY, z],
        [k + 0.5, c.baseY + 0.18 + (k % 3) * 0.07, z + 0.43],
        tint(rock, 0.94),
      );
    }
  }
}
function localRect(o, p) {
  const a = p[0],
    b = p[1],
    w = Math.hypot(b[0] - a[0], b[1] - a[1]),
    f = edgeFrame(o, a, b);
  const dx = (b[0] - a[0]) / w,
    dz = (b[1] - a[1]) / w;
  const zz = p.map((v) => (v[0] - a[0]) * -dz + (v[1] - a[1]) * dx),
    min = Math.min(...zz),
    max = Math.max(...zz);
  return { f: frame(f, 0, 0, min), w, d: max - min };
}
function barrel(o, f, w, d, base, rise, slot = 'limestone', c = stone) {
  const n = low(o) ? 4 : near(o) ? 20 : 8,
    rings = [0, d].map((z) =>
      Array.from({ length: n + 1 }, (_, i) => {
        const t = (i * Math.PI) / n;
        return [w / 2 - (Math.cos(t) * w) / 2, base + Math.sin(t) * rise, z];
      }),
    );
  for (let i = 0; i < n; i++) {
    const q = [rings[0][i], rings[1][i], rings[1][i + 1], rings[0][i + 1]];
    face(f, slot, q, c);
  }
  if (fine(o))
    for (let j = 0; j < n; j++) {
      const a = rings[0][j],
        b = rings[0][j + 1],
        q = [
          [a[0], a[1] - 0.5, 0],
          [b[0], b[1] - 0.5, 0],
          [b[0], b[1] - 0.5, d],
          [a[0], a[1] - 0.5, d],
        ];
      face(f, slot, q, tint(c, 0.88));
    }
  for (const z of [0, d])
    for (let i = 0; i < n; i++) {
      const q = [[w / 2, base, z], rings[z === 0 ? 0 : 1][i], rings[z === 0 ? 0 : 1][i + 1]];
      if (normalFor(...q)[2] > 0 !== (z === d)) q.reverse();
      tri(f, slot, q, c);
    }
}
function cistern(o, c) {
  const { f, w, d } = localRect(o, c.points);
  const rise = Math.min(w, d) * 0.3,
    base = c.baseY + c.height - rise;
  solid(o, c.points, c.baseY, base, 'limestone', stone);
  barrel(o, f, w, d, base, rise);
  if (near(o)) {
    for (const z of [d * 0.3, d * 0.7])
      box(
        f,
        'recess',
        [w * 0.44, base + rise - 0.03, z - 0.5],
        [w * 0.57, base + rise + 0.04, z + 0.5],
        [0.15, 0.15, 0.12],
      );
  }
}
function hall(o, c) {
  const p = polygon(c.points);
  shell(o, p, c.baseY, c.height, c.thickness, { slits: true, roof: !near(o) });
  if (!near(o)) return;
  const { f, w, d } = localRect(o, c.points),
    cols = 3,
    rows = 4,
    cellX = w / cols,
    cellZ = d / rows;
  // The roof's cross-vault cells share piers; both intrados and terrace remain modeled.
  for (let i = 1; i < cols; i++)
    for (let j = 1; j < rows; j++)
      box(
        f,
        'limestone',
        [i * cellX - 0.9, c.baseY, j * cellZ - 0.9],
        [i * cellX + 0.9, c.baseY + 5.5, j * cellZ + 0.9],
        stone,
      );
  const n = master(o) ? 10 : 4;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      for (let u = 0; u < n; u++)
        for (let v = 0; v < n; v++) {
          const pts = [
            [u, v],
            [u + 1, v],
            [u + 1, v + 1],
            [u, v + 1],
          ].map(([u, v]) => {
            const x = u / n,
              z = v / n;
            const rise =
              Math.max(
                Math.sqrt(Math.max(0, 1 - (x * 2 - 1) ** 2)),
                Math.sqrt(Math.max(0, 1 - (z * 2 - 1) ** 2)),
              ) * 2.7;
            return [(i + x) * cellX, c.baseY + 5.4 + rise, (j + z) * cellZ];
          });
          for (const ids of [
            [0, 1, 2],
            [2, 3, 0],
          ]) {
            const q = ids.map((k) => pts[k]);
            if (normalFor(...q)[1] > 0) q.reverse();
            tri(f, 'limestone', q, tint(stone, 0.92));
          }
        }
    }
  cap(o, p, c.baseY + c.height - 0.3, 'plaster', [0.74, 0.69, 0.55]);
}
function roofed(o, c) {
  if (low(o) && c.kind !== 'gate') {
    solid(o, c.points, c.baseY, c.baseY + c.height);
    return;
  }
  shell(o, c.points, c.baseY, c.height, c.thickness, {
    roof: !c.ruinedTower,
    gate: c.kind === 'gate',
    slits: c.kind === 'tower' || c.kind === 'gate',
    rough: c.kind !== 'mosque',
  });
  if (c.kind === 'mosque' && near(o)) {
    const { f, w } = localRect(o, c.points);
    // Small paired windows and a separate mihrab projection on the south elevation.
    for (const x of [w * 0.22, w * 0.5, w * 0.78]) {
      box(
        f,
        'recess',
        [x - 0.28, c.baseY + 2.2, -c.thickness / 2 - 0.065],
        [x + 0.28, c.baseY + 3.25, -c.thickness / 2 - 0.025],
        [0.16, 0.16, 0.13],
      );
    }
    const mid = mix(c.points[2], c.points[3], 0.5);
    loft(
      o,
      'limestone',
      [
        radialRing(c.baseY, 1, 1, near(o) ? 16 : 8, mid),
        radialRing(c.baseY + 3.9, 1, 1, near(o) ? 16 : 8, mid),
      ],
      stone,
    );
  }
}
function minaret(o, c) {
  if (low(o)) {
    solid(o, c.points, c.baseY, c.baseY + c.height);
    return;
  }
  const p = polygon(c.points),
    h = c.baseY + c.height;
  solid(o, p, c.baseY, h - 2.3, 'limestone', stone);
  const center = [0, 1].map((k) => p.reduce((s, q) => s + q[k], 0) / p.length),
    scale = (v) => p.map((q) => q.map((n, i) => center[i] + (n - center[i]) * v));
  solid(o, scale(1.12), h - 2.6, h - 2.25, 'carved', trim);
  shell(o, p, h - 2.25, 1.95, 0.48, { gate: true, rough: false });
  cap(o, scale(1.03), h, 'metal', [0.26, 0.3, 0.28]);
  if (near(o))
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        w = Math.hypot(a[0] - b[0], a[1] - b[1]),
        f = edgeFrame(o, b, a);
      for (const y of [c.baseY + 4.8, c.baseY + 10, c.baseY + 14])
        box(
          f,
          'recess',
          [w / 2 - 0.15, y, 0.035],
          [w / 2 + 0.15, y + 1.1, 0.06],
          [0.13, 0.14, 0.12],
        );
      if (master(o)) facade(frame(f, 0, 0, 0.015), w, c.baseY, h - 2.7, [], 'limestone', stone);
    }
}
function bath(o, c) {
  roofed(o, c);
  if (!near(o)) return;
  const { f, w, d } = localRect(o, c.points),
    rows = c.name.includes('hot') ? 3 : 1;
  for (let j = 0; j < rows; j++) {
    const cx = w * 0.5,
      cz = (d * (j + 0.5)) / rows,
      r = Math.min(w * 0.28, (d / rows) * 0.29);
    const n = master(o) ? 24 : 12,
      rings = [];
    for (let k = 0; k <= 5; k++) {
      const t = (k * Math.PI) / 12;
      rings.push(
        radialRing(
          c.baseY + c.height - 0.2 + Math.sin(t) * r * 0.7,
          Math.cos(t) * r,
          Math.cos(t) * r,
          n,
          [cx, cz],
        ),
      );
    }
    loft(f, 'plaster', rings, [0.73, 0.68, 0.55]);
    if (fine(o))
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        box(
          f,
          'recess',
          [
            cx + Math.cos(a) * r * 0.47 - 0.12,
            c.baseY + c.height + r * 0.56,
            cz + Math.sin(a) * r * 0.47 - 0.12,
          ],
          [
            cx + Math.cos(a) * r * 0.47 + 0.12,
            c.baseY + c.height + r * 0.56 + 0.025,
            cz + Math.sin(a) * r * 0.47 + 0.12,
          ],
          [0.15, 0.14, 0.12],
        );
      }
  }
}
function portico(o, c) {
  if (low(o)) return;
  const { f, w, d } = localRect(o, c.points),
    n = Math.max(2, Math.round(w / 4.5));
  if (!near(o)) {
    solid(o, c.points, c.baseY, c.baseY + c.height, 'limestone', stone);
    return;
  }
  const holes = Array.from({ length: n }, (_, i) =>
    arch(((i + 0.5) * w) / n, c.baseY, w / n - 0.85, c.height - 0.35, master(o) ? 12 : 6),
  );
  facade(frame(f, 0, 0, -0.2), w, c.baseY, c.baseY + c.height, holes, 'limestone', stone, 0.7);
  facade(
    frame(f, w, 0, d + 0.2, Math.PI),
    w,
    c.baseY,
    c.baseY + c.height,
    holes,
    'limestone',
    stone,
    0.7,
  );
  for (let i = 0; i <= n; i++)
    box(
      f,
      'limestone',
      [Math.max(0, (i * w) / n - 0.38), c.baseY, 0],
      [Math.min(w, (i * w) / n + 0.38), c.baseY + c.height - 0.5, d],
      stone,
    );
  cap(o, c.points, c.baseY + c.height, 'plaster', [0.74, 0.71, 0.6]);
}
function roundTower(o, t) {
  const n = low(o) ? 6 : near(o) ? 32 : 10,
    levels = [
      [t.baseY, t.radius * 1.08],
      [t.baseY + 3, t.radius],
      [t.topY, t.radius],
    ];
  loft(
    o,
    'limestone',
    (low(o) ? [levels[0], levels[2]] : levels).map(([y, r], i) =>
      radialRing(y, r, r, n, t.center).map((v) =>
        i === 0 ? [v[0], foundationGround(v[0], v[2]) - 4, v[2]] : v,
      ),
    ),
    stone,
  );
  if (near(o)) {
    const [x, z] = t.center;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3,
        f = frame(o, x + Math.sin(a) * t.radius, 0, z + Math.cos(a) * t.radius, a);
      box(
        f,
        'recess',
        [-0.13, t.topY - 3.5, 0.018],
        [0.13, t.topY - 1.9, 0.05],
        [0.13, 0.14, 0.12],
      );
    }
    if (master(o))
      for (let j = 0, y = t.baseY + 0.3; y < t.topY - 0.3; y += 0.62, j++)
        for (let i = 0; i < n; i++) {
          const a = ((i + (j % 2) * 0.5) * Math.PI * 2) / n,
            b = a + (Math.PI * 2) / n - 0.012,
            r = t.radius + 0.04;
          face(
            o,
            'limestone',
            [
              [x + Math.sin(a) * r, y, z + Math.cos(a) * r],
              [x + Math.sin(b) * r, y, z + Math.cos(b) * r],
              [x + Math.sin(b) * r, y + 0.56, z + Math.cos(b) * r],
              [x + Math.sin(a) * r, y + 0.56, z + Math.cos(a) * r],
            ],
            tint(stone, 0.9 + ((i + j * 3) % 9) * 0.019),
          );
        }
  }
}
function fortifications(o) {
  const p = low(o) ? simplify(map.outline, 6) : map.outline;
  // The western town walls survive at lower, broken heights. No continuous fantasy crenels.
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      x = (a[0] + b[0]) / 2;
    if (x > 285 || (x > 184 && (a[1] + b[1]) / 2 > 25)) continue;
    gradeWall(o, a, b, x < -80 ? 1.7 : x < 45 ? 3.8 : 3.1, x < -80 ? 1.5 : 2.1);
  }
  const m = {
      ...map.masterTower,
      baseY: grade.masterFloor,
      topY: grade.masterFloor + map.masterTower.topY - map.masterTower.baseY,
    },
    mp = feature(m.featureId);
  if (low(o)) solid(o, mp, m.baseY, m.topY);
  else shell(o, mp, m.baseY, m.topY - m.baseY, m.wallThickness, { roof: true, slits: true });
  // Shallow roof parapets, irregular wall heads and the exceptionally thick keep envelope.
  if (near(o)) {
    const p = polygon(mp);
    for (let i = 0; i < p.length; i++)
      wall(o, p[(i + 1) % p.length], p[i], m.topY, master(o) ? 0.85 : 0.65, 1.25, { rough: true });
  }
  for (const original of map.southTowers) {
    const t = {
      ...original,
      baseY: grade.towerFloors[original.featureId],
      topY: grade.towerFloors[original.featureId] + original.topY - original.baseY,
    };
    if (low(o) && !t.gate) solid(o, feature(t.featureId), t.baseY, t.topY);
    else
      shell(o, feature(t.featureId), t.baseY, t.topY - t.baseY, t.gate ? 2.7 : 2.1, {
        gate: t.gate,
        roof: !t.gate,
        slits: true,
      });
  }
  for (const [i, t] of map.roundTowers.entries())
    roundTower(o, {
      ...t,
      baseY: grade.roundFloors[i],
      topY: grade.roundFloors[i] + t.topY - t.baseY,
    });
  const n = {
      ...map.needle,
      baseY: grade.moat.floor,
      topY: grade.moat.floor + map.needle.topY - map.needle.baseY,
    },
    points = low(o) ? 5 : near(o) ? 18 : 8;
  loft(
    o,
    'weathered',
    [
      [n.baseY, n.radius * 1.4],
      [n.baseY + 9, n.radius * 0.94],
      [n.topY - n.masonryCapHeight, n.radius * 0.56],
    ].map(([y, r]) => radialRing(y, r, r * 0.78, points, n.center)),
    rock,
  );
  const [x, z] = n.center;
  box(
    o,
    'limestone',
    [x - 1.15, n.topY - n.masonryCapHeight, z - 0.95],
    [x + 1.15, n.topY, z + 0.95],
    stone,
  );
  if (fine(o))
    for (let y = n.topY - n.masonryCapHeight + 0.4; y < n.topY; y += 0.6)
      box(o, 'carved', [x - 1.18, y, z - 0.98], [x + 1.18, y + 0.08, z + 0.98], tint(stone, 0.8));
}
function fountain(o) {
  if (!near(o)) return;
  const q = { ...map.fountain, baseY: grade.workingPalaceFloor },
    n = master(o) ? 32 : 16,
    r = q.radius,
    [x, z] = q.center;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    const p = [
      [x + Math.cos(a) * r, z + Math.sin(a) * r],
      [x + Math.cos(b) * r, z + Math.sin(b) * r],
      [x + Math.cos(b) * (r - 0.2), z + Math.sin(b) * (r - 0.2)],
      [x + Math.cos(a) * (r - 0.2), z + Math.sin(a) * (r - 0.2)],
    ];
    solid(o, p, q.baseY, q.baseY + 0.38, 'carved', trim);
  }
  cap(
    o,
    radialRing(q.baseY, r - 0.2, r - 0.2, n, q.center).map((v) => [v[0], v[2]]),
    q.baseY + 0.025,
    'aggregate',
    [0.58, 0.54, 0.43],
  );
  box(o, 'carved', [x - 0.19, q.baseY, z - 0.19], [x + 0.19, q.baseY + 0.55, z + 0.19], trim);
}
function buildSalahRuntime(out, detail) {
  const o = {
    detail,
    addQuad: (...v) => out.addQuad(...v),
    addTriangle: (...v) => out.addTriangle(...v),
    addConvexPolygon: (...v) => out.addConvexPolygon(...v),
  };
  terrain(o);
  for (const t of map.southTowers)
    fittedFloor(o, {
      points: feature(t.featureId),
      baseY: grade.towerFloors[t.featureId],
      thickness: t.gate ? 2.7 : 2.1,
    });
  fittedFloor(o, {
    points: feature(map.masterTower.featureId),
    baseY: grade.masterFloor,
    thickness: map.masterTower.wallThickness,
  });
  fortifications(o);
  for (const original of map.components) {
    const c = { ...original, baseY: grade.componentFloors[original.name] };
    if (
      c.closed !== false &&
      !(low(o) && ['portico', 'bath'].includes(c.kind)) &&
      !(
        low(o) &&
        (c.name.startsWith('Palace') ||
          c.name.startsWith('Courtyard') ||
          c.name.startsWith('Industrial'))
      )
    )
      fittedFloor(o, c);
    if (low(o) && ['portico', 'bath'].includes(c.kind)) continue;
    if (c.kind === 'cistern') cistern(o, c);
    else if (c.kind === 'hall') hall(o, c);
    else if (c.kind === 'minaret') minaret(o, c);
    else if (c.kind === 'bath') bath(o, c);
    else if (c.kind === 'portico') portico(o, c);
    else if (['gate', 'mosque', 'tower', 'terrace'].includes(c.kind)) roofed(o, c);
    else ruined(o, c);
  }
  fountain(o);
}
const buildSalahSkyline = (o) => buildSalahRuntime(o, 'skyline');

const means = {
  weathered: [0.44849861649919487, 0.44906994842942866, 0.37575318374011624],
  aggregate: [0.6893546167686782, 0.6750929657086415, 0.6305210116163465],
  limestone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
  carved: [0.8863538324344638, 0.8863538324344638, 0.8863538324344638],
  plaster: [0.8560149893924018, 0.8277277519506693, 0.7276425175607023],
  metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
};
function translated(out, baked = false) {
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, u, c) =>
        out[k](s, r, p, n, u, baked ? c.map((v, i) => v * (means[s]?.[i] ?? 1)) : c),
    ]),
  );
}
export const buildSalahReviewedMaster = (o) => buildSalahRuntime(translated(o), 'closeup');
export const buildSalahReviewedCloseup = (o) => buildSalahRuntime(translated(o), 'closeup');
export const buildSalahReviewedStreet = (o) => buildSalahRuntime(translated(o), 'street');
export const buildSalahReviewedDistrict = (o) => buildSalahRuntime(translated(o), 'district');
export const buildSalahReviewedSkyline = (o) => buildSalahRuntime(translated(o, true), 'skyline');
