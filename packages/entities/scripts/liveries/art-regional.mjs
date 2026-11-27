/**
 * Shared livery helpers for the regional airliners and business jets (Citation CJ4, Gulfstream
 * G650ER, Dash 8 Q400, ATR 72-600): side-view artwork laid out in model metres, paint zones
 * written as model-space recipes and applied to several paint slots at once, and national
 * marks drawn as original geometric constructions (no reference pixels).
 */

/* ------------------------------------------------------------------ side-view artwork ---- */

/**
 * A canvas laid out in the side view, in model metres: `fore` is the forward edge (model z,
 * nose +Z), `aft` the rear, `low`/`high` model heights. Art is drawn as seen from the LEFT
 * side (nose at the canvas left); `sideAnchors` places it on the left as drawn and on the
 * right mirrored (`flip`), so the same art faces forward on both sides.
 */
export function sideCanvas(k, { aft, fore, low, high }) {
  const c = new k.Canvas(fore - aft, high - low);
  const at = ([z, y]) => [fore - z, y - low];
  const view = {
    c,
    at,
    /** A polygon given as model [z, y] points. */
    poly(color, points, holes = []) {
      c.add(
        color,
        points.map(at),
        holes.map((h) => h.map(at)),
      );
      return view;
    },
    /**
     * The region between two side-view curves `upper(z)` and `lower(z)` from z0 to z1 (any
     * order), sampled in `steps` pieces: stripes, swooshes and belly sweeps.
     */
    band(color, upper, lower, z0, z1, steps = 24) {
      const top = [],
        bottom = [];
      for (let i = 0; i <= steps; i++) {
        const z = z0 + ((z1 - z0) * i) / steps;
        top.push([z, upper(z)]);
        bottom.push([z, lower(z)]);
      }
      return view.poly(color, [...top, ...bottom.reverse()]);
    },
    circle(color, z, y, r, segments = 48) {
      c.circle(color, fore - z, y - low, r, segments);
      return view;
    },
    graphic(label) {
      return c.graphic(label);
    },
  };
  return view;
}

/**
 * Left and right projectors for a side-view canvas on `slot`. The projector box runs from
 * `inner` (just off the centre plane, so the far side is never reached) to `outer` (just
 * outside the widest skin it should paint). Returns { [name-l], [name-r] }.
 */
export function sideAnchors(space, slot, name, { aft, fore, low, high }, { inner = 0.02, outer }) {
  const depth = outer - inner,
    x = inner + depth / 2;
  const box = {
    width: fore - aft,
    height: high - low,
    depth,
  };
  const center = (side) => [side * x, (low + high) / 2, (aft + fore) / 2];
  return {
    [`${name}-l`]: space.anchor(slot, { center: center(1), facing: [1, 0, 0], ...box }),
    [`${name}-r`]: space.anchor(slot, { center: center(-1), facing: [-1, 0, 0], ...box }),
  };
}

/** Markings for a side-view graphic on both sides (mirrored on the right). */
export const bothSides = (name, graphic) => [
  { anchor: `${name}-l`, graphic },
  { anchor: `${name}-r`, graphic, flip: true },
];

/** Markings for lettering on both sides (reads left to right on each side). */
export const bothSidesText = (name, graphic) => [
  { anchor: `${name}-l`, graphic },
  { anchor: `${name}-r`, graphic },
];

/** Lettering centred on a canvas of the given size (metres); cap height `h * scale`. */
export function lettering(k, label, w, h, color, opts = {}) {
  const { scale = 0.8, ...rest } = opts;
  return new k.Canvas(w, h)
    .text(color, label, {
      x: w / 2,
      y: h / 2,
      height: h * scale,
      maxWidth: w * 0.98,
      face: 'regular',
      ...rest,
    })
    .graphic(label);
}

/* ------------------------------------------------------------------ paint zones ---- */

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** A model-space half-space { n, d } (points with n·p >= d) from a recipe step. */
function halfSpace(step) {
  const [kind, ...args] = step;
  switch (kind) {
    case 'above':
      return { n: [0, 1, 0], d: args[0] };
    case 'below':
      return { n: [0, -1, 0], d: -args[0] };
    case 'ahead':
      return { n: [0, 0, 1], d: args[0] };
    case 'behind':
      return { n: [0, 0, -1], d: -args[0] };
    case 'left': // +X side beyond x
      return { n: [1, 0, 0], d: args[0] };
    case 'right': // -X side beyond -x (pass a positive distance: right of x = -v)
      return { n: [-1, 0, 0], d: args[0] };
    case 'line': {
      // Side-view line from [z0, y0] to [z1, y1]: above it (side 1) or below (-1).
      const [[z0, y0], [z1, y1], side = 1] = args;
      let n = [0, z1 - z0, -(y1 - y0)];
      if (n[1] < 0) n = n.map((v) => -v);
      n = n.map((v) => v * side);
      return { n, d: dot(n, [0, y0, z0]) };
    }
    case 'plane': {
      const [n, p] = args;
      return { n, d: dot(n, p) };
    }
    default:
      throw new Error(`Unknown zone step ${kind}`);
  }
}

