/**
 * Shared art for airliner liveries (737-800, A320neo, A220-300, E175 and the generic airliner):
 * model-space geometry read from the builders' own station tables, side-view paint regions for
 * belly colors, cheatlines, swooshes and tail areas, decal anchors on the fuselage and fin,
 * registrations and national flags. Everything is original vector drawing; no operator names,
 * logos or wordmarks.
 *
 * Coordinates: the builders' body frame, `u` metres aft of the nose tip and `h` metres above the
 * barrel keel, posed into the model frame (+Z nose, +X the aircraft's left, +Y up) with the
 * airframe's own nose-down stance, so a "horizontal" line here follows the fuselage.
 */
import { bodySurface, noseZ, pose } from '../aircraft/transport-kit.mjs';
import { textShapes } from '../lettering-outlines.mjs';

/** Body-frame geometry of a transport-kit airframe table `A` (or a compatible one). */
export function airframe(A) {
  const M = bodySurface(A);
  const { pitch, Y } = pose(A);
  const c = Math.cos(pitch),
    s = Math.sin(pitch),
    zN = noseZ(A);
  /** Body (x, h, u) to model [x, y, z]. */
  const model = (x, h, u) => {
    const z = zN - u;
    return [x, Y + h * c - z * s, h * s + z * c];
  };
  /** Skin point at station u and body height h on one side (+1 left, -1 right). */
  const skin = (u, h, side = 1, offset = 0) => {
    const [x, y] = M.point(u, M.angle(u, h), side, offset);
    return model(x, y, u);
  };
  /** Outward skin normal at (u, h), from two nearby skin points round the section. */
  const normal = (u, h, side = 1) => {
    const a = M.angle(u, h),
      p = M.point(u, a - 0.01, side),
      q = M.point(u, a + 0.01, side);
    // Tangent round the section (x, h); the outward normal is perpendicular to it.
    let nx = q[1] - p[1],
      nh = -(q[0] - p[0]);
    if (nx * side < 0) {
      nx = -nx;
      nh = -nh;
    }
    const l = Math.hypot(nx, nh) || 1;
    return [nx / l, (nh / l) * c, (nh / l) * s];
  };
  return {
    A,
    M,
    model,
    skin,
    normal,
    pitch,
    /** Model direction of the body's nose (decreasing u) and of body up (+h). */
    forward: [0, -s, c],
    up: [0, c, s],
    keel: M.keel,
    crown: M.crown,
    half: M.half,
    length: A.length,
  };
}

/**
 * Landmarks of a transport-kit table, in body (u, h): the barrel, windows, passenger doors, fin
 * edges (functions of h), rudder, wing root and engine. Schemes are written against these so
 * one operator's layout lands in the same places on each type it flies.
 */
export function landmarks(A) {
  const M = bodySurface(A);
  const wide = Math.max(...A.body.map((r) => r[1]));
  const barrelRows = A.body.filter((r) => r[1] >= wide - 0.02);
  const { runs, pitch } = A.windows;
  const windowUs = runs.flatMap((r) =>
    Array.from({ length: r.count }, (_, i) => r.from + i * pitch),
  );
  const doors = A.doors.filter((d) => !d.side && d.y1 - d.y0 > 1.6).sort((p, q) => p.u0 - q.u0);
  const rows = A.fin.rows;
  const along = (k) => (h) => {
    if (h <= rows[0][0]) return rows[0][k];
    for (let i = 0; i < rows.length - 1; i++)
      if (h <= rows[i + 1][0])
        return (
          rows[i][k] +
          ((rows[i + 1][k] - rows[i][k]) * (h - rows[i][0])) / (rows[i + 1][0] - rows[i][0])
        );
    return rows.at(-1)[k];
  };
  return {
    L: A.length,
    D: A.bodyHeight,
    nose: barrelRows[0][0],
    tail: barrelRows.at(-1)[0],
    win: A.windows.y,
    winH: A.windows.h,
    firstWindow: Math.min(...windowUs),
    lastWindow: Math.max(...windowUs),
    fwdDoor: doors[0],
    rearDoor: doors.at(-1),
    /** Fin leading and trailing edge stations at body height h; the fin tip height. */
    finLE: along(1),
    finTE: along(2),
    finTip: rows.at(-1)[0],
    rudder: A.fin.rudder,
    wing: { le: A.wing.rows[0][2], te: A.wing.rows[0][3], h: A.wing.rows[0][1] },
    engine: A.engine,
    keel: M.keel,
    crown: M.crown,
    /** Height of the seam between the painted skin and the belly panel at station u. */
    seam: (u) => M.point(Math.max(0.05, Math.min(A.length - 0.05, u)), A.bellyAngle ?? 1.95)[1],
  };
}

