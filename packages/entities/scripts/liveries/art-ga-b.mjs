/**
 * Shared artwork and model-space helpers for the Cirrus SR22T, DHC-2 Beaver, PC-6 Porter,
 * PC-12 and DA42 liveries. Everything is original vector drawing (real-font lettering, plain
 * geometry); no reference image pixels, operator names or logos.
 */

/** One line of lettering filling a canvas `w` x `h` metres; the cap height is `fill` of h. */
export function lettering(k, label, w, h, color, opts = {}) {
  const { fill = 0.8, face = 'technical', tracking = 0, slant = 0, align = 'center' } = opts;
  const x = align === 'left' ? 0 : align === 'right' ? w : w / 2;
  return new k.Canvas(w, h)
    .text(color, label, {
      x,
      y: h / 2,
      height: h * fill,
      maxWidth: w * 0.98,
      face,
      tracking,
      slant,
      align,
    })
    .graphic(label);
}

/**
 * Several lines of lettering on one canvas: `lines` are { text, y, height, color?, face?,
 * tracking? } with y the line's centre (metres from the bottom).
 */
export function lettered(k, w, h, color, lines, label) {
  const c = new k.Canvas(w, h);
  for (const line of lines)
    c.text(line.color ?? color, line.text, {
      x: line.x ?? w / 2,
      y: line.y,
      height: line.height,
      maxWidth: line.maxWidth ?? w * 0.98,
      face: line.face ?? 'technical',
      tracking: line.tracking ?? 0,
      align: line.align ?? 'center',
      slant: line.slant ?? 0,
    });
  return c.graphic(label ?? lines.map((l) => l.text).join(' / '));
}

/** RAF-pattern type D roundel (dark blue, narrow white, large red centre): RAF, AAC, RNZAF. */
export function typeDRoundel(k, c, cx, cy, r) {
  return k.roundel(c, cx, cy, r, ['#1f3165', '#f2f2ee', '#c4202e'], [1 / 3, 1 / 6, 1 / 2]);
}

/** Austrian Bundesheer marking: a white equilateral triangle, point down, on a red disc. */
export function austriaMark(c, cx, cy, r) {
  c.circle('#d01c2e', cx, cy, r);
  const t = r * 0.86;
  c.add('#ffffff', [
    [cx - t * Math.sin(Math.PI / 3), cy + t * 0.5],
    [cx, cy - t],
    [cx + t * Math.sin(Math.PI / 3), cy + t * 0.5],
  ]);
  return c;
}

/** Swiss military marking with a thin white border, as painted on light grey airframes. */
export function swissMarkBordered(k, c, cx, cy, s, border = 0.06) {
  c.rect(
    '#ffffff',
    cx - s / 2 - s * border,
    cy - s / 2 - s * border,
    s * (1 + 2 * border),
    s * (1 + 2 * border),
  );
  return k.swissMark(c, cx, cy, s);
}

/** A flat polygon band from a centre line: `pts` [[x, y], ...] and a half thickness each. */
export function ribbon(c, color, pts, half) {
  const left = [],
    right = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0],
      dy = b[1] - a[1];
    const n = Math.hypot(dx, dy) || 1;
    dx /= n;
    dy /= n;
    const h = Array.isArray(half) ? half[i] : half;
    left.push([pts[i][0] - dy * h, pts[i][1] + dx * h]);
    right.push([pts[i][0] + dy * h, pts[i][1] - dx * h]);
  }
  return c.add(color, [...left, ...right.reverse()]);
}

/** Points along a cubic Bezier from p0 to p3 (inclusive), `n` segments. */
export function bezier(p0, p1, p2, p3, n = 16) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n,
      u = 1 - t;
    return [0, 1].map(
      (k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k],
    );
  });
}

/**
 * A swoosh: the region between two curves sharing their ends (a tapered crescent), each curve
 * a cubic Bezier [p0, p1, p2, p3]. Points are in canvas metres.
 */
export function swoosh(c, color, upper, lower, n = 20) {
  const top = bezier(...upper, n),
    bottom = bezier(...lower, n);
  return c.add(color, [...top, ...bottom.reverse()]);
}

