/**
 * Shared livery helpers for the light and medium helicopters (Robinson R44, Airbus H125 and H145,
 * Leonardo AW139, Bell 206B and 407): model-space paint schemes applied across several paint
 * slots at once, lettering graphics and a few original vector emblems. Everything is drawn here as
 * vector shapes; nothing is traced from photographs.
 *
 * A scheme's zones are written once in the model frame (metres, +Z nose, +X the aircraft's left,
 * +Y up) and converted per slot, so a split or cheatline runs straight across every material it
 * crosses (cabin skin, cowling, boom, fin).
 */

/** Half-space specs in the model frame; `scheme` turns them into each slot's planes. */
export const P = {
  plane: (n, p) => ({ n, p }),
  above: (y) => ({ n: [0, 1, 0], p: [0, y, 0] }),
  below: (y) => ({ n: [0, -1, 0], p: [0, y, 0] }),
  ahead: (z) => ({ n: [0, 0, 1], p: [0, 0, z] }),
  behind: (z) => ({ n: [0, 0, -1], p: [0, 0, z] }),
  /** The aircraft's left (+X) or right (-X) half. */
  left: (x = 0) => ({ n: [1, 0, 0], p: [x, 0, 0] }),
  right: (x = 0) => ({ n: [-1, 0, 0], p: [x, 0, 0] }),
  /** Outboard of |x| on one side: `side` 1 is the left (+X), -1 the right. */
  outboard: (side, x) => ({ n: [side, 0, 0], p: [side * x, 0, 0] }),
  /** Above (`side` 1) or below (-1) the side-view line from (z0, y0) to (z1, y1). */
  line: ([z0, y0], [z1, y1], side = 1) => {
    let n = [0, z1 - z0, -(y1 - y0)];
    if (n[1] < 0) n = n.map((v) => -v);
    return { n: n.map((v) => v * side), p: [0, y0, z0] };
  },
  /** The side of the side-view line (z0, y0)-(z1, y1) that holds the point (zt, yt). */
  keep: ([z0, y0], [z1, y1], [zt, yt]) => {
    let n = [0, z1 - z0, -(y1 - y0)];
    if (n[1] * (yt - y0) + n[2] * (zt - z0) < 0) n = n.map((v) => -v);
    return { n, p: [0, y0, z0] };
  },
  /** The side of the plan-view line (x0, z0)-(x1, z1) that holds (xt, zt). */
  keepPlan: ([x0, z0], [x1, z1], [xt, zt]) => {
    let n = [z1 - z0, 0, -(x1 - x0)];
    if (n[0] * (xt - x0) + n[2] * (zt - z0) < 0) n = n.map((v) => -v);
    return { n, p: [x0, 0, z0] };
  },
};

/** Which side of the side-view line (z0, y0)-(z1, y1) a point lies on (same test as P.keep). */
export function sideOf([z0, y0], [z1, y1], [z, y]) {
  return Math.sign((z1 - z0) * (y - y0) - (y1 - y0) * (z - z0));
}

/** Deterministic pseudo-random numbers (mulberry32) for scattered artwork. */
export function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Side-projected artwork placed in model coordinates: `box` is the anchor's side-view window
 * { z, y, width, height } (centre and size, metres). `draw(c, at)` gets the canvas and a
 * function mapping model (z, y) to canvas (x, y) for the LEFT side's projector (art +X toward
 * the tail); mark the right side's copy `flip: true` so it lands on the same stations.
 */
export function sideArt(k, box, label, draw) {
  const c = new k.Canvas(box.width, box.height);
  const at = (z, y) => [box.z - z + box.width / 2, y - box.y + box.height / 2];
  draw(c, at);
  return c.graphic(label);
}

/** Side-view anchors on both sides matching a `sideArt` box (x is the surface half-width). */
export function sideAnchors(space, name, slot, box, x, depth = 0.5) {
  const out = {};
  for (const side of [1, -1])
    out[`${name}-${side === 1 ? 'l' : 'r'}`] = space.anchor(slot, {
      center: [side * x, box.y, box.z],
      facing: [side, 0, 0],
      width: box.width,
      height: box.height,
      depth,
    });
  return out;
}