/** Whether a convex region (half-spaces) meets an axis-aligned box: an exact vertex search. */
function meetsBox(halves, { min, max }) {
  const all = [
    ...halves,
    { n: [1, 0, 0], d: min[0] },
    { n: [-1, 0, 0], d: -max[0] },
    { n: [0, 1, 0], d: min[1] },
    { n: [0, -1, 0], d: -max[1] },
    { n: [0, 0, 1], d: min[2] },
    { n: [0, 0, -1], d: -max[2] },
  ];
  const ok = (p) => all.every((h) => dot(h.n, p) >= h.d - 1e-6);
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++)
      for (let k = j + 1; k < all.length; k++) {
        const a = all[i],
          b = all[j],
          c = all[k];
        const bc = cross(b.n, c.n),
          det = dot(a.n, bc);
        if (Math.abs(det) < 1e-12) continue;
        const ca = cross(c.n, a.n),
          ab = cross(a.n, b.n);
        const p = [0, 1, 2].map((q) => (a.d * bc[q] + b.d * ca[q] + c.d * ab[q]) / det);
        if (ok(p)) return true;
      }
  return false;
}

/**
 * Paint for one slot from model-space zone recipes: `zones` is [{ color, steps: [[kind, ...]],
 * roughness?, metalness? }]. Zones that cannot reach the slot's bounds are left out, so one
 * recipe serves the skin, belly and fin slots alike.
 */
export function zonedPaint(space, slot, color, zones = [], extra = {}) {
  const bounds = space.bounds[slot];
  if (!bounds) throw new Error(`Unknown or empty paint slot ${slot}`);
  const out = [];
  for (const zone of zones) {
    const halves = zone.steps.map(halfSpace);
    if (!meetsBox(halves, bounds)) continue;
    out.push({
      color: zone.color,
      ...(zone.roughness !== undefined ? { roughness: zone.roughness } : {}),
      ...(zone.metalness !== undefined ? { metalness: zone.metalness } : {}),
      planes: halves.map((h) =>
        space.plane(
          slot,
          h.n,
          // A point on the plane: d·n/|n|².
          h.n.map((v) => (v * h.d) / dot(h.n, h.n)),
        ),
      ),
    });
  }
  if (out.length > 12) throw new Error(`${slot}: ${out.length} zones (12 at most)`);
  return { color, ...extra, ...(out.length ? { zones: out } : {}) };
}

/** The same base color and zone recipe over several slots. */
export function paintAll(space, slots, color, zones = [], extra = {}) {
  return Object.fromEntries(slots.map((s) => [s, zonedPaint(space, s, color, zones, extra)]));
}

/**
 * A smooth side-view curve y(z) through [z, y] knots (any order of z, distinct): a Catmull-Rom
 * spline in z, held flat beyond the end knots.
 */
export function spline(knots) {
  const pts = [...knots].sort((a, b) => a[0] - b[0]);
  return (z) => {
    if (z <= pts[0][0]) return pts[0][1];
    if (z >= pts.at(-1)[0]) return pts.at(-1)[1];
    let i = 0;
    while (z > pts[i + 1][0]) i++;
    const p0 = pts[Math.max(0, i - 1)],
      p1 = pts[i],
      p2 = pts[i + 1],
      p3 = pts[Math.min(pts.length - 1, i + 2)];
    const h = p2[0] - p1[0],
      t = (z - p1[0]) / h;
    // Tangents (dy/dz) from the neighbours, scaled to this interval.
    const m1 = ((p2[1] - p0[1]) / (p2[0] - p0[0] || 1)) * h,
      m2 = ((p3[1] - p1[1]) / (p3[0] - p1[0] || 1)) * h;
    const t2 = t * t,
      t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * p1[1] +
      (t3 - 2 * t2 + t) * m1 +
      (-2 * t3 + 3 * t2) * p2[1] +
      (t3 - t2) * m2
    );
  };
}

/* ------------------------------------------------------------------ national marks ---- */

/**
 * United States flag: 13 stripes and 50 stars in a canton (proportions of the 1959 order,
 * 10:19), canton at the upper left as drawn.
 */
export function usFlag(c, x, y, w) {
  const h = (w * 10) / 19,
    red = '#b22234',
    white = '#ffffff',
    blue = '#3c3b6e';
  c.rect(white, x, y, w, h);
  for (let i = 0; i < 13; i += 2) c.rect(red, x, y + h - ((i + 1) * h) / 13, w, h / 13);
  const cw = w * 0.4,
    ch = (h * 7) / 13;
  c.rect(blue, x, y + h - ch, cw, ch);
  const r = h * 0.0308;
  for (let row = 0; row < 9; row++) {
    const odd = row % 2 === 1;
    for (let col = 0; col < (odd ? 5 : 6); col++) {
      const sx = x + (cw / 12) * (1 + 2 * col + (odd ? 1 : 0)),
        sy = y + h - (ch / 10) * (row + 1);
      c.star(white, sx, sy, r, r * 0.382);
    }
  }
  return c;
}

/**
 * The international distinctive sign of civil defence (Additional Protocol I, Art. 66): an
 * equilateral blue triangle on an orange ground, here in a blue-ringed disc as civil
 * protection services wear it.
 */
export function civilDefenceDisc(c, cx, cy, r) {
  c.circle('#ffffff', cx, cy, r);
  c.circle('#1d4fa0', cx, cy, r * 0.93);
  c.circle('#ffffff', cx, cy, r * 0.84);
  c.circle('#f08a1c', cx, cy, r * 0.78);
  const t = r * 0.62;
  c.add(
    '#1d4fa0',
    [0, 1, 2].map((i) => {
      const a = Math.PI / 2 + (i * Math.PI * 2) / 3;
      return [cx + Math.cos(a) * t, cy - t * 0.12 + Math.sin(a) * t];
    }),
  );
  return c;
}
