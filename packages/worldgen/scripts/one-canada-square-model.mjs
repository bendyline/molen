/** Original One Canada Square exterior, with published window and storey dimensions. */
import { readFileSync } from 'node:fs';
import { beam, loft, normalFor, radialRing, torus } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frameBytes = readFileSync(structureSourcePath('n0222_one_canada_square', 'map-frame.json'));
const frame = JSON.parse(frameBytes);
const cx = -2.65;
const module = 3.048;
const radius = module * 9.5;
const innerStep = radius - 2 * module;
const outerStep = radius - module;
const officeBase = 20.5;
// The owner's stacking diagram omits 13. Labels 5..46 give 41 physical office intervals.
const lowerLabels = Array.from({ length: 42 }, (_, i) => i + 5).filter((n) => n !== 13);
const terraceY = officeBase + lowerLabels.length * 4.11;
const upperFloors = [
  terraceY,
  terraceY + 4.11,
  terraceY + 8.22,
  terraceY + 12.33,
  terraceY + 17.04,
];
const roofY = upperFloors.at(-1);
const eave = roofY + 4;
const apex = 234.5;
const silver = [0.68, 0.715, 0.73];
const trim = [0.52, 0.565, 0.59];
const dark = [0.1, 0.14, 0.16];
const glazing = [0.235, 0.335, 0.36];
const marble = [0.61, 0.6, 0.51];
const roof = [0.26, 0.29, 0.3];
const tint = (color, n, amplitude = 0.025) =>
  color.map((v) => v + (((Math.imul(n + 11, 48271) >>> 0) % 103) / 102 - 0.5) * amplitude);
const face = (out, slot, p, color) => quad(out, slot, p, normalFor(...p), color);
const square = (half) => [
  [-half, -half],
  [-half, half],
  [half, half],
  [half, -half],
];
const plan = (() => {
  const a = innerStep,
    b = outerStep,
    r = radius;
  return [
    [-a, -r],
    [-a, -b],
    [-b, -b],
    [-b, -a],
    [-r, -a],
    [-r, a],
    [-b, a],
    [-b, b],
    [-a, b],
    [-a, r],
    [a, r],
    [a, b],
    [b, b],
    [b, a],
    [r, a],
    [r, -a],
    [b, -a],
    [b, -b],
    [a, -b],
    [a, -r],
  ];
})();