/**
 * Paint slots of a transport-kit airliner beyond the existing skin, tail, engine and winglet
 * ones: the belly (lower skin and tail cone), the wing-body fairing, the nose gear doors, the
 * wings, the control surfaces and the cabin window panels.
 */
export function transportSlots(prefix, existing, { fairing = 'wing-body-fairing' } = {}) {
  return {
    ...existing,
    'body-belly': { materials: [`${prefix}-belly`], node: 'fuselage-belly' },
    'body-fairing': { materials: [`${prefix}-belly`], node: fairing },
    'gear-door-left': { materials: [`${prefix}-belly`], node: 'gear-0-door-left' },
    'gear-door-right': { materials: [`${prefix}-belly`], node: 'gear-0-door-right' },
    'wing-left': { materials: [`${prefix}-wing`], node: 'wing-1' },
    'wing-right': { materials: [`${prefix}-wing`], node: 'wing--1' },
    'wing-controls': { materials: [`${prefix}-controls`] },
    'cabin-windows': { materials: [`${prefix}-cabin-window`], node: 'skin-detail-0' },
  };
}

/** Slot groups of a transport-kit airliner, for painting several at once. */
export const TRANSPORT = {
  skin: ['body-fuselage', 'body-belly', 'body-fairing', 'gear-door-left', 'gear-door-right'],
  fin: ['tail-fin', 'tail-rudder'],
  stabilizers: [
    'pitch-tailplane-left',
    'pitch-tailplane-right',
    'pitch-elevator-left',
    'pitch-elevator-right',
  ],
  nacelles: ['engine-1', 'engine-2'],
  pylons: ['engine-1-pylon', 'engine-2-pylon'],
  winglets: ['accent-winglet-left', 'accent-winglet-right'],
  wings: ['wing-left', 'wing-right'],
};

/* ------------------------------------------------------------------ side-view regions ---- */

/**
 * Regions are lists of convex side-view polygons in body (u, h); each polygon becomes one zone
 * per slot it touches. The same region paints every slot it is given, so a belly line or a
 * cheatline runs continuously across the skin, belly, fairing and fin.
 */
export const region = {
  /** One convex polygon. */
  polygon: (points) => [points],
  /** Everything below a path of [u, h] points (u increasing), down to `floor`. */
  below(path, floor = -20) {
    return segments(path).map(([a, b]) => [a, b, [b[0], floor], [a[0], floor]]);
  },
  /** Everything above a path, up to `ceiling`. */
  above(path, ceiling = 40) {
    return segments(path).map(([a, b]) => [a, b, [b[0], ceiling], [a[0], ceiling]]);
  },
  /** The band between a lower and an upper path (resampled at both paths' stations). */
  band(lower, upper) {
    const us = [...new Set([...lower, ...upper].map((p) => p[0]))]
      .filter((u) => u >= Math.max(lower[0][0], upper[0][0]))
      .filter((u) => u <= Math.min(lower.at(-1)[0], upper.at(-1)[0]))
      .sort((p, q) => p - q);
    const lo = us.map((u) => [u, interpolate(lower, u)]),
      hi = us.map((u) => [u, interpolate(upper, u)]);
    return us.slice(0, -1).map((_, i) => [lo[i], lo[i + 1], hi[i + 1], hi[i]]);
  },
  /** A band of constant thickness `t` centred on a path. */
  stripe(path, t) {
    return region.band(
      path.map(([u, h]) => [u, h - t / 2]),
      path.map(([u, h]) => [u, h + t / 2]),
    );
  },
  /** Everything forward (`fore`) or aft (`aft`) of station u. */
  fore: (u) => [
    [
      [-50, -20],
      [u, -20],
      [u, 40],
      [-50, 40],
    ],
  ],
  aft: (u) => [
    [
      [u, -20],
      [200, -20],
      [200, 40],
      [u, 40],
    ],
  ],
};

