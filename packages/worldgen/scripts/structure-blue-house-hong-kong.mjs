/** Blue House, Hong Kong: four connected shophouse units and their own balconies/access stairs. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  blue = rgb('367c99'),
  pale = rgb('cbd5d2'),
  white = rgb('e4e3da'),
  gray = rgb('b9bdb6'),
  iron = rgb('294b50'),
  green = rgb('2b5b4c'),
  blueWood = rgb('609db0'),
  glass = rgb('657e7c'),
  tile = rgb('666d68'),
  brown = rgb('54473e');
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
function prism(o, ring, y0, y1, s = 'wall', c = blue) {
  const r = ring.map((p) => p.slice());
  if (
    r.reduce(
      (a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
      0,
    ) < 0
  )
    r.reverse();
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    quad(
      o,
      s,
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
  const ids = earcut(r.flat());
  for (const [y, n] of [
    [y0, [0, -1, 0]],
    [y1, [0, 1, 0]],
  ])
    for (let i = 0; i < ids.length; i += 3) {
      const p = ids.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]);
      o.addTriangle(
        s,
        ref,
        p,
        n,
        p.map((v) => [v[0], v[2]]),
        c,
      );
    }
}
function clip(ring, axis, value, less) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      av = a[axis] - value,
      bv = b[axis] - value,
      ai = less ? av <= 0 : av >= 0,
      bi = less ? bv <= 0 : bv >= 0;
    if (ai) out.push(a);
    if (ai !== bi) {
      const t = av / (av - bv);
      out.push(a.map((v, j) => v + (b[j] - v) * t));
    }
  }
  return out;
}
function line(o, s, a, b, w, c) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l = Math.hypot(dx, dy),
    x = ((-dy / l) * w) / 2,
    y = ((dx / l) * w) / 2;
  quad(
    o,
    s,
    [
      [a[0] + x, a[1] + y, a[2]],
      [b[0] + x, b[1] + y, b[2]],
      [b[0] - x, b[1] - y, b[2]],
      [a[0] - x, a[1] - y, a[2]],
    ],
    [0, 0, 1],
    c,
  );
}
function roofPanel(o, ring, height) {
  const ids = earcut(ring.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((j) => [ring[j][0], height(ring[j][1]), ring[j][1]]);
    let n = normalFor(...p);
    if (n[1] < 0) n = n.map((v) => -v);
    o.addTriangle(
      'roof',
      ref,
      p,
      n,
      p.map((v) => [v[0], v[2]]),
      tile,
    );
  }
}
function endGable(o, a, b, d, c) {
  const aa = [a[0], 13.75, a[1]],
    bb = [b[0], 13.75, b[1]],
    t = (-0.9 - a[1]) / (b[1] - a[1]),
    ridge = [a[0] + (b[0] - a[0]) * t, 14.8, -0.9],
    p = [aa, bb, ridge],
    n = normalFor(...p);
  o.addTriangle(
    'wall',
    ref,
    p,
    n,
    p.map((v) => [v[2], v[1]]),
    c,
  );
  if (d > 1) {
    beam(o, 'concrete', aa, ridge, 0.16, 0.16, white);
    beam(o, 'concrete', ridge, bb, 0.16, 0.16, white);
  }
}
function rail(o, w, y, d, c = iron, ornate = true) {
  if (d === 0) {
    B(o, 'metal', 0, y + 0.15, 0, w, 0.8, 0.06, c);
    return;
  }
  B(o, 'metal', 0, y + 1.02, 0, w, 0.06, 0.07, brown);
  B(o, 'metal', 0, y + 0.12, 0, w, 0.05, 0.055, c);
  const n = d === 1 ? Math.ceil(w / 0.6) : Math.ceil(w / 0.22);
  for (let i = 0; i <= n; i++) {
    const x = -w / 2 + (w * i) / n;
    if (d < 2) face(o, 'metal', x, y + 0.15, 0, 0.035, 0.85, c);
    else line(o, 'metal', [x, y + 0.16, 0], [x, y + 0.98, 0], 0.025, c);
  }
  if (d > 1 && ornate) {
    const m = Math.max(1, Math.floor(w / 1.8));
    for (let i = 0; i < m; i++) {
      const x = -w / 2 + ((i + 0.5) * w) / m;
      for (const scale of [1, 0.72]) {
        const k = d > 2 ? 16 : 10;
        for (let j = 0; j < k; j++) {
          const a = (j / k) * Math.PI * 2,
            b = ((j + 1) / k) * Math.PI * 2;
          line(
            o,
            'metal',
            [x + Math.cos(a) * 0.43 * scale, y + 0.57 + Math.sin(a) * 0.37 * scale, 0.015],
            [x + Math.cos(b) * 0.43 * scale, y + 0.57 + Math.sin(b) * 0.37 * scale, 0.015],
            0.025,
            c,
          );
        }
      }
      for (const sign of [-1, 1]) {
        line(
          o,
          'metal',
          [x + sign * 0.48, y + 0.18, 0.02],
          [x + sign * 0.75, y + 0.58, 0.02],
          0.025,
          c,
        );
        line(
          o,
          'metal',
          [x + sign * 0.75, y + 0.58, 0.02],
          [x + sign * 0.48, y + 0.97, 0.02],
          0.025,
          c,
        );
      }
    }
  }
}
function glazed(o, x, y, w, h, d, c = blueWood, door = true) {
  if (!d) return;
  face(o, 'wood', x, y - 0.03, 0.055, w + 0.18, h + 0.13, c);
  face(o, 'glass', x, y, 0.08, w, h, glass);
  if (d === 1) {
    face(o, 'wood', x, y, 0.09, 0.06, h, c);
    return;
  }
  for (const xx of [x - w / 2, x, x + w / 2]) B(o, 'wood', xx, y, 0.1, 0.07, h, 0.065, c);
  const bottom = door ? 0.52 : 0;
  for (const yy of [y + bottom, y + h * 0.5, y + h * 0.81, y + h])
    face(o, 'wood', x, yy, 0.15, w, 0.055, c);
  if (door) {
    for (const sign of [-1, 1]) {
      face(o, 'wood', x + (sign * w) / 4, y + 0.04, 0.13, w * 0.46, 0.43, c);
      face(o, 'wood', x + (sign * w) / 4, y + h * 0.82, 0.14, w * 0.43, 0.19, c);
      if (d > 2) B(o, 'metal', x + sign * 0.055, y + 1.05, 0.18, 0.025, 0.16, 0.025, iron);
    }
  }
  if (d > 2) {
    for (const xx of [x - w / 4, x + w / 4])
      face(o, 'wood', xx, y + bottom, 0.16, 0.04, h * 0.81 - bottom, c);
    B(o, 'concrete', x, y - 0.1, 0.15, w + 0.28, 0.12, 0.3, pale);
  }
}
function corbel(o, x, y, d) {
  if (d < 2) return;
  const profile = [
      [y, 3.15],
      [y, 5.33],
      [y - 0.22, 5.33],
      [y - 0.35, 4.12],
      [y - 1.02, 3.55],
      [y - 1.02, 3.15],
    ],
    ids = earcut(profile.flat());
  for (const sign of [-1, 1])
    for (let i = 0; i < ids.length; i += 3) {
      const q = ids.slice(i, i + 3).map((j) => [x + sign * 0.12, profile[j][0], profile[j][1]]);
      o.addTriangle(
        'concrete',
        ref,
        q,
        [sign, 0, 0],
        q.map((v) => [v[2], v[1]]),
        white,
      );
    }
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length],
      p = [
        [x - 0.12, ...a],
        [x + 0.12, ...a],
        [x + 0.12, ...b],
        [x - 0.12, ...b],
      ];
    quad(o, 'concrete', p, normalFor(...p), white);
  }
}
const craftControls = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/we/wec/blue_house_hong_kong/balcony-door-construction-controls.json',
      import.meta.url,
    ),
  ),
);
/** Metric UVs and fully closed stocks for the new balcony and doorway craft. */
function closeCraft(o) {
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
  const box = (slot, x0, y0, x1, y1, back, front, col) =>
    solid(slot, [rect(x0, y0, x1, y1)], back, front, col);
  const strip = (slot, a, b, width, back, front, col) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      len = Math.hypot(dx, dy),
      ox = (-dy * width) / (2 * len),
      oy = (dx * width) / (2 * len);
    solid(
      slot,
      [
        [
          [a[0] + ox, a[1] + oy],
          [a[0] - ox, a[1] - oy],
          [b[0] - ox, b[1] - oy],
          [b[0] + ox, b[1] + oy],
        ],
      ],
      back,
      front,
      col,
    );
  };
  return { Q, rect, flat, solid, box, strip };
}
function closedBalconyRail(o, w, y, _d, c = iron, ornate = true) {
  const k = craftControls.rails,
    { box, solid, strip, rect } = closeCraft(o),
    back = -k.depth / 2,
    front = k.depth / 2;
  const handWidth = w + (ornate ? k.frontHandrailExtension : 0);
  box('balconyWood', -handWidth / 2, y + 1.02, handWidth / 2, y + 1.08, -0.035, 0.035, brown);
  for (const h of [0.12, 0.9])
    box('balconyIron', -w / 2, y + h, w / 2, y + h + 0.025, back, front, c);
  const motifs = ornate
    ? Array.from(
        { length: Math.max(1, Math.floor(w / 1.8)) },
        (_, i) => -w / 2 + ((i + 0.5) * w) / Math.max(1, Math.floor(w / 1.8)),
      )
    : [];
  const bars = Math.ceil(w / k.postPitch);
  for (let i = 0; i <= bars; i++) {
    const x = -w / 2 + (i * w) / bars;
    if (motifs.some((cx) => Math.abs(x - cx) < k.motifHalfWidth + 0.04)) continue;
    box('balconyIron', x - k.barWidth / 2, y + 0.15, x + k.barWidth / 2, y + 0.98, back, front, c);
  }
  const ring = (x, yy, rx, ry, n) => {
    const loop = (a, b) =>
      Array.from({ length: n }, (_, j) => {
        const t = (j * 2 * Math.PI) / n;
        return [x + a * Math.cos(t), yy + b * Math.sin(t)];
      });
    solid(
      'balconyIron',
      [
        loop(rx + k.barWidth / 2, ry + k.barWidth / 2),
        loop(rx - k.barWidth / 2, ry - k.barWidth / 2),
      ],
      0.015 + back,
      0.015 + front,
      c,
    );
  };
  for (const x of motifs) {
    const l = x - k.motifHalfWidth,
      r = x + k.motifHalfWidth,
      lo = y + k.motifBottom,
      hi = y + k.motifTop;
    solid(
      'balconyIron',
      [rect(l, lo, r, hi), rect(l + k.barWidth, lo + k.barWidth, r - k.barWidth, hi - k.barWidth)],
      back,
      front,
      c,
    );
    ring(x, y + k.motifCenterY, ...k.ellipse, k.largeSegments);
    ring(x, y + k.motifCenterY, ...k.circle, k.largeSegments);
    for (const sign of [-1, 1])
      ring(
        x + sign * k.sideCircleOffset,
        y + k.motifCenterY,
        k.sideCircleRadius,
        k.sideCircleRadius,
        k.smallSegments,
      );
    for (const h of k.minorCenterYs) ring(x, y + h, k.minorRadius, k.minorRadius, k.minorSegments);
    for (const dx of [-0.105, 0, 0.105])
      box('balconyIron', x + dx - k.barWidth / 2, lo, x + dx + k.barWidth / 2, hi, back, front, c);
    for (const sign of [-1, 1])
      for (const sy of [-1, 1])
        strip(
          'balconyIron',
          [x + sign * (k.motifHalfWidth - 0.025), y + k.motifCenterY + sy * 0.29],
          [x + sign * 0.32, y + k.motifCenterY],
          k.barWidth,
          back,
          front,
          c,
        );
  }
}
function joinedBalconyPipes(o) {
  const c = craftControls.rails,
    { Q } = closeCraft(o);
  for (const [x, j] of c.frontPipeXs.map((x, j) => [x, j])) {
    const col = j === c.frontPipeXs.length - 1 ? iron : rgb('3c778b'),
      ring = (y) =>
        Array.from({ length: c.pipeSides }, (_, i) => {
          const a = (i * 2 * Math.PI) / c.pipeSides;
          return [x + c.pipeRadius * Math.cos(a), y, c.pipeZ + c.pipeRadius * Math.sin(a)];
        }),
      lo = ring(c.pipeBottom),
      hi = ring(c.pipeTop);
    for (let i = 0; i < c.pipeSides; i++)
      Q('balconyIron', [lo[i], hi[i], hi[(i + 1) % c.pipeSides], lo[(i + 1) % c.pipeSides]], col);
    for (const [r, n] of [
      [lo, [0, -1, 0]],
      [hi, [0, 1, 0]],
    ])
      for (let i = 1; i < r.length - 1; i++) {
        const p = [r[0], r[i], r[i + 1]];
        if (normalFor(...p)[1] * n[1] < 0) p.reverse();
        o.addTriangle(
          'balconyIron',
          ref,
          p,
          n,
          p.map((v) => [v[0], v[2]]),
          col,
        );
      }
  }
}
function recessedBalconyDoors(o) {
  const f = craftControls.front,
    k = craftControls.doors,
    { box, solid, flat, rect, Q } = closeCraft(o),
    locations = f.bays.flatMap((x, j) =>
      f.levels.map((level) => ({ x, j, y: level + k.aboveFloor })),
    ),
    hole = (v) => rect(v.x - k.width / 2, v.y, v.x + k.width / 2, v.y + k.height);
  for (const [left, right, col] of [
    [f.left, f.splitX, blue],
    [f.splitX, f.right, white],
  ])
    flat(
      'doorWall',
      [
        rect(left, f.bottom, right, f.top),
        ...locations.filter((v) => v.x > left && v.x < right).map(hole),
      ],
      f.z,
      1,
      col,
    );
  for (const v of locations) {
    const x = v.x,
      y = v.y,
      l = x - k.width / 2,
      r = x + k.width / 2,
      top = y + k.height,
      shape = hole(v),
      frame = v.j === 3 ? green : blueWood;
    for (let i = 0; i < 4; i++) {
      const a = shape[i],
        b = shape[(i + 1) % 4];
      Q(
        'doorReveal',
        [
          [...a, f.z],
          [...b, f.z],
          [...b, k.leafBackZ],
          [...a, k.leafBackZ],
        ],
        v.j === 3 ? white : blue,
      );
    }
    solid(
      'doorWood',
      [rect(l - k.frameWidth, y - k.frameWidth, r + k.frameWidth, top + k.frameWidth), shape],
      k.frameBackZ,
      k.frameFrontZ,
      frame,
    );
    solid(
      'doorWood',
      [
        rect(l - 0.012, y - 0.012, r + 0.012, top + 0.012),
        rect(l + 0.035, y + 0.035, r - 0.035, top - 0.035),
      ],
      k.leafBackZ - 0.005,
      f.z + 0.005,
      frame,
    );
    const transom = y + k.height * k.transomFraction;
    for (const sign of [-1, 1]) {
      const left = sign < 0 ? l + 0.015 : x + k.leafGap / 2,
        right = sign < 0 ? x - k.leafGap / 2 : r - 0.015;
      box('doorWood', left, y, right, y + k.lowerPanelHeight, k.leafBackZ, k.leafFrontZ, frame);
      box(
        'doorGlass',
        left,
        y + k.lowerPanelHeight,
        right,
        transom,
        k.leafFrontZ - k.glassThickness,
        k.leafFrontZ,
        glass,
      );
      box(
        'doorGlass',
        left,
        transom,
        right,
        top,
        k.leafFrontZ - k.glassThickness,
        k.leafFrontZ,
        glass,
      );
      const stile = x + sign * 0.04;
      box(
        'doorWood',
        stile - k.barWidth / 2,
        y,
        stile + k.barWidth / 2,
        top,
        k.leafFrontZ - 0.005,
        k.leafFrontZ + k.barDepth,
        frame,
      );
      const quarter = x + (sign * k.width) / 4;
      box(
        'doorWood',
        quarter - 0.02,
        y + k.lowerPanelHeight,
        quarter + 0.02,
        transom,
        k.leafFrontZ - 0.005,
        k.leafFrontZ + k.barDepth,
        frame,
      );
      box(
        'doorIron',
        x + sign * 0.055 - 0.0125,
        y + 1.05,
        x + sign * 0.055 + 0.0125,
        y + 1.21,
        k.leafFrontZ - 0.01,
        k.leafFrontZ + 0.09,
        iron,
      );
    }
    for (const xx of [l + 0.03, r - 0.03])
      box(
        'doorWood',
        xx - k.barWidth / 2,
        y,
        xx + k.barWidth / 2,
        top,
        k.leafFrontZ - 0.005,
        k.leafFrontZ + k.barDepth,
        frame,
      );
    for (const yy of [y + 0.04, y + k.lowerPanelHeight, y + k.height * 0.5])
      for (const [left, right] of [
        [l, x - k.leafGap / 2],
        [x + k.leafGap / 2, r],
      ])
        box(
          'doorWood',
          left,
          yy - k.barWidth / 2,
          right,
          yy + k.barWidth / 2,
          k.leafFrontZ - 0.005,
          k.leafFrontZ + k.barDepth,
          frame,
        );
    for (const yy of [transom, top - 0.025])
      box(
        'doorWood',
        l,
        yy - k.barWidth / 2,
        r,
        yy + k.barWidth / 2,
        k.leafFrontZ - 0.005,
        k.leafFrontZ + k.barDepth,
        frame,
      );
    box('doorReveal', l - 0.14, y - 0.1, r + 0.14, y + 0.02, f.z - 0.06, f.z + 0.31, pale);
  }
}

