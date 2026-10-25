/** 'kapaleeshwarar_temple': Kapaleeshwarar's mapped gateways, shrine roofs and open mandapas. */

import { buildDravidianTower } from './dravidian-tower-geometry.mjs';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

const inside = (p, poly) => {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
};
function halfPlane(poly, axis, cut, less) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      insideA = less ? a[axis] <= cut : a[axis] >= cut,
      insideB = less ? b[axis] <= cut : b[axis] >= cut;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = (cut - a[axis]) / (b[axis] - a[axis]);
      result.push(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return result;
}
export function buildKapaliTemple(face, detail, r, sampleTerrain) {
  const a = r.architecturalAngleRadians,
    c = Math.cos(a),
    s = Math.sin(a),
    grade = (x, z) => sampleTerrain(c * x - s * z, s * x + c * z),
    f = (role, ps, n) => {
      if (detail === 0 && n[1] < -0.5) return;
      face(
        role,
        ps.map(([x, y, z]) => [c * x - s * z, y, s * x + c * z]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      );
    };
  const samples = (p) =>
    p.outline.flatMap((a, i) => {
      const b = p.outline[(i + 1) % p.outline.length],
        n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
      return Array.from({ length: n + 1 }, (_, k) => [
        a[0] + ((b[0] - a[0]) * k) / n,
        a[1] + ((b[1] - a[1]) * k) / n,
      ]);
    });
  const low = (q) =>
    Math.min(...q.polygons.flatMap((p) => samples(p).map((p) => grade(...p)))) - 0.65;
  function parapet(p, y) {
    if (detail === 0) return;
    for (let i = 0; i < p.outline.length; i++) {
      const a = p.outline[i],
        b = p.outline[(i + 1) % p.outline.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz);
      if (len < 0.2) continue;
      const n = detail === 1 ? 1 : Math.ceil(len / (detail === 2 ? 4 : 2));
      for (let j = 0; j < n; j++) {
        const t = (j + 0.5) / n,
          x = a[0] + dx * t,
          z = a[1] + dz * t,
          angle = Math.atan2(dz, dx),
          co = Math.cos(angle),
          si = Math.sin(angle),
          at = (role, ps, normal) =>
            f(
              role,
              ps.map(([u, v, w]) => [x + co * u - si * w, v, z + si * u + co * w]),
              [co * normal[0] - si * normal[2], normal[1], si * normal[0] + co * normal[2]],
            );
        box(at, detail === 0 || j % 2 === 0 ? 'wall' : 'rose', 0, y, 0, len / n + 0.01, 0.42, 0.3);
      }
    }
  }
  const towerIds = new Set(r.towers.map((t) => t.owner)),
    sanctumIds = new Set(r.shrines.map((t) => t.owner));
  for (const q of r.parts) {
    if (towerIds.has(q.owner)) continue;
    const bottom = low(q),
      floor = q.floorY,
      body = 4.5;
    for (const p of q.polygons) {
      if (detail > 0) prism(f, 'stone', p, bottom, floor + 0.12);
      if (sanctumIds.has(q.owner)) {
        const z = q.owner === 35184580656527 ? 19.4 : -1,
          front = q.center[0] + q.width / 2,
          back = front - 5.5,
          east = halfPlane(p.outline, 0, back, false),
          shell = [
            halfPlane(p.outline, 0, back, true),
            halfPlane(east, 1, z - 1.65, true),
            halfPlane(east, 1, z + 1.65, false),
          ];
        for (const poly of shell)
          if (poly.length >= 3)
            prism(
              f,
              'stone',
              { outline: poly, holes: [] },
              detail === 0 ? bottom : floor,
              floor + body,
            );
        box(f, 'stone', front - 2.4, floor + 3.15, z, 5.2, body - 3.15, 3.3);
        box(f, 'door', back + 0.12, floor, z, 0.18, 3.15, 3.1);
      } else {
        const corners = p.outline.filter(
          (_, i) => detail > 0 || i === 0 || i === Math.floor(p.outline.length / 2),
        );
        const posts = [];
        for (const a of corners) {
          const n = p.outline.length,
            idx = p.outline.indexOf(a),
            before = p.outline[(idx + n - 1) % n],
            after = p.outline[(idx + 1) % n],
            x = a[0] + (before[0] - a[0] + (after[0] - a[0])) * 0.025,
            z = a[1] + (before[1] - a[1] + (after[1] - a[1])) * 0.025;
          posts.push([x, z]);
        }
        if (detail >= 1) {
          const pts = p.outline,
            xs = pts.map((p) => p[0]),
            zs = pts.map((p) => p[1]),
            stride = detail === 1 ? 12 : 4.5;
          for (let x = Math.min(...xs) + 2.2; x < Math.max(...xs) - 1; x += stride)
            for (let z = Math.min(...zs) + 2.2; z < Math.max(...zs) - 1; z += stride)
              if (inside([x, z], pts) && !p.holes.some((h) => inside([x, z], h)))
                posts.push([x, z]);
        }
        for (const [x, z] of posts) {
          box(
            f,
            'stone',
            x,
            detail === 0 ? bottom : floor,
            z,
            0.48,
            body + (detail === 0 ? floor - bottom : 0),
            0.48,
          );
          if (detail >= 3)
            for (const y of [floor + 0.12, floor + body - 0.3])
              box(f, 'stone', x, y, z, 0.72, 0.22, 0.72);
        }
      }
      prism(f, 'roof', p, floor + body, floor + body + 0.26);
      parapet(p, floor + body + 0.26);
    }
  }
  for (const p of r.towers) {
    const bottom = low(p) - p.floorY,
      at = (role, ps, n) =>
        f(
          role,
          ps.map(([u, y, v]) => [p.center[0] + v, p.floorY + y, p.center[1] + u]),
          [n[2], n[1], n[0]],
        );
    buildDravidianTower(
      at,
      {
        width: p.depth,
        depth: p.width,
        baseHeight: p.baseHeight,
        openingWidth: p.openingWidth,
        openingHeight: p.openingHeight,
        tierHeight: p.tierHeight,
        tiers: p.tiers,
        crestHeight: p.crestHeight,
        bottom,
      },
      detail,
    );
    const threshold = rect(p.center[0], p.center[1], p.width + 0.03, p.openingWidth - 0.03);
    prism(f, 'stone', threshold, low(p), p.floorY + 0.08);
    for (const side of [-1, 1])
      for (let i = 0; i < (detail === 0 ? 1 : 3); i++) {
        const x = p.center[0] + side * (p.width / 2 + (i + 0.5) * 0.38),
          z = p.center[1],
          top = p.floorY - 0.1 - i * 0.18;
        prism(
          f,
          'stone',
          rect(x, z, 0.4, p.openingWidth + 0.7),
          Math.min(grade(x, z) - 0.65, top - 0.2),
          top,
        );
      }
  }
  for (const p of r.shrines) {
    const q = r.parts.find((q) => q.owner === p.owner),
      [x, z] = p.center,
      base = q.floorY + 4.76;
    const at = (role, ps, n) =>
      f(
        role,
        ps.map(([u, y, v]) => [x + u, base + y, z + v]),
        n,
      );
    for (let i = 0; i < p.tiers; i++) {
      const w = p.width * (1 - 0.2 * i),
        d = p.depth * (1 - 0.2 * i),
        y = i * 1.6;
      box(at, ['blue', 'green', 'rose'][i % 3], 0, y, 0, w, 0.28, d);
      loft(
        at,
        'wall',
        0,
        0,
        [
          [y + 0.28, w * 0.94],
          [y + 1.5, w * 0.8],
        ],
        false,
        (k) => [
          [-k / 2, (-d * k) / w / 2],
          [k / 2, (-d * k) / w / 2],
          [k / 2, (d * k) / w / 2],
          [-k / 2, (d * k) / w / 2],
        ],
      );
      if (detail >= 2)
        for (const side of [-1, 1])
          for (const u of [-1, 0, 1])
            box(
              at,
              ['rose', 'blue', 'green'][(u + 4 + i) % 3],
              u * w * 0.3,
              y + 0.3,
              side * d * 0.43,
              0.4,
              0.8,
              0.38,
            );
    }
    const top = p.tiers * 1.6,
      crest = detail > 0;
    loft(
      at,
      'green',
      0,
      0,
      [
        [top, p.width * 0.4],
        [top + 1.2, p.width * 0.45],
        [p.height - 0.65, p.width * 0.2],
      ],
      crest,
    );
    loft(
      at,
      'gold',
      0,
      0,
      [
        [p.height - 0.65, 0.55],
        [p.height - 0.35, 0.72],
        [p.height, 0.2],
      ],
      false,
    );
  }
  const p = r.flagstaff,
    [x, z] = p.center,
    ground = Math.min(grade(x, z) - 0.65, p.floorY - 0.2);
  box(f, 'stone', x, ground, z, 1.2, p.floorY + 0.35 - ground, 1.2);
  const at = (role, ps, n) =>
    f(
      role,
      ps.map(([u, y, v]) => [x + u, p.floorY + y, z + v]),
      n,
    );
  loft(
    at,
    'gold',
    0,
    0,
    detail === 0
      ? [
          [0.35, 0.52],
          [p.height, 0.22],
        ]
      : [
          [0.35, 0.52],
          [1.2, 0.38],
          [p.height - 0.8, 0.28],
          [p.height - 0.45, 0.7],
          [p.height, 0.22],
        ],
    false,
  );
  if (detail >= 1)
    for (const y of [p.height - 1.6, p.height - 1, p.height - 0.4])
      box(at, 'gold', 0, y, 0, 0.25, 0.1, 1.8);
}