/** A smooth path sampled from h = f(u) at `n` + 1 stations. */
export function curve(f, u0, u1, n = 6) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const u = u0 + ((u1 - u0) * i) / n;
    return [u, f(u)];
  });
}

/** Monotone smoothstep between two values over [u0, u1]. */
export const ease = (u, u0, u1, a, b) => {
  const t = Math.max(0, Math.min(1, (u - u0) / (u1 - u0)));
  return a + (b - a) * t * t * (3 - 2 * t);
};

function segments(path) {
  return path.slice(0, -1).map((p, i) => [p, path[i + 1]]);
}
function interpolate(path, u) {
  for (let i = 0; i < path.length - 1; i++) {
    const [u0, h0] = path[i],
      [u1, h1] = path[i + 1];
    if (u >= u0 - 1e-9 && u <= u1 + 1e-9)
      return u1 === u0 ? h0 : h0 + ((h1 - h0) * (u - u0)) / (u1 - u0);
  }
  return u < path[0][0] ? path[0][1] : path.at(-1)[1];
}

/**
 * Paint builder bound to one airframe and the module's `space`. `paint(slots, base, layers)`
 * returns paints for each slot: the base color plus the layers' regions as zones (only the
 * pieces that reach the slot; at most 12 per slot). Layers paint in order.
 */
export function painter(space, F) {
  const sideView = (points) => points.map(([u, h]) => F.model(0, h, u)).map((p) => [p[2], p[1]]);
  /** Half-spaces of a convex polygon (model z, y), each normal pointing inwards. */
  const halfSpaces = (poly) => {
    const cz = poly.reduce((s, p) => s + p[0], 0) / poly.length,
      cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length];
      const dz = b[0] - a[0],
        dy = b[1] - a[1];
      if (Math.hypot(dz, dy) < 1e-6) continue;
      // Perpendicular in (z, y), towards the centroid.
      let nz = -dy,
        ny = dz;
      if (nz * (cz - a[0]) + ny * (cy - a[1]) < 0) {
        nz = -nz;
        ny = -ny;
      }
      const l = Math.hypot(nz, ny);
      out.push({ normal: [0, ny / l, nz / l], point: [0, a[1], a[0]] });
    }
    return out;
  };
  const corners = (slot) => {
    const { min, max } = space.bounds[slot];
    return [
      [min[2], min[1]],
      [max[2], min[1]],
      [max[2], max[1]],
      [min[2], max[1]],
    ];
  };
  const holds = (h, [z, y]) => h.normal[1] * (y - h.point[1]) + h.normal[2] * (z - h.point[2]);
  /** The polygon's zone on a slot: null when it misses the slot's side-view box. */
  const zoneOn = (slot, points) => {
    const poly = sideView(points),
      box = corners(slot);
    const hs = halfSpaces(poly);
    // Separating axis test between the convex polygon and the slot's side-view box.
    for (const h of hs) if (box.every((p) => holds(h, p) < -1e-4)) return null;
    const [z0, y0] = box[0],
      [z1, y1] = box[2];
    if (
      poly.every((p) => p[0] < z0) ||
      poly.every((p) => p[0] > z1) ||
      poly.every((p) => p[1] < y0) ||
      poly.every((p) => p[1] > y1)
    )
      return null;
    // Planes the whole box already satisfies cut nothing here.
    const cutting = hs.filter((h) => !box.every((p) => holds(h, p) >= 0));
    const kept = cutting.length ? cutting : hs.slice(0, 1);
    return kept.map((h) => space.plane(slot, h.normal, h.point));
  };
  const zones = (slot, layers) => {
    const out = [];
    for (const { color, region: pieces, roughness, metalness } of layers)
      for (const points of pieces) {
        const planes = zoneOn(slot, points);
        if (planes)
          out.push({
            color,
            ...(roughness === undefined ? {} : { roughness }),
            ...(metalness === undefined ? {} : { metalness }),
            planes,
          });
      }
    if (out.length > 12) throw new Error(`${slot}: ${out.length} zones (12 at most)`);
    return out;
  };
  return {
    zones,
    /** Paints for several slots sharing a base color and layered regions. */
    paint(slots, base, layers = [], extra = {}) {
      const out = {};
      for (const slot of slots) {
        if (!space.bounds[slot]) throw new Error(`Unknown slot ${slot}`);
        const z = zones(slot, layers);
        out[slot] = { color: base, ...extra, ...(z.length ? { zones: z } : {}) };
      }
      return out;
    },
  };
}

