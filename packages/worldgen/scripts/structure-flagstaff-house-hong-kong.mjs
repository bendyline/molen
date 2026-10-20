/** Flagstaff House: original two-storey house, excluding the later gallery connection. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
import fs from 'node:fs';
import { loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  white = rgb('e6e4dc'),
  light = rgb('f0eee5'),
  recess = rgb('bdbfb5'),
  wood = rgb('3c3633'),
  glass = rgb('89928a'),
  tile = rgb('8e746a'),
  edge = rgb('55504e'),
  pink = rgb('bd837c');

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
function column(o, x, z, y, h, d) {
  const n = d === 0 ? 4 : d === 1 ? 6 : 12;
  if (d === 0) {
    loft(
      o,
      'wall',
      [radialRing(y, 0.39, 0.39, n, [x, z]), radialRing(y + h, 0.32, 0.32, n, [x, z])],
      white,
    );
    return;
  }
  if (d === 1) {
    B(o, 'wall', x, y, z, 0.9, 0.52, 0.9, light);
    loft(
      o,
      'wall',
      [radialRing(y + 0.52, 0.36, 0.36, 4, [x, z]), radialRing(y + h - 0.15, 0.3, 0.3, 4, [x, z])],
      white,
    );
    B(o, 'wall', x, y + h - 0.15, z, 0.91, 0.15, 0.91, light);
    return;
  }
  B(o, 'wall', x, y, z, 0.9, 0.52, 0.9, light);
  loft(
    o,
    'wall',
    [
      radialRing(y + 0.52, 0.43, 0.43, n, [x, z]),
      radialRing(y + 0.61, 0.43, 0.43, n, [x, z]),
      radialRing(y + 0.69, 0.36, 0.36, n, [x, z]),
      radialRing(y + h - 0.24, 0.3, 0.3, n, [x, z]),
      radialRing(y + h - 0.17, 0.4, 0.4, n, [x, z]),
      radialRing(y + h - 0.09, 0.43, 0.43, n, [x, z]),
    ],
    white,
  );
  B(o, 'wall', x, y + h - 0.09, z, 0.91, 0.09, 0.91, light);
}
function window(o, x, y, w, h, d, shutters = false) {
  face(o, 'glass', x, y, 0, w, h, glass);
  if (d < 1) return;
  if (d === 1) {
    for (const xx of [-w / 2, 0, w / 2]) face(o, 'wood', x + xx, y, 0.02, 0.09, h, wood);
    for (const yy of [y, y + h]) face(o, 'wood', x, yy, 0.024, w + 0.12, 0.09, wood);
    return;
  }
  for (const xx of [-w / 2, w / 2]) B(o, 'wood', x + xx, y, -0.005, 0.09, h, 0.1, wood);
  for (const yy of [y, y + h]) B(o, 'wood', x, yy, -0.005, w + 0.12, 0.09, 0.1, wood);
  B(o, 'wood', x, y, 0.016, 0.1, h, 0.07, wood);
  if (d > 1) {
    for (const xx of [-w / 4, w / 4]) face(o, 'wood', x + xx, y, 0.065, 0.04, h, wood);
    for (let i = 1; i < 5; i++) face(o, 'wood', x, y + (h * i) / 5, 0.069, w, 0.035, wood);
    B(o, 'wall', x, y - 0.1, 0.04, w + 0.3, 0.12, 0.27, white);
  }
  if (shutters && d > 1)
    for (const sign of [-1, 1]) {
      const sx = x + sign * (w * 0.76);
      face(o, 'wall', sx, y, 0.1, w * 0.45, h, white);
      for (let i = 1; i < 14; i++)
        face(o, 'wall', sx, y + (h * i) / 14, 0.108, w * 0.4, 0.025, recess);
      for (const yy of [y, y + h * 0.48, y + h])
        face(o, 'wall', sx, yy, 0.12, w * 0.45, 0.06, light);
    }
}
function archedDoor(o, d) {
  window(o, 0, 0.63, 2.15, 2.55, d);
  const cy = 3.18,
    r = 1.075,
    n = d < 2 ? 8 : 16,
    p = [[r, cy, 0]];
  for (let i = 1; i <= n; i++)
    p.push([Math.cos((Math.PI * i) / n) * r, cy + Math.sin((Math.PI * i) / n) * r, 0]);
  p.push([-r, cy, 0]);
  // A fan triangulation avoids degenerate triangles along the diameter.
  for (let i = 0; i < n; i++) {
    const a = p[i],
      b = p[i + 1];
    o.addTriangle(
      'glass',
      ref,
      [
        [0, cy, 0.015],
        [a[0], a[1], 0.015],
        [b[0], b[1], 0.015],
      ],
      [0, 0, 1],
      [
        [0.5, 0],
        [0, 1],
        [1, 1],
      ],
      glass,
    );
    if (d > 0) ribbon(o, [a[0], a[1]], [b[0], b[1]], 0.12, 0.065, wood);
  }
  if (d > 1)
    for (let i = 1; i < 8; i++) {
      const a = (Math.PI * i) / 8;
      ribbon(o, [0, cy], [Math.cos(a) * r, cy + Math.sin(a) * r], 0.035, 0.08, white);
    }
}
function railing(o, w, d) {
  B(o, 'wall', 0, 4.97, 0, w, 0.84, 0.22, white);
  B(o, 'wall', 0, 5.81, 0, w, 0.1, 0.3, light);
  if (d > 1)
    for (let x = -w / 2 + 0.36; x < w / 2 - 0.3; x += 1.08) {
      face(o, 'wall', x, 5.12, 0.115, 0.78, 0.54, recess);
      for (const xx of [-0.38, 0.38]) face(o, 'wall', x + xx, 5.12, 0.125, 0.05, 0.54, light);
      for (const yy of [5.12, 5.62]) face(o, 'wall', x, yy, 0.126, 0.78, 0.05, light);
      ribbon(o, [x - 0.23, 5.37], [x, 5.61], 0.07, 0.13);
      ribbon(o, [x, 5.61], [x + 0.23, 5.37], 0.07, 0.13);
      ribbon(o, [x + 0.23, 5.37], [x, 5.14], 0.07, 0.13);
      ribbon(o, [x, 5.14], [x - 0.23, 5.37], 0.07, 0.13);
    }
}
function vent(o, w, y, h, d) {
  if (d < 1) return;
  face(o, 'wall', 0, y, 0, w, h, recess);
  if (d > 1) {
    for (let yy = y + 0.06; yy < y + h; yy += 0.13) face(o, 'wall', 0, yy, 0.012, w, 0.07, light);
    for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 4)
      face(o, 'wall', x, y, 0.025, 0.055, h, white);
  }
}
const constructionControls = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/we/wec/flagstaff_house_hong_kong/entrance-window-construction-controls.json',
      import.meta.url,
    ),
  ),
);
/** Closed joinery stocks, real cut-through pockets, and metric rather than stretched unit UVs. */
function entranceCraft(o) {
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
    rings.forEach((ring, j) =>
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
      }),
    );
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
function archedEntranceAndLowerWindows(o) {
  const c = constructionControls,
    f = c.wall,
    k = c.entrance,
    w = c.windows,
    { Q, rect, flat, solid, box, strip } = entranceCraft(o);
  const arch = (r, bottom) => [
    [-r, bottom],
    [r, bottom],
    ...Array.from({ length: k.segments + 1 }, (_, j) => {
      const t = (j * Math.PI) / k.segments;
      return [r * Math.cos(t), k.spring + r * Math.sin(t)];
    }),
  ];
  const archHole = arch(k.radius, k.bottom),
    windowHole = (x) => rect(x - w.width / 2, w.bottom, x + w.width / 2, w.bottom + w.height);
  flat(
    'frontWall',
    [rect(f.left, f.bottom, f.right, f.top), ...w.centers.map(windowHole), archHole],
    f.z,
    1,
    white,
  );
  const reveal = (shape, back) =>
    shape.forEach((a, i) => {
      const b = shape[(i + 1) % shape.length];
      Q(
        'openingReveal',
        [
          [...a, f.z],
          [...b, f.z],
          [...b, back],
          [...a, back],
        ],
        white,
      );
    });
  reveal(archHole, k.backZ);
  solid(
    'darkJoinery',
    [arch(k.radius + k.frameWidth, k.bottom - k.frameWidth), archHole],
    k.frameBackZ,
    k.frameFrontZ,
    wood,
  );
  // White inner stops and closed fixed fan, separated from the active paired leaves.
  const l = -k.radius,
    r = k.radius,
    top = k.spring,
    panelTop = k.bottom + k.panelHeight;
  for (const xx of [l + 0.035, r - 0.035])
    box('whiteJoinery', xx - 0.035, k.bottom, xx + 0.035, top, k.backZ, 7.94, light);
  const fan = Array.from({ length: k.segments + 1 }, (_, j) => {
    const t = (j * Math.PI) / k.segments;
    return [k.radius * Math.cos(t), top + k.radius * Math.sin(t)];
  });
  solid('glazingStock', [fan], k.backZ - 0.025, k.leafFrontZ - 0.025, glass);
  // Closed semi-annular stocks with real end faces.
  const arcStock = (inner, outer, back, front) => {
    const loop = [
      ...Array.from({ length: k.segments + 1 }, (_, j) => {
        const t = (j * Math.PI) / k.segments;
        return [outer * Math.cos(t), top + outer * Math.sin(t)];
      }),
      ...Array.from({ length: k.segments + 1 }, (_, j) => {
        const t = Math.PI - (j * Math.PI) / k.segments;
        return [inner * Math.cos(t), top + inner * Math.sin(t)];
      }),
    ];
    solid('whiteJoinery', [loop], back, front, light);
  };
  arcStock(k.radius - 0.075, k.radius - 0.035, k.leafFrontZ - 0.005, k.leafFrontZ + k.barDepth);
  arcStock(0.665, 0.695, k.leafFrontZ - 0.005, k.leafFrontZ + k.barDepth);
  for (let j = 1; j <= k.fanSpokes; j++) {
    const t = (j * Math.PI) / (k.fanSpokes + 1);
    strip(
      'whiteJoinery',
      [0, top],
      [Math.cos(t) * (k.radius - 0.05), top + Math.sin(t) * (k.radius - 0.05)],
      k.barWidth,
      k.leafFrontZ - 0.005,
      k.leafFrontZ + k.barDepth,
      light,
    );
  }
  box(
    'whiteJoinery',
    l,
    top - 0.045,
    r,
    top + 0.045,
    k.leafFrontZ - 0.005,
    k.leafFrontZ + k.barDepth,
    light,
  );
  box(
    'glazingStock',
    l + 0.04,
    k.transomY,
    r - 0.04,
    top - 0.04,
    k.backZ - 0.025,
    k.leafFrontZ - 0.025,
    glass,
  );
  box(
    'whiteJoinery',
    l,
    k.transomY - 0.05,
    r,
    k.transomY + 0.05,
    k.leafFrontZ - 0.005,
    k.leafFrontZ + k.barDepth,
    light,
  );
  for (const sign of [-1, 1]) {
    const left = sign < 0 ? l + 0.075 : k.leafGap / 2,
      right = sign < 0 ? -k.leafGap / 2 : r - 0.075;
    const lower = rect(left + 0.1, k.bottom + 0.1, right - 0.1, panelTop - 0.08),
      upper = rect(left + 0.075, panelTop + 0.04, right - 0.075, k.transomY - 0.06);
    solid(
      'whiteJoinery',
      [rect(left, k.bottom, right, k.transomY), lower, upper],
      k.backZ,
      k.leafFrontZ,
      light,
    );
    solid('whiteJoinery', [lower], k.backZ + 0.01, k.leafFrontZ - 0.025, white);
    // Raised closed moulding around the inset bottom panel; its centre remains physically recessed.
    solid(
      'whiteJoinery',
      [
        rect(left + 0.075, k.bottom + 0.075, right - 0.075, panelTop - 0.055),
        rect(left + 0.12, k.bottom + 0.12, right - 0.12, panelTop - 0.1),
      ],
      k.leafFrontZ - 0.01,
      k.leafFrontZ + 0.025,
      light,
    );
    solid('glazingStock', [upper], k.backZ - 0.025, k.leafFrontZ - 0.025, glass);
    const mid = (left + right) / 2;
    box(
      'whiteJoinery',
      mid - 0.018,
      panelTop,
      mid + 0.018,
      k.transomY,
      k.leafFrontZ - 0.005,
      k.leafFrontZ + k.barDepth,
      light,
    );
    for (const frac of [0.3, 0.62]) {
      const y = panelTop + (k.transomY - panelTop) * frac;
      box(
        'whiteJoinery',
        left,
        y - 0.019,
        right,
        y + 0.019,
        k.leafFrontZ - 0.005,
        k.leafFrontZ + k.barDepth,
        light,
      );
    }
    const knob = Array.from({ length: 16 }, (_, j) => {
      const t = (j * 2 * Math.PI) / 16;
      return [
        sign * 0.105 + k.knobRadius * Math.cos(t),
        panelTop - 0.045 + k.knobRadius * Math.sin(t),
      ];
    });
    solid('doorHardware', [knob], k.leafFrontZ - 0.01, k.leafFrontZ + 0.1, edge);
  }
  box(
    'openingReveal',
    l - 0.12,
    k.bottom - 0.08,
    r + 0.12,
    k.bottom + 0.015,
    f.z - 0.12,
    f.z + 0.16,
    light,
  );
  for (const x of w.centers) {
    const l = x - w.width / 2,
      r = x + w.width / 2,
      y = w.bottom,
      top = y + w.height,
      shape = windowHole(x);
    reveal(shape, w.backZ);
    solid(
      'darkJoinery',
      [rect(l - w.frameWidth, y - w.frameWidth, r + w.frameWidth, top + w.frameWidth), shape],
      w.frameBackZ,
      w.frameFrontZ,
      wood,
    );
    box('darkJoinery', l, y, r, top, w.backZ - 0.035, w.backZ - 0.015, wood);
    // White internal closed louvres behind the dark original sash, never unsupported exterior wings.
    for (const sign of [-1, 1]) {
      const cx = x + (sign * w.width) / 4,
        pl = cx - w.slatWidth / 2,
        pr = cx + w.slatWidth / 2;
      solid(
        'whiteJoinery',
        [
          rect(pl - 0.025, y + 0.06, pr + 0.025, top - 0.06),
          rect(pl + 0.025, y + 0.105, pr - 0.025, top - 0.105),
        ],
        w.backZ,
        w.frontZ,
        light,
      );
      const angle = (w.slatTiltDegrees * Math.PI) / 180,
        cs = Math.cos(angle),
        sn = Math.sin(angle);
      for (let sy = y + 0.14; sy < top - 0.1; sy += w.slatPitch) {
        const v = (p) => [p[0], sy + cs * p[1] - sn * p[2], w.frontZ + sn * p[1] + cs * p[2]],
          n = (p) => [p[0], cs * p[1] - sn * p[2], sn * p[1] + cs * p[2]],
          tilted = {
            addTriangle: (s, r, p, nn, u, c) => o.addTriangle(s, r, p.map(v), n(nn), u, c),
            addQuad: (s, r, p, nn, u, c) => o.addQuad(s, r, p.map(v), n(nn), u, c),
          };
        entranceCraft(tilted).box(
          'whiteJoinery',
          pl,
          -w.slatHeight / 2,
          pr,
          w.slatHeight / 2,
          -w.slatDepth / 2,
          w.slatDepth / 2,
          light,
        );
      }
    }
    for (const dx of [-w.width / 2 + 0.03, -w.width / 4, 0, w.width / 4, w.width / 2 - 0.03])
      box('darkJoinery', x + dx - 0.025, y, x + dx + 0.025, top, w.frontZ + 0.025, 8.095, wood);
    for (const frac of [0, 0.33, 0.67, 1]) {
      const yy = y + w.height * frac;
      box('darkJoinery', l, yy - 0.033, r, yy + 0.033, w.frontZ + 0.025, 8.1, wood);
    }
    box('openingReveal', l - 0.15, y - 0.1, r + 0.15, y + 0.015, 7.99, 8.27, light);
  }
}

