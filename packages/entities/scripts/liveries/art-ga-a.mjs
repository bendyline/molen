/**
 * Shared livery helpers for the light singles: Cessna 172S, 182T and 208B, Piper PA-28-180 and
 * Beechcraft G36 Bonanza. Original vector drawing only; no reference image pixels.
 *
 * Paint regions are authored once in model metres (+Z nose, +X the aircraft's left, +Y up) and
 * applied to every paint slot of an aircraft, so the fuselage, the baked accent strips and the
 * control surfaces all take the same split, stripe and tip colors. Side artwork is drawn in
 * side-view coordinates (z, y) and projected straight across onto each side of the body.
 */

/** A half-space in model metres: the side of the plane through `p` that `n` points into. */
export const half = (n, p) => ({ n, p });
export const above = (y) => half([0, 1, 0], [0, y, 0]);
export const below = (y) => half([0, -1, 0], [0, y, 0]);
/** Toward the nose of station z (z larger), and toward the tail. */
export const ahead = (z) => half([0, 0, 1], [0, 0, z]);
export const behind = (z) => half([0, 0, -1], [0, 0, z]);
/** Aircraft's left of x (x larger) and right of x. */
export const leftOf = (x) => half([1, 0, 0], [x, 0, 0]);
export const rightOf = (x) => half([-1, 0, 0], [x, 0, 0]);
/** |x| within a half width: two planes. */
export const inboard = (x) => [leftOf(-x), rightOf(x)];

/** Points above (side 1) or below (side -1) the side-view line through (z0, y0) and (z1, y1). */
export function over([z0, y0], [z1, y1], side = 1) {
  let n = [0, z1 - z0, -(y1 - y0)];
  if (n[1] < 0) n = n.map((v) => -v);
  return half(
    n.map((v) => v * side),
    [0, y0, z0],
  );
}
export const under = (a, b) => over(a, b, -1);

/** Points ahead of (side 1) or behind (side -1) a sloped side-view line, e.g. a swept fin edge. */
export function front([z0, y0], [z1, y1], side = 1) {
  let n = [0, z1 - z0, -(y1 - y0)];
  if (n[2] < 0) n = n.map((v) => -v);
  return half(
    n.map((v) => v * side),
    [0, y0, z0],
  );
}
export const aft = (a, b) => front(a, b, -1);

/**
 * A band between two side-view polylines sampled at the same stations (z descending or
 * ascending), as one region per segment. `extra` planes (e.g. `inboard`) join every segment.
 */
export function band(color, top, bottom, extra = [], finish = {}) {
  const regions = [];
  for (let i = 0; i < top.length - 1; i++) {
    const za = top[i][0],
      zb = top[i + 1][0];
    regions.push({
      color,
      ...finish,
      planes: [
        ahead(Math.min(za, zb)),
        behind(Math.max(za, zb)),
        under(top[i], top[i + 1]),
        over(bottom[i], bottom[i + 1]),
        ...extra,
      ],
    });
  }
  return regions;
}

const corners = ({ min, max }) => {
  const out = [];
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) out.push([x, y, z]);
  return out;
};
const holds = (h, q) => h.n.reduce((s, v, i) => s + v * (q[i] - h.p[i]), 0) >= -1e-9;

/**
 * Paint each slot in `slots` with a base color and the model-space `regions` (in order; a
 * later region wins). Regions that miss a slot's bounds are dropped; a region that covers a
 * slot's bounds entirely becomes its base. Slots missing from the bounds are skipped.
 */
export function paintSlots(space, slots, base, regions = [], finish = {}) {
  const out = {};
  for (const slot of slots) {
    const b = space.bounds[slot];
    if (!b) continue;
    const pts = corners(b);
    let color = base,
      own = finish,
      zones = [];
    for (const region of regions) {
      if (region.planes.some((h) => pts.every((q) => !holds(h, q)))) continue;
      const { color: c, planes, ...rest } = region;
      if (region.planes.every((h) => pts.every((q) => holds(h, q)))) {
        color = c;
        own = { ...finish, ...rest };
        zones = [];
        continue;
      }
      zones.push({ color: c, ...rest, planes: planes.map((h) => space.plane(slot, h.n, h.p)) });
    }
    if (zones.length > 12) throw new Error(`${slot}: ${zones.length} zones (max 12)`);
    out[slot] = { color, ...own, ...(zones.length ? { zones } : {}) };
  }
  return out;
}

/** Cubic Bezier through side-view points, sampled with `n` segments (n + 1 points). */
export function bezier(p0, p1, p2, p3, n = 8) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}
/**
 * A smooth curve through side-view points (Catmull-Rom, `per` segments between points),
 * passing exactly through every given point; ends are not extrapolated.
 */