function front(o, d) {
  const bays = [-6.4, -2.12, 2.15, 6.42],
    levels = [3.95, 7.3, 10.65],
    w = 4.27;
  for (let j = 0; j < 4; j++) {
    const x = bays[j],
      c = j === 3 ? white : blue,
      frame = j === 3 ? green : blueWood,
      railColor = j === 3 ? iron : rgb('3c778b');
    for (const y of [...levels, 14.0]) {
      B(o, 'concrete', x, y - 0.2, 4.25, w + 0.025, 0.2, 2.5, white);
      B(o, 'concrete', x, y - 0.04, 5.43, w + 0.025, 0.1, 0.13, pale);
      corbel(o, x - w / 2 + 0.12, y - 0.2, d);
    }
    for (const y of levels) {
      if (d !== 3) glazed(facing(o, 0, 0, 3.21), x, y + 0.14, 2.38, 2.75, d, frame);
      (d === 3 ? closedBalconyRail : rail)(facing(o, 0, x, 5.37), w - 0.08, y, d, railColor);
      for (const xx of [x - w * 0.47, x + w * 0.47])
        if (d !== 3 && (d || (j === 0 && xx < x) || (j === 3 && xx > x)))
          B(o, 'metal', xx, y, 5.32, 0.048, 3.28, 0.048, railColor);
      if (d > 1) B(o, 'metal', x - w * 0.47, y, 3.32, 0.075, 3.2, 0.075, iron);
    }
    const f = facing(o, 0, 0, 3.22),
      ground = [0.18, 0.58, 1.18, 1.2][j];
    if (d) {
      if (j === 0) {
        B(f, 'concrete', x, ground - 0.1, 0.26, 3.2, 0.15, 0.6, gray);
        glazed(f, x, ground, 2.65, 2.8, d, rgb('aaa99c'), false);
        face(f, 'concrete', x, ground + 2.55, 0.21, 2.75, 0.44, pale);
        for (const sign of [-1, 1]) {
          face(f, 'concrete', x + sign * 1.65, ground + 0.2, 0.21, 0.42, 2.5, white);
          B(f, 'concrete', x + sign * 1.36, ground, 0.18, 0.13, 2.8, 0.25, gray);
        }
        clinicCanopy(f, x, ground + 3.05, d);
      } else shopfront(f, x, ground, j, d);
      const n = j === 0 ? 2 : j === 1 ? 3 : 4;
      for (let k = 0; k < n; k++)
        B(
          f,
          'concrete',
          x,
          (ground * (k + 1)) / n - 0.1,
          0.25 + (n - k) * 0.17,
          3.1,
          0.11,
          (n - k) * 0.34 + 0.15,
          gray,
        );
    }
    if (d > 1) face(f, 'wall', x, ground - 0.2, 0.01, w, ground + 0.4, c);
  }
  for (const y of [...levels, 14.0]) corbel(o, 8.42, y - 0.2, d);
  for (const y of levels)
    for (const x of [-8.54, 8.56])
      (d === 3 ? closedBalconyRail : rail)(
        facing(o, x < 0 ? -Math.PI / 2 : Math.PI / 2, x, 4.2),
        2.35,
        y,
        d,
        x < 0 ? rgb('3c778b') : iron,
        false,
      );
  if (d > 2)
    for (const x of [-8.48, 4.35]) {
      beam(o, 'metal', [x, 0, 3.35], [x, 13.8, 3.35], 0.08, 0.08, iron);
      for (const y of [3.95, 7.3, 10.65])
        beam(o, 'metal', [x, y, 3.35], [x, y - 0.2, 3.15], 0.08, 0.08, iron);
    }
}
function shopfront(o, x, y, index, d) {
  const c = index === 1 ? brown : green,
    w = 3.0,
    h = index > 1 ? 2.5 : 2.8;
  face(o, 'wood', x, y, 0.06, w, h, c);
  if (d > 1) {
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 6; col++) {
        const xx = x - w / 2 + ((col + 0.5) * w) / 6,
          yy = y + ((row + 0.5) * h) / 4;
        face(o, 'glass', xx, yy - h / 8 + 0.035, 0.075, w / 6 - 0.065, h / 4 - 0.07, glass);
      }
    for (const xx of [x - w / 2, x + w / 2]) B(o, 'wood', xx, y, 0.12, 0.1, h, 0.14, c);
    B(o, 'wood', x, y + h - 0.55, 0.15, w + 0.25, 0.5, 0.25, c);
    if (index === 2) face(o, 'concrete', x, y + h - 0.47, 0.28, w, 0.28, rgb('ddd9af'));
  } else face(o, 'glass', x, y + 0.15, 0.08, w - 0.3, h - 0.9, glass);
}
function clinicCanopy(o, x, y, d) {
  const xs = [x - 1.8, x - 1.4, x + 1.4, x + 1.8],
    ys = [y + 0.22, y, y, y + 0.22];
  for (let i = 0; i < 3; i++) {
    const p = [
      [xs[i], ys[i], 0.1],
      [xs[i + 1], ys[i + 1], 0.1],
      [xs[i + 1], ys[i + 1] - 0.1, 0.85],
      [xs[i], ys[i] - 0.1, 0.85],
    ];
    let n = normalFor(...p);
    if (n[1] < 0) n = n.map((v) => -v);
    quad(o, 'roof', p, n, rgb('526a5a'));
  }
  if (d > 1)
    for (let i = 0; i < 22; i++) {
      const xx = x - 1.7 + i * 0.16;
      beam(o, 'roof', [xx, y + 0.07, 0.1], [xx, y - 0.04, 0.87], 0.07, 0.07, rgb('536e5d'));
    }
}
function sides(o, d) {
  if (!d) return;
  const na = [-13.65, -9.98],
    nb = [-9.25, 3.2],
    a = Math.atan2(na[1] - nb[1], nb[0] - na[0]),
    w = Math.hypot(nb[0] - na[0], nb[1] - na[1]),
    north = facing(o, a, (na[0] + nb[0]) / 2, (na[1] + nb[1]) / 2);
  for (const y of [4.25, 7.6, 10.95])
    for (const x of [-4.2, -0.3, 3.6]) glazed(north, x, y, 1.2, 2.1, d, blueWood, false);
  glazed(north, 2.4, 2.05, 6.3, 1.0, d, blueWood, false);
  for (const y of [3.8, 7.15, 10.5, 13.75]) B(north, 'concrete', 0, y, 0.08, w, 0.12, 0.18, pale);
  const south = facing(o, Math.PI / 2, 8.65, -0.87);
  for (const y of [4.25, 7.6, 10.95])
    for (const x of [-2.7, 0, 2.7]) glazed(south, x, y, 1.2, 2.1, d, green, false);
  for (const y of [3.8, 7.15, 10.5, 13.75])
    B(south, 'concrete', 0, y, 0.08, 8.2, 0.12, 0.18, white);
  for (const x of [-2.7, 0, 2.7]) glazed(south, x, 1.05, 0.9, 1.4, d, green, false);
}
function stairs(o, d) {
  const back = facing(o, Math.PI, 0, -5.55);
  for (const y of [1.18, 3.95, 7.3, 10.65]) {
    B(back, 'concrete', 0, y - 0.2, 0.85, 10.2, 0.2, 1.7, white);
    if (d) rail(facing(back, 0, 0, 1.73), 10.2, y, d, iron, false);
  }
  for (let floor = 0; floor < 3; floor++) {
    const lo = [1.18, 3.95, 7.3][floor],
      hi = [3.95, 7.3, 10.65][floor],
      a = [-4.4, lo, 2.6],
      b = [4.0, hi, 2.6];
    if (d === 0) beam(back, 'concrete', a, b, 1.0, 0.22, gray);
    else {
      const n = d === 1 ? 10 : 20;
      for (let i = 0; i < n; i++) {
        const t = (i + 1) / n,
          x = a[0] + (b[0] - a[0]) * t,
          y = lo + (hi - lo) * t;
        B(back, 'concrete', x, y - 0.2, 2.6, 8.4 / n + 0.025, 0.2, 1.0, gray);
      }
      for (const z of [2.08, 3.12]) {
        beam(back, 'metal', [-4.4, lo + 1.05, z], [4.0, hi + 1.05, z], 0.05, 0.05, iron);
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          B(back, 'metal', -4.4 + 8.4 * t, lo + (hi - lo) * t, z, 0.035, 1.05, 0.035, iron);
        }
      }
    }
  }
  if (d) {
    for (const x of [-9, -5.7, -2, 2, 6.8])
      for (const y of [4.2, 7.55, 10.9])
        glazed(facing(o, Math.PI, x, -5.56), 0, y, 1.1, 2.0, d, blueWood, false);
    for (const x of [-4.8, 4.5]) B(back, 'metal', x, 0.1, 1.7, 0.12, 13.8, 0.12, iron);
  }
}
const footprint = [
  [-13.65, -9.98],
  [-9.01, -9.27],
  [-7.98, -5.53],
  [-3.87, -5.51],
  [-3.83, -7.88],
  [-1.47, -7.83],
  [-1.68, -5.12],
  [1.29, -4.99],
  [1.15, -7.87],
  [5.61, -7.69],
  [5.75, -4.81],
  [8.63, -4.95],
  [8.5, 3.2],
  [-9.25, 3.2],
];
export function blueHouse(o, _frame, d = 3) {
  for (const [less, c] of [
    [true, blue],
    [false, white],
  ])
    prism(
      d === 3
        ? {
            addQuad: (s, r, p, n, u, c) =>
              p.every((v) => Math.abs(v[2] - 3.2) < 1e-7) ? undefined : o.addQuad(s, r, p, n, u, c),
            addTriangle: (...a) => o.addTriangle(...a),
          }
        : o,
      clip(footprint, 0, 4.3, less),
      -2.5,
      13.75,
      'wall',
      c,
    );
  const roof = [
    [-12.0, -5.05],
    [8.63, -4.95],
    [8.5, 3.25],
    [-9.25, 3.25],
  ];
  for (const lower of [true, false]) {
    const r = clip(roof, 1, -0.9, lower);
    roofPanel(o, r, (z) => 14.8 - (Math.abs(z + 0.9) * 1.05) / 4.2);
  }
  endGable(o, [-12, -5.05], [-9.25, 3.25], d, blue);
  endGable(o, [8.5, 3.25], [8.63, -4.95], d, white);
  // Low, flat covers above the three rear service projections.
  for (const [x, z, w, l] of [
    [-10.9, -7.5, 4.1, 4.8],
    [-2.68, -6.7, 2.4, 2.6],
    [3.4, -6.4, 4.2, 2.7],
  ])
    B(o, 'roof', x, 13.75, z, w, 0.15, l, tile);
  front(o, d);
  if (d === 3) {
    recessedBalconyDoors(o);
    joinedBalconyPipes(o);
  }
  sides(o, d);
  stairs(o, d);
}
export function blueHouseSkyline(o) {
  blueHouse(o, undefined, 0);
}
export function blueHouseDistrict(o) {
  blueHouse(o, undefined, 1);
}
export function blueHouseStreet(o) {
  blueHouse(o, undefined, 2);
}
const surfaces = {
  balconyIron: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.65,
    metallic: 0.3,
    doubleSided: true,
  },
  balconyWood: { slot: 'trim', graph: 'wood_plain', roughness: 0.8, metallic: 0 },
  doorWall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  doorReveal: { slot: 'wall', graph: 'concrete_plain', roughness: 0.87, metallic: 0 },
  doorWood: { slot: 'trim', graph: 'wood_plain', roughness: 0.8, metallic: 0 },
  doorGlass: { ...landmarkSurfaces.glass, localRef: ref },
  doorIron: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.65,
    metallic: 0.3,
    doubleSided: true,
  },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.87, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.8, metallic: 0 },
  metal: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.65,
    metallic: 0.3,
    doubleSided: true,
  },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const blueHouseModel = {
  id: 'blue_house_hong_kong',
  key: 'blue_house_hong_kong',
  recipe: 'structure-blue-house-hong-kong.mjs',
  cell: 'we/wec',
  title: 'Blue House (Hong Kong)',
  brief:
    'Four connected Hong Kong shophouse units: three blue and one white end unit, three tiers of cantilevered balconies with concrete corbels and ornamental ironwork, paired glazed doors, shopfronts and clinic canopy; shallow gable roof and modern rear access stairs.',
  camera: [-32, 25, 37],
  lookAt: [-1, 6, 0],
  qaCameras: [
    { name: 'front', position: [-5, 12, 36], lookAt: [-0.5, 6.5, 3] },
    { name: 'back', position: [27, 24, -34], lookAt: [-2, 6.5, -4] },
    { name: 'balcony-ironwork', position: [-1, 9.1, 10], lookAt: [-2.12, 7.9, 5.37] },
    { name: 'paired-door-recess', position: [-4.5, 9, 7.7], lookAt: [-2.12, 8.7, 3.2] },
  ],
  mediumFiContext: { scale: 0.5 },
  build: blueHouse,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Northern Stone Nullah Lane approach[-6.5,6.5], Y=0 against unmodified official Hong Kong5m DTM, datum11mHKPD. The source rises about1m southward; shop thresholds .18/.58/1.18/1.2 and rear first landing1.18 retain photographed individual steps without changing the ground.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-blue-house-hong-kong.mjs',
    level: 'skyline',
    export: 'blueHouseSkyline',
    errorMeters: 0.6,
    surfaces,
    authoredLevels: {
      district: { export: 'blueHouseDistrict', errorMeters: 0.45, surfaces },
      street: { export: 'blueHouseStreet', errorMeters: 0.35, surfaces },
    },
  },
  limitations: [
    'Current construction uses exact native named-photographer CC0 2020 front/corner after Qualla-first111records. Twelve front paired-door pockets and closed ornamental railings built from inspected native detail. Earlier attribution/private/aerial controls are historical and excluded; full original four-unit house/white74A/roof/rear access/shopfront scope retained, broader rear/hidden roof fidelity pending. Dimensions, recesses, iron profiles and current condition remain estimates.',
    'Four contiguous72–74A Stone Nullah Lane units only, including white-painted74A. Separate Yellow/Orange Houses, courtyard landscaping, neighboring bridges, interiors, signs lettering and street furniture excluded.',
    'Close front ironwork uses physical elliptical/circular/side-loop stocks and twelve paired-door recesses; all three original lower levels remain exact. LODerror estimates increased conservatively for new recess depth, not measured geometric-error certification. Rear stair positioning/hidden details retained as estimates pending wider cleared evidence.',
    'Independent terrain compatibility is recorded in qa.json. Footprint replacement disabled; no photographic pixels redistributed and no physical-device performance measurement claimed.',
  ],
};