/* ------------------------------------------------------------------ anchors ---- */

/**
 * A pair of fuselage projectors (left `-L`, right `-R`) centred on the skin at (u, h), facing
 * out of it, lettering upright along the body. Width and height in metres.
 */
export function fuselageAnchors(space, F, slot, name, { u, h, width, height, depth = 0.7 }) {
  const out = {};
  for (const [side, tag] of [
    [1, 'L'],
    [-1, 'R'],
  ]) {
    const n = F.normal(u, h, side);
    out[`${name}-${tag}`] = space.anchor(slot, {
      center: F.skin(u, h, side),
      facing: n,
      up: F.up,
      width,
      height,
      depth,
    });
  }
  return out;
}

/**
 * A pair of fin projectors centred at body (u, h) on each face of the fin, facing straight out
 * (fins here are flat foils). `depth` must cover the fin's half thickness at the art without
 * reaching the opposite face: the projector box runs from the mid-plane outwards.
 */
export function finAnchors(space, F, slot, name, { u, h, width, height, depth = 1.0 }) {
  const out = {};
  for (const [side, tag] of [
    [1, 'L'],
    [-1, 'R'],
  ]) {
    const [, y, z] = F.model(0, h, u);
    out[`${name}-${tag}`] = space.anchor(slot, {
      center: [(side * depth) / 2, y, z],
      facing: [side, 0, 0],
      up: F.up,
      width,
      height,
      depth,
    });
  }
  return out;
}

/** Both sides of an anchor pair; `flipRight` mirrors art that should face forward on both. */
export const bothSides = (name, graphic, flipRight = false) => [
  { anchor: `${name}-L`, graphic },
  { anchor: `${name}-R`, graphic, ...(flipRight ? { flip: true } : {}) },
];

/**
 * One design's working set: frame, landmarks, painter and the anchors and shared graphics it
 * accumulates. `reg`, `flag`, `fuselageArt` and `finArt` return a variant's markings (both
 * sides), creating anchors and graphics on first use; identical requests share them.
 */
