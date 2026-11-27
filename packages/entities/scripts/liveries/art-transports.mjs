/**
 * Shared original vector art for the transport and tiltrotor liveries (C-130J, C-17A, C-5M,
 * A400M, An-124, MV-22B): national flags and fin flashes, stacked lettering and a few emblems.
 * Everything is drawn from geometry here; no reference image pixels.
 */

/* Douglas-Peucker on an open polyline (metres). */
function simplifyLine(points, tol) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0],
    [bx, by] = points.at(-1);
  const dx = bx - ax,
    dy = by - ay,
    len = Math.hypot(dx, dy);
  let worst = -1,
    at = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const d = len ? Math.abs((px - ax) * dy - (py - ay) * dx) / len : Math.hypot(px - ax, py - ay);
    if (d > worst) {
      worst = d;
      at = i;
    }
  }
  if (worst <= tol) return [points[0], points.at(-1)];
  return [
    ...simplifyLine(points.slice(0, at + 1), tol).slice(0, -1),
    ...simplifyLine(points.slice(at), tol),
  ];
}

/** Simplify a closed ring: split at its two farthest-apart points and simplify both halves. */
function simplifyRing(ring, tol) {
  if (ring.length <= 4) return ring;
  let far = 0,
    best = -1;
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]);
    if (d > best) {
      best = d;
      far = i;
    }
  }
  const a = simplifyLine(ring.slice(0, far + 1), tol),
    b = simplifyLine([...ring.slice(far), ring[0]], tol);
  const out = [...a.slice(0, -1), ...b.slice(0, -1)];
  return out.length >= 3 ? out : ring;
}

/**
 * Finish a canvas into a schema graphic with a smaller footprint: rings are simplified to
 * `tol` metres and coordinates rounded to 1e-3 of the canvas (a few millimetres at most), which
 * keeps lettering-heavy transport liveries inside the size budget.
 */
export function finish(c, title, tol) {
  const t = tol ?? Math.min(c.width, c.height) * 0.006;
  for (const s of c.shapes) {
    s.points = simplifyRing(s.points, t);
    s.holes = s.holes.map((h) => simplifyRing(h, t)).filter((h) => h.length >= 3);
  }
  const g = c.graphic(title);
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const tidy = (ring) => {
    const out = [];
    for (const p of ring) {
      const q = [r3(p[0]), r3(p[1])];
      const last = out.at(-1);
      if (!last || last[0] !== q[0] || last[1] !== q[1]) out.push(q);
    }
    if (out.length > 1 && out[0][0] === out.at(-1)[0] && out[0][1] === out.at(-1)[1]) out.pop();
    return out;
  };
  g.shapes = g.shapes
    .map((s) => {
      const points = tidy(s.points);
      const holes = (s.holes ?? []).map(tidy).filter((h) => h.length >= 3);
      return { color: s.color, points, ...(holes.length ? { holes } : {}) };
    })
    .filter((s) => s.points.length >= 3);
  return g;
}

/** One line of lettering filling a w x h canvas (cap height `fill` of h). */
export function label(k, text, w, h, color, { fill = 0.8, title, ...opts } = {}) {
  return finish(
    new k.Canvas(w, h).text(color, text, {
      x: w / 2,
      y: h / 2,
      height: h * fill,
      maxWidth: w * 0.98,
      ...opts,
    }),
    title ?? text,
  );
}

/** Lettering aligned left or right inside its canvas (titles that start at a door or frame). */
export function labelAt(k, text, w, h, color, align, { fill = 0.8, ...opts } = {}) {
  const x = align === 'left' ? 0 : align === 'right' ? w : w / 2;
  return finish(
    new k.Canvas(w, h).text(color, text, {
      x,
      y: h / 2,
      height: h * fill,
      maxWidth: w,
      align,
      ...opts,
    }),
    text,
  );
}

/**
 * Several lines on one canvas: `rows` are [text, capHeight, y, color?, opts?] with y the line's
 * middle measured from the bottom, all in metres.
 */
export function lines(k, w, h, color, rows, title) {
  const c = new k.Canvas(w, h);
  for (const [text, height, y, col, opts] of rows)
    c.text(col ?? color, text, { x: w / 2, y, height, maxWidth: w * 0.98, ...opts });
  return finish(c, title ?? rows.map((r) => r[0]).join(' / '));
}