/**
 * Paint several slots with one base color and the same model-space zones. `zones` are
 * { color, planes: [P...], only?: [slot names], roughness?, metalness? }; later zones win.
 */
export function scheme(space, slots, base, zones = [], extra = {}) {
  const paints = {};
  for (const slot of slots) {
    if (!space.bounds[slot]) continue;
    const own = zones
      .filter((zone) => !zone.only || zone.only.includes(slot))
      .filter((zone) => !zone.except?.includes(slot))
      .map(({ color, planes, roughness, metalness }) => ({
        color,
        ...(roughness !== undefined ? { roughness } : {}),
        ...(metalness !== undefined ? { metalness } : {}),
        planes: planes.map(({ n, p }) => space.plane(slot, n, p)),
      }));
    if (own.length > 12) throw new Error(`${slot}: more than 12 zones`);
    paints[slot] = { color: base, ...extra, ...(own.length ? { zones: own } : {}) };
  }
  return paints;
}

/** A single line of lettering filling a w x h canvas (cap height 80% unless given). */
export function lettering(k, label, w, h, color, opts = {}) {
  const { capHeight = h * 0.8, align = 'center', ...rest } = opts;
  const x = align === 'left' ? 0.02 * w : align === 'right' ? 0.98 * w : w / 2;
  return new k.Canvas(w, h)
    .text(color, label, { x, y: h / 2, height: capHeight, maxWidth: w * 0.98, align, ...rest })
    .graphic(label);
}

/**
 * Star of Life (the generic emergency medical services symbol): a blue six-armed cross with a
 * white edge and the rod and serpent in white, drawn from scratch.
 */
export function starOfLife(k, size, { blue = '#1f4fa3', white = '#ffffff' } = {}) {
  const c = new k.Canvas(size, size);
  const cx = size / 2,
    cy = size / 2;
  const arm = (len, wid, color) => {
    for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) c.box(color, cx, cy, len, wid, a);
  };
  arm(size * 0.98, size * 0.34, white);
  arm(size * 0.9, size * 0.27, blue);
  // Rod with a serpent winding round it.
  c.rect(white, cx - size * 0.022, cy - size * 0.36, size * 0.044, size * 0.72);
  const coil = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24,
      y = cy - size * 0.3 + t * size * 0.58,
      x = cx + Math.sin(t * Math.PI * 3) * size * 0.075;
    coil.push([x, y]);
  }
  for (let i = 0; i < coil.length - 1; i++) {
    const [x0, y0] = coil[i],
      [x1, y1] = coil[i + 1];
    c.box(
      white,
      (x0 + x1) / 2,
      (y0 + y1) / 2,
      Math.hypot(x1 - x0, y1 - y0) + size * 0.01,
      size * 0.035,
      Math.atan2(y1 - y0, x1 - x0),
    );
  }
  c.circle(white, coil.at(-1)[0], coil.at(-1)[1] + size * 0.02, size * 0.035, 12);
  return c.graphic('Star of Life');
}

/** Horizontal tricolor flag (top to bottom colors), w x h. */
export function flag(k, w, h, colors, { vertical = false } = {}) {
  const c = new k.Canvas(w, h);
  colors.forEach((color, i) => {
    if (vertical) c.rect(color, (i * w) / colors.length, 0, w / colors.length, h);
    else c.rect(color, 0, h - ((i + 1) * h) / colors.length, w, h / colors.length);
  });
  return c;
}

/**
 * Side anchors on both sides of a round boom or fuselage: `at(side)` gives
 * { slot, center, facing?, up?, width, height, depth } for side 1 (+X, the aircraft's left) and -1.
 */
export function pair(space, name, at) {
  const out = {};
  for (const side of [1, -1]) {
    const a = at(side);
    out[`${name}-${side === 1 ? 'l' : 'r'}`] = space.anchor(a.slot, {
      facing: [side, 0, 0],
      depth: 0.4,
      ...a,
    });
  }
  return out;
}

/** Both sides' markings for a paired anchor; `flipRight` mirrors directional art on the right. */
export function both(anchor, graphic, flipRight = false) {
  return [
    { anchor: `${anchor}-l`, graphic },
    { anchor: `${anchor}-r`, graphic, ...(flipRight ? { flip: true } : {}) },
  ];
}