/** Local x follows a clockwise edge; local +z points out of the building. */
function edge(out, a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / length,
    uz = (b[1] - a[1]) / length;
  const vector = ([x, y, z]) => [ux * x - uz * z, y, uz * x + ux * z];
  const point = (p) => {
    const q = vector(p);
    return [q[0] + a[0] + cx, q[1], q[2] + a[1]];
  };
  return {
    length,
    addQuad: (s, r, p, n, u, c) => out.addQuad(s, r, p.map(point), vector(n), u, c),
    addTriangle: (s, r, p, n, u, c) => out.addTriangle(s, r, p.map(point), vector(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) =>
      out.addConvexPolygon(s, r, p.map(point), vector(n), u, c),
  };
}

function panel(out, x0, x1, y0, y1, color = silver, z = 0, slot = 'stainless') {
  if (x1 - x0 < 0.012 || y1 - y0 < 0.012) return;
  const bevel = 0.008;
  const ring = (inset, depth) => [
    [x0 + inset, y0 + inset, depth],
    [x1 - inset, y0 + inset, depth],
    [x1 - inset, y1 - inset, depth],
    [x0 + inset, y1 - inset, depth],
  ];
  const back = ring(0, z - 0.13),
    lip = ring(0, z - bevel),
    front = ring(bevel, z);
  face(out, slot, front, color);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(out, slot, [back[i], back[j], lip[j], lip[i]], color);
    face(out, slot, [lip[i], lip[j], front[j], front[i]], color);
  }
}
function pane(out, x0, x1, y0, y1, z, serial, clear = false) {
  face(
    out,
    clear ? 'clear_glass' : 'glass',
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    clear ? [0.68, 0.76, 0.77] : tint(glazing, serial, 0.09),
  );
  // One continuous reveal frame avoids four overlapping boxes and their hidden back faces.
  const ring = (d, depth) => [
    [x0 - d, y0 - d, depth],
    [x1 + d, y0 - d, depth],
    [x1 + d, y1 + d, depth],
    [x0 - d, y1 + d, depth],
  ];
  const outside = ring(0.025, z + 0.045),
    inside = ring(-0.025, z + 0.045);
  const rear = ring(0.025, z - 0.02),
    innerRear = ring(-0.025, z);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(out, 'metal', [outside[i], outside[j], inside[j], inside[i]], dark);
    face(out, 'metal', [rear[i], rear[j], outside[j], outside[i]], dark);
    face(out, 'metal', [inside[i], inside[j], innerRear[j], innerRear[i]], dark);
  }
}
function backing(out, x0, x1, y0, y1, z = -0.25) {
  face(
    out,
    'recess',
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    dark,
  );
}
function punchedWindow(out, x0, y0, serial) {
  const x1 = x0 + module,
    left = (x0 + x1) / 2 - 0.9,
    right = left + 1.8;
  const sill = y0 + 0.73,
    head = sill + 2.75,
    top = y0 + 4.11;
  // Continuous backing closes the fine cladding joints. Opaque window glazing sits in front.
  backing(out, x0 - 0.005, x1 + 0.005, y0, top);
  // Two vertical panel strips and separately divided upper/lower spandrels.
  for (const [a, b] of [
    [x0 + 0.009, left],
    [right, x1 - 0.009],
  ]) {
    const split = y0 + 2.055;
    panel(out, a, b, y0 + 0.009, split - 0.007, tint(silver, serial));
    panel(out, a, b, split + 0.007, top - 0.009, tint(silver, serial + 1));
  }
  for (const [a, b] of [
    [left, (left + right) / 2 - 0.008],
    [(left + right) / 2 + 0.008, right],
  ]) {
    panel(out, a, b, y0 + 0.009, sill, tint(silver, serial + 2));
    panel(out, a, b, head, top - 0.009, tint(silver, serial + 3));
  }
  const opening = [
    [left, sill, 0],
    [right, sill, 0],
    [right, head, 0],
    [left, head, 0],
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      out,
      'stainless',
      [
        opening[j],
        opening[i],
        [opening[i][0], opening[i][1], -0.19],
        [opening[j][0], opening[j][1], -0.19],
      ],
      trim,
    );
  }
  const mid = (left + right) / 2,
    transom = sill + 0.62;
  for (const [a, b] of [
    [left + 0.03, mid - 0.014],
    [mid + 0.014, right - 0.03],
  ]) {
    pane(out, a, b, sill + 0.028, transom, -0.205, serial);
    pane(out, a, b, transom + 0.025, head - 0.025, -0.205, serial + 1);
  }
  box(out, 'stainless', [left - 0.025, sill - 0.05, -0.22], [right + 0.025, sill, 0.055], trim);
}
function steppedSlab(out, y, thickness, color, slot = 'stainless', expand = 0) {
  // A union of rectangles caps the concave staircase plan without a convex fan across notches.
  const a = innerStep + expand,
    b = outerStep + expand,
    r = radius + expand;
  box(out, slot, [cx - a, y, -r], [cx + a, y + thickness, r], color);
  for (const sign of [-1, 1]) {
    const side = (lo, hi, depth) =>
      box(
        out,
        slot,
        [cx + Math.min(sign * lo, sign * hi), y, -depth],
        [cx + Math.max(sign * lo, sign * hi), y + thickness, depth],
        color,
      );
    side(a, b, b);
    side(b, r, a);
  }
}
function shaft(out) {
  for (let k = 0; k < plan.length; k++) {
    const o = edge(out, plan[k], plan[(k + 1) % plan.length]);
    const columns = Math.round(o.length / module);
    for (let row = 0; row < lowerLabels.length; row++) {
      const y = officeBase + row * 4.11;
      for (let col = 0; col < columns; col++)
        punchedWindow(o, col * module, y, k * 10007 + row * 131 + col);
      // Narrow rounded horizontal noses, separate from the inset glazing and panel joints.
      tube(o, 'stainless', [0, y + 0.075, 0.018], [o.length, y + 0.075, 0.018], 0.045, trim, 8);
    }
    for (let col = 0; col <= columns; col++) {
      const x = Math.min(Math.max(col * module, 0.035), o.length - 0.035);
      box(o, 'stainless', [x - 0.031, officeBase, -0.02], [x + 0.031, terraceY, 0.085], trim);
      box(o, 'recess', [x - 0.009, officeBase, 0.086], [x + 0.009, terraceY, 0.093], dark);
    }
  }
  steppedSlab(out, officeBase - 0.16, 0.16, roof, 'recess');
  steppedSlab(out, terraceY - 0.24, 0.24, silver);
  // The roof between stepped shaft and the smaller upper section is a real ledge.
  for (let k = 0; k < plan.length; k++) {
    const o = edge(out, plan[k], plan[(k + 1) % plan.length]);
    box(o, 'stainless', [0, terraceY - 0.12, -0.12], [o.length, terraceY + 0.26, 0.06], silver);
  }
}