/** Vertical bands, first color at the reader's left (a fin flash; flip it on the right side). */
export function bandsV(c, x, y, w, h, colors, weights) {
  const ws = weights ?? colors.map(() => 1),
    total = ws.reduce((s, v) => s + v, 0);
  let at = x;
  colors.forEach((color, i) => {
    const bw = (w * ws[i]) / total;
    c.rect(color, at, y, bw + (i < colors.length - 1 ? w * 0.002 : 0), h);
    at += bw;
  });
  return c;
}

/** Horizontal bands, first color on top. */
export function bandsH(c, x, y, w, h, colors, weights) {
  const ws = weights ?? colors.map(() => 1),
    total = ws.reduce((s, v) => s + v, 0);
  let at = y + h;
  colors.forEach((color, i) => {
    const bh = (h * ws[i]) / total;
    c.rect(
      color,
      x,
      at - bh - (i < colors.length - 1 ? h * 0.002 : 0),
      w,
      bh + (i < colors.length - 1 ? h * 0.002 : 0),
    );
    at -= bh;
  });
  return c;
}

export const flash = (k, w, h, colors, title, weights) =>
  finish(bandsV(new k.Canvas(w, h), 0, 0, w, h, colors, weights), title);
export const flagH = (k, w, h, colors, title, weights) =>
  finish(bandsH(new k.Canvas(w, h), 0, 0, w, h, colors, weights), title);

/**
 * United States flag, canton at the reader's top left (the hoist toward the nose on the
 * aircraft's left side; flip it on the right side so the stars lead there too).
 */
export function usFlag(
  k,
  w,
  h,
  { stripes = ['#b22234', '#ffffff'], canton = '#3c3b6e', star = '#ffffff' } = {},
) {
  const c = new k.Canvas(w, h);
  const sh = h / 13;
  c.rect(stripes[1], 0, 0, w, h);
  for (let i = 0; i < 13; i += 2) c.rect(stripes[0], 0, h - (i + 1) * sh, w, sh);
  const cw = w * 0.4,
    ch = sh * 7;
  c.rect(canton, 0, h - ch, cw, ch);
  const r = h * 0.0616 * 0.5 * 1.05;
  for (let row = 0; row < 9; row++) {
    const count = row % 2 ? 5 : 6;
    for (let i = 0; i < count; i++) {
      const x = ((row % 2 ? 2 : 1) + i * 2) * (cw / 12),
        y = h - (row + 1) * (ch / 10);
      c.star(star, x, y, r, r * 0.382);
    }
  }
  return finish(c, 'United States flag');
}

/** Turkish flag: white crescent and star on red, hoist at the reader's left. */
export function turkishFlag(k, w, h) {
  const c = new k.Canvas(w, h),
    G = h;
  c.rect('#e30a17', 0, 0, w, h);
  const cx = G / 2,
    cy = h / 2;
  // Crescent: white disc with a red disc cut from it, set toward the fly.
  const outer = Array.from({ length: 40 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2;
    return [cx + Math.cos(a) * G * 0.25, cy + Math.sin(a) * G * 0.25];
  });
  c.add('#ffffff', outer);
  c.circle('#e30a17', cx + G * 0.0625, cy, G * 0.2, 40);
  c.star('#ffffff', cx + G * 0.354, cy, G * 0.125, G * 0.125 * 0.382, 5, Math.PI / 2);
  return finish(c, 'Turkish flag');
}

/** United Kingdom flag (simplified: the red saltire is centred, not counterchanged). */
export function unionFlag(k, w, h) {
  const c = new k.Canvas(w, h),
    blue = '#012169',
    red = '#c8102e',
    white = '#ffffff';
  c.rect(blue, 0, 0, w, h);
  const angle = Math.atan2(h, w),
    len = Math.hypot(w, h) * 1.1;
  for (const a of [angle, -angle]) c.box(white, w / 2, h / 2, len, h * 0.2, a);
  for (const a of [angle, -angle]) c.box(red, w / 2, h / 2, len, h * 0.067, a);
  c.rect(white, w / 2 - h / 6, 0, h / 3, h);
  c.rect(white, 0, h / 2 - h / 6, w, h / 3);
  c.rect(red, w / 2 - h / 10, 0, h / 5, h);
  c.rect(red, 0, h / 2 - h / 10, w, h / 5);
  return finish(c, 'United Kingdom flag');
}

