/** Duke Chapel's Abele Quad tower, cruciform body, memorial chapel and open walks. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls'),
  terrain = read('terrain-grid');
const [outline] = read('map-frame').geometry.polygons;
const { base, tower: t, nave: n, transept, choir } = plan;
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.86, metallic: 0.08 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.66, metallic: 0.1 },
};
const c = Object.fromEntries(
  Object.entries({
    duke: '978b75',
    warm: '9a8c74',
    shadow: '89806f',
    dress: 'c2b69e',
    light: 'cfc3aa',
    recess: 'a39783',
    footing: '928775',
    roof: '767973',
    seam: '888980',
    glass: '4b5251',
    glass2: '59605b',
    door: '916b48',
    louvre: '55524a',
    dark: '393d3a',
  }).map(([k, v]) => [k, rgb(v)]),
);
const up = [0, 1, 0],
  rect = (a, b, low, high) => [
    [a, low],
    [b, low],
    [b, high],
    [a, high],
  ];
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
function directed(out, slot, p, normal, tint) {
  const sign = normalFor(...p).reduce((sum, v, i) => sum + v * normal[i], 0);
  const vertices = sign >= 0 ? p : p.toReversed();
  if (vertices.length === 3) triangle(out, slot, vertices, tint);
  else face(out, slot, vertices, tint);
}
function fill(out, slot, outline, project, normal, tint, holes = []) {
  const points = [...outline];
  const starts = holes.map((h) => {
    const start = points.length;
    points.push(...h);
    return start;
  });
  const ids = earcut(points.flat(), starts);
  for (let i = 0; i < ids.length; i += 3)
    directed(
      out,
      slot,
      ids.slice(i, i + 3).map((j) => project(...points[j])),
      normal,
      tint,
    );
}
function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    p = terrain.heightsMeters[j],
    q = terrain.heightsMeters[j + 1];
  return (
    (1 - b) * ((1 - a) * p[i] + a * p[i + 1]) +
    b * ((1 - a) * q[i] + a * q[i + 1]) -
    terrain.modelDatumElevationMeters
  );
}
function section(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const normal = [dz / length, 0, -dx / length];
  return {
    length,
    normal,
    p: (u, y, depth = 0) => [
      a[0] + (u * dx) / length + normal[0] * depth,
      y,
      a[1] + (u * dz) / length + normal[2] * depth,
    ],
  };
}
function faces(x0, x1, z0, z1) {
  return [
    section([x0, z0], [x1, z0]),
    section([x1, z0], [x1, z1]),
    section([x1, z1], [x0, z1]),
    section([x0, z1], [x0, z0]),
  ];
}
function rectangle(out, s, slot, shape, depth, tint) {
  directed(
    out,
    slot,
    shape.map(([u, y]) => s.p(u, y, depth)),
    s.normal,
    tint,
  );
}
function block(out, slot, x, z, w, d, low, high, tint) {
  box(out, slot, [x - w / 2, low, z - d / 2], [x + w / 2, high, z + d / 2], tint);
}
function profile(w, lod) {
  const { u, low, high, width } = w,
    r = width / 2,
    steps = [1, 2, 4, 6][lod];
  const spring = high - Math.min(width * 0.84, (high - low) * 0.4);
  return [
    [u - r, low],
    [u + r, low],
    ...Array.from({ length: steps * 2 + 1 }, (_, i) => {
      const t = i / steps - 1;
      return [u - r * t, spring + (high - spring) * (1 - Math.pow(Math.abs(t), 1.5))];
    }),
  ];
}
function stringCourse(out, s, y, height, depth, tint = c.dress) {
  const L = s.length,
    p = s.p;
  rectangle(out, s, 'trim', rect(0, L, y - height, y), depth, tint);
  directed(out, 'trim', [p(0, y), p(L, y), p(L, y, depth), p(0, y, depth)], up, tint);
}
function aperture(out, s, w, ring, lod, thickness) {
  const { u, low, high, width, kind } = w,
    { p, normal } = s;
  const recessed = lod >= 2 || kind === 'open';
  const depth = recessed ? -thickness : 0.024;
  if (kind !== 'open')
    fill(
      out,
      'glass',
      ring,
      (x, y) => p(x, y, depth),
      normal,
      kind === 'door' || kind === 'louvre' ? c.dark : c.glass,
    );
  if (recessed && lod > 0) {
    const center = p(u, (low + high) / 2);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        m = p(...mix(a, b, 0.5));
      directed(
        out,
        'trim',
        [p(...a), p(...b), p(...b, depth), p(...a, depth)],
        center.map((x, k) => x - m[k]),
        c.recess,
      );
    }
  }
  if (!lod) {
    if (kind === 'door')
      rectangle(
        out,
        s,
        'timber',
        rect(u - width * 0.34, u + width * 0.34, low + 0.13, Math.min(low + 2.88, high - 0.8)),
        depth + 0.036,
        c.door,
      );
    return;
  }
  if (lod === 1 && (kind === 'louvre' || (kind === 'glass' && width < 2.2))) return;
  const d = kind === 'door' ? 0.26 : kind === 'open' ? 0.2 : 0.16;
  const border = ring.map(([x, y]) => [
    u + (x - u) * (1 + (2 * d) / width),
    y + d * ((2 * (y - low)) / (high - low) - 1),
  ]);
  for (let i = 1; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    rectangle(out, s, 'trim', [ring[i], ring[j], border[j], border[i]], 0.048, c.dress);
  }
  if (lod >= 2 && (kind === 'door' || kind === 'open')) {
    const outer = border.map(([x, y]) => [
      u + (x - u) * (1 + (2 * d) / width),
      y + d * ((2 * (y - low)) / (high - low) - 1),
    ]);
    for (let i = 1; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      rectangle(out, s, 'trim', [border[i], border[j], outer[j], outer[i]], 0.105, c.light);
    }
  }
  if (kind === 'open') return;
  if (kind === 'louvre') {
    for (let j = 1; j <= (lod >= 2 ? 9 : 5); j++) {
      const y = low + j * (high - low) * 0.066;
      rectangle(
        out,
        s,
        'trim',
        rect(u - width * 0.45, u + width * 0.45, y, y + 0.095),
        depth + 0.032,
        c.louvre,
      );
    }
    return;
  }
  if (kind === 'door') {
    const pane = rect(
      u - width * 0.34,
      u + width * 0.34,
      low + 0.13,
      Math.min(low + 2.88, high - 0.8),
    );
    rectangle(out, s, 'timber', pane, depth + 0.036, c.door);
    if (lod >= 2) {
      const y = low + 1.12;
      beam(
        out,
        'trim',
        p(u - 0.05, y - 0.08, depth + 0.08),
        p(u - 0.05, y + 0.08, depth + 0.08),
        0.045,
        0.046,
        c.light,
      );
    }
  }
  const spring = high - Math.min(width * 0.84, (high - low) * 0.4);
  for (const f of lod >= 2 && width > 1.8 ? [-0.24, 0, 0.24] : [0]) {
    const x = u + f * width;
    rectangle(
      out,
      s,
      'trim',
      rect(x - 0.042, x + 0.042, low + 0.065, spring + 0.16),
      depth + 0.06,
      c.light,
    );
  }
  if (lod >= 2 && kind !== 'door') {
    const q = (angle, r) => [u + Math.cos(angle) * r, spring + 0.15 + Math.sin(angle) * r];
    const r = width * 0.2,
      segments = lod === 3 ? 10 : 6;
    for (let j = 0; j < segments; j++)
      beam(
        out,
        'trim',
        p(...q((j * 2 * Math.PI) / segments, r), depth + 0.06),
        p(...q(((j + 1) * 2 * Math.PI) / segments, r), depth + 0.06),
        0.052,
        0.058,
        c.light,
      );
    rectangle(
      out,
      s,
      'trim',
      rect(
        u - width * 0.46,
        u + width * 0.46,
        low + (spring - low) * 0.62,
        low + (spring - low) * 0.62 + 0.065,
      ),
      depth + 0.064,
      c.dress,
    );
  }
}
function wall(out, s, low, high, windows, lod, tint = c.duke, thickness = 0.33) {
  const rings = windows.map((w) => profile(w, lod));
  const holes = rings.filter((_, i) => lod >= 2 || windows[i].kind === 'open');
  fill(out, 'stone', rect(0, s.length, low, high), (u, y) => s.p(u, y), s.normal, tint, holes);
  for (const [i, w] of windows.entries()) aperture(out, s, w, rings[i], lod, thickness);
}
function foundation(out, s, high) {
  const k = Math.max(2, Math.ceil(s.length / 10));
  for (let i = 0; i < k; i++) {
    const a = (s.length * i) / k,
      b = (s.length * (i + 1)) / k;
    const foot = (u) => {
      const [x, , z] = s.p(u, 0);
      return s.p(u, Math.min(high - 0.12, grade(x, z) - 0.26));
    };
    directed(
      out,
      'foundation',
      [foot(a), foot(b), s.p(b, high), s.p(a, high)],
      s.normal,
      c.footing,
    );
  }
}
function pillar(out, x, z, y0, y1, w, d, topScale, lod) {
  const ring = (y, k) => [
    [x - (w * k) / 2, y, z - (d * k) / 2],
    [x - (w * k) / 2, y, z + (d * k) / 2],
    [x + (w * k) / 2, y, z + (d * k) / 2],
    [x + (w * k) / 2, y, z - (d * k) / 2],
  ];
  loft(out, 'trim', [ring(y0, 1), ring(y1, topScale)], c.dress);
  if (lod >= 2) {
    for (const f of [0.24, 0.62]) {
      const h = y0 + (y1 - y0) * f,
        k = 1 - (1 - topScale) * f;
      block(out, 'trim', x, z, w * k + 0.12, d * k + 0.12, h - 0.11, h, c.light);
    }
  }
}
function spirelet(out, x, z, base, height, w, lod) {
  const crown = base + height;
  const ring = (y, k) => [
    [x - (w * k) / 2, y, z - d(k)],
    [x - (w * k) / 2, y, z + d(k)],
    [x + (w * k) / 2, y, z + d(k)],
    [x + (w * k) / 2, y, z - d(k)],
  ];
  const d = (k) => (w * k) / 2;
  loft(out, 'trim', [ring(base, 1), ring(base + height * 0.4, 0.84), ring(crown, 0.055)], c.light);
  if (lod >= 2)
    for (const f of [0.35, 0.57, 0.75]) {
      const y = base + f * height,
        r = w * (0.42 - f * 0.31);
      block(out, 'trim', x, z, 2 * r, 2 * r, y - 0.07, y + 0.12, c.dress);
    }
}
function gable(out, { x, z, w, d, eave, ridge, angle = 0 }, lod) {
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  const p = (u, y, v) => [x + u * cos - v * sin, y, z + u * sin + v * cos];
  const a = p(-w / 2, eave, -d / 2),
    b = p(w / 2, eave, -d / 2),
    q = p(w / 2, eave, d / 2),
    r = p(-w / 2, eave, d / 2);
  const highA = p(0, ridge, -d / 2),
    highB = p(0, ridge, d / 2);
  directed(out, 'roof', [a, highA, highB, r], up, c.roof);
  directed(out, 'roof', [b, q, highB, highA], up, c.roof);
  directed(out, 'stone', [a, b, highA], [sin, 0, -cos], c.duke);
  directed(out, 'stone', [r, q, highB], [-sin, 0, cos], c.duke);
  if (lod) {
    beam(out, 'roof', highA, highB, 0.2, 0.14, c.seam);
    for (const [u, v] of [
      [a, r],
      [b, q],
    ])
      beam(out, 'trim', u, v, 0.16, 0.15, c.dress);
  }
}

function tower(out, lod) {
  const W = t.width / 2,
    z0 = t.z - W,
    z1 = t.z + W,
    x0 = t.x - W,
    x1 = t.x + W,
    parapet = base + 58.6;
  const ss = faces(x0, x1, z0, z1);
  for (const [i, s] of ss.entries()) {
    const L = s.length,
      m = L / 2;
    const windows = [
      { u: m - 2.17, width: 1.62, low: 47.1, high: 56.05, kind: 'louvre' },
      { u: m + 2.17, width: 1.62, low: 47.1, high: 56.05, kind: 'louvre' },
    ];
    if (i === 2)
      windows.push(
        { u: m, width: 5.46, low: base + 0.07, high: 13.45, kind: 'door' },
        { u: m, width: 2.03, low: 18.3, high: 30.6, kind: 'glass' },
        { u: m, width: 1.85, low: 34.1, high: 41.2, kind: 'glass' },
      );
    else if (lod) windows.push({ u: m, width: 1.45, low: 24.05, high: 32.98, kind: 'glass' });
    wall(out, s, base, parapet, windows, lod, i === 2 ? c.warm : c.duke, 0.72);
    foundation(out, s, base);
    for (const y of [parapet - 0.12, 46.1, 42.55]) {
      if (!lod && y !== parapet - 0.12) continue;
      stringCourse(out, s, y, y > 55 ? 0.58 : 0.26, 0.34);
    }
    const battlements = lod >= 2 ? 9 : 5;
    for (let j = 0; j < battlements; j++) {
      const u = (L * (j + 0.5)) / battlements,
        [x, , z] = s.p(u, parapet, 0.04);
      if (lod) block(out, 'trim', x, z, 0.67, 0.67, parapet - 0.08, parapet + 0.79, c.dress);
      else
        rectangle(
          out,
          s,
          'trim',
          rect(u - 0.36, u + 0.36, parapet - 0.08, parapet + 0.79),
          0.045,
          c.dress,
        );
    }
  }
  block(
    out,
    'roof',
    t.x,
    t.z,
    t.width - 0.3,
    t.width - 0.3,
    parapet - 0.26,
    parapet - 0.075,
    c.roof,
  );
  for (const side of [-1, 1])
    for (const end of [-1, 1]) {
      const x = t.x + side * (W - 0.14),
        z = t.z + end * (W - 0.38);
      pillar(out, x, z, Math.min(grade(x, z) - 0.21, base), 20.1, 2.23, 2.28, 0.69, lod);
      pillar(out, x, z, 19.9, 43.65, 1.64, 1.68, 0.71, lod);
      pillar(out, x, z, 43.51, base + 60.2, 1.18, 1.2, 0.73, lod);
      spirelet(out, x, z, base + 59.74, t.height - 59.74, 0.91, lod);
      if (lod >= 1)
        spirelet(
          out,
          t.x + side * (W - 1.48),
          t.z + end * (W + 0.11),
          base + 58.94,
          2.41,
          0.49,
          lod,
        );
    }
  const foot = grade(t.x, z1 + 2.61) - 0.035;
  for (let i = 0; i < (lod ? 6 : 3); i++) {
    const k = lod ? 6 : 3,
      y = foot + ((base + 0.1 - foot) * (i + 1)) / k;
    block(
      out,
      'foundation',
      t.x,
      z1 + 1.27 - 0.17 * i,
      6.62,
      2.72 - 0.33 * i,
      foot - 0.19,
      y,
      c.dress,
    );
  }
}

function nave(out, lod) {
  const main = faces(n.x - n.halfWidth, n.x + n.halfWidth, n.back, n.front);
  const aisle = [n.outerLeft, n.outerRight];
  const bayZ = [-4.7, 1.44, 7.48, 13.53, 19.58, 25.62, 31.72];
  for (const [i, s] of main.entries()) {
    const frontOrBack = i % 2 === 0;
    const ws = frontOrBack
      ? []
      : bayZ
          .filter((_, j) => lod || j % 2 === 0)
          .map((z) => ({
            u: i === 1 ? z - n.back : n.front - z,
            width: 2.52,
            low: 16.28,
            high: 23.46,
            kind: 'glass',
          }));
    wall(out, s, n.aisleEave - 0.16, n.eave, ws, lod, c.duke);
    if (lod) stringCourse(out, s, n.eave - 0.07, 0.26, 0.19);
  }
  gable(
    out,
    {
      x: n.x,
      z: (n.back + n.front) / 2,
      w: n.halfWidth * 2 + 0.37,
      d: n.front - n.back + 0.33,
      eave: n.eave,
      ridge: n.ridge,
    },
    lod,
  );
  for (const [i, x] of aisle.entries()) {
    const sign = i === 0 ? -1 : 1;
    const s = i === 0 ? section([x, n.front], [x, n.back]) : section([x, n.back], [x, n.front]);
    const ws = bayZ
      .filter((_, j) => lod || j % 2 === 1)
      .map((z) => ({
        u: i === 0 ? n.front - z : z - n.back,
        width: 2.12,
        low: 3.02,
        high: 10.91,
        kind: 'glass',
      }));
    wall(out, s, base, n.aisleEave, ws, lod, i === 0 ? c.shadow : c.warm);
    foundation(out, s, base);
    if (lod) stringCourse(out, s, n.aisleEave - 0.05, 0.27, 0.26);
    const xTop = n.x + sign * n.halfWidth;
    directed(
      out,
      'roof',
      [
        [x, n.aisleEave, n.back],
        [xTop, 15.17, n.back],
        [xTop, 15.17, n.front],
        [x, n.aisleEave, n.front],
      ],
      up,
      c.roof,
    );
    const endWall = section([Math.max(x, xTop), n.front], [Math.min(x, xTop), n.front]);
    fill(
      out,
      'stone',
      rect(0, endWall.length, base, n.aisleEave),
      (u, y) => endWall.p(u, y),
      [0, 0, 1],
      c.duke,
    );
    foundation(out, endWall, base);
    for (const end of [n.back, n.front])
      directed(
        out,
        'stone',
        [
          [x, n.aisleEave, end],
          [xTop, n.aisleEave, end],
          [xTop, 15.17, end],
        ],
        [0, 0, Math.sign(end)],
        c.duke,
      );
    for (const z of [-2.28, 3.76, 9.82, 15.85, 21.91, 27.28, 34.63]) {
      if (!lod && z !== 3.76 && z !== 21.91 && z !== 34.63) continue;
      const p = x + sign * 0.45;
      pillar(
        out,
        p,
        z,
        Math.min(base, grade(p, z) - 0.22),
        n.aisleEave + 0.93,
        1.22,
        1.39,
        0.61,
        lod,
      );
      if (lod) {
        pillar(out, xTop + sign * 0.29, z, 14.94, n.eave - 0.22, 1.16, 1.38, 0.62, lod);
        spirelet(out, xTop + sign * 0.32, z, n.eave - 0.41, lod === 1 ? 1.55 : 2.12, 0.64, lod);
      }
    }
  }
  for (const x of [-11.07, 10.65]) {
    block(
      out,
      'stone',
      x,
      29.15,
      3.65,
      3.74,
      Math.min(base, grade(x, 29.15) - 0.2),
      11.78,
      c.shadow,
    );
    gable(out, { x, z: 29.15, w: 3.98, d: 4.05, eave: 11.74, ridge: 13.39 }, lod);
  }
}

function crossWing(out, { x, z, width, depth, eave, ridge }, lod, isChoir = false) {
  const x0 = x - width / 2,
    x1 = x + width / 2,
    z0 = z - depth / 2,
    z1 = z + depth / 2;
  for (const [i, s] of faces(x0, x1, z0, z1).entries()) {
    const external = isChoir ? i === 0 : i % 2 === 1;
    const L = s.length,
      windows = [];
    if (external) {
      windows.push({
        u: L / 2,
        width: isChoir ? 5.65 : 5.11,
        low: 8.67,
        high: eave - 2.32,
        kind: 'glass',
      });
      if (lod)
        for (const f of [0.2, 0.8])
          windows.push({ u: L * f, width: 1.19, low: 4.52, high: eave - 4.11, kind: 'glass' });
    } else if (lod && isChoir && i !== 2)
      for (const f of [0.23, 0.56, 0.83])
        windows.push({ u: L * f, width: 1.62, low: 8.89, high: eave - 3.2, kind: 'glass' });
    wall(out, s, base, eave, windows, lod, external ? c.warm : c.duke);
    foundation(out, s, base);
    if (lod) stringCourse(out, s, eave - 0.12, 0.24, 0.27);
  }
  gable(
    out,
    {
      x,
      z,
      w: (isChoir ? width : depth) + 0.37,
      d: (isChoir ? depth : width) + 0.39,
      eave,
      ridge,
      angle: isChoir ? 0 : Math.PI / 2,
    },
    lod,
  );
  for (const a of [-1, 1])
    for (const b of [-1, 1]) {
      const X = x + a * (width / 2 - 0.21),
        Z = z + b * (depth / 2 - 0.19);
      pillar(out, X, Z, Math.min(base, grade(X, Z) - 0.2), eave + 0.09, 1.61, 1.6, 0.62, lod);
      if (lod) spirelet(out, X, Z, eave - 0.18, 2.29, 0.66, lod);
    }
}

function memorial(out, lod) {
  const a = -18.3,
    b = -6.97,
    z0 = -40.33,
    z1 = -21.09,
    eave = 14.83;
  for (const [i, s] of faces(a, b, z0, z1).entries()) {
    const L = s.length,
      windows = [];
    if (i !== 1 && i !== 2) {
      for (const f of lod ? [0.2, 0.5, 0.8] : [0.5])
        windows.push({ u: L * f, width: 1.97, low: 3.92, high: 12.51, kind: 'glass' });
    }
    wall(out, s, base, eave, windows, lod, c.shadow);
    foundation(out, s, base);
  }
  gable(
    out,
    { x: (a + b) / 2, z: (z0 + z1) / 2, w: b - a + 0.29, d: z1 - z0 + 0.32, eave, ridge: 18.57 },
    lod,
  );
  for (const z of lod ? [-39.68, -34.31, -28.92, -22.34] : [-39.68, -22.34]) {
    pillar(out, a + 0.08, z, Math.min(base, grade(a, z) - 0.19), eave + 0.3, 1.31, 1.46, 0.59, lod);
    if (lod) spirelet(out, a + 0.08, z, eave + 0.14, 1.61, 0.53, lod);
  }
  for (const [i, s] of faces(7.15, 13.47, -34.41, -23.03).entries()) {
    const windows = i === 1 ? [{ u: 5.24, width: 1.79, low: 3.42, high: 9.17, kind: 'glass' }] : [];
    wall(out, s, base, 11.45, windows, lod, c.duke);
    foundation(out, s, base);
  }
  gable(out, { x: 10.2, z: -28.72, w: 6.58, d: 11.68, eave: 11.42, ridge: 13.76 }, lod);
}

function cloister(out, x0, x1, z, lod) {
  const back = z - 1.87,
    front = z + 1.87,
    top = 6.72;
  const frontWall = section([x1, front], [x0, front]),
    backWall = section([x0, back], [x1, back]);
  const L = frontWall.length,
    n = 4;
  const openings = Array.from({ length: n }, (_, i) => ({
    u: (L * (i + 0.5)) / n,
    width: (L / n) * 0.77,
    low: base + 0.06,
    high: 5.54,
    kind: 'open',
  }));
  for (const s of [frontWall, backWall]) {
    wall(out, s, base, top, openings, lod, c.shadow, 0.53);
    if (lod) stringCourse(out, s, top - 0.06, 0.26, 0.2);
  }
  block(
    out,
    'foundation',
    (x0 + x1) / 2,
    z,
    x1 - x0,
    front - back,
    Math.min(grade(x0, z), grade(x1, z)) - 0.17,
    base + 0.02,
    c.footing,
  );
  gable(
    out,
    {
      x: (x0 + x1) / 2,
      z,
      w: front - back + 0.25,
      d: x1 - x0 + 0.19,
      eave: top,
      ridge: 8.24,
      angle: Math.PI / 2,
    },
    lod,
  );
  if (lod)
    for (let i = 1; i < n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      pillar(out, x, front + 0.12, base, 7.27, 0.75, 0.84, 0.57, lod);
      spirelet(out, x, front + 0.19, 7.16, 1.72, 0.42, lod);
    }
}

function build(out, lod) {
  tower(out, lod);
  nave(out, lod);
  crossWing(out, transept, lod);
  crossWing(out, choir, lod, true);
  memorial(out, lod);
  cloister(out, -22.2, -5.85, 39.95, lod);
  cloister(out, 5.65, 18.67, 39.95, lod);
}
export const chapelSkyline = (out) => build(out, 0);
export const chapelDistrict = (out) => build(out, 1);
export const chapelStreet = (out) => build(out, 2);
export const chapelCloseup = (out) => build(out, 3);
const recipe = 'duke-chapel-model.mjs',
  camera = [-103, 63, 117],
  lookAt = [0, 25.1, 3.6];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'chapelDistrict', 0.64],
    ['street', 'chapelStreet', 0.22],
    ['closeup', 'chapelCloseup', 0.058],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);
export const chapelModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: chapelCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'English collegiate Gothic chapel with a tall pinnacled tower, cruciform body, traceried lancets and open cloister walks.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-34, 38, 32],
  mediumFiContext: {
    scale: 2.19,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.94,
    basis: 'The named Duke Chapel outline in OpenStreetMap way 626679838.',
  },
  embeddedCanonicalGraphs: [
    'stone_ashlar',
    'stone_limestone_raw',
    'stone_limestone',
    'metal_standing_seam',
    'wood_plain',
  ],
  qaCameras: [
    { name: 'chapel-drive-tower-and-open-walks', position: [-21, 31, 106], lookAt: [0, 30.8, 37] },
    { name: 'west-side-buttresses-and-transept', position: [-64, 21, 3], lookAt: [-5, 14, -4] },
    { name: 'rear-choir-and-memorial-chapel', position: [-61, 34, -79], lookAt: [-4, 18, -21] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-duke-chapel-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'chapelSkyline',
    errorMeters: 1.31,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Mapped chapel outline is ODbL. The four exact Qualla photographs are CC0.',
};
