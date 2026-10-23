/** Current Bingen Mouse Tower: pale asymmetric body, stair turret and two crenellated crowns. */
import earcut from 'earcut';
import { prism, rect } from './khmer-structure-geometry.mjs';

export function buildMouseTower(face, detail, r, sample) {
  const F = r.floorY,
    P = ([x, y, z]) => [
      r.center[0] + x * r.xAxis[0] + z * r.zAxis[0],
      y,
      r.center[1] + x * r.xAxis[1] + z * r.zAxis[1],
    ],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, points, normal) => face(role, points.map(P), D(normal)),
    ground = (x, z) => {
      const p = P([x, 0, z]);
      return sample(p[0], p[2]);
    },
    polygon = (role, rings, map, normal) => {
      const ps = rings.flat(),
        holes = [];
      let count = rings[0].length;
      for (const ring of rings.slice(1)) {
        holes.push(count);
        count += ring.length;
      }
      const indices = earcut(ps.flat(), holes);
      for (let i = 0; i < indices.length; i += 3)
        f(
          role,
          indices.slice(i, i + 3).map((j) => map(ps[j])),
          normal,
        );
    },
    solid = (role, rings, back, front, map, n, u) => {
      polygon(role, rings, (p) => map(p, front), n);
      polygon(
        role,
        rings,
        (p) => map(p, back),
        n.map((v) => -v),
      );
      for (let k = 0; k < rings.length; k++) {
        const ring = rings[k],
          sign =
            Math.sign(
              ring.reduce(
                (s, p, i) =>
                  s + p[0] * ring[(i + 1) % ring.length][1] - p[1] * ring[(i + 1) % ring.length][0],
                0,
              ),
            ) * (k ? -1 : 1);
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            b = ring[(i + 1) % ring.length],
            s = (b[1] - a[1]) * sign,
            y = (a[0] - b[0]) * sign;
          f(
            role,
            [map(a, back), map(b, back), map(b, front), map(a, front)],
            [u[0] * s, y, u[2] * s],
          );
        }
      }
    },
    rectangle = (x, lo, w, h) => [
      [x - w / 2, lo],
      [x + w / 2, lo],
      [x + w / 2, lo + h],
      [x - w / 2, lo + h],
    ],
    pointed = (x, w, lo, spring, apex) => [
      [x - w / 2, lo],
      [x + w / 2, lo],
      [x + w / 2, spring],
      [x + w * 0.28, spring + (apex - spring) * 0.65],
      [x, apex],
      [x - w * 0.28, spring + (apex - spring) * 0.65],
      [x - w / 2, spring],
    ],
    edges = (outline) => {
      const sign = Math.sign(
        outline.reduce(
          (s, p, i) =>
            s +
            p[0] * outline[(i + 1) % outline.length][1] -
            p[1] * outline[(i + 1) % outline.length][0],
          0,
        ),
      );
      return outline.map((a, i) => {
        const b = outline[(i + 1) % outline.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          u = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len],
          n = [u[2] * sign, 0, -u[0] * sign];
        return {
          a,
          b,
          len,
          u,
          n,
          map: ([s, y], d = 0) => [a[0] + u[0] * s + n[0] * d, F + y, a[1] + u[2] * s + n[2] * d],
        };
      });
    },
    ring = (radius, x = r.stairX, z = r.stairZ, count = 8) =>
      Array.from({ length: count }, (_, i) => [
        x + radius * Math.cos(Math.PI / 8 + (i * 2 * Math.PI) / count),
        z + radius * Math.sin(Math.PI / 8 + (i * 2 * Math.PI) / count),
      ]),
    chamfered = (w, d, chamfer) => [
      [-w / 2 + chamfer, -d / 2],
      [w / 2 - chamfer, -d / 2],
      [w / 2, -d / 2 + chamfer],
      [w / 2, d / 2 - chamfer],
      [w / 2 - chamfer, d / 2],
      [-w / 2 + chamfer, d / 2],
      [-w / 2, d / 2 - chamfer],
      [-w / 2, -d / 2 + chamfer],
    ],
    roof = (outline, inner, lo, hi, role = 'stone') => {
      const center = outline.reduce((v, p) => v.map((x, k) => x + p[k] / outline.length), [0, 0]);
      for (let i = 0; i < outline.length; i++) {
        const j = (i + 1) % outline.length,
          a = outline[i],
          b = outline[j],
          n = [(a[0] + b[0]) / 2 - center[0], 0.25, (a[1] + b[1]) / 2 - center[1]];
        f(
          role,
          [
            [a[0], F + lo, a[1]],
            [b[0], F + lo, b[1]],
            [inner[j][0], F + hi, inner[j][1]],
            [inner[i][0], F + hi, inner[i][1]],
          ],
          n,
        );
      }
      polygon(role, [outline], (p) => [p[0], F + lo, p[1]], [0, -1, 0]);
      polygon(role, [inner], (p) => [p[0], F + hi, p[1]], [0, 1, 0]);
    };
  prism(
    f,
    'stone',
    { outline: r.outer },
    Math.min(...r.outer.map((p) => ground(...p))) - 0.45,
    F + 0.08,
  );
  const bodyEdges = edges(r.body);
  for (const edge of bodyEdges) {
    const { len, n, u, map } = edge,
      windows =
        detail === 0
          ? []
          : n[0] > 0.8
            ? [rectangle(len * 0.21, 10.3, 0.53, 1.05), rectangle(len * 0.79, 10.3, 0.53, 1.05)]
            : [rectangle(len / 2, 4.2, 0.4, 0.88), rectangle(len / 2, 10.3, 0.55, 1.05)];
    solid(
      'wall',
      [rectangle(len / 2, 0.08, len, r.coreEave - 0.08), ...windows],
      -0.38,
      0,
      map,
      n,
      u,
    );
    for (const opening of windows) {
      solid('panel', [opening], -0.29, -0.27, map, n, u);
      if (detail > 1) {
        const x = (opening[0][0] + opening[1][0]) / 2,
          y = opening[0][1],
          w = opening[1][0] - opening[0][0],
          h = opening[2][1] - y;
        solid(
          'stone',
          [rectangle(x, y - 0.08, w + 0.18, h + 0.16), opening],
          0.006,
          0.065,
          map,
          n,
          u,
        );
      }
    }
    // Follow the actual facade planes, avoiding overlapping axis-aligned corner strips.
    if (detail > 0)
      for (const s of [0.075, len - 0.075])
        solid('stone', [rectangle(s, 0.08, 0.14, r.coreEave - 0.08)], 0.002, 0.045, map, n, u);
    // Corbels project from the body to the gallery above; the gaps remain blind relief.
    if (detail > 0)
      for (let i = 0; i < 4; i++) {
        const s = (len * (i + 0.5)) / 4,
          w = detail === 1 ? 0.3 : 0.38,
          shape = [
            [r.coreEave - 0.48, 0],
            [r.coreEave - 0.3, 0.12],
            [r.galleryLo - 0.1, 0.34],
            [r.galleryLo, 0.34],
            [r.galleryLo, 0],
          ];
        for (let j = 0; j < shape.length; j++) {
          const a = shape[j],
            b = shape[(j + 1) % shape.length];
          f(
            'stone',
            [
              map([s - w / 2, a[0]], a[1]),
              map([s + w / 2, a[0]], a[1]),
              map([s + w / 2, b[0]], b[1]),
              map([s - w / 2, b[0]], b[1]),
            ],
            [n[0] * (b[0] - a[0]), a[1] - b[1], n[2] * (b[0] - a[0])],
          );
        }
        for (const sign of [-1, 1])
          polygon(
            'stone',
            [shape.map(([y, d]) => [d, y])],
            (p) => map([s + (sign * w) / 2, p[1]], p[0]),
            u.map((v) => v * sign),
          );
      }
  }
  const gallery = chamfered(r.width + 0.64, r.depth + 0.64, 0.28),
    innerGallery = chamfered(r.width - 0.08, r.depth - 0.08, 0.24);
  roof(r.body, r.body, r.coreEave - 0.02, r.galleryLo - 0.08);
  // Closed shallow projecting soffit and the gallery's closed walls.
  prism(f, 'stone', { outline: gallery }, F + r.galleryLo - 0.12, F + r.galleryLo + 0.1);
  for (const e of edges(gallery)) {
    const holes = detail === 0 || e.len < 2 ? [] : [rectangle(e.len / 2, 15.2, 0.36, 1.05)];
    solid(
      'wall',
      [rectangle(e.len / 2, r.galleryLo + 0.1, e.len, r.deckY - r.galleryLo - 0.1), ...holes],
      -0.28,
      0,
      e.map,
      e.n,
      e.u,
    );
    for (const hole of holes) solid('panel', [hole], -0.2, -0.18, e.map, e.n, e.u);
  }
  prism(f, 'stone', { outline: gallery }, F + r.deckY - 0.1, F + r.deckY);
  prism(f, 'stone', { outline: gallery, holes: [innerGallery] }, F + r.deckY, F + r.deckY + 0.52);
  for (const e of edges(gallery).filter((e) => e.len > 2)) {
    const count = 3;
    for (let i = 0; i < count; i++)
      solid(
        'stone',
        [
          rectangle(
            (e.len * (i + 0.5)) / count,
            r.deckY + 0.52,
            detail === 0 ? 0.72 : 0.78,
            r.mainMerlonTop - r.deckY - 0.52,
          ),
        ],
        -0.3,
        0.015,
        e.map,
        e.n,
        e.u,
      );
  }

  const shaft = ring(r.stairRadius);
  // Native eastern projection is the stair turret; it continues above the main crown.
  for (const e of edges(shaft)) {
    const holes =
      detail > 0 && e.n[0] > 0.35
        ? [4.0, 9.0, 16.2].map((y) => rectangle(e.len / 2, y, 0.2, 0.76))
        : [];
    solid(
      'wall',
      [rectangle(e.len / 2, 0.08, e.len, r.shaftTop - 0.08), ...holes],
      -0.2,
      0,
      e.map,
      e.n,
      e.u,
    );
    for (const hole of holes) solid('panel', [hole], -0.16, -0.14, e.map, e.n, e.u);
  }
  const head = ring(r.headRadius),
    headInner = ring(r.headRadius - 0.2);
  prism(f, 'stone', { outline: head }, F + r.shaftTop - 0.08, F + r.shaftTop + 0.1);
  for (const [i, e] of edges(head).entries()) {
    const hole =
      i % 2 === 0
        ? pointed(e.len / 2, Math.min(0.67, e.len * 0.68), r.shaftTop + 0.42, 22.45, 23.14)
        : undefined;
    solid(
      'wall',
      [
        rectangle(e.len / 2, r.shaftTop + 0.1, e.len, r.headTop - r.shaftTop - 0.1),
        ...(hole ? [hole] : []),
      ],
      -0.2,
      0,
      e.map,
      e.n,
      e.u,
    );
    if (hole && detail > 1) {
      const outer = pointed(
        e.len / 2,
        Math.min(0.86, e.len * 0.87),
        r.shaftTop + 0.33,
        22.45,
        23.32,
      );
      solid('stone', [outer, hole], 0.005, 0.07, e.map, e.n, e.u);
    }
  }
  prism(f, 'stone', { outline: head }, F + r.headTop - 0.08, F + r.headTop + 0.15);
  prism(
    f,
    'stone',
    { outline: head, holes: [headInner] },
    F + r.headTop + 0.15,
    F + r.headTop + 0.62,
  );
  for (const [i, e] of edges(head).entries())
    if (detail > 0 || i % 2 === 0)
      solid(
        'stone',
        [
          rectangle(
            e.len / 2,
            r.headTop + 0.62,
            detail === 0 ? 0.58 : 0.48,
            r.crownTop - r.headTop - 0.62,
          ),
        ],
        -0.24,
        0.03,
        e.map,
        e.n,
        e.u,
      );

  // The small dark lower housing and closed hipped cap occupy the mapped projection.
  const housing = rect(r.stairX, r.stairZ, 2.25, 2.36).outline;
  prism(
    f,
    'roof',
    { outline: housing },
    Math.min(...housing.map((p) => ground(...p))) - 0.2,
    F + 2.05,
  );
  roof(
    housing,
    housing.map((p) => [r.stairX + (p[0] - r.stairX) * 0.45, r.stairZ + (p[1] - r.stairZ) * 0.45]),
    2.05,
    2.63,
    'roof',
  );
  if (detail > 0) {
    const east = edges(housing).find((e) => e.n[0] > 0.9);
    if (east)
      solid(
        'panel',
        [rectangle(east.len / 2, 0.16, 0.75, 1.48)],
        0.002,
        0.015,
        east.map,
        east.n,
        east.u,
      );
  }
  // Sparse iron rods are attached to the actual cap/deck; no copied flag or sign.
  const rod = (x, z, lo, hi, rad) =>
    prism(f, 'metal', { outline: ring(rad, x, z, detail === 0 ? 4 : 6) }, F + lo, F + hi);
  rod(r.stairX + 0.72, r.stairZ - 0.62, r.headTop + 0.1, r.ironTip, 0.025);
  if (detail > 0) {
    rod(r.stairX - 0.68, r.stairZ + 0.63, r.headTop + 0.1, r.ironTip - 0.22, 0.023);
    rod(-r.width / 2 + 0.55, -r.depth / 2 + 0.55, r.deckY, r.deckY + 2.0, 0.035);
  }
}