export function spline(points, per = 5) {
  if (points.length < 3) return points.map((p) => [...p]);
  const out = [];
  const at = (i) => points[Math.max(0, Math.min(points.length - 1, i))];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = at(i - 1),
      p1 = at(i),
      p2 = at(i + 1),
      p3 = at(i + 2);
    for (let s = 0; s < per; s++) {
      const t = s / per,
        t2 = t * t,
        t3 = t2 * t;
      out.push(
        [0, 1].map(
          (k) =>
            0.5 *
            (2 * p1[k] +
              (-p0[k] + p2[k]) * t +
              (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
              (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3),
        ),
      );
    }
  }
  out.push([...points.at(-1)]);
  return out.map(([z, y]) => [Math.round(z * 1e4) / 1e4, Math.round(y * 1e4) / 1e4]);
}

/**
 * A tapered stripe along a side-view centerline (sample it densely, e.g. with `spline`): full
 * vertical `width` in the middle, pointed over the first `lead` and last `trail` fraction of
 * its length. Returns its [upper, lower] edges for `SideArt.between`.
 */
export function taper(center, width, { lead = 0.12, trail = 0.2 } = {}) {
  const run = [0];
  for (let i = 1; i < center.length; i++)
    run.push(
      run[i - 1] + Math.hypot(center[i][0] - center[i - 1][0], center[i][1] - center[i - 1][1]),
    );
  const total = run.at(-1);
  const w = (s) =>
    width * Math.min(1, lead ? s / (lead * total) : 1, trail ? (total - s) / (trail * total) : 1);
  return [
    center.map(([z, y], i) => [z, y + w(run[i]) / 2]),
    center.map(([z, y], i) => [z, y - w(run[i]) / 2]),
  ];
}

/** Join polylines, dropping each joint's repeated point. */
export const chain = (...parts) =>
  parts.flatMap((p, i) => (i && p.length ? p.slice(1) : p)).filter(Boolean);

/**
 * Artwork drawn in side-view model coordinates: (z, y) in metres over the box
 * zFront..zRear by yBottom..yTop. Projected onto the left side it reads nose-left as drawn;
 * the right side takes the same art mirrored (`flip`), so it still flows nose to tail.
 */
export class SideArt {
  constructor(k, { zFront, zRear, yBottom, yTop }) {
    this.box = { zFront, zRear, yBottom, yTop };
    this.canvas = new k.Canvas(zFront - zRear, yTop - yBottom);
  }
  map([z, y]) {
    return [this.box.zFront - z, y - this.box.yBottom];
  }
  /** A filled outline of side-view points. */
  poly(color, points, holes = []) {
    this.canvas.add(
      color,
      points.map((p) => this.map(p)),
      holes.map((h) => h.map((p) => this.map(p))),
    );
    return this;
  }
  /** The region between an upper and a lower edge (each a polyline running the same way). */
  between(color, upper, lower) {
    return this.poly(color, [...upper, ...[...lower].reverse()]);
  }
  graphic(label) {
    return this.canvas.graphic(label);
  }
  /**
   * Projector anchors for both sides on `slot`: the box spans |x| from `inner` to `reach`,
   * so it reaches the skin on its own side and never the opposite face.
   */
  anchors(space, slot, name, { reach = 0.7, inner = 0.01 } = {}) {
    const { zFront, zRear, yBottom, yTop } = this.box;
    const common = {
      width: zFront - zRear,
      height: yTop - yBottom,
      depth: reach - inner,
    };
    const z = (zFront + zRear) / 2,
      y = (yBottom + yTop) / 2,
      x = (reach + inner) / 2;
    return {
      [`${name}-l`]: space.anchor(slot, { center: [x, y, z], facing: [1, 0, 0], ...common }),
      [`${name}-r`]: space.anchor(slot, { center: [-x, y, z], facing: [-1, 0, 0], ...common }),
    };
  }
}

/** Markings for an anchor pair from `SideArt.anchors`; side art is mirrored on the right. */
export const sides = (name, graphic, { mirror = true } = {}) => [
  { anchor: `${name}-l`, graphic },
  { anchor: `${name}-r`, graphic, ...(mirror ? { flip: true } : {}) },
];

/**
 * Lettering anchors on both sides: centre (z, y), the box spanning |x| inner..reach. `pitch`
 * tilts the lettering's up toward the nose (radians), for text that follows a sloping line.
 */
export function textAnchors(space, slot, name, { z, y, width, height, reach = 0.7, inner = 0.01 }) {
  const x = (reach + inner) / 2,
    common = { width, height, depth: reach - inner };
  return {
    [`${name}-l`]: space.anchor(slot, { center: [x, y, z], facing: [1, 0, 0], ...common }),
    [`${name}-r`]: space.anchor(slot, { center: [-x, y, z], facing: [-1, 0, 0], ...common }),
  };
}

/** Lettering in a box `width` x `height` metres; `cap` is the cap height (default 80 %). */
export function lettering(
  k,
  label,
  { width, height, color, cap = height * 0.8, face = 'technical', slant = 0, tracking = 0 },
) {
  return new k.Canvas(width, height)
    .text(color, label, {
      x: width / 2,
      y: height / 2,
      height: cap,
      face,
      slant,
      tracking,
      maxWidth: width * 0.98 - Math.abs(slant) * cap,
    })
    .graphic(label);
}

/**
 * Wing-surface lettering anchor (ICAO practice: under the left wing, tops of the letters toward
 * the leading edge). `x` > 0 is the left wing; `face` -1 projects from below, 1 from above;
 * `dihedral` is the skin's rise per metre of span, tilting the projector to follow it.
 */
export function wingAnchor(
  space,
  slot,
  { x, y, z, width, height, depth = 0.4, face = -1, dihedral = 0 },
) {
  return space.anchor(slot, {
    center: [x, y, z],
    facing: [-face * dihedral * Math.sign(x), face, 0],
    up: [0, 0, 1],
    width,
    height,
    depth,
  });
}

/** A fictional, plausibly formatted civil registration list per country prefix. */
export const REG_NOTE =
  'The registration is a fictional mark in the national format, not the photographed aircraft’s.';
