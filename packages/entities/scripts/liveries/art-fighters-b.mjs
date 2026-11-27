/**
 * Shared artwork for the F-22A, F-35A, Gripen C, Rafale C and Typhoon liveries: national
 * markings the kit does not carry, fin flashes, serial and code lettering, and model-space
 * helpers for canted fins. Every mark is an original vector drawing from published
 * descriptions and photographs; no reference pixels.
 */

/** A canvas holding one line of real lettering, centred, cap height `h * fill`. */
export function textGraphic(k, label, w, h, color, opts = {}) {
  const { fill = 0.8, ...rest } = opts;
  return new k.Canvas(w, h)
    .text(color, label, { x: w / 2, y: h / 2, height: h * fill, maxWidth: w * 0.98, ...rest })
    .graphic(label);
}

/** Thin outline text: the same lettering drawn twice, outline color under, fill on top. */
export function outlinedText(c, fill, edge, label, { x, y, height, face, align, spread, ...rest }) {
  const e = spread ?? height * 0.06;
  for (const [dx, dy] of [
    [-e, 0],
    [e, 0],
    [0, -e],
    [0, e],
    [-e * 0.7, -e * 0.7],
    [e * 0.7, e * 0.7],
    [-e * 0.7, e * 0.7],
    [e * 0.7, -e * 0.7],
  ])
    c.text(edge, label, { x: x + dx, y: y + dy, height, face, align, ...rest });
  c.text(fill, label, { x, y, height, face, align, ...rest });
  return c;
}

/** Horizontal stripes, top to bottom, with relative weights. */
export function stripesH(c, x, y, w, h, colors, weights) {
  const ws = weights ?? colors.map(() => 1);
  const total = ws.reduce((s, v) => s + v, 0);
  let top = y + h;
  colors.forEach((color, i) => {
    const band = (h * ws[i]) / total;
    c.rect(color, x, top - band, w, band);
    top -= band;
  });
  return c;
}

/** Vertical stripes, left to right (left is the hoist: forward once mirrored per side). */
export function stripesV(c, x, y, w, h, colors, weights) {
  const ws = weights ?? colors.map(() => 1);
  const total = ws.reduce((s, v) => s + v, 0);
  let left = x;
  colors.forEach((color, i) => {
    const band = (w * ws[i]) / total;
    c.rect(color, left, y, band, h);
    left += band;
  });
  return c;
}

/** A filled circular sector from angle a0 to a1 (radians, counter-clockwise). */
export function sector(c, color, cx, cy, r, a0, a1, steps = 24) {
  const pts = [[cx, cy]];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return c.add(color, pts);
}

/**
 * Czech Air Force roundel: a disc in three 120 degree sectors, blue at the hoist (left), white
 * above and red below a horizontal radius to the right. `lowvis` draws the photographed
 * Gripen style: an outline ring, the blue sector solid, the red sector hatched, white left open.
 */
export function czechRoundel(c, cx, cy, r, { lowvis = false, color = '#4b5359' } = {}) {
  const third = (Math.PI * 2) / 3;
  if (!lowvis) {
    sector(c, '#ffffff', cx, cy, r, 0, third);
    sector(c, '#11457e', cx, cy, r, third, 2 * third);
    sector(c, '#d7141a', cx, cy, r, 2 * third, 3 * third);
    return c;
  }
  const t = r * 0.07;
  c.ring(color, cx, cy, r - t, r, 48);
  sector(c, color, cx, cy, r - t * 0.4, third, 2 * third);
  // Red sector: horizontal hatching clipped to the sector (lines of the sector's chords).
  const lines = 6;
  for (let i = 0; i < lines; i++) {
    const y = cy - ((i + 0.5) / lines) * (r - t);
    const h = (r - t) / lines / 2.2;
    // Span of the red sector (angles 240..360 deg) at this height.
    const half = Math.sqrt(Math.max(0, (r - t) ** 2 - (y - cy) ** 2));
    const left = cx + Math.max(-half, (y - cy) / Math.tan((4 * Math.PI) / 3));
    c.rect(color, left, y - h / 2, cx + half - left, h);
  }
  // The horizontal radius between the white and red sectors.
  c.rect(color, cx, cy - t * 0.4, r - t * 0.5, t * 0.8);
  return c;
}

/** A heraldic open crown (band, three fleurons with pearls) centred at x, y, `s` wide. */
export function crown(c, color, x, y, s) {
  c.rect(color, x - s * 0.46, y - s * 0.34, s * 0.92, s * 0.16);
  c.add(color, [
    [x - s * 0.46, y - s * 0.18],
    [x + s * 0.46, y - s * 0.18],
    [x + s * 0.5, y + s * 0.14],
    [x + s * 0.3, y - s * 0.02],
    [x + s * 0.16, y + s * 0.1],
    [x, y + s * 0.2],
    [x - s * 0.16, y + s * 0.1],
    [x - s * 0.3, y - s * 0.02],
    [x - s * 0.5, y + s * 0.14],
  ]);
  for (const [dx, dy] of [
    [-0.5, 0.2],
    [0, 0.29],
    [0.5, 0.2],
  ])
    c.circle(color, x + dx * s, y + dy * s, s * 0.075, 12);
  return c;
}

