/** Original One Canada Square exterior, with published window and storey dimensions. */
import { beam, loft, normalFor, radialRing, torus } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

let detail;
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
    detail: out.detail,
    addQuad: (s, r, p, n, u, c) => out.addQuad(s, r, p.map(point), vector(n), u, c),
    addTriangle: (s, r, p, n, u, c) => out.addTriangle(s, r, p.map(point), vector(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) =>
      out.addConvexPolygon(s, r, p.map(point), vector(n), u, c),
  };
}

function panel(out, x0, x1, y0, y1, color = silver, z = 0, slot = 'stainless') {
  if (x1 - x0 < 0.012 || y1 - y0 < 0.012) return;
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    color,
  );
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
  if (detail.level === 'closeup' && clear) {
    for (const [lo, hi] of [
      [x0, x0 + 0.025],
      [x1 - 0.025, x1],
    ])
      face(
        out,
        'metal',
        [
          [lo, y0, z + 0.02],
          [hi, y0, z + 0.02],
          [hi, y1, z + 0.02],
          [lo, y1, z + 0.02],
        ],
        dark,
      );
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
  const left = x0 + module / 2 - 0.9,
    right = left + 1.8,
    sill = y0 + 0.73,
    head = sill + 2.75,
    top = y0 + 4.11;
  if (!detail.sourceMaster) {
    const depth = detail.level === 'closeup' ? -0.14 : -0.12;
    const outer = [
        [x0, y0, 0],
        [x0 + module, y0, 0],
        [x0 + module, top, 0],
        [x0, top, 0],
      ],
      inner = [
        [left, sill, depth],
        [right, sill, depth],
        [right, head, depth],
        [left, head, depth],
      ];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      face(out, 'stainless', [outer[i], outer[j], inner[j], inner[i]], tint(silver, serial));
    }
    face(out, 'glass', inner, tint(glazing, serial, 0.09));
    return;
  }
  for (const [a, b, c, d] of [
    [x0, left, y0, top],
    [right, x0 + module, y0, top],
    [left, right, y0, sill],
    [left, right, head, top],
  ])
    panel(out, a, b, c, d, tint(silver, serial));
  const p = [
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
      [p[j], p[i], [p[i][0], p[i][1], -0.205], [p[j][0], p[j][1], -0.205]],
      trim,
    );
  }
  face(
    out,
    'glass',
    [
      [left, sill, -0.205],
      [right, sill, -0.205],
      [right, head, -0.205],
      [left, head, -0.205],
    ],
    tint(glazing, serial, 0.09),
  );
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
    const o = edge(out, plan[k], plan[(k + 1) % plan.length]),
      columns = Math.round(o.length / module);
    if (detail.level === 'skyline' || detail.level === 'district') {
      panel(o, 0, o.length, officeBase, terraceY, silver);
      if (detail.level === 'district')
        for (let row = 0; row < lowerLabels.length; row += 8)
          for (let col = 0; col < columns; col += 4) {
            const left = col * module + module / 2 - 0.9,
              right = left + 1.8,
              y = officeBase + row * 4.11;
            pane(o, left, right, y + 0.73, y + 3.48, 0.004, row * 131 + col);
          }
    } else {
      for (let row = 0; row < lowerLabels.length; row += detail.rowStride) {
        const y = officeBase + row * 4.11;
        for (let col = 0; col < columns; col++)
          punchedWindow(o, col * module, y, k * 10007 + row * 131 + col);
        if (detail.rowStride > 1)
          panel(o, 0, o.length, y + 4.11, Math.min(terraceY, y + detail.rowStride * 4.11), silver);
      }
    }
  }
  steppedSlab(out, officeBase - 0.16, 0.16, roof, 'recess');
  steppedSlab(out, terraceY - 0.24, 0.24, silver);
  if (detail.level !== 'skyline')
    for (let k = 0; k < plan.length; k++) {
      const o = edge(out, plan[k], plan[(k + 1) % plan.length]);
      box(o, 'stainless', [0, terraceY - 0.12, -0.12], [o.length, terraceY + 0.26, 0.06], silver);
    }
}