export function studio(
  { kit: k, space },
  A,
  { skin = 'body-fuselage', belly = 'body-belly', fin = 'tail-fin' } = {},
) {
  const F = airframe(A),
    T = landmarks(A),
    P = painter(space, F);
  const anchors = {},
    graphics = {};
  const key = (...parts) => parts.map((p) => (typeof p === 'number' ? p.toFixed(2) : p)).join('_');
  /** The skin and/or belly slots a fuselage marking at (u, h) of size w x hh reaches. */
  const reach = (u, h, w, hh) => {
    const seams = [-0.5, -0.25, 0, 0.25, 0.5].map((f) => T.seam(u + f * w));
    const out = [];
    if (h + hh / 2 > Math.min(...seams) - 0.02) out.push(skin);
    if (belly && h - hh / 2 < Math.max(...seams) + 0.02) out.push(belly);
    return out;
  };
  const slotsOf = (slot, u, h, w, hh) => (slot === 'auto' ? reach(u, h, w, hh) : [slot].flat());
  const onFuselage = (name, box, slot = skin) => {
    if (!anchors[`${name}-L`]) Object.assign(anchors, fuselageAnchors(space, F, slot, name, box));
    return name;
  };
  const onFin = (name, box, slot = fin) => {
    if (!anchors[`${name}-L`]) Object.assign(anchors, finAnchors(space, F, slot, name, box));
    return name;
  };
  const share = (id, make) => {
    if (!graphics[id]) graphics[id] = make();
    return id;
  };
  return {
    k,
    space,
    F,
    T,
    P,
    anchors,
    graphics,
    onFuselage,
    onFin,
    share,
    /**
     * A registration (or any one line of lettering) centred at body (u, h) on both sides. `slot`
     * may list several slots (the skin and the belly) for lettering that crosses their seam.
     */
    reg(text, { u, h, cap, color, face = 'technical', tracking = 0.04, slot = 'auto', depth }) {
      const w = letteringWidth(text, { height: cap, face, tracking }) + cap * 0.5,
        hh = cap * 1.5;
      const graphic = share(key('text', text, color, cap, face), () =>
        lettering(k, text, { width: w, height: hh, cap, color, face, tracking }),
      );
      return slotsOf(slot, u, h, w, hh).flatMap((s) =>
        bothSides(
          onFuselage(key('t', u, h, w, hh, s), { u, h, width: w, height: hh, depth }, s),
          graphic,
        ),
      );
    },
    /** Lettering on the fin, both faces. */
    finText(text, { u, h, cap, color, face = 'technical', tracking = 0.04, slot = fin, depth }) {
      const w = letteringWidth(text, { height: cap, face, tracking }) + cap * 0.4,
        hh = cap * 1.4;
      const anchor = onFin(
        key('f', u, h, w, hh, slot),
        { u, h, width: w, height: hh, depth },
        slot,
      );
      const graphic = share(key('text', text, color, cap, face), () =>
        lettering(k, text, { width: w, height: hh, cap, color, face, tracking }),
      );
      return bothSides(anchor, graphic);
    },
    /**
     * A flag of `height` metres at (u, h); `draw(k, w, h)` returns its canvas (hoist at the
     * left). `forward` puts the hoist forward on both sides (mirrored on the right).
     */
    flag(id, draw, { u, h, height, aspect = 1.5, forward = true, slot = 'auto' }) {
      const w = height * aspect;
      const graphic = share(key('flag', id, w, height), () =>
        draw(k, w, height).graphic(`${id} flag`),
      );
      return slotsOf(slot, u, h, w, height).flatMap((s) =>
        bothSides(
          onFuselage(key('flag', u, h, w, height, s), { u, h, width: w, height }, s),
          graphic,
          forward,
        ),
      );
    },
    /** Any canvas art on the fuselage at (u, h); `flipRight` keeps it facing forward. */
    fuselageArt(id, canvas, { u, h, flipRight = true, slot = 'auto', depth }) {
      const graphic = share(id, () => canvas.graphic(id));
      return slotsOf(slot, u, h, canvas.width, canvas.height).flatMap((s) =>
        bothSides(
          onFuselage(
            key('art', u, h, canvas.width, canvas.height, s),
            { u, h, width: canvas.width, height: canvas.height, depth },
            s,
          ),
          graphic,
          flipRight,
        ),
      );
    },
    /** Any canvas art on the fin at (u, h). */
    finArt(id, canvas, { u, h, flipRight = true, slot = fin, depth }) {
      const anchor = onFin(
        key('fart', u, h, canvas.width, canvas.height, slot),
        { u, h, width: canvas.width, height: canvas.height, depth },
        slot,
      );
      return bothSides(
        anchor,
        share(id, () => canvas.graphic(id)),
        flipRight,
      );
    },
  };
}

/* ------------------------------------------------------------------ shared schemes ---- */

/** Body height at a fraction `f` of the local section (0 keel, 1 crown) at station u. */
export const sectionHeight = (T, u, f) => {
  const k = T.keel(Math.max(0, Math.min(T.L, u))),
    c = T.crown(Math.max(0, Math.min(T.L, u)));
  return k + f * (c - k);
};

/** A path whose height is a fraction of the local section, sampled at the given stations. */
export const sectionPath = (T, stations) => stations.map(([u, f]) => [u, sectionHeight(T, u, f)]);

/** Solid paint for a slot group. */
export const solid = (slots, color, extra = {}) =>
  Object.fromEntries(slots.map((s) => [s, { color, ...extra }]));

/** Polygon aft of the line through two fin points (u, h), up to `far` behind. */
export const aftOf = ([u0, h0], [u1, h1], far = 80) => [
  [u0, h0],
  [u1, h1],
  [u1 + far, h1],
  [u0 + far, h0],
];
/** Polygon forward of the line through two fin points. */
export const foreOf = ([u0, h0], [u1, h1], far = 80) => [
  [u0 - far, h0],
  [u1 - far, h1],
  [u1, h1],
  [u0, h0],
];
/** A horizontal band between two heights (body frame), optionally limited to [u0, u1]. */
export const hband = (h0, h1, u0 = -50, u1 = 200) => [
  [u0, h0],
  [u1, h0],
  [u1, h1],
  [u0, h1],
];