/**
 * Swedish Air Force roundel. Full color: yellow rim, blue disc, three yellow crowns.
 * `lowvis`: the tactical style on gray Gripens, a dark ring and three dark crowns only.
 */
export function swedenRoundel(c, cx, cy, r, { lowvis = false, color = '#3d454b' } = {}) {
  const s = r * 0.56;
  const at = [
    [cx - r * 0.36, cy + r * 0.2],
    [cx + r * 0.36, cy + r * 0.2],
    [cx, cy - r * 0.38],
  ];
  if (lowvis) {
    c.ring(color, cx, cy, r * 0.88, r, 48);
    for (const [x, y] of at) crown(c, color, x, y, s);
    return c;
  }
  c.circle('#fecc02', cx, cy, r, 48);
  c.circle('#005b99', cx, cy, r * 0.9, 48);
  for (const [x, y] of at) crown(c, '#fecc02', x, y, s);
  return c;
}

/**
 * The Bundeswehr cross (Eisernes Kreuz) of the Luftwaffe: a black cross pattee whose arms
 * flare outward along concave sides, edged white. `s` is the overall span.
 */
export function bundeswehrCross(c, cx, cy, s, { lowvis = false } = {}) {
  const arm = (a0, a1, L) => {
    // One closed outline of all four arms, counter-clockwise, each arm's sides concave:
    // inner corner, up one side to the flared end, across, down the other side.
    const rot = (x, y, q) => {
      const cs = Math.round(Math.cos((q * Math.PI) / 2)),
        sn = Math.round(Math.sin((q * Math.PI) / 2));
      return [cx + x * cs - y * sn, cy + x * sn + y * cs].map((v) => v.toFixed(5)).join(' ');
    };
    let d = `M${rot(a0, a0, 0)} `;
    for (let q = 0; q < 4; q++)
      d +=
        `Q${rot(a0 + (a1 - a0) * 0.22, L * 0.62, q)} ${rot(a1, L, q)} L${rot(-a1, L, q)} ` +
        `Q${rot(-a0 - (a1 - a0) * 0.22, L * 0.62, q)} ${rot(-a0, a0, q)} `;
    return `${d}Z`;
  };
  const draw = (color, a0, a1, L) =>
    c.path(color, arm(a0, a1, L), {
      viewBox: [0, 0, 1, 1],
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      flipY: false,
      segments: 6,
    });
  const e = s * 0.045;
  if (!lowvis) draw('#ffffff', s * 0.075 + e, s * 0.22 + e, s * 0.5);
  draw(lowvis ? '#3f474d' : '#111111', s * 0.075, s * 0.22, s * 0.5 - (lowvis ? 0 : e));
  return c;
}

/** Austrian Air Force: a red-white-red triangle, point down. `s` is the side length. */
export function austriaTriangle(c, cx, cy, s) {
  const tri = (k) => {
    const h = (Math.sqrt(3) / 2) * s * k;
    // Centroid at (cx, cy): apex below, flat side above.
    return [
      [cx - (s * k) / 2, cy + h / 3],
      [cx + (s * k) / 2, cy + h / 3],
      [cx, cy - (2 * h) / 3],
    ];
  };
  c.add('#c8102e', tri(1));
  c.add('#ffffff', tri(0.66));
  c.add('#c8102e', tri(0.33));
  return c;
}

/** Spanish fin marking: a black St Andrew's cross (Cruz de San Andres) on a white square. */
export function spainSaltire(c, cx, cy, s) {
  c.rect('#ffffff', cx - s / 2, cy - s / 2, s, s);
  const len = s * 1.16,
    w = s * 0.17;
  c.box('#111111', cx, cy, len, w, Math.PI / 4);
  c.box('#111111', cx, cy, len, w, -Math.PI / 4);
  return c;
}

/**
 * Hungarian Air Force triangle: red, white and green nested triangles (red outside), apex at
 * the canvas left (forward once mirrored for the right side). `s` is the height of the base
 * edge. `lowvis` draws the photographed Gripen style: a white outline round gray bands.
 */
export function hungaryTriangle(c, cx, cy, s, { lowvis = false } = {}) {
  const len = s * 1.6;
  const tri = (k) => [
    [cx - (len * k) / 2, cy],
    [cx + (len * k) / 2, cy + (s * k) / 2],
    [cx + (len * k) / 2, cy - (s * k) / 2],
  ];
  // Nested triangles share the right-hand base edge region; shift inner ones toward it.
  const nest = (k) => tri(k).map(([x, y]) => [x + (len * (1 - k)) / 2, y]);
  const colors = lowvis
    ? ['#f2f2ee', '#6b7479', '#aab2b6', '#3e464b']
    : ['#ffffff', '#cd2a3e', '#ffffff', '#436f4d'];
  [1, 0.9, 0.62, 0.36].forEach((k, i) => {
    c.add(colors[i], nest(k));
  });
  return c;
}