/** Canadian flag: red, white square with an original eleven-point maple leaf, red. */
export function canadaFlag(k, w, h) {
  const c = new k.Canvas(w, h);
  c.rect('#d52b1e', 0, 0, w, h);
  c.rect('#ffffff', w / 4, 0, w / 2, h);
  const s = h * 0.42,
    cx = w / 2,
    cy = h * 0.47;
  c.add(
    '#d52b1e',
    MAPLE.map(([x, y]) => [cx + x * s, cy + y * s]),
  );
  return finish(c, 'Canadian flag');
}

/** An original eleven-point maple leaf outline in a unit box centred on the stem axis. */
export const MAPLE = [
  [0, 1],
  [0.12, 0.76],
  [0.28, 0.82],
  [0.22, 0.44],
  [0.46, 0.66],
  [0.52, 0.52],
  [0.78, 0.58],
  [0.68, 0.3],
  [0.8, 0.24],
  [0.42, -0.08],
  [0.5, -0.24],
  [0.05, -0.18],
  [0.06, -0.62],
  [-0.06, -0.62],
  [-0.05, -0.18],
  [-0.5, -0.24],
  [-0.42, -0.08],
  [-0.8, 0.24],
  [-0.68, 0.3],
  [-0.78, 0.58],
  [-0.52, 0.52],
  [-0.46, 0.66],
  [-0.22, 0.44],
  [-0.28, 0.82],
  [-0.12, 0.76],
];

/** A five-point star in a ring (the low-visibility Russian star outline style). */
export function starOutline(c, cx, cy, r, color, t = r * 0.12) {
  const pts = (rr, ri) =>
    Array.from({ length: 10 }, (_, i) => {
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      const q = i % 2 ? ri : rr;
      return [cx + Math.cos(a) * q, cy + Math.sin(a) * q];
    });
  c.add(color, pts(r, r * 0.42), [[...pts(r - t * 1.9, (r - t * 1.9) * 0.42)].reverse()]);
  return c;
}

/**
 * The USCG racing stripe: a wide red-orange bar and a narrow blue bar slanted forward at 64
 * degrees, with the service emblem (a simplified original shield in a ring) on the wide bar.
 * `w`, `h` frame the stripe; it leans toward the reader's left (the nose on the left side).
 */
export function coastGuardStripe(k, w, h, { emblem = true } = {}) {
  const c = new k.Canvas(w, h);
  const lean = h / Math.tan((64 * Math.PI) / 180);
  const bar = (x0, width, color) =>
    c.add(color, [
      [x0 + lean, 0],
      [x0 + lean + width, 0],
      [x0 + width, h],
      [x0, h],
    ]);
  const wide = (w - lean) * 0.7,
    gap = (w - lean) * 0.06,
    narrow = (w - lean) * 0.24;
  bar(0, wide, '#e2522f');
  bar(wide + gap, narrow, '#1f3f7a');
  if (emblem) {
    const cx = wide * 0.5 + lean * 0.5,
      cy = h * 0.5,
      r = Math.min(wide * 0.36, h * 0.2);
    c.circle('#ffffff', cx, cy, r, 40);
    c.ring('#1f3f7a', cx, cy, r * 0.78, r * 0.92, 40);
    // Shield: blue chief over white and red pales, with crossed anchors suggested as a bar.
    const sw = r * 0.62,
      top = cy + r * 0.42,
      bottom = cy - r * 0.55;
    c.add('#1f3f7a', [
      [cx - sw / 2, top],
      [cx + sw / 2, top],
      [cx + sw / 2, cy - r * 0.08],
      [cx, bottom],
      [cx - sw / 2, cy - r * 0.08],
    ]);
    for (let i = 0; i < 4; i++)
      c.rect(
        i % 2 ? '#ffffff' : '#c8102e',
        cx - sw / 2 + (i * sw) / 4,
        cy - r * 0.2,
        sw / 4,
        r * 0.4,
      );
    c.add('#1f3f7a', [
      [cx - sw / 2, cy - r * 0.2],
      [cx + sw / 2, cy - r * 0.2],
      [cx, bottom],
    ]);
  }
  return finish(c, 'Coast Guard racing stripe');
}

/** A rectangle of solid color (cheatline segments, walkway blocks, anti-glare panels). */
export const block = (k, color, title = 'block') =>
  new k.Canvas(1, 1).rect(color, 0, 0, 1, 1).graphic(title);