function rail(out, a, b, y) {
  const o = edge(out, a, b),
    count = Math.max(1, Math.round(o.length / 1.55));
  for (let i = 0; i < count; i++) {
    const l = (i * o.length) / count,
      r = ((i + 1) * o.length) / count;
    pane(o, l + 0.035, r - 0.035, y + 0.12, y + 1.12, 0, i, true);
    box(o, 'stainless', [l - 0.024, y, -0.04], [l + 0.024, y + 1.18, 0.04], trim);
  }
  tube(o, 'stainless', [0, y + 1.19, 0], [o.length, y + 1.19, 0], 0.029, silver, 10);
}
function upper(out) {
  const half = 25.6,
    p = square(half),
    count = 17;
  for (let k = 0; k < 4; k++) {
    const o = edge(out, p[k], p[(k + 1) % 4]),
      w = o.length / count;
    for (let row = 0; row < 4; row++) {
      const y0 = upperFloors[row],
        y1 = upperFloors[row + 1];
      backing(o, 0, o.length, y0, y1, -0.31);
      for (let col = 0; col < count; col++) {
        const left = col * w,
          right = left + w,
          mid = (left + right) / 2;
        panel(o, left + 0.013, right - 0.013, y0, y0 + 0.42, silver, 0.02);
        panel(o, left + 0.013, right - 0.013, y1 - 0.37, y1, silver, 0.02);
        for (const [a, b] of [
          [left + 0.19, mid - 0.022],
          [mid + 0.022, right - 0.19],
        ]) {
          pane(o, a, b, y0 + 0.48, y0 + 1.03, -0.23, col + row * 83 + k * 997);
          pane(o, a, b, y0 + 1.065, y1 - 0.43, -0.23, col + row * 83 + k * 997 + 1);
        }
        // Level-47 west terrace doors occupy selected bays, independently framed.
        if (k === 0 && row === 0 && [4, 8, 12].includes(col)) {
          box(
            o,
            'stainless',
            [left + 0.23, y0 + 1.06, -0.18],
            [left + 0.255, y0 + 1.39, -0.12],
            silver,
          );
          box(
            o,
            'stainless',
            [right - 0.255, y0 + 1.06, -0.18],
            [right - 0.23, y0 + 1.39, -0.12],
            silver,
          );
        }
      }
    }
    for (let col = 0; col <= count; col++) {
      const x = col * w;
      panel(o, x - 0.135, x + 0.135, terraceY, roofY + 0.65, silver, 0.06);
      box(o, 'stainless', [x - 0.035, terraceY, 0.06], [x + 0.035, roofY + 0.65, 0.31], trim);
    }
    panel(o, 0, o.length, roofY - 0.1, roofY + 0.65, silver, 0.02);
  }
  box(out, 'recess', [cx - half, roofY, -half], [cx + half, roofY + 0.19, half], roof);
  // Narrow west terrace; no marketing-render furniture is presumed installed.
  box(
    out,
    'stone',
    [cx - radius + 0.28, terraceY, -innerStep + 0.25],
    [cx - half - 0.05, terraceY + 0.1, innerStep - 0.25],
    [0.56, 0.57, 0.55],
  );
  rail(out, [-radius + 0.25, -innerStep + 0.2], [-radius + 0.25, innerStep - 0.2], terraceY + 0.1);
  for (const z of [-innerStep + 0.2, innerStep - 0.2])
    rail(out, [-radius + 0.25, z], [-half, z], terraceY + 0.1);
}