function rail(out, a, b, y) {
  const o = edge(out, a, b),
    count = Math.max(1, Math.round(o.length / detail.railBay));
  for (let i = 0; i < count; i++) {
    const l = (i * o.length) / count,
      r = ((i + 1) * o.length) / count;
    pane(o, l + 0.035, r - 0.035, y + 0.12, y + 1.12, 0, i, true);
    if (detail.level !== 'skyline')
      box(o, 'stainless', [l - 0.024, y, -0.04], [l + 0.024, y + 1.18, 0.04], trim);
  }
  tube(o, 'stainless', [0, y + 1.19, 0], [o.length, y + 1.19, 0], 0.029, silver, detail.sections);
}
function upper(out) {
  const half = 25.6,
    p = square(half),
    count = detail.upperBays;
  for (let k = 0; k < 4; k++) {
    const o = edge(out, p[k], p[(k + 1) % 4]),
      w = o.length / count;
    for (let row = 0; row < 4; row += detail.upperStride) {
      const y0 = upperFloors[row],
        y1 = upperFloors[Math.min(4, row + detail.upperStride)];
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
    if (detail.level !== 'skyline') {
      // Preserve the original seventeen upper mullion positions in street views.
      // Folding the wider strip out to the rail replaces repeated hidden box faces.
      const rails = detail.level === 'street' ? 17 : count;
      for (let col = 0; col <= rails; col++) {
        const x = (col * o.length) / rails;
        if (detail.level === 'street') {
          panel(o, x - 0.135, x + 0.135, terraceY, roofY + 0.65, silver, 0.31);
          for (const sign of [-1, 1]) {
            const a = x + sign * 0.135;
            const p = [
              [a, terraceY, 0.06],
              [a, roofY + 0.65, 0.06],
              [a, roofY + 0.65, 0.31],
              [a, terraceY, 0.31],
            ];
            face(o, 'stainless', sign > 0 ? p : p.toReversed(), trim);
          }
        } else {
          panel(o, x - 0.135, x + 0.135, terraceY, roofY + 0.65, silver, 0.06);
          box(o, 'stainless', [x - 0.035, terraceY, 0.06], [x + 0.035, roofY + 0.65, 0.31], trim);
        }
      }
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
    for (let y = roofY + 0.24; y < eave - 0.1; y += detail.crownPitch) {
      if (detail.level === 'closeup')
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
    if (detail.level !== 'skyline')
      for (let x = 0; x <= o.length + 0.01; x += o.length / detail.crownPosts)
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
    if (detail.level !== 'skyline')
      for (let y = eave; y < apex - 0.25; y += detail.pyramidPitch) {
        const top = Math.min(y + 0.24, apex - 0.12);
        const a0 = at(a, y, 0.07),
          b0 = at(b, y, 0.07),
          a1 = at(a, top, 0.035),
          b1 = at(b, top, 0.035);
        face(out, 'stainless', [a0, b0, b1, a1], tint(silver, Math.round(y * 11)));
        if (detail.level === 'closeup')
          face(out, 'stainless', [at(a, y, 0), at(b, y, 0), b0, a0], trim);
        if (detail.level === 'closeup')
          face(out, 'stainless', [a0, a1, at(a, top), at(a, y)], trim);
        if (detail.level === 'closeup')
          face(out, 'stainless', [b1, b0, at(b, y), at(b, top)], trim);
      }
    if (detail.level !== 'skyline')
      beam(out, 'stainless', [cx + a[0], eave + 0.06, a[1]], [cx, apex, 0], 0.22, 0.15, trim);
  }
  // A small cap/beacon finishes the roof at the architect's stated 235 m tip.
  loft(
    out,
    'stainless',
    [
      radialRing(apex - 0.22, 0.25, 0.25, detail.sections, [cx, 0]),
      radialRing(apex + 0.12, 0.15, 0.15, detail.sections, [cx, 0]),
    ],
    trim,
  );
  loft(
    out,
    'metal',
    [
      radialRing(apex + 0.12, 0.11, 0.11, detail.sections, [cx, 0]),
      radialRing(235, 0.11, 0.11, detail.sections, [cx, 0]),
    ],
    [0.49, 0.06, 0.035],
  );
  // Visible perimeter maintenance track; mechanisms whose shapes are unverified are omitted.
  const track = square(23.7);
  if (detail.level === 'closeup')
    for (let k = 0; k < 4; k++) {
      const o = edge(out, track[k], track[(k + 1) % 4]);
      tube(
        o,
        'stainless',
        [0, roofY + 0.55, 0],
        [o.length, roofY + 0.55, 0],
        0.045,
        trim,
        detail.sections,
      );
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
  for (const [bottom, top] of detail.level === 'closeup'
    ? [
        [y, y + 0.04],
        [head, head + 0.28],
        [head + 0.28, head + 0.48],
      ]
    : [[head, head + 0.48]])
    loft(
      out,
      'stainless',
      [
        radialRing(bottom, r + 0.1, r + 0.1, detail.drumSides, [x, z]),
        radialRing(top, r + 0.1, r + 0.1, detail.drumSides, [x, z]),
      ],
      silver,
    );
  if (detail.level !== 'skyline')
    tube(out, 'stainless', [x, y + 0.04, z], [x, head, z], 0.08, trim, detail.sections);
  for (const sign of [-1, 1]) {
    // The two open approaches remain actual openings in the outer drum.
    const start = sign === 1 ? -Math.PI * 0.28 : Math.PI * 0.72;
    for (let j = 0; j < detail.curveSides; j++) {
      const a = start + (j * Math.PI * 0.56) / detail.curveSides,
        b = start + ((j + 1) * Math.PI * 0.56) / detail.curveSides;
      const point = (t, h) => [x + r * Math.cos(t), h, z + r * Math.sin(t)];
      face(
        out,
        'clear_glass',
        [point(b, y + 0.08), point(a, y + 0.08), point(a, head), point(b, head)],
        [0.66, 0.75, 0.77],
      );
      if (detail.level !== 'skyline' && j % Math.max(1, Math.floor(detail.curveSides / 3)) === 0)
        tube(out, 'stainless', point(a, y + 0.06), point(a, head), 0.023, trim, detail.sections);
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
    if (detail.level === 'closeup')
      tube(
        o,
        'stainless',
        [0.1, y + 1.18, 0.055],
        [o.length - 0.12, y + 1.18, 0.055],
        0.018,
        trim,
        detail.sections,
      );
  }
  if (detail.level === 'closeup')
    torus(out, 'stainless', [x, y + 0.055, z], r, 0.028, trim, detail.drumSides, 4);
  if (bullnose && detail.level !== 'skyline') {
    for (const sign of [-1, 1]) {
      const xx = x + sign * (r + 0.46);
      // Shallow curved fixed sidelights beside the revolving drum.
      for (let i = 0; i < detail.bullnoseSides; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / detail.bullnoseSides,
          b = a + Math.PI / detail.bullnoseSides;
        const point = (t, h) => [xx + sign * 0.43 * Math.cos(t), h, z + 0.57 * Math.sin(t)];
        face(
          out,
          'clear_glass',
          [point(a, y + 0.1), point(b, y + 0.1), point(b, head), point(a, head)],
          [0.7, 0.77, 0.78],
        );
      }
      if (detail.level === 'closeup')
        tube(
          out,
          'stainless',
          [xx, y + 0.08, z - 0.57],
          [xx, head, z - 0.57],
          0.03,
          trim,
          detail.sections,
        );
      if (detail.level === 'closeup')
        tube(
          out,
          'stainless',
          [xx, y + 0.08, z + 0.57],
          [xx, head, z + 0.57],
          0.03,
          trim,
          detail.sections,
        );
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
    const count = Math.max(1, Math.round((b - a) / detail.lobbyBay));
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
  for (let x = 0; x < o.length; x += detail.lobbyBay)
    pane(o, x, Math.min(x + detail.lobbyBay, o.length), 4.12, 7.3, -0.5, 3, true);
  box(o, 'stainless', [0, 3.95, -0.62], [o.length, 4.12, -0.26], silver);
  for (const x of [lo - 0.3, hi + 0.3])
    tube(o, 'stainless', [x, 0.2, 0], [x, 7.48, 0], 0.31, silver, detail.sections);
  box(o, 'stainless', [-0.28, 7.32, -1.7], [o.length + 0.28, 7.54, 1.0], silver);
  if (detail.level === 'closeup')
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
  if (detail.level !== 'skyline')
    for (const x of [-18, 18])
      for (const z of [-18, 18])
        tube(out, 'stainless', [cx + x, 0.23, z], [cx + x, 7.3, z], 0.36, silver, detail.sections);
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
      const count = Math.round(o.length / detail.lobbyBay);
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
    backing(o, 0, o.length, 7.71, officeBase, -0.24);
    if (detail.level === 'skyline' || detail.level === 'district') {
      panel(o, 0, o.length, 13.35, officeBase, trim);
      pane(o, 0, o.length, 7.71, 13.35, -0.2, k);
      continue;
    }
    // Larger low-level windows below a separate plant screen.
    const columns = Math.round(o.length / module);
    for (let col = 0; col < columns; col += detail.plantStride) {
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
      for (let y = 13.43; y < officeBase - 0.1; y += detail.plantPitch)
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

const levels = {
  skyline: {
    rowStride: 41,
    railBay: 100,
    upperBays: 1,
    upperStride: 4,
    crownPitch: 10,
    crownPosts: 1,
    pyramidPitch: 100,
    sections: 4,
    drumSides: 4,
    curveSides: 1,
    bullnoseSides: 1,
    lobbyBay: 30,
    plantStride: 20,
    plantPitch: 10,
  },
  district: {
    rowStride: 8,
    railBay: 12,
    upperBays: 4,
    upperStride: 2,
    crownPitch: 2,
    crownPosts: 4,
    pyramidPitch: 4,
    sections: 4,
    drumSides: 8,
    curveSides: 2,
    bullnoseSides: 2,
    lobbyBay: 6,
    plantStride: 4,
    plantPitch: 2,
  },
  street: {
    rowStride: 4,
    railBay: 6,
    upperBays: 6,
    upperStride: 1,
    crownPitch: 1,
    crownPosts: 7,
    pyramidPitch: 1.2,
    sections: 6,
    drumSides: 12,
    curveSides: 6,
    bullnoseSides: 4,
    lobbyBay: 3,
    plantStride: 3,
    plantPitch: 1,
  },
  closeup: {
    rowStride: 1,
    railBay: 3,
    upperBays: 17,
    upperStride: 1,
    crownPitch: 0.41,
    crownPosts: 16,
    pyramidPitch: 0.57,
    sections: 8,
    drumSides: 16,
    curveSides: 12,
    bullnoseSides: 6,
    lobbyBay: 1.5,
    plantStride: 1,
    plantPitch: 0.55,
  },
};
function buildLevel(out, name, sourceMaster = false) {
  detail = { ...levels[name], level: name, sourceMaster };
  const target = { detail };
  for (const key of ['addQuad', 'addTriangle', 'addConvexPolygon'])
    target[key] = (...args) => {
      if (name === 'skyline') {
        if (args[0] === 'clear_glass') args[0] = 'glass';
        const mean = {
          stone: 0.916082784859,
          marble: 0.916082784859,
          stainless: [0.818960257808, 0.822888570085, 0.822888570085],
          metal: [0.818960257808, 0.822888570085, 0.822888570085],
          recess: [0.818960257808, 0.822888570085, 0.822888570085],
        }[args[0]];
        if (mean) args[5] = args[5].map((v, i) => v * (Array.isArray(mean) ? mean[i] : mean));
      }
      return out[key](...args);
    };
  base(target);
  shaft(target);
  upper(target);
  crown(target);
}
export const buildCanadaSkyline = (out) => buildLevel(out, 'skyline');
export const buildCanadaDistrict = (out) => buildLevel(out, 'district');
export const buildCanadaStreet = (out) => buildLevel(out, 'street');
export const buildCanadaCloseup = (out) => buildLevel(out, 'closeup');
export const buildCanadaReviewedMaster = (out) => buildLevel(out, 'closeup', true);