/**
 * Delta Air Lines' 2007 scheme: white over a navy belly that runs from the radome back to the rear
 * door, where it curves down into the keel; navy fin, with the navy carried forward over the top
 * of the tail cone to the dorsal; navy engines and winglets; registration and a US flag above the
 * aft windows, ship number on the fin tip. The red tail "widget" is the operator's logo and is
 * omitted, as are titles.
 */
export function deltaScheme(S, { reg, ship, stab = '#c8ccce' }) {
  const { T, P } = S;
  const NAVY = '#0b2a5e',
    WHITE = '#f4f5f2';
  const r = T.rearDoor.u0;
  const belly = sectionPath(T, [
    [-1, 0.42],
    [T.nose * 0.25, 0.3],
    [T.nose, 0.32],
    [r - 5, 0.34],
    [r - 2, 0.27],
    [r, 0.14],
    [r + 1.6, -0.1],
  ]);
  const dorsal = T.finLE(T.D) - 0.6;
  const swoosh = [
    [dorsal, T.D + 0.3],
    [dorsal + (T.L - dorsal) * 0.35, T.D - 0.45],
    [T.L - 2.2, T.D - 0.95],
    [T.L + 1, T.D - 0.5],
  ];
  const wh = T.win + T.winH / 2;
  return {
    paints: {
      ...P.paint(TRANSPORT.skin, WHITE, [
        { color: NAVY, region: region.below(belly) },
        { color: NAVY, region: region.above(swoosh) },
      ]),
      ...solid(TRANSPORT.fin, NAVY),
      ...solid(TRANSPORT.stabilizers, stab),
      ...solid(TRANSPORT.nacelles, NAVY),
      ...solid(TRANSPORT.pylons, '#d9dcdc'),
      ...solid(TRANSPORT.winglets, NAVY),
    },
    markings: [
      ...S.reg(reg, { u: T.lastWindow - 0.6, h: wh + 0.3, cap: 0.3 * (T.D / 4), color: NAVY }),
      ...S.flag('us', usFlag, {
        u: T.lastWindow - 2.7,
        h: wh + 0.3,
        height: 0.36 * (T.D / 4),
        aspect: 1.9,
      }),
      ...S.finText(ship, {
        u: T.finLE(T.finTip - 0.35) + 0.75,
        h: T.finTip - 0.35,
        cap: 0.2,
        color: WHITE,
      }),
    ],
  };
}

/**
 * KLM's scheme: KLM blue over the top two thirds of the fuselage and the nose, a fine dark blue
 * line along the boundary sweeping down to the radome, a light grey belly; white fin; light grey
 * engines; EU and Dutch flags and a white registration above the aft windows. Crown logo, titles
 * and the aircraft's bird name are omitted.
 */
export function klmScheme(S, { reg, f = 0.36 }) {
  const { T, P } = S;
  const BLUE = '#0083c8',
    DARK = '#002f86',
    GREY = '#c9ced2',
    WHITE = '#f3f5f5';
  const line = sectionPath(T, [
    [-1, 0.1],
    [T.nose * 0.3, 0.17],
    [T.nose * 0.75, f - 0.06],
    [T.nose + 2, f],
    [T.L + 1, f],
  ]).map(([u, h], i, all) => (i === all.length - 1 ? [u, all[i - 1][1]] : [u, h]));
  const t = 0.07 * (T.D / 4);
  const wh = T.win + T.winH / 2;
  const regU = T.lastWindow - 1.2;
  return {
    paints: {
      ...P.paint(TRANSPORT.skin, BLUE, [
        { color: GREY, region: region.below(line.map(([u, h]) => [u, h - t])) },
        { color: DARK, region: region.stripe(line, 2 * t) },
      ]),
      ...solid(TRANSPORT.fin, WHITE),
      ...solid(TRANSPORT.stabilizers, '#d5d9dc'),
      ...solid(TRANSPORT.nacelles, '#dfe2e4'),
      ...solid(TRANSPORT.pylons, '#d5d9dc'),
      ...solid(TRANSPORT.winglets, BLUE),
    },
    markings: [
      ...S.reg(reg, { u: regU, h: wh + 0.28, cap: 0.27 * (T.D / 4), color: WHITE }),
      ...S.flag('nl', (k, w, h) => stripesFlag(k, w, h, NETHERLANDS), {
        u: regU - 1.75 * (T.D / 4),
        h: wh + 0.28,
        height: 0.3 * (T.D / 4),
      }),
      ...S.flag('eu', euFlag, {
        u: regU - 2.35 * (T.D / 4),
        h: wh + 0.28,
        height: 0.3 * (T.D / 4),
      }),
    ],
  };
}

