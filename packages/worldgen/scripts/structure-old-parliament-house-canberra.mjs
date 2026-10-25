/** Old Parliament House, Canberra: stripped classical ranges around four open courts. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  white = rgb('e3e1d8'),
  light = rgb('f1eee5'),
  recess = rgb('b7b9b0'),
  wood = rgb('373c38'),
  glass = rgb('536565'),
  tile = rgb('7a817f'),
  edge = rgb('45504e'),
  brick = rgb('8e5845');
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
function face(o, s, x, y, z, w, h, c) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    c,
  );
}
function ribbon(o, a, b, w, z, c = light) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l = Math.hypot(dx, dy),
    x = (-dy * w) / l / 2,
    y = (dx * w) / l / 2;
  quad(
    o,
    'wall',
    [
      [a[0] + x, a[1] + y, z],
      [b[0] + x, b[1] + y, z],
      [b[0] - x, b[1] - y, z],
      [a[0] - x, a[1] - y, z],
    ],
    [0, 0, 1],
    c,
  );
}

function ringArea(r) {
  return r.reduce(
    (s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
    0,
  );
}
function polygon(o, rings, y0, y1, slot, c) {
  const rr = rings.map((r, i) => {
    const a = r.map((p) => p.slice());
    if (ringArea(a) > 0 !== (i === 0)) a.reverse();
    return a;
  });
  for (const r of rr)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1];
      if (Math.hypot(dx, dz) < 0.001) continue;
      quad(
        o,
        slot,
        [
          [a[0], y0, a[1]],
          [b[0], y0, b[1]],
          [b[0], y1, b[1]],
          [a[0], y1, a[1]],
        ],
        [dz, 0, -dx],
        c,
      );
    }
  const points = rr.flat(),
    holes = [];
  let sum = rr[0].length;
  for (let i = 1; i < rr.length; i++) {
    holes.push(sum);
    sum += rr[i].length;
  }
  const ids = earcut(points.flat(), holes);
  for (const [y, n] of [
    [y0, [0, -1, 0]],
    [y1, [0, 1, 0]],
  ])
    for (let i = 0; i < ids.length; i += 3) {
      const p = ids.slice(i, i + 3).map((j) => [points[j][0], y, points[j][1]]);
      o.addTriangle(
        slot,
        ref,
        p,
        n,
        p.map((p) => [p[0], p[2]]),
        c,
      );
    }
}
function insideRing([x, z], r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++)
    if (
      r[i][1] > z !== r[j][1] > z &&
      x < ((r[j][0] - r[i][0]) * (z - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]
    )
      inside = !inside;
  return inside;
}
const insidePart = (p, f) =>
  insideRing(p, f.rings[0]) && !f.rings.slice(1).some((r) => insideRing(p, r));
function window(o, y, w, h, d) {
  face(o, 'glass', 0, y, 0, w, h, glass);
  if (d === 0) return;
  if (d < 3) {
    for (const x of [-w / 2, 0, w / 2]) face(o, 'metal', x, y, 0.018, 0.065, h, wood);
    if (d > 1)
      for (const yy of [y, y + h * 0.5, y + h]) face(o, 'metal', 0, yy, 0.025, w, 0.055, wood);
    return;
  }
  for (const x of [-w / 2, 0, w / 2]) B(o, 'metal', x, y, 0.02, 0.07, h, 0.09, wood);
  for (const yy of [y, y + h * 0.5, y + h]) B(o, 'metal', 0, yy, 0.03, w + 0.1, 0.065, 0.1, wood);
  B(o, 'wall', 0, y - 0.12, 0, w + 0.3, 0.14, 0.25, light);
}
function arch(o, y, w, h, d) {
  const r = w / 2,
    cy = y + h - r,
    n = d < 3 ? 10 : 18;
  window(o, y, w, h - r, d);
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * i) / n,
      b = (Math.PI * (i + 1)) / n,
      p = [
        [0, cy, 0.005],
        [Math.cos(a) * r, cy + Math.sin(a) * r, 0.005],
        [Math.cos(b) * r, cy + Math.sin(b) * r, 0.005],
      ];
    o.addTriangle(
      'glass',
      ref,
      p,
      [0, 0, 1],
      [
        [0.5, 0],
        [0, 1],
        [1, 1],
      ],
      glass,
    );
    if (d > 1)
      ribbon(
        o,
        [Math.cos(a) * (r + 0.12), cy + Math.sin(a) * (r + 0.12)],
        [Math.cos(b) * (r + 0.12), cy + Math.sin(b) * (r + 0.12)],
        0.13,
        0.02,
        light,
      );
    if (d > 2 && i % 3 === 0)
      ribbon(o, [0, cy], [Math.cos(a) * r, cy + Math.sin(a) * r], 0.055, 0.06, wood);
  }
}
function balcony(o, w, y, d) {
  if (d < 2) {
    B(o, 'metal', 0, y, 0, w, 0.7, 0.07, white);
    return;
  }
  B(o, 'metal', 0, y + 0.76, 0, w, 0.065, 0.075, white);
  B(o, 'metal', 0, y + 0.1, 0, w, 0.055, 0.065, white);
  const n = Math.ceil(w / 0.6);
  for (let i = 0; i <= n; i++)
    face(o, 'metal', -w / 2 + (w * i) / n, y + 0.1, 0.01, 0.035, 0.68, white);
  if (d > 2)
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w * (i + 0.5)) / n,
        ww = w / n;
      ribbon(o, [x - ww * 0.45, y + 0.12], [x + ww * 0.45, y + 0.74], 0.025, 0.027, white);
      ribbon(o, [x + ww * 0.45, y + 0.12], [x - ww * 0.45, y + 0.74], 0.025, 0.029, white);
    }
}
function hip(o, outer, inner, y0, y1) {
  const choices = [];
  for (const r of [inner, [...inner].reverse()])
    for (let k = 0; k < 4; k++) {
      const points = r.map((_, i) => r[(i + k) % 4]);
      choices.push({
        points,
        cost: points.reduce(
          (s, p, i) => s + (p[0] - outer[i][0]) ** 2 + (p[1] - outer[i][1]) ** 2,
          0,
        ),
      });
    }
  inner = choices.sort((a, b) => a.cost - b.cost)[0].points;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      a = [outer[i][0], y0, outer[i][1]],
      b = [outer[j][0], y0, outer[j][1]],
      c = [inner[j][0], y1, inner[j][1]],
      d = [inner[i][0], y1, inner[i][1]];
    for (const p of [
      [a, b, c],
      [a, c, d],
    ]) {
      let n = normalFor(...p);
      if (n[1] < 0) n = n.map((v) => -v);
      o.addTriangle(
        'roof',
        ref,
        p,
        n,
        p.map((p) => [p[0], p[2]]),
        tile,
      );
    }
  }
  polygon(o, [inner], y1 - 0.05, y1, 'roof', tile);
}
function portal(o, frame, d) {
  const x = -0.7;
  const frontZ = (x) => {
    const intersections = [];
    for (const p of frame.features.slice(1).filter((p) => p.properties.height >= 7.5)) {
      const r = p.rings[0];
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length];
        if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x))
          intersections.push(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
      }
    }
    return Math.max(...intersections) + 0.12;
  };
  // Low projecting canopy is an open porch, not a solid block.
  B(o, 'wall', x, 5.24, 37.3, 9.0, 0.35, 8.1, light);
  for (const xx of [-4.0, -1.35, 1.35, 4.0]) {
    B(o, 'wall', x + xx, 2.35, 40.5, 0.48, 2.9, 0.48, white);
    if (d > 1) B(o, 'wall', x + xx, 4.97, 40.5, 0.65, 0.27, 0.65, light);
  }
  for (let i = 0; i < (d === 0 ? 3 : 12); i++) {
    const n = d === 0 ? 3 : 12,
      h = 2.35 / n;
    // Closed stone stair body; preserve the original tread surfaces and fixed base.
    B(o, 'concrete', x, 0, 44.7 - (i * 4) / n, 12.6, (i + 1) * h, 4 / n + 0.15, recess);
  }
  if (d > 0) {
    for (const dx of [-4.7, 0, 4.7]) {
      const p = facing(o, 0, x + dx, frontZ(x + dx));
      window(p, 2.4, dx === 0 ? 2.4 : 1.85, 2.15, d);
      window(p, 5.1, 1.85, 2.1, d);
      if (d > 1) balcony(p, 1.85, 4.4, d);
    }
    for (const sign of [-1, 1]) {
      const side = facing(o, 0, x + sign * 11.9, frontZ(x + sign * 11.9));
      arch(side, 2.4, 2.1, 4.75, d);
      if (d > 1) {
        const cx = x + sign * 9.7;
        for (let k = 0; k < 12; k++) {
          const a = (k * Math.PI) / 6,
            b = ((k + 1) * Math.PI) / 6;
          ribbon(
            facing(o, 0, cx, frontZ(cx)),
            [Math.cos(a) * 0.48, 7.05 + Math.sin(a) * 0.48],
            [Math.cos(b) * 0.48, 7.05 + Math.sin(b) * 0.48],
            0.065,
            0.01,
            light,
          );
        }
      }
    }
  }
  B(o, 'wall', x, 8.0, 32.8, 15, 0.45, 2.0, white);
  B(o, 'wall', x, 8.45, 32.8, 12.2, 0.5, 1.8, white);
  if (d > 1)
    for (const sign of [-1, 1]) {
      const px = x + sign * 8.0;
      B(o, 'wall', px, 2.3, frontZ(px), 0.55, 5.7, 0.25, light);
    }
  if (d > 1) {
    // Raised shield relief, deliberately avoiding invented readable text or a full coat of arms.
    polygon(
      facing(o, 0, x, 34.02),
      [
        [
          [-0.6, -0.02],
          [0.6, -0.02],
          [0.45, 0.2],
          [0, 0.48],
          [-0.45, 0.2],
        ],
      ],
      7.88,
      8.35,
      'wall',
      recess,
    );
    for (const sign of [-1, 1]) B(o, 'metal', x + sign * 6.8, 2.3, 43.2, 0.06, 1.0, 0.08, edge);
  }
  // The fixed roof flagstaff is part of the building; lawn flags are excluded.
  B(o, 'metal', x, 8.8, 31.5, 0.065, 5.4, 0.065, edge);
}
const cornerFaces = [
  { name: 'northeast-front', a: [-58.85477, 35.05686], b: [-74.54882, 35.09631], bays: 4 },
  { name: 'southeast-side', a: [-74.54882, 35.09631], b: [-74.45987, 16.28432], bays: 5 },
];
function selectedCornerEdge(a, b) {
  return cornerFaces.some((f) =>
    [a, b].every((v) => [f.a, f.b].some((p) => Math.hypot(v[0] - p[0], v[1] - p[1]) < 1e-6)),
  );
}
function withoutCornerWall(o) {
  return {
    addTriangle: (...a) => o.addTriangle(...a),
    addQuad: (s, r, p, n, u, c) =>
      p.length === 4 &&
      Math.min(...p.map((v) => v[1])) === 1.8 &&
      Math.max(...p.map((v) => v[1])) === 8 &&
      selectedCornerEdge([p[0][0], p[0][2]], [p[1][0], p[1][2]])
        ? undefined
        : o.addQuad(s, r, p, n, u, c),
  };
}
const sashControls = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/r3/r3d/old_parliament_house_canberra/corner-sash-construction-controls.json',
      import.meta.url,
    ),
  ),
);
/** Closed painted joinery stocks and glass, real wall pockets, and physical projecting sill profiles. */
function sashCraft(o) {
  const Q = (slot, p, col) => {
    const n = normalFor(...p),
      a = n.map(Math.abs),
      axis = a.indexOf(Math.max(...a));
    o.addQuad(
      slot,
      ref,
      p,
      n,
      p.map((v) => (axis === 0 ? [v[2], v[1]] : axis === 1 ? [v[0], v[2]] : [v[0], v[1]])),
      col,
    );
  };
  const rect = (x0, y0, x1, y1) => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  const flat = (slot, rings, z, sign, col) => {
    const vertices = rings.flat(),
      holes = [];
    let cursor = rings[0].length;
    for (const r of rings.slice(1)) {
      holes.push(cursor);
      cursor += r.length;
    }
    const ids = earcut(vertices.flat(), holes);
    for (let i = 0; i < ids.length; i += 3) {
      const p = ids.slice(i, i + 3).map((j) => [...vertices[j], z]);
      if (normalFor(...p)[2] * sign < 0) p.reverse();
      o.addTriangle(
        slot,
        ref,
        p,
        [0, 0, sign],
        p.map((v) => [v[0], v[1]]),
        col,
      );
    }
  };
  const solid = (slot, rings, back, front, col) => {
    flat(slot, rings, back, -1, col);
    flat(slot, rings, front, 1, col);
    rings.forEach((ring, j) => {
      ring.forEach((a, i) => {
        const b = ring[(i + 1) % ring.length],
          p = [
            [...a, back],
            [...b, back],
            [...b, front],
            [...a, front],
          ];
        if (j) p.reverse();
        Q(slot, p, col);
      });
    });
  };
  return { Q, rect, flat, solid };
}
function recessedCornerSashes(o) {
  const c = sashControls,
    k = c.windows;
  for (const f of c.faces) {
    const dx = f.b[0] - f.a[0],
      dz = f.b[1] - f.a[1],
      len = Math.hypot(dx, dz),
      nx = dz / len,
      nz = -dx / len,
      local = facing(o, Math.atan2(nx, nz), (f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2),
      { Q, rect, flat, solid } = sashCraft(local),
      centers = Array.from({ length: f.bays }, (_, j) => len / 2 - ((j + 0.5) * len) / f.bays),
      shape = (x, y, h) => rect(x - k.width / 2, y, x + k.width / 2, y + h);
    flat(
      'cornerWall',
      [
        rect(-len / 2, c.wall.bottom, len / 2, c.wall.top),
        ...centers.flatMap((x) => k.bands.map(([y, h]) => shape(x, y, h))),
      ],
      0,
      1,
      white,
    );
    for (const x of centers)
      for (const [y, h] of k.bands) {
        const l = x - k.width / 2,
          r = x + k.width / 2,
          top = y + h,
          opening = shape(x, y, h);
        for (let i = 0; i < 4; i++) {
          const a = opening[i],
            b = opening[(i + 1) % 4];
          Q(
            'cornerReveal',
            [
              [...a, 0],
              [...b, 0],
              [...b, -k.recess],
              [...a, -k.recess],
            ],
            white,
          );
        }
        solid(
          'cornerSash',
          [rect(l - k.frameWidth, y - k.frameWidth, r + k.frameWidth, top + k.frameWidth), opening],
          k.frameBack,
          k.frameFront,
          light,
        );
        solid(
          'cornerSash',
          [opening, rect(l + 0.025, y + 0.025, r - 0.025, top - 0.025)],
          -0.045,
          0.025,
          wood,
        );
        for (const upper of [false, true]) {
          const bottom = upper ? y + h * 0.5 - 0.015 : y + 0.025,
            tt = upper ? top - 0.025 : y + h * 0.5 + 0.025,
            left = l + 0.035,
            right = r - 0.035,
            inner = rect(
              left + k.sashWidth,
              bottom + k.sashWidth,
              right - k.sashWidth,
              tt - k.sashWidth,
            ),
            back = upper ? k.upperBack : k.lowerBack,
            front = upper ? k.upperFront : k.lowerFront;
          solid('cornerSash', [rect(left, bottom, right, tt), inner], back, front, light);
          solid(
            'cornerGlass',
            [inner],
            front - k.glassBehindFace - k.glassThickness,
            front - k.glassBehindFace,
            glass,
          );
        }
        // Closed, gently weathered sill: lower outer edge sheds water without a painted-on line.
        const left = l - 0.12,
          right = r + 0.12,
          back = -0.06,
          front = k.sillDepth,
          bottom = y - 0.14,
          nearTop = y + 0.01,
          outerTop = y - 0.035,
          p = [
            [left, bottom, back],
            [right, bottom, back],
            [right, bottom, front],
            [left, bottom, front],
            [left, nearTop, back],
            [right, nearTop, back],
            [right, outerTop, front],
            [left, outerTop, front],
          ];
        for (const face of [
          [0, 3, 2, 1],
          [4, 5, 6, 7],
          [0, 1, 5, 4],
          [3, 7, 6, 2],
          [0, 4, 7, 3],
          [1, 2, 6, 5],
        ])
          Q('cornerSill', face.map((i) => p[i]).reverse(), light);
      }
  }
}

function walls(o, parts, d) {
  if (d === 0) return;
  for (const f of parts) {
    const h = f.properties.height;
    for (let ri = 0; ri < f.rings.length; ri++) {
      const r = f.rings[ri].map((p) => p.slice());
      if (ringArea(r) > 0 !== (ri === 0)) r.reverse();
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          len = Math.hypot(dx, dz);
        if (len < 2.3) continue;
        if (d === 3 && f.id === 'buildings/35184886298725' && selectedCornerEdge(a, b)) continue;
        const nx = dz / len,
          nz = -dx / len,
          angle = Math.atan2(nx, nz),
          n = Math.floor(len / (d === 1 ? 5.5 : 3.5));
        for (let j = 0; j < n; j++) {
          const t = (j + 0.5) / n,
            x = a[0] + dx * t,
            z = a[1] + dz * t;
          if (z > 32 && Math.abs(x + 0.7) < 15) continue;
          const local = facing(o, angle, x + nx * 0.05, z + nz * 0.05),
            probe = [x + nx * 0.3, z + nz * 0.3];
          const bands =
            d === 1
              ? [[3.6, 2.6]]
              : [
                  [2.55, 1.9],
                  [5.08, 1.95],
                ];
          for (const [y, hh] of bands) {
            if (
              y + hh > h - 0.4 ||
              parts.some(
                (other) => other !== f && other.properties.height > y && insidePart(probe, other),
              )
            )
              continue;
            window(local, y, Math.min(1.65, (len / n) * 0.58), hh, d);
            if (d > 1 && z > 31 && nz > 0.6) balcony(local, 1.65, 4.37, d);
          }
        }
      }
    }
  }
}
export function oldParliamentHouse(o, _frame, d = 3) {
  const f =
      _frame ??
      JSON.parse(
        fs.readFileSync(
          new URL(
            '../../../content/worldgen/source/places/r3/r3d/old_parliament_house_canberra/map-frame.json',
            import.meta.url,
          ),
        ),
      ),
    base = f.features[0],
    all = f.features.slice(1),
    parts = all.filter(
      (p) =>
        ![
          'buildings/35184886298721',
          'buildings/35184886298712',
          'buildings/35184886122970',
          'buildings/35184885978783',
          'buildings/35184885978784',
        ].includes(p.id),
    );
  polygon(o, base.rings, -6, 1.8, 'wall', white);
  if (d > 0)
    for (let i = 0; i < base.rings[0].length; i++) {
      const a = base.rings[0][i],
        b = base.rings[0][(i + 1) % base.rings[0].length];
      if (a[1] < 31 || b[1] < 31) continue;
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz);
      if (len < 0.5) continue;
      const t = facing(o, Math.atan2(-dz, dx), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      B(t, 'brick', 0, -0.2, 0, len, 2.0, 0.12, brick);
    }
  if (d === 0) {
    // Simplified continuous ranges retain all four open courts without small roof steps.
    polygon(o, base.rings, 1.8, 7.7, 'wall', white);
    for (const [x, z, w, l, h] of [
      [-1, 8, 18, 16, 11],
      [28, 8, 37, 23, 12.5],
      [-31, 8, 37, 23, 12.5],
      [-1, -20, 18, 27, 8.6],
    ])
      B(o, 'wall', x, 7.7, z, w, h - 7.7, l, white);
    for (const id of ['buildings/52776565592504', 'buildings/52776565595024']) {
      const wing = all.find((p) => p.id === id);
      polygon(o, wing.rings, 7.7, 11, 'wall', white);
    }
  } else
    for (const p of parts) {
      const h = p.properties.height;
      polygon(
        d === 3 && p.id === 'buildings/35184886298725' ? withoutCornerWall(o) : o,
        p.rings,
        1.8,
        h,
        'wall',
        white,
      );
      polygon(o, p.rings, h, h + 0.11, 'roof', tile);
      if (d > 1)
        for (let ri = 0; ri < p.rings.length; ri++) {
          const ring = p.rings[ri];
          for (let i = 0; i < ring.length; i++) {
            const a = ring[i],
              b = ring[(i + 1) % ring.length],
              dx = b[0] - a[0],
              dz = b[1] - a[1],
              len = Math.hypot(dx, dz);
            if (len < 0.3) continue;
            // Parapet cap carries the simple horizontal classical trim.
            const c = facing(o, Math.atan2(-dz, dx), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
            B(c, 'wall', 0, h + 0.1, 0, len, 0.22, 0.26, light);
          }
        }
    }
  for (const ids of [
    ['buildings/35184886298712', 'buildings/35184885978783'],
    ['buildings/35184886122970', 'buildings/35184885978784'],
  ]) {
    const a = all.find((p) => p.id === ids[0]),
      b = all.find((p) => p.id === ids[1]);
    hip(o, a.rings[0], b.rings[0], 12.5, 14);
  }
  if (d > 0) {
    const upper = all.find((p) => p.id === 'buildings/35184885882688');
    polygon(o, upper.rings, 8.6, 11, 'wall', white);
    polygon(o, upper.rings, 11, 11.12, 'roof', tile);
    for (const sign of [-1, 1])
      for (let i = 0; i < 4; i++)
        window(facing(o, (sign * Math.PI) / 2, sign * 5.45, -14.2 - i * 2.7), 9.0, 0.9, 1.15, d);
  }
  walls(o, parts, d);
  if (d === 3) recessedCornerSashes(o);
  portal(o, f, d);
}
export function oldParliamentSkyline(o) {
  oldParliamentHouse(o, undefined, 0);
}
export function oldParliamentDistrict(o) {
  oldParliamentHouse(o, undefined, 1);
}
export function oldParliamentStreet(o) {
  oldParliamentHouse(o, undefined, 2);
}
const surfaces = {
  cornerWall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  cornerReveal: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  cornerSill: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  cornerSash: { slot: 'trim', graph: 'metal_painted', roughness: 0.68, metallic: 0.2 },
  cornerGlass: { ...landmarkSurfaces.glass, localRef: ref },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.92, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.9, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.68, metallic: 0.2 },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const oldParliamentModel = {
  id: 'old_parliament_house_canberra',
  key: 'old_parliament_house_canberra',
  recipe: 'structure-old-parliament-house-canberra.mjs',
  cell: 'r3/r3d',
  title: 'Old Parliament House (Canberra)',
  brief:
    'Stripped classical parliamentary building with stepped white low ranges, tall paired chamber roof masses, central hall, four open courtyards, eighteen recessed white double-hung southeast-corner sash windows, other retained framed windows, round-arched north openings, balcony rails and central open entrance canopy with broad steps.',
  camera: [-132, 115, 175],
  lookAt: [-1, 5, -14],
  qaCameras: [
    { name: 'front', position: [-1, 62, 203], lookAt: [-1, 4, 20] },
    { name: 'front-detail', position: [-25, 12, 75], lookAt: [-1, 4.5, 33] },
    { name: 'back', position: [135, 110, -175], lookAt: [0, 5, -22] },
    { name: 'corner-front-sash', position: [-66, 6.6, 39.5], lookAt: [-68.66, 6.04, 35.08] },
    { name: 'corner-side-sash', position: [-79.4, 4, 27], lookAt: [-74.51, 3.5, 25.69] },
  ],
  mediumFiContext: { scale: 1.1 },
  build: oldParliamentHouse,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-old-parliament-house-canberra.mjs',
    level: 'skyline',
    export: 'oldParliamentSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'oldParliamentDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'oldParliamentStreet', errorMeters: 0.3, surfaces },
    },
  },
  limitations: [
    'Current southeast-corner construction uses exact native6480x4320Dhx1own-photo CC0originals001/002and native detail after Qualla-first68candidate/metadata scan. Eighteen real sash pockets on two corner pavilion faces with white closed staggered sash/glass/sills; unsupported central vertical bars and duplicated corner rails removed. Earlier attribution/private/aerial controls excluded. Full fixed main building/low wings/portico/four courtyards/roof retained pending broader fidelity review. Mapped8–14m parts, dimensions, profiles, closed sash positions/material type and present condition remain estimates, not survey certification.',
    'Preserves four mapped open courtyards and original main building/own entrance scope. Detached garden buildings, lawn installations, temporary exhibition banners, trees and interiors excluded. Shield relief is simplified and readable heraldic lettering omitted. New painted-sash material finish is an estimate from the visible white finish. Original three lower geometry streams and all other outside attributes exact; conservative LODerror estimates.8/.4/.3m account for new recess/profile changes without measured geometric-error certification.',
    'Independent official ACT2020 LiDAR-derived2m contours replace rejected Terrarium after initial geometry;original fields and identities retained. Source heights are unchanged. Provider smoothing and contour interpolation can miss steps/local breaks;this is not a1m raster or floor survey.',
    'Bounded source-relative geographic preview with generic-footprint replacement disabled. Other host terrain needs contact review. No photographic pixels redistributed;no measured survey or physical-device performance claim.',
  ],
};
