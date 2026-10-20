/** Parliament House, Canberra: architectural grass roofs, office courts and steel flag mast. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  white = rgb('e0dfd5'),
  light = rgb('efeee5'),
  recess = rgb('adb3a9'),
  glass = rgb('5e7a77'),
  silver = rgb('bdc1bd'),
  gray = rgb('999e96'),
  grass = rgb('637c4d'),
  tile = rgb('a16e50'),
  dark = rgb('3b4947'),
  paving = rgb('a77f68');
const constructionUrl = new URL(
  '../../../content/worldgen/source/places/r3/r3d/parliament_house_canberra/site-construction-controls.json',
  import.meta.url,
);
function constructionControls() {
  return JSON.parse(fs.readFileSync(constructionUrl));
}

function insetRing(ring, width) {
  const sign = Math.sign(ringArea(ring));
  const edges = ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    return {
      point: [a[0] - ((sign * dz) / length) * width, a[1] + ((sign * dx) / length) * width],
      direction: [dx, dz],
    };
  });
  return edges.map((b, i) => {
    const a = edges[(i + edges.length - 1) % edges.length],
      cross = a.direction[0] * b.direction[1] - a.direction[1] * b.direction[0],
      delta = b.point.map((v, k) => v - a.point[k]),
      t = (delta[0] * b.direction[1] - delta[1] * b.direction[0]) / cross;
    return a.point.map((v, k) => v + a.direction[k] * t);
  });
}

function forecourtGarage(o, d) {
  const control = constructionControls(),
    r = control.deckOutline,
    l = control.levels,
    inner = insetRing(r, l.perimeterWallThickness);
  if (d < 2) {
    // Coarse solid envelope remains below the basin; its top cannot fill the pool.
    polygon(o, [r], l.garageFloorBottom, l.garageRoofTop, 'wall', gray);
    polygon(o, [r, inner], l.garageRoofTop, l.wallTop, 'wall', white);
    return;
  }
  // Hollow exterior shell only. The garage's actual interior parking grid is excluded.
  polygon(o, [r], l.garageFloorBottom, l.garageFloorTop, 'wall', gray);
  polygon(o, [r], l.garageSoffit, l.garageRoofTop, 'wall', gray);
  polygon(o, [r, inner], l.garageFloorTop, l.wallTop, 'wall', white);
}
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
function ringArea(r) {
  return r.reduce(
    (s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
    0,
  );
}
function polygon(o, rings, y0, y1, slot, c, bottom = true, topColor = c) {
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
      if (n[1] < 0 && !bottom) continue;
      const p = ids.slice(i, i + 3).map((j) => [points[j][0], y, points[j][1]]);
      o.addTriangle(
        slot,
        ref,
        p,
        n,
        p.map((p) => [p[0], p[2]]),
        n[1] > 0 ? topColor : c,
      );
    }
}

function clean(r, tolerance = 0.03) {
  const p = r.map((v) => v.slice());
  let again = true;
  while (again && p.length > 4) {
    again = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        l = Math.hypot(dx, dz);
      if (
        Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.03 ||
        Math.abs((b[0] - a[0]) * dz - (b[1] - a[1]) * dx) / l < tolerance
      ) {
        p.splice(i, 1);
        again = true;
        break;
      }
    }
  }
  return p;
}
function clip(r, axis, k, less) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      u = a[axis] - k,
      v = b[axis] - k,
      ai = less ? u <= 0 : u >= 0,
      bi = less ? v <= 0 : v >= 0;
    if (ai) out.push(a);
    if (ai !== bi) {
      const t = u / (u - v);
      out.push(a.map((x, j) => x + (b[j] - x) * t));
    }
  }
  return out;
}
function curvedRoof(o, ring, height, d) {
  const r = clean(ring, d === 0 ? 3 : 0.03);
  if (ringArea(r) < 0) r.reverse();
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      n = [b[1] - a[1], 0, a[0] - b[0]];
    quad(
      o,
      'wall',
      [
        [a[0], -18, a[1]],
        [b[0], -18, b[1]],
        [b[0], height(b[1]), b[1]],
        [a[0], height(a[1]), a[1]],
      ],
      n,
      white,
    );
  }
  const ids = earcut(r.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((j) => [r[j][0], height(r[j][1]) + 0.04, r[j][1]]);
    let n = normalFor(...p);
    if (n[1] < 0) n = n.map((v) => -v);
    o.addTriangle(
      'grass',
      ref,
      p,
      n,
      p.map((p) => [p[0], p[2]]),
      grass,
    );
  }
}
function window(o, y, w, h, d) {
  face(o, 'glass', 0, y, 0, w, h, glass);
  if (d < 1) return;
  if (d < 3) {
    if (d > 1) for (const x of [-w / 2, w / 2]) face(o, 'metal', x, y, 0.02, 0.08, h, dark);
    face(o, 'metal', 0, y, 0.023, 0.06, h, dark);

    return;
  }
  for (const x of [-w / 2, w / 2]) B(o, 'metal', x, y, 0.02, 0.07, h, 0.09, dark);
  for (const yy of [y, y + h]) face(o, 'metal', 0, yy, 0.08, w + 0.1, 0.07, dark);
  face(o, 'metal', 0, y, 0.075, 0.05, h, dark);
  face(o, 'metal', 0, y + h * 0.6, 0.08, w, 0.05, dark);
}
function inside([x, z], rings) {
  const test = (r) => {
    let yes = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++)
      if (
        r[i][1] > z !== r[j][1] > z &&
        x < ((r[j][0] - r[i][0]) * (z - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]
      )
        yes = !yes;
    return yes;
  };
  return test(rings[0]) && !rings.slice(1).some(test);
}
const grade = (z) =>
  z > 44
    ? 18 - ((Math.min(211, z) - 44) * 26) / 167
    : z < -82
      ? 18 - ((-82 - Math.max(-242, z)) * 24) / 160
      : 20;
function wingWindows(o, p, all, d) {
  if (d === 0) return;
  for (let ri = 0; ri < p.rings.length; ri++) {
    const r = clean(p.rings[ri]);
    if (ringArea(r) > 0 !== (ri === 0)) r.reverse();
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        l = Math.hypot(dx, dz);
      if (l < 3) continue;
      const n = d === 1 ? Math.floor(l / 12) : Math.floor(l / 6),
        nx = dz / l,
        nz = -dx / l;
      for (let j = 0; j < n; j++) {
        const t = (j + 0.5) / n,
          x = a[0] + dx * t,
          z = a[1] + dz * t,
          probe = [x + nx * 0.3, z + nz * 0.3],
          out = facing(o, Math.atan2(nx, nz), x + nx * 0.05, z + nz * 0.05);
        for (const y of d === 1 ? [4] : [-1.6, 2.4, 6.4]) {
          if (
            all.some(
              (q) =>
                q !== p && inside(probe, q.rings) && (q.grass ? grade(z) : q.properties.height) > y,
            )
          )
            continue;
          window(out, y, Math.min(1.8, (l / n) * 0.55), 2.35, d);
        }
      }
    }
  }
}
function skylight(o, ring, y0, y1, d) {
  const r = clean(ring),
    cx = r.reduce((s, p) => s + p[0], 0) / r.length,
    cz = r.reduce((s, p) => s + p[1], 0) / r.length;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      p = [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [cx, y1, cz],
      ];
    let n = normalFor(...p);
    if (n[1] < 0) n = n.map((v) => -v);
    o.addTriangle(
      'glass',
      ref,
      p,
      n,
      p.map((p) => [p[0], p[2]]),
      glass,
    );
    if (d > 1) beam(o, 'metal', p[0], p[2], 0.15, 0.15, white);
  }
}
function chamber(o, x, z, round, d) {
  const w = 46,
    l = 48,
    y = 18.3;
  B(o, 'wall', x, 10.9, z, w, y - 10.9, l, white);
  if (round) {
    const n = d === 0 ? 8 : d === 1 ? 12 : 32;
    loft(o, 'tile', [radialRing(y, 21, 21, n, [x, z]), radialRing(22.0, 8, 8, n, [x, z])], tile, {
      cap: false,
    });
    loft(
      o,
      'glass',
      [radialRing(22.0, 8, 8, n, [x, z]), radialRing(25, 2.8, 2.8, n, [x, z])],
      glass,
    );
  } else {
    const base = [
        [x - 20, z - 20],
        [x + 20, z - 20],
        [x + 20, z + 20],
        [x - 20, z + 20],
      ],
      top = base.map((p) => [x + (p[0] - x) * 0.3, z + (p[1] - z) * 0.3]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4,
        p = [
          [base[i][0], y, base[i][1]],
          [base[j][0], y, base[j][1]],
          [top[j][0], 24.5, top[j][1]],
          [top[i][0], 24.5, top[i][1]],
        ];
      for (const pp of [
        [p[0], p[1], p[2]],
        [p[0], p[2], p[3]],
      ]) {
        let n = normalFor(...pp);
        if (n[1] < 0) n = n.map((v) => -v);
        o.addTriangle(
          'tile',
          ref,
          pp,
          n,
          pp.map((p) => [p[0], p[2]]),
          tile,
        );
      }
    }
    skylight(o, top, 24.5, 27, d);
  }
  if (d > 1)
    for (const sign of [-1, 1])
      for (let i = 0; i < 8; i++)
        window(
          facing(o, sign > 0 ? 0 : Math.PI, x - 18 + i * 5.1, z + sign * 24.04),
          12.2,
          2.1,
          3.3,
          d,
        );
}
function upperCurves(o, features, d) {
  for (const i of [9, 30]) {
    const r = features.find((p) => p.index === i).rings[0];
    if (d < 2) {
      polygon(o, [clean(r, 1)], 20, 27, 'wall', gray);
      continue;
    }
    for (const [lo, hi] of [
      [-100, -34],
      [-24, 1],
      [11, 100],
    ]) {
      const cut = clip(clip(r, 1, lo, false), 1, hi, true);
      if (cut.length > 2) polygon(o, [clean(cut)], 20, 27, 'wall', gray);
    }
    for (const [lo, hi] of [
      [-34, -24],
      [1, 11],
    ]) {
      const cut = clip(clip(r, 1, lo, false), 1, hi, true);
      if (cut.length > 2) polygon(o, [clean(cut)], 25.9, 27, 'wall', gray);
    }
  }
}
function portal(o, d) {
  const cx = -6.6,
    z = 104.8;
  // Deep open centre between two marble end ranges, with a square central recess.
  for (const sign of [-1, 1]) {
    const x = cx + sign * 27;
    B(o, 'marble', x, -0.4, 98, 21, 14.4, 13.5, white);
    if (d > 0)
      for (let i = 0; i < 4; i++)
        for (const y of [1.1, 7.9]) window(facing(o, 0, x - 7.5 + i * 5, 104.81), y, 1.7, 3.4, d);
  }
  B(o, 'marble', cx, 13.0, 98, 75, 1, 13.5, light);
  for (const x of d === 0 ? [-18, -6, 6, 18] : [-18, -14, -10, -6, 6, 10, 14, 18])
    B(o, 'marble', cx + x, -0.3, z, 1.0, 13.3, 1.4, white);
  if (d > 0) {
    B(o, 'marble', cx, 6.2, z, 6.4, 1.0, 1.4, white);
    for (const sign of [-1, 1]) B(o, 'marble', cx + sign * 2.7, 7.2, z, 1.0, 5.8, 1.4, white);
    B(o, 'wall', cx, 0, 86.4, 48, 9, 1, white);
  }
  if (d > 0)
    for (let i = 0; i < 9; i++) window(facing(o, 0, cx - 20 + i * 5, 86.95), 1.1, 2.0, 4.7, d);
  // Resting ledges and thin green roof glazing behind the open facade.
  if (d > 0) B(o, 'glass', cx, 12.8, 94.8, 48, 0.15, 12.5, glass);
  B(o, 'wall', cx, -0.8, 109, 78, 0.8, 9, paving);
  if (d > 1) {
    for (let i = 0; i < 8; i++) B(o, 'marble', cx - 17.5 + i * 5, 0, 103.4, 0.3, 12.7, 0.3, light);
    for (const sign of [-1, 1])
      for (let i = 0; i < 4; i++)
        B(o, 'marble', cx + sign * (21 + 5 * i), 6.2, 104.85, 4, 0.15, 0.14, light);
  }
}
function flag(o, cx, cz, d) {
  const blue = rgb('173a70'),
    red = rgb('a43c49'),
    w = 12.8,
    h = 6.4,
    y0 = 94.6,
    p = (x, y, z = 0.0) => [cx + x, y0 + y, cz + Math.sin(x * 0.55) * 0.45 + z];
  const panel = (x, y, w, h, c, offset = 0) => {
    const n = d === 0 ? 1 : Math.max(1, Math.ceil(w / 1.1));
    for (let i = 0; i < n; i++) {
      const a = x + (w * i) / n,
        b = x + (w * (i + 1)) / n,
        pp = [p(a, y, offset), p(b, y, offset), p(b, y + h, offset), p(a, y + h, offset)];
      for (const q of [
        [pp[0], pp[1], pp[2]],
        [pp[0], pp[2], pp[3]],
      ])
        o.addTriangle(
          'grass',
          ref,
          q,
          normalFor(...q),
          q.map((v) => [v[0], v[1]]),
          c,
        );
    }
  };
  panel(0, 0, w, h, blue);
  if (d < 1) return;
  const stripe = (a, b, w, c, z) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy),
      u = (-dy * w) / l / 2,
      v = (dx * w) / l / 2,
      pp = [
        p(a[0] + u, a[1] + v, z),
        p(b[0] + u, b[1] + v, z),
        p(b[0] - u, b[1] - v, z),
        p(a[0] - u, a[1] - v, z),
      ];
    for (const q of [
      [pp[0], pp[1], pp[2]],
      [pp[0], pp[2], pp[3]],
    ])
      o.addTriangle(
        'grass',
        ref,
        q,
        normalFor(...q),
        q.map((v) => [v[0], v[1]]),
        c,
      );
  };
  for (const [a, b] of [
    [
      [0.2, 3.4],
      [6.2, 6.2],
    ],
    [
      [0.2, 6.2],
      [6.2, 3.4],
    ],
  ]) {
    stripe(a, b, 0.4, light, 0.015);
    stripe(a, b, 0.14, red, 0.022);
  }
  panel(0, 4.55, 6.4, 0.5, light, 0.025);
  panel(2.95, 3.2, 0.5, 3.2, light, 0.025);
  panel(0, 4.7, 6.4, 0.2, red, 0.04);
  panel(3.1, 3.2, 0.2, 3.2, red, 0.04);
  const star = (x, y, r, n = 7) => {
    const points = Array.from({ length: n * 2 }, (_, i) => {
        const a = Math.PI / 2 + (i * Math.PI) / n,
          rr = i % 2 ? r * 0.42 : r;
        return p(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 0.06);
      }),
      center = p(x, y, 0.06);
    for (let i = 0; i < points.length; i++) {
      const q = [center, points[i], points[(i + 1) % points.length]];
      o.addTriangle(
        'grass',
        ref,
        q,
        normalFor(...q),
        q.map((v) => [v[0], v[1]]),
        light,
      );
    }
  };
  for (const [x, y, r, n] of [
    [3.2, 1.7, 0.55, 7],
    [9.8, 5.2, 0.4, 7],
    [7.9, 3.4, 0.4, 7],
    [11.4, 3.4, 0.4, 7],
    [9.8, 0.9, 0.4, 7],
    [10.7, 2.7, 0.2, 5],
  ])
    star(x, y, r, n);
}
function forecourt(o, d) {
  const plan = JSON.parse(
      fs.readFileSync(
        new URL(
          '../../../content/worldgen/source/places/r3/r3d/parliament_house_canberra/forecourt-frame.json',
          import.meta.url,
        ),
      ),
    ),
    levels = plan.verticalControls;
  // Published OSM map vertices; current visual reference is the exact PD2006original.
  // The pool is asymmetric and has three water patches around real bridges/island.
  const surface = (rings, bottom, top, slot, color, preserveOutline = false) => {
    if (d > 0) {
      polygon(
        o,
        preserveOutline ? rings : rings.map((r) => clean(r, d === 1 ? 0.5 : 0.03)),
        bottom,
        top,
        slot,
        color,
      );
      return;
    }
    // At skyline distance, retain the plan and openings with upward surface proxies.
    const rr = preserveOutline ? rings : rings.map((r) => clean(r, 1.5)),
      points = rr.flat(),
      holes = [];
    let count = rr[0].length;
    for (const r of rr.slice(1)) {
      holes.push(count);
      count += r.length;
    }
    const ids = earcut(points.flat(), holes);
    for (let i = 0; i < ids.length; i += 3) {
      const p = ids.slice(i, i + 3).map((j) => [points[j][0], top, points[j][1]]);
      o.addTriangle(
        slot,
        ref,
        p,
        [0, 1, 0],
        p.map((p) => [p[0], p[2]]),
        color,
      );
    }
  };
  for (const p of plan.brownPaving)
    surface(p, levels.pavingBottom, levels.pavingTop, 'wall', paving);
  for (const p of plan.paleBorder)
    surface(p, levels.basinBottom, levels.pavingTop, 'marble', light);
  surface([plan.basinOutline], levels.basinBottom, levels.basinFloor, 'wall', dark, true);
  for (const p of plan.solidIslandAndBridges)
    surface(p, levels.basinFloor, levels.pavingTop, 'marble', light);
  for (const p of plan.water) surface(p, levels.waterBottom, levels.waterTop, 'glass', glass);
  for (const p of plan.grass) {
    if (d > 0)
      polygon(
        o,
        p.map((r) => clean(r, d === 1 ? 0.5 : 0.03)),
        levels.plantingBottom,
        levels.plantingTop - 0.04,
        'marble',
        light,
      );
    surface(p, levels.plantingTop - 0.04, levels.plantingTop, 'grass', grass);
  }
  const mosaic = plan.mosaic;
  B(
    o,
    'marble',
    mosaic.center[0],
    levels.pavingTop,
    mosaic.center[1],
    mosaic.size[0],
    levels.mosaicTop - levels.pavingTop,
    mosaic.size[1],
    recess,
  );
}
function mast(o, d) {
  const cx = -8,
    cz = -12.5;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const points = [
          [26, 20],
          [5.7, 51],
          [2.8, 56],
          [2, 59],
          [2, 79],
        ],
        n = d < 2 ? 4 : 8;
      const rings = (d === 0 ? [points[0], points[2], points[4]] : points).map(([r, y], i) => {
        const x = cx + sx * r,
          z = cz + sz * r,
          width = i === 0 ? 1.8 : i < 3 ? 1.3 : 1.0;
        return radialRing(y, width, 0.55, n, [x, z], Math.PI / 4);
      });
      loft(o, 'metal', rings, silver);
      if (d > 0) B(o, 'wall', cx + sx * 26, 18.8, cz + sz * 26, 4.4, 1.2, 4.4, gray);
    }
  for (const y of d === 0 ? [77] : [59, 77])
    for (const sign of d === 0 ? [1] : [-1, 1]) {
      beam(o, 'metal', [cx - 2, y, cz + sign * 2], [cx + 2, y, cz + sign * 2], 0.45, 0.4, silver);
      beam(o, 'metal', [cx + sign * 2, y, cz - 2], [cx + sign * 2, y, cz + 2], 0.45, 0.4, silver);
    }
  B(o, 'metal', cx, 46, cz, 0.22, 55, 0.22, silver);
  flag(o, cx, cz, d);
}
export function parliamentHouse(o, _frame, d = 3) {
  const f =
      _frame ??
      JSON.parse(
        fs.readFileSync(
          new URL(
            '../../../content/worldgen/source/places/r3/r3d/parliament_house_canberra/map-frame.json',
            import.meta.url,
          ),
        ),
      ),
    at = (i) => f.features.find((p) => p.index === i),
    wings = [at(22), at(41), at(93)],
    mass = [at(27), at(25), at(46)],
    green = [48, 49, 81].map((i) => ({ ...at(i), grass: true }));
  for (const p of wings) {
    const rings = p.rings.map((r) => clean(r, d === 0 ? 8 : 0.03));
    polygon(o, rings, -18, p.properties.height, 'wall', white, d > 0, gray);
  }
  for (const p of mass) {
    polygon(
      o,
      [clean(p.rings[0], d === 0 ? 2 : 0.03)],
      -18,
      p.properties.height,
      'wall',
      white,
      d > 0,
      grass,
    );
    if (d > 0)
      polygon(
        o,
        [clean(p.rings[0])],
        p.properties.height + 0.01,
        p.properties.height + 0.04,
        'grass',
        grass,
      );
  }
  for (const p of green) curvedRoof(o, p.rings[0], grade, d);
  if (d > 0) {
    upperCurves(o, f.features, d);
    for (const p of wings) wingWindows(o, p, [...wings, ...mass, ...green], d);
  }
  chamber(o, 65, -14, true, d);
  chamber(o, -80, -14, false, d);
  if (d > 0) polygon(o, [clean(at(1).rings[0])], 20.05, 20.2, 'wall', gray);
  skylight(o, at(0).rings[0], 20.1, 25, d);
  if (d > 0) skylight(o, at(29).rings[0], 20, 22, d);
  portal(o, d);
  forecourt(o, d);
  forecourtGarage(o, d);
  mast(o, d);
}
export function parliamentSkyline(o) {
  parliamentHouse(o, undefined, 0);
}
export function parliamentDistrict(o) {
  parliamentHouse(o, undefined, 1);
}
export function parliamentStreet(o) {
  parliamentHouse(o, undefined, 2);
}
const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  marble: { slot: 'wall', graph: 'stone_marble', roughness: 0.8, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_stainless', roughness: 0.55, metallic: 0.75 },
  grass: {
    slot: 'roof',
    localRef: 'palette:#feffff',
    roughness: 1,
    metallic: 0,
    doubleSided: true,
  },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const parliamentModel = {
  id: 'parliament_house_canberra',
  key: 'parliament_house_canberra',
  recipe: 'structure-parliament-house-canberra.mjs',
  cell: 'r3/r3d',
  title: 'Parliament House (Canberra)',
  brief:
    'Paired office/chamber wings with courts, curved retaining walls and grass-covered ramp roofs, round Senate and angular House chamber skylight roofs, open white marble north entrance, central glass skylights and four curved steel flag-mast legs with tall uprights and Australian flag. Published native forecourt plan retains three asymmetric water patches, connecting bridges, planted island beds and a plain mosaic square.',
  camera: [-290, 220, 445],
  lookAt: [-7, 16, -8],
  qaCameras: [
    { name: 'front', position: [-7, 54, 305], lookAt: [-7, 25, 40] },
    { name: 'front-detail', position: [-65, 26, 180], lookAt: [-7, 8, 100] },
    { name: 'back', position: [260, 200, -390], lookAt: [-7, 12, -35] },
    { name: 'forecourt-plan', position: [-6, 225, 178], lookAt: [-6, 0, 160] },
    { name: 'forecourt-approach', position: [-45, 5, 220], lookAt: [-6, 1, 150] },
    { name: 'deck-edge-detail', position: [-115, 8, 230], lookAt: [-10, -1.5, 175] },
  ],
  mediumFiContext: { scale: 1.3 },
  build: parliamentHouse,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Bounded source-relative preview using original ACT2020LiDAR-derived2m contours acquired before the new forecourt shell. Absolute elevations are unchanged;the original nominal contact[-7,128],anchor,heading,building/paving/roof levels and all generated geometry are retained. Real model-owned forecourt deck/garage shell covers its own opening. Original coarse Terrarium files are archived unchanged. Exact AHD slab/garage levels and another live host terrain remain unverified.',
  groundCutout: {
    outline: constructionControls().deckOutline,
    basis:
      'Own mapped forecourt deck and physical basement support envelope only. Primary text establishes garage below forecourt/pool. Continuous modeled roof/slab/floor and perimeter walls cover this opening;actual basin/bridges/island remain above the garage roof. Original architectural levels and published source elevations are retained. Source field is independently acquired ACTcontours;old Terrarium is archived unchanged. No whole-building pad or courtyard fill.',
  },
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-parliament-house-canberra.mjs',
    level: 'skyline',
    export: 'parliamentSkyline',
    errorMeters: 5.5,
    surfaces,
    authoredLevels: {
      district: { export: 'parliamentDistrict', errorMeters: 1.2, surfaces },
      street: { export: 'parliamentStreet', errorMeters: 0.25, surfaces },
    },
  },
  limitations: [
    'Current visual references are exact creator-released public-domain2006roof-side/forecourt originals and a2010distant silhouette original. Earlier CC-BY-SA photographs,rights-unverified/copyrighted aerials and engineering illustrations are excluded. OSM vectors and primary architecture/construction/flag-mast text facts remain controls. Office elevations,court details,roof grades and partly hidden joins are estimates,not a survey.',
    'Architectural grass roofs are real sloping model geometry. Original ends/grades remain estimates. Original ACT2020two-metre contour elevations replace rejected coarse Terrarium without fitting architecture or source heights;native data smoothing is retained. Exact AHD floor/roof grades are not surveyed.',
    'Four narrow office courts on each side and executive court remain open. Original OSM water/pedestrian/grass vertices control the flared forecourt,asymmetric three-part basin,bridges and planted island. Public-domain2006forecourt photo confirms the pool/curb/open entrance topology. The196m²mosaic is a plain14m square;painting omitted. Basin depths remain exterior estimates. Fine rooftop plant,interiors,detached buildings,roads,security furniture and temporary objects excluded.',
    'Primary text establishes real parking below the forecourt/pool. Only a bounded exterior deck/support envelope within the mapped paving is represented. Hidden slab,floor and wall dimensions are estimates declared before geometry,not surveyed garage levels or dimensions inferred from entry clearance,project-wide excavation or DEM. Street/close levels have a hollow shell;coarse levels simplify its concealed volume. Actual parking grid,ramps and navigable interior are excluded.',
    'Flag top is81m above an estimated20m roof deck, based on the Parliamentary Services maintenance account. Curved leg profiles, connection details and simplified flag graphics are estimates; no structural engineering claim.',
    'Bounded source-relative placement;the retained[-7,128]nominal forecourt reference yields596mAHD from original ACTcontours,not an independently surveyed deck elevation. Source terrain can interpolate beneath structural decks. Another live host field needs its own contact review. Footprint replacement disabled;no physical-device performance claim.',
  ],
};