/**
 * American Airlines' 2013 scheme: silver mica fuselage, engines and winglets; the tail is the
 * stylised flag, blue and white stripes on the forward half, red and white on the aft half and a
 * full-chord red band at the root, with one more red band over the tail cone; registration and a
 * US flag below the aft windows. The Flight Symbol and titles are omitted.
 */
export function americanScheme(S, { reg, fleet }) {
  const { T, P } = S;
  const SILVER = '#c2c8cc',
    RED = '#c8202f',
    BLUE = '#1257a6',
    WHITE = '#eceef0';
  const metal = { metalness: 0.55, roughness: 0.32 };
  const base = T.D,
    H = T.finTip - base;
  const mid = (h) => (T.finLE(h) + T.finTE(h)) / 2;
  const split = [
    [mid(base), base],
    [mid(T.finTip), T.finTip],
  ];
  // Seven narrow blue rows forward, four wide red rows aft, one red band across the root.
  const blue = Array.from({ length: 7 }, (_, i) => {
    const h0 = base + H * (0.165 + i * 0.123);
    return [h0, h0 + H * 0.093];
  });
  const red = [0.205, 0.43, 0.64, 0.87].map((f) => [base + H * f, base + H * (f + 0.115)]);
  // A band between two heights, cut to the half fore (-1) or aft (1) of the split line.
  const clip = (lo, hi, side) => {
    const [[u0, h0], [u1, h1]] = split;
    const at = (h) => u0 + ((u1 - u0) * (h - h0)) / (h1 - h0);
    const far = side * 30;
    return [
      [at(lo), lo],
      [at(lo) + far, lo],
      [at(hi) + far, hi],
      [at(hi), hi],
    ];
  };
  const finLayers = [
    { color: RED, region: [hband(base - 2, base + H * 0.11)] },
    { color: BLUE, region: blue.map(([a, b]) => clip(a, b, -1)) },
    { color: RED, region: red.map(([a, b]) => clip(a, b, 1)) },
  ];
  const tailBand = [
    [T.rearDoor.u0 - 0.4, T.D - 1.25 * (T.D / 4)],
    [T.L + 1, T.D - 1.25 * (T.D / 4)],
    [T.L + 1, T.D - 0.62 * (T.D / 4)],
    [T.rearDoor.u0 + 0.5, T.D - 0.62 * (T.D / 4)],
  ];
  const wl = T.win - T.winH / 2;
  return {
    paints: {
      ...P.paint(TRANSPORT.skin, SILVER, [{ color: RED, region: [tailBand] }], metal),
      ...P.paint(TRANSPORT.fin, WHITE, finLayers),
      ...solid(TRANSPORT.stabilizers, SILVER, metal),
      ...solid(TRANSPORT.nacelles, SILVER, metal),
      ...solid(TRANSPORT.pylons, SILVER, metal),
      ...solid(TRANSPORT.winglets, SILVER, metal),
    },
    markings: [
      ...S.reg(reg, {
        u: T.lastWindow - 1.8,
        h: wl - 0.3,
        cap: 0.26 * (T.D / 4),
        color: '#26292c',
      }),
      ...S.reg(fleet, {
        u: T.lastWindow - 1.8,
        h: wl - 0.68,
        cap: 0.13 * (T.D / 4),
        color: '#26292c',
      }),
      ...S.flag('us', usFlag, {
        u: T.lastWindow - 0.1,
        h: wl - 0.3,
        height: 0.3 * (T.D / 4),
        aspect: 1.9,
      }),
    ],
  };
}

/* ------------------------------------------------------------------ lettering ---- */

/** Width in metres of a line of lettering at cap height `height`. */
export function letteringWidth(label, { height, face = 'technical', tracking = 0 }) {
  return textShapes(label, { height, face, tracking }).width;
}

/**
 * A registration (or other single line) centred on a canvas of the anchor's size: cap height
 * `height`, condensed only if it would overrun the canvas.
 */