function crown(out) {
  const h = 22.4,
    p = square(h);
  for (let k = 0; k < 4; k++) {
    const o = edge(out, p[k], p[(k + 1) % 4]);
    backing(o, 0, o.length, roofY + 0.15, eave, -0.11);
    for (let y = roofY + 0.24; y < eave - 0.1; y += 0.41) {
      box(o, 'stainless', [0, y, -0.01], [o.length, y + 0.085, 0.12], silver);
      face(
        o,
        'stainless',
        [
          [0, y, 0.12],
          [o.length, y, 0.12],
          [o.length, y + 0.2, -0.02],
          [0, y + 0.2, -0.02],
        ],
        trim,
      );
    }
    for (let x = 0; x <= o.length + 0.01; x += o.length / 28)
      box(o, 'stainless', [x - 0.037, roofY, -0.02], [x + 0.037, eave + 0.05, 0.16], silver);
    const a = p[k],
      b = p[(k + 1) % 4];
    const at = (q, y, project = 0) => {
      const t = (y - eave) / (apex - eave),
        n = [-(b[1] - a[1]) / o.length, (b[0] - a[0]) / o.length];
      return [cx + q[0] * (1 - t) + n[0] * project, y, q[1] * (1 - t) + n[1] * project];
    };
    const pa = at(a, eave),
      pb = at(b, eave),
      tip = [cx, apex, 0];
    out.addTriangle(
      'recess',
      'palette:#ffffff',
      [pa, pb, tip],
      normalFor(pa, pb, tip),
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      dark,
    );
    // Separate folded horizontal louvres; their tiny gaps expose a closed dark roof backing.
    for (let y = eave; y < apex - 0.25; y += 0.285) {
      const top = Math.min(y + 0.24, apex - 0.12);
      const a0 = at(a, y, 0.07),
        b0 = at(b, y, 0.07),
        a1 = at(a, top, 0.035),
        b1 = at(b, top, 0.035);
      face(out, 'stainless', [a0, b0, b1, a1], tint(silver, Math.round(y * 11)));
      face(out, 'stainless', [at(a, y, 0), at(b, y, 0), b0, a0], trim);
      face(out, 'stainless', [a0, a1, at(a, top), at(a, y)], trim);
      face(out, 'stainless', [b1, b0, at(b, y), at(b, top)], trim);
    }
    beam(out, 'stainless', [cx + a[0], eave + 0.06, a[1]], [cx, apex, 0], 0.22, 0.15, trim);
  }
  // A small cap/beacon finishes the roof at the architect's stated 235 m tip.
  loft(
    out,
    'stainless',
    [
      radialRing(apex - 0.22, 0.25, 0.25, 16, [cx, 0]),
      radialRing(apex + 0.12, 0.15, 0.15, 16, [cx, 0]),
    ],
    trim,
  );
  loft(
    out,
    'metal',
    [radialRing(apex + 0.12, 0.11, 0.11, 16, [cx, 0]), radialRing(235, 0.11, 0.11, 16, [cx, 0])],
    [0.49, 0.06, 0.035],
  );
  // Visible perimeter maintenance track; mechanisms whose shapes are unverified are omitted.
  const track = square(23.7);
  for (let k = 0; k < 4; k++) {
    const o = edge(out, track[k], track[(k + 1) % 4]);
    tube(o, 'stainless', [0, roofY + 0.55, 0], [o.length, roofY + 0.55, 0], 0.045, trim, 10);
    for (let x = 0.8; x < o.length; x += 2.95)
      box(
        o,
        'stainless',
        [x - 0.055, roofY + 0.18, -0.055],
        [x + 0.055, roofY + 0.54, 0.055],
        trim,
      );
  }
}