/**
 * A rigid pose for airframes built pitched in their datum (taildraggers): `pitch` radians nose
 * up about +X, then `lift` metres up. Converts datum points and directions to the model frame.
 */
export function pose(pitch, lift = 0) {
  const c = Math.cos(pitch),
    s = Math.sin(pitch);
  const dir = ([x, y, z]) => [x, y * c + z * s, z * c - y * s];
  const at = ([x, y, z]) => {
    const [px, py, pz] = dir([x, y, z]);
    return [px, py + lift, pz];
  };
  return { at, dir, up: dir([0, 1, 0]), forward: dir([0, 0, 1]) };
}

/**
 * Model-space shorthands over the kit's `space`, in an optional posed datum: anchors on a side
 * of a slot (box from the centre plane outward, so it never reaches the far side), on upper or
 * lower faces, and zone planes from datum lines.
 */
export function helpers(space, frame = pose(0)) {
  const { at, dir } = frame;
  return {
    frame,
    /**
     * Side anchor: datum (z, y) centre, box from x = 0 out to `reach` on side `s` (+1 left).
     * `toe` leans the projector with a side that narrows aft (dx/dz of the skin).
     */
    side(slot, s, z, y, width, height, { reach = 1.2, toe = 0, up } = {}) {
      return space.anchor(slot, {
        center: at([(s * reach) / 2, y, z]),
        facing: dir([s, 0, -toe]),
        up: up ?? frame.up,
        width,
        height,
        depth: reach,
      });
    },
    /** Box between datum heights y0 (near the centre of a thin surface) and y0 + reach. */
    face(
      slot,
      x,
      z,
      y0,
      width,
      height,
      { reach = 0.3, down = false, up = [0, 0, 1], spin = 0, dihedral = 0 } = {},
    ) {
      const sign = down ? -1 : 1;
      const u = [Math.sin(spin), 0, Math.cos(spin)];
      // A wing rising outboard by `dihedral` (radians): its faces tilt inboard (upper) or
      // outboard (lower), so the box follows the wing across its width.
      const n = [-Math.sign(x) * Math.sin(dihedral) * sign, Math.cos(dihedral) * sign, 0];
      return space.anchor(slot, {
        center: at([x + (n[0] * reach) / 2, y0 + (n[1] * reach) / 2, z]),
        facing: dir(n),
        up: dir(spin ? u : up),
        width,
        height,
        depth: reach,
      });
    },
    /** Points above (side 1) or below (-1) a datum line through (z0, y0) and (z1, y1). */
    line(slot, [z0, y0], [z1, y1], side = 1) {
      const a = at([0, y0, z0]),
        b = at([0, y1, z1]);
      return space.sideLine(slot, [a[2], a[1]], [b[2], b[1]], side);
    },
    /** Datum half-spaces: ahead of / behind a station, above / below a height. */
    ahead(slot, z) {
      return space.plane(slot, dir([0, 0, 1]), at([0, 0, z]));
    },
    behind(slot, z) {
      return space.plane(slot, dir([0, 0, -1]), at([0, 0, z]));
    },
    above(slot, y) {
      return space.plane(slot, dir([0, 1, 0]), at([0, y, 0]));
    },
    below(slot, y) {
      return space.plane(slot, dir([0, -1, 0]), at([0, y, 0]));
    },
    /** |x| <= half (two planes), keeping a fuselage zone off the wings. */
    within(slot, half) {
      return [
        space.plane(slot, [1, 0, 0], [-half, 0, 0]),
        space.plane(slot, [-1, 0, 0], [half, 0, 0]),
      ];
    },
    /** |x| >= from on both sides is not convex; this keeps one side: x*s >= from. */
    outboard(slot, s, from) {
      return space.plane(slot, [s, 0, 0], [s * from, 0, 0]);
    },
  };
}

/** Every slot of `all` whose name matches `test`, painted `paint`. */
export function paintAll(all, test, paint) {
  return Object.fromEntries(
    Object.keys(all)
      .filter((name) => test.test(name))
      .map((name) => [name, paint]),
  );
}