export function lettering(
  k,
  label,
  { width, height, cap, color, face = 'technical', tracking = 0 },
) {
  return new k.Canvas(width, height)
    .text(color, label, {
      x: width / 2,
      y: height / 2,
      height: cap,
      face,
      tracking,
      maxWidth: width * 0.98,
    })
    .graphic(label);
}

/* ------------------------------------------------------------------ flags ---- */

/** Horizontal tricolour (or any stripes), top first. */
export function stripesFlag(k, w, h, colors, edge) {
  const c = new k.Canvas(w, h);
  if (edge) c.rect(edge, 0, 0, w, h);
  const inset = edge ? Math.min(w, h) * 0.04 : 0;
  const band = (h - 2 * inset) / colors.length;
  for (const [i, color] of colors.entries())
    c.rect(color, inset, h - inset - (i + 1) * band, w - 2 * inset, band);
  return c;
}

/** Vertical tricolour, hoist first. */
export function columnsFlag(k, w, h, colors) {
  const c = new k.Canvas(w, h);
  const band = w / colors.length;
  for (const [i, color] of colors.entries()) c.rect(color, i * band, 0, band, h);
  return c;
}

/** United States flag (simplified star field: 50 stars in the 9-row pattern). */
export function usFlag(k, w, h) {
  const c = new k.Canvas(w, h);
  const red = '#b22234',
    white = '#ffffff',
    blue = '#3c3b6e';
  const stripe = h / 13;
  c.rect(white, 0, 0, w, h);
  for (let i = 0; i < 13; i += 2) c.rect(red, 0, h - (i + 1) * stripe, w, stripe);
  const cw = w * 0.4,
    ch = stripe * 7;
  c.rect(blue, 0, h - ch, cw, ch);
  const r = ch * 0.045;
  for (let row = 0; row < 9; row++) {
    const count = row % 2 ? 5 : 6;
    for (let i = 0; i < count; i++) {
      const x = ((row % 2 ? 2 : 1) + i * 2) * (cw / 12),
        y = h - ((row + 1) * ch) / 10;
      c.star(white, x, y, r, r * 0.4);
    }
  }
  return c;
}

/** European Union flag: twelve gold stars in a circle on blue. */
export function euFlag(k, w, h) {
  const c = new k.Canvas(w, h);
  c.rect('#003399', 0, 0, w, h);
  const r = h / 3;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    c.star('#ffcc00', w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, h / 18, (h / 18) * 0.4);
  }
  return c;
}

/** Canadian flag: red, white square with an original eleven-point maple leaf, red. */
export function canadaFlag(k, w, h) {
  const c = new k.Canvas(w, h);
  c.rect('#d52b1e', 0, 0, w, h);
  c.rect('#ffffff', w / 4, 0, w / 2, h);
  const s = h * 0.42,
    cx = w / 2,
    cy = h * 0.5;
  const leaf = [
    [0, 0.98],
    [0.13, 0.72],
    [0.3, 0.8],
    [0.25, 0.42],
    [0.52, 0.6],
    [0.46, 0.4],
    [0.74, 0.44],
    [0.6, 0.2],
    [0.66, 0.1],
    [0.3, -0.12],
    [0.36, -0.3],
    [0.04, -0.24],
    [0.05, -0.72],
    [-0.05, -0.72],
    [-0.04, -0.24],
    [-0.36, -0.3],
    [-0.3, -0.12],
    [-0.66, 0.1],
    [-0.6, 0.2],
    [-0.74, 0.44],
    [-0.46, 0.4],
    [-0.52, 0.6],
    [-0.25, 0.42],
    [-0.3, 0.8],
    [-0.13, 0.72],
  ].map(([x, y]) => [cx + x * s, cy + y * s]);
  c.add('#d52b1e', leaf);
  return c;
}

/** German federal colours with a thin border (government transports). */
export const GERMANY = ['#000000', '#dd0000', '#ffce00'];
export const NETHERLANDS = ['#ae1c28', '#ffffff', '#21468b'];
/** Latvia: carmine, a narrow white stripe, carmine (2:1:2). */
export function latviaFlag(k, w, h) {
  const c = new k.Canvas(w, h);
  c.rect('#9e3039', 0, 0, w, h);
  c.rect('#ffffff', 0, (h * 2) / 5, w, h / 5);
  return c;
}