/** Union flag, `w` x `h` at (x, y): saltires, counterchanged red saltire, St George's cross. */
export function unionFlag(c, x, y, w, h) {
  const blue = '#012169',
    red = '#c8102e',
    white = '#ffffff';
  c.rect(blue, x, y, w, h);
  const cx = x + w / 2,
    cy = y + h / 2,
    diag = Math.hypot(w, h),
    a = Math.atan2(h, w);
  c.box(white, cx, cy, diag, h * 0.2, a);
  c.box(white, cx, cy, diag, h * 0.2, -a);
  // Counterchanged red saltire: offset thin bands in each quarter.
  const off = h * 0.033;
  for (const [sx, sy, angle] of [
    [-1, 1, -a],
    [1, -1, -a],
    [-1, -1, a],
    [1, 1, a],
  ]) {
    const nx = -Math.sin(angle) * off * (sx * sy > 0 ? 1 : -1),
      ny = Math.cos(angle) * off * (sx * sy > 0 ? 1 : -1);
    c.box(
      red,
      cx + (sx * w) / 4 + nx * (sx > 0 ? 1 : -1),
      cy + (sy * h) / 4 + ny * (sx > 0 ? 1 : -1),
      diag / 2,
      h * 0.067,
      angle,
    );
  }
  c.rect(white, cx - h * 0.167, y, h * 0.333, h);
  c.rect(white, x, cy - h * 0.167, w, h * 0.333);
  c.rect(red, cx - h * 0.1, y, h * 0.2, h);
  c.rect(red, x, cy - h * 0.1, w, h * 0.2);
  return c;
}

/**
 * Twin canted fins (F-22, F-35): a model-space point and frame on the fin's outer face.
 * `root` is the fin's root reference [x for side +1, y, z], `cant` the outward lean in radians.
 */
export function cantedFin(root, cant) {
  const s = Math.sin(cant),
    co = Math.cos(cant);
  return {
    /** Point at span `span` (metres up the fin) and station z on side `side` (1 left, -1 right). */
    point: (side, span, z, out = 0) => [
      side * (root[0] + span * s + out * co),
      root[1] + span * co - out * s,
      z,
    ],
    facing: (side) => [side * co, -s, 0],
    up: (side) => [side * s, co, 0],
  };
}

/** Douglas-Peucker on a closed ring in metres (sx, sy scale normalized units to metres). */
function leanRing(ring, sx, sy, tol) {
  if (ring.length <= 4) return ring;
  const keep = new Uint8Array(ring.length);
  const dist = (p, a, b) => {
    const ax = a[0] * sx,
      ay = a[1] * sy,
      bx = b[0] * sx - ax,
      by = b[1] * sy - ay,
      px = p[0] * sx - ax,
      py = p[1] * sy - ay;
    const len = bx * bx + by * by;
    const t = len ? Math.max(0, Math.min(1, (px * bx + py * by) / len)) : 0;
    return Math.hypot(px - bx * t, py - by * t);
  };
  const run = (i, j) => {
    let worst = -1,
      at = -1;
    for (let k = i + 1; k < j; k++) {
      const d = dist(ring[k], ring[i], ring[j % ring.length]);
      if (d > worst) {
        worst = d;
        at = k;
      }
    }
    if (worst > tol) {
      keep[at] = 1;
      run(i, at);
      run(at, j);
    }
  };
  // Split the ring at its first point and the point farthest from it.
  let far = 0,
    best = -1;
  for (let k = 1; k < ring.length; k++) {
    const d = Math.hypot((ring[k][0] - ring[0][0]) * sx, (ring[k][1] - ring[0][1]) * sy);
    if (d > best) {
      best = d;
      far = k;
    }
  }
  keep[0] = keep[far] = 1;
  run(0, far);
  run(far, ring.length);
  const out = ring.filter((_, k) => keep[k]);
  return out.length >= 3 ? out : ring;
}

/**
 * Trim a built livery's artwork: every ring is simplified to `tol` metres (default 1.6 mm,
 * half an atlas texel at 300 px/m) at the smallest size the graphic is projected at.
 * Keeps each aircraft's livery JSON inside its budget without coarser source curves.
 */
export function leanLivery(built, bounds, tol = 0.0016) {
  const sizes = new Map();
  const visit = (graphic, anchor) => {
    const a = built.anchors[anchor];
    const b = bounds[a.slot];
    const longest = Math.max(...b.max.map((v, i) => v - b.min[i]));
    const w = a.size[0] * longest,
      h = a.size[1] * longest;
    const seen = sizes.get(graphic);
    sizes.set(graphic, seen ? [Math.min(seen[0], w), Math.min(seen[1], h)] : [w, h]);
  };
  for (const v of built.variants)
    for (const m of v.markings ?? [])
      visit(typeof m.graphic === 'string' ? built.graphics[m.graphic] : m.graphic, m.anchor);
  for (const [graphic, [w, h]] of sizes)
    for (const shape of graphic.shapes) {
      shape.points = leanRing(shape.points, w, h, tol);
      if (shape.holes) shape.holes = shape.holes.map((ring) => leanRing(ring, w, h, tol));
    }
  return built;
}