function revolving(out, x, y, z, bullnose) {
  const r = 1.47,
    head = y + 3.45;
  for (const [bottom, top] of [
    [y, y + 0.04],
    [head, head + 0.28],
    [head + 0.28, head + 0.48],
  ])
    loft(
      out,
      'stainless',
      [
        radialRing(bottom, r + 0.1, r + 0.1, 64, [x, z]),
        radialRing(top, r + 0.1, r + 0.1, 64, [x, z]),
      ],
      silver,
    );
  tube(out, 'stainless', [x, y + 0.04, z], [x, head, z], 0.08, trim, 20);
  for (const sign of [-1, 1]) {
    // The two open approaches remain actual openings in the outer drum.
    const start = sign === 1 ? -Math.PI * 0.28 : Math.PI * 0.72;
    for (let j = 0; j < 24; j++) {
      const a = start + (j * Math.PI * 0.56) / 24,
        b = start + ((j + 1) * Math.PI * 0.56) / 24;
      const point = (t, h) => [x + r * Math.cos(t), h, z + r * Math.sin(t)];
      face(
        out,
        'clear_glass',
        [point(b, y + 0.08), point(a, y + 0.08), point(a, head), point(b, head)],
        [0.66, 0.75, 0.77],
      );
      if (j % 8 === 0) tube(out, 'stainless', point(a, y + 0.06), point(a, head), 0.023, trim, 10);
    }
  }
  for (let leaf = 0; leaf < 4; leaf++) {
    const a = (leaf * Math.PI) / 2 + Math.PI / 4;
    const o = edge(
      out,
      [x - cx, z],
      [x - cx + Math.cos(a) * (r - 0.07), z + Math.sin(a) * (r - 0.07)],
    );
    pane(o, 0.06, o.length, y + 0.09, head - 0.05, 0, leaf, true);
    tube(
      o,
      'stainless',
      [0.1, y + 1.18, 0.055],
      [o.length - 0.12, y + 1.18, 0.055],
      0.018,
      trim,
      8,
    );
  }
  torus(out, 'stainless', [x, y + 0.055, z], r, 0.028, trim, 64, 8);
  if (bullnose) {
    for (const sign of [-1, 1]) {
      const xx = x + sign * (r + 0.46);
      // Shallow curved fixed sidelights beside the revolving drum.
      for (let i = 0; i < 12; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 12,
          b = a + Math.PI / 12;
        const point = (t, h) => [xx + sign * 0.43 * Math.cos(t), h, z + 0.57 * Math.sin(t)];
        face(
          out,
          'clear_glass',
          [point(a, y + 0.1), point(b, y + 0.1), point(b, head), point(a, head)],
          [0.7, 0.77, 0.78],
        );
      }
      tube(out, 'stainless', [xx, y + 0.08, z - 0.57], [xx, head, z - 0.57], 0.03, trim, 10);
      tube(out, 'stainless', [xx, y + 0.08, z + 0.57], [xx, head, z + 0.57], 0.03, trim, 10);
    }
  }
}
function entrance(out, a, b, count, serial) {
  const o = edge(out, a, b),
    middle = o.length / 2,
    spacing = 5.4;
  for (let i = 0; i < count; i++) {
    const x = middle + (i - (count - 1) / 2) * spacing;
    // Nested local edge adapters preserve actual four-wing geometry on each facade.
    const moved = {
      addQuad: (s, r, p, n, u, c) =>
        o.addQuad(
          s,
          r,
          p.map(([xx, y, z]) => [xx - cx, y, z]),
          n,
          u,
          c,
        ),
      addTriangle: (s, r, p, n, u, c) =>
        o.addTriangle(
          s,
          r,
          p.map(([xx, y, z]) => [xx - cx, y, z]),
          n,
          u,
          c,
        ),
      addConvexPolygon: (s, r, p, n, u, c) =>
        o.addConvexPolygon(
          s,
          r,
          p.map(([xx, y, z]) => [xx - cx, y, z]),
          n,
          u,
          c,
        ),
    };
    revolving(moved, x + cx, 0.21, -0.55, serial + i < 7);
  }
  const lo = middle - (count * spacing) / 2,
    hi = middle + (count * spacing) / 2;
  for (const [a, b] of [
    [0, lo],
    [hi, o.length],
  ]) {
    const count = Math.max(1, Math.round((b - a) / 1.5));
    for (let i = 0; i < count; i++)
      pane(
        o,
        a + ((b - a) * i) / count,
        a + ((b - a) * (i + 1)) / count,
        0.22,
        3.95,
        -0.52,
        i,
        true,
      );
  }
  for (let x = 0; x < o.length; x += 1.5)
    pane(o, x, Math.min(x + 1.5, o.length), 4.12, 7.3, -0.5, 3, true);
  box(o, 'stainless', [0, 3.95, -0.62], [o.length, 4.12, -0.26], silver);
  for (const x of [lo - 0.3, hi + 0.3])
    tube(o, 'stainless', [x, 0.2, 0], [x, 7.48, 0], 0.31, silver, 36);
  box(o, 'stainless', [-0.28, 7.32, -1.7], [o.length + 0.28, 7.54, 1.0], silver);
  for (let x = 0.6; x < o.length; x += 2.4)
    box(o, 'stainless', [x - 0.05, 7.2, -1.25], [x + 0.05, 7.31, 0.8], trim);
}
function base(out) {
  // Three separate base slabs follow the mapped asymmetric envelope.
  box(out, 'stone', [-31.55, 0, -28.16], [26.25, 0.2, 28.16], [0.52, 0.53, 0.51]);
  box(out, 'stone', [-24.2, 0, -29.61], [18.9, 0.2, 29.61], [0.52, 0.53, 0.51]);
  box(out, 'stone', [26.25, 0, -21.12], [31.55, 0.2, 21.16], [0.52, 0.53, 0.51]);
  // A small visible lobby interior provides depth behind transparent entrances.
  box(out, 'marble', [cx - 12, 0.2, -10], [cx + 12, 7.2, 10], marble);
  box(out, 'marble', [cx - 20, 0.2, -22], [cx + 20, 0.23, 22], [0.72, 0.7, 0.61]);
  for (const x of [-18, 18])
    for (const z of [-18, 18])
      tube(out, 'stainless', [cx + x, 0.23, z], [cx + x, 7.3, z], 0.36, silver, 40);
  // The low lobby roof covers the entrance projections, beyond the stepped upper shaft.
  box(out, 'stainless', [-31.69, 7.44, -28.3], [26.39, 7.71, 28.3], silver);
  box(out, 'stainless', [-24.34, 7.44, -29.75], [19.04, 7.71, 29.75], silver);
  box(out, 'stainless', [26.25, 7.44, -21.26], [31.69, 7.71, 21.3], silver);
  // Entrance allocation is a documented reconstruction: N2, E3, S2, W2.
  entrance(out, [21.55, -29.61], [-21.55, -29.61], 2, 0);
  entrance(out, [34.2, 21.16], [34.2, -21.12], 3, 2);
  entrance(out, [-21.55, 29.61], [21.55, 29.61], 2, 5);
  entrance(out, [-28.9, -21.4], [-28.9, 21.4], 2, 7);
  const returns = [
    [
      [-31.55, -28.16],
      [-31.55, -21.4],
    ],
    [
      [-31.55, 21.4],
      [-31.55, 28.16],
    ],
    [
      [-31.55, 28.16],
      [-24.2, 28.16],
    ],
    [
      [-24.2, 28.16],
      [-24.2, 29.61],
    ],
    [
      [18.9, 29.61],
      [18.9, 28.16],
    ],
    [
      [18.9, 28.16],
      [26.25, 28.16],
    ],
    [
      [26.25, 28.16],
      [26.25, 21.16],
    ],
    [
      [26.25, 21.16],
      [31.55, 21.16],
    ],
    [
      [31.55, -21.12],
      [26.25, -21.12],
    ],
    [
      [26.25, -21.12],
      [26.25, -28.16],
    ],
    [
      [26.25, -28.16],
      [18.9, -28.16],
    ],
    [
      [18.9, -28.16],
      [18.9, -29.61],
    ],
    [
      [-24.2, -29.61],
      [-24.2, -28.16],
    ],
    [
      [-24.2, -28.16],
      [-31.55, -28.16],
    ],
  ];
  for (const [a, b] of returns) {
    const o = edge(out, [a[0] - cx, a[1]], [b[0] - cx, b[1]]);
    if (o.length < 2) panel(o, 0, o.length, 0.2, 7.44, marble, -0.01, 'marble');
    else {
      const count = Math.round(o.length / 1.5);
      for (let i = 0; i < count; i++)
        for (const [lo, hi] of [
          [0.22, 3.95],
          [4.1, 7.42],
        ])
          pane(o, (i * o.length) / count, ((i + 1) * o.length) / count, lo, hi, -0.035, i, true);
    }
  }
  for (let k = 0; k < plan.length; k++) {
    const o = edge(out, plan[k], plan[(k + 1) % plan.length]);
    // Larger low-level windows below a separate plant screen.
    const columns = Math.round(o.length / module);
    for (let col = 0; col < columns; col++) {
      const x = col * module;
      backing(o, x, x + module, 7.71, officeBase, -0.24);
      panel(o, x + 0.01, x + 0.34, 7.72, 13.35, silver);
      panel(o, x + module - 0.34, x + module - 0.01, 7.72, 13.35, silver);
      pane(o, x + 0.38, x + module / 2 - 0.02, 8.05, 12.87, -0.2, col);
      pane(o, x + module / 2 + 0.02, x + module - 0.38, 8.05, 12.87, -0.2, col + 1);
      panel(o, x + 0.34, x + module - 0.34, 7.72, 8.02, silver);
      panel(o, x + 0.34, x + module - 0.34, 12.92, 13.35, silver);
      panel(o, x + 0.01, x + 0.33, 13.38, officeBase, silver);
      panel(o, x + module - 0.33, x + module - 0.01, 13.38, officeBase, silver);
      for (let y = 13.43; y < officeBase - 0.1; y += 0.275)
        face(
          o,
          'stainless',
          [
            [x + 0.34, y, -0.06],
            [x + module - 0.34, y, -0.06],
            [x + module - 0.34, y + 0.2, -0.19],
            [x + 0.34, y + 0.2, -0.19],
          ],
          trim,
        );
    }
    box(o, 'stainless', [0, 13.3, -0.1], [o.length, 13.42, 0.11], silver);
  }
}