function front(o, d) {
  const w = 34.2,
    spacing = w / 9;
  for (let i = 0; i < 10; i++) {
    const x = -w / 2 + i * spacing;
    column(o, x, 11.15, 0.55, 4.1, d);
    column(o, x, 11.15, 4.97, 4.03, d);
  }
  railing(facing(o, 0, 0, 11.18), w, d);
  for (let i = 0; i < 9; i++) {
    const x = -w / 2 + (i + 0.5) * spacing;
    vent(facing(o, 0, x, 11.16), spacing - 0.45, 8.16, 0.8, d);
    const wx = (i - 4) * 3.38;
    const wall = facing(o, 0, wx, 8.08);
    if (d !== 3) {
      if (i === 4) archedDoor(wall, d);
      else window(wall, 0, 1.02, 1.63, 2.78, d, i < 3 || i > 5);
    }
    window(wall, 0, 5.52, 1.68, 2.48, d);
  }
  // Broad low steps match the park-front photograph; retain the independent ground.
  B(o, 'edge', 0, -0.25, 11.83, 34.8, 0.53, 1.5, edge);
  B(o, 'wall', 0, 0.28, 11.43, 34.8, 0.27, 0.8, white);
}
function sides(o, d) {
  for (const sign of [-1, 1]) {
    const a = (sign * Math.PI) / 2,
      side = facing(o, a, sign * 17.1, 0);
    for (let i = 0; i < 5; i++) {
      const pz = -11.15 + i * 4.46;
      column(o, sign * 17.1, pz, 0.55, 4.1, d);
      column(o, sign * 17.1, pz, 4.97, 4.03, d);
    }
    railing(facing(o, a, sign * 17.14, 0), 22.3, d);
    for (let i = 0; i < 5; i++) {
      const xx = -11.15 + (i + 0.5) * 4.46;
      vent(facing(side, 0, xx, 0), 3.85, 8.16, 0.8, d);
      // Restored upper side galleries are screened by tall white louvred panels.
      if (d > 0) {
        const panel = facing(side, 0, xx, 0.03);
        face(panel, 'wood', 0, 5.95, 0, 3.65, 2.12, wood);
        if (d > 1)
          for (const dx of [-0.9, 0, 0.9]) {
            face(panel, 'wall', dx, 6.02, 0.012, 0.82, 1.98, white);
            for (let yy = 6.1; yy < 7.97; yy += 0.115)
              face(panel, 'wall', dx, yy, 0.022, 0.75, 0.035, recess);
          }
      }
      const core = facing(o, a, sign * 14.53, 0);
      window(facing(core, 0, xx * 0.82, 0), 0, 1.02, 1.62, 2.78, d, d > 1);
    }
  }
  const back = facing(o, Math.PI, 0, -11.23);
  for (const x of [-13.5, -10.1, -6.75, -3.38, 0, 3.38, 6.75, 10.1, 13.5])
    for (const y of [1.02, 5.52]) window(facing(back, 0, x, 0), 0, y, 1.63, 2.48, d);
}
function roof(o, d) {
  const x = 17.8,
    z = 11.9,
    y = 9.3,
    r = 11.35,
    rx = 7.4;
  const p = [
    [-x, y, -z],
    [x, y, -z],
    [x, y, z],
    [-x, y, z],
    [-rx, r, 0],
    [rx, r, 0],
  ];
  for (const ids of [
    [0, 4, 5],
    [0, 5, 1],
    [1, 5, 2],
    [2, 5, 4],
    [2, 4, 3],
    [3, 4, 0],
  ]) {
    const pp = ids.map((i) => p[i]);
    let n = normalFor(...pp);
    if (n[1] < 0) n = n.map((v) => -v);
    o.addTriangle(
      'roof',
      ref,
      pp,
      n,
      pp.map((p) => [p[0], p[2]]),
      tile,
    );
  }
  if (d > 0) B(o, 'roof', 0, 11.33, 0, 14.9, 0.13, 0.22, tile);
  for (const xx of [-8.1, 8.1])
    for (const zz of [-4.8, 4.8]) {
      const roofY = r - ((r - y) * Math.abs(zz)) / z;
      B(o, 'roof', xx, roofY - 0.04, zz, 1.18, 1.4, 1.1, pink);
      B(o, 'roof', xx, roofY + 1.36, zz, 1.54, 0.15, 1.4, pink);
      if (d > 1)
        for (const sign of [-1, 1]) {
          face(
            facing(o, sign > 0 ? 0 : Math.PI, xx, zz + sign * 0.556),
            'edge',
            0,
            roofY + 1.02,
            0,
            0.8,
            0.23,
            edge,
          );
        }
    }
}
export function flagstaffHouse(o, _frame, d = 3) {
  // The published ground slopes down behind the house. This plinth is structural,
  // not a fitted terrain surface; hidden rear foundation depth remains approximate.
  B(
    d === 3
      ? {
          addQuad: (s, r, p, n, u, c) =>
            p.every((v) => Math.abs(v[2] - 8.05) < 1e-7) ? undefined : o.addQuad(s, r, p, n, u, c),
          addTriangle: (...a) => o.addTriangle(...a),
        }
      : o,
    'wall',
    0,
    -3.8,
    -1.55,
    29,
    12.8,
    19.2,
    white,
  );
  B(o, 'wall', 0, -3.8, -11.0, 34.4, 12.8, 0.4, white);
  for (const y of [0.4, 4.65, 9.0]) {
    B(o, 'wall', 0, y, 0, 34.7, y === 0.4 ? 0.15 : 0.28, 22.8, white);
    if (y > 0.5) {
      B(o, 'edge', 0, y + 0.27, 11.44, 35.0, 0.1, 0.22, edge);
      for (const sign of [-1, 1]) B(o, 'edge', sign * 17.4, y + 0.27, 0, 0.2, 0.1, 23.1, edge);
    }
  }
  front(o, d);
  if (d === 3) archedEntranceAndLowerWindows(o);
  sides(o, d);
  roof(o, d);
}
export function flagstaffHouseSkyline(o) {
  flagstaffHouse(o, undefined, 0);
}
export function flagstaffHouseDistrict(o) {
  flagstaffHouse(o, undefined, 1);
}
export function flagstaffHouseStreet(o) {
  flagstaffHouse(o, undefined, 2);
}
const surfaces = {
  frontWall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  openingReveal: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  darkJoinery: { slot: 'trim', graph: 'wood_plain', roughness: 0.8, metallic: 0 },
  whiteJoinery: { slot: 'trim', graph: 'wood_plain', roughness: 0.8, metallic: 0 },
  glazingStock: { ...landmarkSurfaces.glass, localRef: ref },
  doorHardware: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.15 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.8, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9, metallic: 0 },
  edge: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.15 },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const flagstaffHouseModel = {
  id: 'flagstaff_house_hong_kong',
  key: 'flagstaff_house_hong_kong',
  recipe: 'structure-flagstaff-house-hong-kong.mjs',
  cell: 'we/wec',
  title: 'Flagstaff House (Hong Kong)',
  brief:
    'Original two-storey Greek Revival house with deep white colonnaded verandahs, dark framed sash windows, closed internal lower-front louvers behind recessed lattice and white paired paneled entrance doors with physical fanlight, panelled upper balustrade, white louvred side galleries, shallow hipped tiled roof and four pink chimneys. Later gallery and connecting passage excluded.',
  camera: [40, 24, 40],
  lookAt: [0, 4, 0],
  qaCameras: [
    { name: 'front', position: [0, 24, 53], lookAt: [0, 4.5, 5] },
    { name: 'back', position: [-32, 22, -38], lookAt: [0, 4, -1] },
    { name: 'arched-entrance', position: [2.7, 3.1, 11.0], lookAt: [0, 2.45, 8.0] },
    { name: 'internal-louvers', position: [-5.6, 2.9, 10.8], lookAt: [-6.76, 2.4, 8.0] },
  ],
  mediumFiContext: { scale: 0.6 },
  build: flagstaffHouse,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Park-front forecourt[0,14], Y=0 at27m HKPD in unmodified official5m DTM. Front deck.55m and broad low steps retain photographed contact; source ground falls about3m toward the hidden rear. Foundation continues beneath it without flattening the independent grid. Coarse ground accuracy and unseen rear foundation remain explicit limitations.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-flagstaff-house-hong-kong.mjs',
    level: 'skyline',
    export: 'flagstaffHouseSkyline',
    errorMeters: 0.55,
    surfaces,
    authoredLevels: {
      district: { export: 'flagstaffHouseDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'flagstaffHouseStreet', errorMeters: 0.32, surfaces },
    },
  },
  limitations: [
    'Current construction uses exact native same-photographer public-domain2007front after Qualla-first93records; first own-photo grant/native upload identity bound. True arched entrance/white paired paneled doors/closed fanlight stocks/eight lower-front recessed internal louvers built. Earlier attribution/private/aerial controls excluded; full main-house/verandas/columns/hipped roof retained pending broader exterior/roof review. Dimensions, bay counts, columns/upper rail/rear details and present condition remain estimates, not measured elevations.',
    'Original house only. The later K.S.Lo Gallery and narrow connecting passage, temporary exhibition banners, interiors, garden objects, trees and fine signage are excluded.',
    'The official5m DTM has published±5m accuracy at90% confidence; rear ground and foundation cannot be certified from the front photograph. Source terrain remains unmodified. Close new joinery has real recess/closed stocks/metric UVs. Three original lower geometry streams remain exact; conservative LODerror estimates.55/.4/.32m account for recess depth without claiming measured geometric-error certification. Fine columns/upper rail/side galleries/roof profiles remain original estimates pending wider cleared evidence.',
    'Placement preview only; generic-footprint replacement disabled. Photographic pixels are not redistributed and no physical-device performance or survey accuracy is claimed.',
  ],
};