export const oneCanadaSquareStudy = {
  id: 'N0222',
  key: 'one_canada_square',
  title: 'One Canada Square',
  wikidataId: 'Q503477',
  mapFrame: 'map-frame.json',
  build(out) {
    base(out);
    shaft(out);
    upper(out);
    crown(out);
  },
  brief:
    'One Canada Square: a linen-finish stainless tower with two inward steps at each corner, individually recessed paired windows, four narrower glazed upper storeys, west terrace, folded-louvre pyramid and four entrance elevations with revolving doors.',
  sourceFacts: {
    architectTipHeightMeters: 235,
    councilTipHeightMeters: 236,
    completed: 1991,
    typicalFloorIntervalMeters: 4.11,
    level50FloorIntervalMeters: 4.71,
    punchedWindowMeters: [1.8, 2.75],
    level35InternalDimensionMeters: 56.9,
    level47InternalDimensionMeters: 49.8,
    revolvingDoors: 9,
    bullnoseRevolvingDoors: 7,
  },
  reconstruction: {
    centerXZ: [cx, 0],
    outerShaftDimensionMeters: radius * 2,
    outerUpperDimensionMeters: 51.2,
    facadeModuleMeters: module,
    officeBase,
    lowerLabels,
    terraceY,
    upperFloors,
    roofY,
    pyramidEave: eave,
    pyramidApex: apex,
    pyramidBaseMeters: 44.8,
    entranceAllocation: { north: 2, east: 3, south: 2, west: 2 },
    basis:
      'External 19-module shaft width reconciles the 56.9 m internal plan with the mapped west/east wall lines. The nominal 3 m engineering module is reconstructed as 3.048 m. Lower office datum, roof dimensions, ground-floor heights and door allocation are inferred, not measured.',
    materials:
      'Linen-finish steel uses the canonical stainless graph. Original geometry supplies joints, mullions, reveals, bullnoses and louvres; no photograph textures.',
  },
  refs: [
    'https://pcparch.com/work/one-canada-square-and-docklands-light-railway-station',
    'https://offices.canarywharf.com/wp-content/uploads/2025/07/One-Canada-Square-Brochure_v17g.pdf',
    'https://images1.loopnet.com/d2/g_LDyTiUwUQh7gLJ-NzRTflr7BdsBQ8ZRfc0XYVIK_8/One%20Canada%20SquareBrochurepdf.pdf',
    'https://www.entuitive.com/projects/one-canada-square,-canary-wharf',
    'https://www.skyscrapercenter.com/building/one-canada-square/1040',
    'https://colt-international.co.uk/solutions/louvre/',
    'https://websaweprd.blob.core.windows.net/cms-assets-international/2023-06/One%20Canada%20Square_Case_Study.pdf',
    'https://www.openstreetmap.org/way/5986754',
  ],
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X east-southeast along local street grid',
    front: '+Z south-southwest',
    origin: 'Mapped lower-envelope center; upper tower center is X=-2.65 m; Y0 is terrain contact.',
  },
  geographic: () => ({
    anchor: frame.anchor,
    heading: frame.heading,
    mapGeometryHash: hashEvidenceText(frameBytes),
    notes:
      'Exact-QID map registration. Stepped shaft remains distinct from the asymmetric lower envelope. The terrace is on the west. Signed alignment, real pavement contact and the 235/236 m height convention remain review items.',
  }),
  geometrySource:
    'Original procedural reconstruction from linked architect photographs, owner floor plans and published facade specifications. No downloaded mesh or photograph is rendered.',
  sourceLicense:
    'Original Molen recipe under the repository MIT license. Map evidence © OpenStreetMap contributors, ODbL-1.0. Reference images and drawings are linked, not redistributed.',
  sourceDocuments: ['reference-metadata.json'],
  limitations: [
    'Maximum-fidelity review remains pending: external plan dimensions, lower office datum, cladding subpanels and louvre profile are reconstructed. The exact distribution of nine revolving doors is unverified; N2/E3/S2/W2 is an explicit working allocation.',
    'The model uses the architect’s 235 m tip. The Council on Vertical Urbanism lists 236 m from the lowest significant entrance; their one-metre datum difference is unresolved. Marketing 244/245 m claims are not used.',
    'Ground-floor glazing/canopies, lower plant floors, roof track and beacon are photo-informed approximations. Interiors, station links, retail pavilions and nearby buildings are outside the exterior model.',
    'Geographic approval requires real pavement/terrain contact and signed current facade fit. A flat-ground map overlay alone does not establish those conditions.',
  ],
  camera: { position: [-218, 142, 255], lookAt: [cx, 115, 0], fov: 36 },
  qaCameras: [
    { name: 'pyramid-louvres', position: [cx + 48, 237, 54], lookAt: [cx, 220, 0] },
    { name: 'upper-four-levels', position: [cx - 78, 209, 49], lookAt: [cx - 20, 198, 0] },
    { name: 'west-terrace', position: [cx - 45, 196, 24], lookAt: [cx - 27, 190, 4] },
    { name: 'punched-window-detail', position: [cx + 11, 107, 42], lookAt: [cx + 11, 106, radius] },
    { name: 'stepped-corner', position: [cx - 43, 63, -42], lookAt: [cx - 25, 61, -25] },
    { name: 'north-entrance', position: [cx, 10, -55], lookAt: [cx, 4, -29] },
    { name: 'east-entrance', position: [59, 10, 0], lookAt: [29, 4, 0] },
    { name: 'south-entrance', position: [cx, 10, 55], lookAt: [cx, 4, 29] },
    { name: 'west-entrance', position: [-58, 10, 0], lookAt: [-31, 4, 0] },
    { name: 'revolving-door', position: [cx - 3, 4, -37], lookAt: [cx - 2.7, 2, -29] },
    { name: 'roof-and-plan', position: [cx, 365, 0.5], lookAt: [cx, 0, 0] },
    { name: 'far-silhouette', position: [-660, 340, 740], lookAt: [cx, 116, 0] },
  ],
};
