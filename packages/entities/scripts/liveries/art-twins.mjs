/**
 * Shared livery art for the piston and turboprop twins and the P-51: national markings that the
 * kit does not draw, period US insignia, maintenance stencils and small helpers. Everything is an
 * original vector drawing (no reference pixels); see README.md for the marking policy.
 */

import { textShapes } from '../lettering-outlines.mjs';

/**
 * Canvas.text with fewer curve segments (3 per glyph curve instead of 4): lettering is the bulk
 * of the livery JSON and the difference is invisible at marking sizes.
 */
export function text(
  c,
  color,
  label,
  {
    x,
    y,
    height,
    face = 'technical',
    align = 'center',
    tracking = 0,
    maxWidth,
    slant = 0,
    segments = 3,
  },
) {
  const { shapes, width } = textShapes(label, { height, face, align, tracking });
  const squeeze = maxWidth && width > maxWidth ? maxWidth / width : 1;
  return c.shapesFrom(
    color,
    shapes,
    ([px, py]) => [x + px * squeeze + py * slant, y + py],
    segments,
  );
}

/** Lettering centred on its own canvas, condensed to fit; `height` defaults to 80% of the box. */
export function lettering(k, label, w, h, color, opts = {}) {
  const { height = h * 0.8, ...rest } = opts;
  const c = new k.Canvas(w, h);
  text(c, color, label, { x: w / 2, y: h / 2, height, maxWidth: w * 0.98, ...rest });
  return c.graphic(label);
}

/** Several lines of lettering stacked top to bottom, each [label, capHeight, color, opts]. */
export function stacked(k, w, h, lines, gap = 0.35, label) {
  const c = new k.Canvas(w, h);
  const total = lines.reduce((s, [, cap], i) => s + cap + (i ? cap * gap : 0), 0);
  let y = h / 2 + total / 2;
  lines.forEach(([line, cap, color, opts = {}], i) => {
    if (i) y -= lines[i - 1][1] * gap;
    text(c, color, line, { x: w / 2, y: y - cap / 2, height: cap, maxWidth: w * 0.98, ...opts });
    y -= cap;
  });
  return c.graphic(label ?? lines.map((l) => l[0]).join(' / '));
}

const starPoints = (cx, cy, outer, inner = outer * 0.382, n = 5, rotation = 0) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = rotation + Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 ? inner : outer;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });

/**
 * US star-and-bar of 1943-47: white star in a blue disc, white bars, all in a blue border (no
 * red stripe; that came in 1947). `r` is the disc radius; the mark is 4r + 2r/8 wide.
 */
export function starAndBar(c, cx, cy, r, { blue = '#1d2a57', white = '#efede4' } = {}) {
  const border = r / 8,
    barH = r / 2;
  const silhouette = (R, half, L) => {
    const a0 = Math.asin(Math.min(1, half / R));
    const pts = [
      [cx + L, cy - half],
      [cx + L, cy + half],
    ];
    for (let i = 0; i <= 32; i++) {
      const a = a0 + ((Math.PI - 2 * a0) * i) / 32;
      pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
    }
    pts.push([cx - L, cy + half], [cx - L, cy - half]);
    for (let i = 0; i <= 32; i++) {
      const a = Math.PI + a0 + ((Math.PI - 2 * a0) * i) / 32;
      pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
    }
    return pts;
  };
  c.add(blue, silhouette(r + border, barH / 2 + border, 2 * r + border));
  c.rect(white, cx - 2 * r, cy - barH / 2, 4 * r, barH);
  c.circle(blue, cx, cy, r, 48);
  c.add(white, starPoints(cx, cy, r, r * 0.382));
  return c;
}

/** The 1942-43 US star in a disc, as worn on the upper wing of early war aircraft. */
export function starInDisc(c, cx, cy, r, { blue = '#1d2a57', white = '#efede4' } = {}) {
  c.circle(blue, cx, cy, r, 48);
  c.add(white, starPoints(cx, cy, r, r * 0.382));
  return c;
}

/** Vertical fin flash: equal stripes left to right (RAF, Commonwealth and others). */
export function finFlash(c, x, y, w, h, colors, widths) {
  const parts = widths ?? colors.map(() => 1 / colors.length);
  let at = x;
  colors.forEach((color, i) => {
    c.rect(color, at, y, w * parts[i] + (i < colors.length - 1 ? w * 0.002 : 0), h);
    at += w * parts[i];
  });
  return c;
}

/** Horizontal flag of equal or weighted bands, top to bottom. */
export function bandFlag(c, x, y, w, h, colors, heights) {
  const parts = heights ?? colors.map(() => 1 / colors.length);
  let top = y + h;
  colors.forEach((color, i) => {
    const bh = h * parts[i];
    c.rect(
      color,
      x,
      top - bh - (i < colors.length - 1 ? h * 0.002 : 0),
      w,
      bh + (i < colors.length - 1 ? h * 0.002 : 0),
    );
    top -= bh;
  });
  return c;
}

/** Venezuelan flag: yellow, blue, red with an arc of eight white stars on the blue band. */
export function venezuelaFlag(c, x, y, w, h) {
  bandFlag(c, x, y, w, h, ['#f7c600', '#1d3f94', '#c4122f']);
  const cx = x + w / 2,
    cy = y + h * 0.3,
    R = h * 0.36;
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * (0.18 + (0.64 * i) / 7);
    c.star('#ffffff', cx - Math.cos(a) * R, cy + Math.sin(a) * R, h * 0.045, h * 0.018);
  }
  return c;
}

/** Colombian Air Force roundel: flag-colored disc with the inverted flag inside and a star. */
export function colombiaRoundel(c, cx, cy, r) {
  const yellow = '#f4c400',
    blue = '#1f3f93',
    red = '#c8102e';
  const arc = (a0, a1, rr, n = 24) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / n;
      return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
    });
  c.add(yellow, arc(0, Math.PI, r, 40));
  c.add(blue, [[cx, cy], ...arc(Math.PI, Math.PI * 1.5, r)]);
  c.add(red, [[cx, cy], ...arc(Math.PI * 1.5, Math.PI * 2, r)]);
  // Inner disc: red over blue over yellow (the flag inverted).
  const ri = r * 0.58;
  const chord = (y0, y1, color) => {
    const pts = [];
    const n = 20;
    const ya = Math.max(-ri, y0),
      yb = Math.min(ri, y1);
    for (let i = 0; i <= n; i++) {
      const yy = ya + ((yb - ya) * i) / n;
      pts.push([cx + Math.sqrt(Math.max(0, ri * ri - yy * yy)), cy + yy]);
    }
    for (let i = n; i >= 0; i--) {
      const yy = ya + ((yb - ya) * i) / n;
      pts.push([cx - Math.sqrt(Math.max(0, ri * ri - yy * yy)), cy + yy]);
    }
    c.add(color, pts);
  };
  chord(ri * 0.5, ri, red);
  chord(0, ri * 0.5, blue);
  chord(-ri, 0, yellow);
  c.star('#ffffff', cx, cy, r * 0.3, r * 0.12);
  return c;
}

/** Venezuelan military roundel: yellow, blue and red rings round a star. */
export function venezuelaRoundel(c, cx, cy, r) {
  c.circle('#c4122f', cx, cy, r, 48);
  c.circle('#1d3f94', cx, cy, r * 0.68, 48);
  c.circle('#f7c600', cx, cy, r * 0.38, 40);
  return c;
}

/* ------------------------------------------------------------------ maintenance stencils ---- */

/** Red propeller-plane warning stripe lettered PROPELLER; long axis horizontal on the canvas. */
export function propellerStripe(k, w, h, { band = '#b5191c', ink = '#f4f2ea' } = {}) {
  const c = new k.Canvas(w, h).rect(band, 0, 0, w, h);
  text(c, ink, 'PROPELLER', {
    x: w / 2,
    y: h / 2,
    height: h * 0.62,
    maxWidth: w * 0.9,
    tracking: 0.35,
  });
  return c.graphic('Propeller warning stripe');
}

/** Ejection seat warning: a red triangle, point down, white edged (its lettering is too small to read). */
export function ejectionTriangle(k, s) {
  const c = new k.Canvas(s, s * 0.9);
  c.add('#f4f2ea', [
    [0, s * 0.9],
    [s, s * 0.9],
    [s / 2, 0],
  ]);
  const i = s * 0.12;
  c.add('#c0161b', [
    [i * 1.4, s * 0.9 - i * 0.7],
    [s - i * 1.4, s * 0.9 - i * 0.7],
    [s / 2, i * 1.5],
  ]);
  return c.graphic('Ejection seat warning');
}

/** NO STEP over a short underline, for wing roots and flaps. */
export function noStep(k, w, h, ink = '#1b1d1f') {
  const c = new k.Canvas(w, h).rect(ink, w * 0.05, h * 0.08, w * 0.9, h * 0.08);
  text(c, ink, 'NO STEP', { x: w / 2, y: h * 0.6, height: h * 0.45, maxWidth: w * 0.95 });
  return c.graphic('NO STEP');
}

/** A walkway outline: two long lines (for wing roots), open ends. */
export function walkway(k, w, h, ink = '#1b1d1f', t = 0.025) {
  return new k.Canvas(w, h)
    .rect(ink, 0, 0, w, t)
    .rect(ink, 0, h - t, w, t)
    .graphic('Walkway lines');
}

/** A rescue arrow with lettering, pointing right on the canvas. */
export function rescueArrow(k, w, h, color = '#d5541c', label = 'RESCUE') {
  const c = new k.Canvas(w, h);
  c.add(color, [
    [0, h * 0.3],
    [w * 0.72, h * 0.3],
    [w * 0.72, 0],
    [w, h * 0.5],
    [w * 0.72, h],
    [w * 0.72, h * 0.7],
    [0, h * 0.7],
  ]);
  text(c, '#ffffff', label, { x: w * 0.38, y: h / 2, height: h * 0.28, maxWidth: w * 0.62 });
  return c.graphic('Rescue arrow');
}

/**
 * A shark mouth for a rounded nose, original drawing: the jaws open toward the canvas LEFT (the
 * nose on a left-side anchor) from a pointed corner on the right, with teeth along both jaws, a
 * red throat line and an eye above. Use `flip` on the right-hand side.
 */
export function sharkMouth(
  k,
  w,
  h,
  { lip = '#f2f1ea', mouth = '#b31b22', tooth = '#f2f1ea', dark = '#1b1c1e', eye = true } = {},
) {
  const c = new k.Canvas(w, h);
  const cx = w * 0.97,
    cy = h * 0.5;
  // t runs from the corner (0) to the nose end (1).
  const upper = (t) => [cx - t * w * 0.93, cy + h * 0.14 * Math.pow(t, 1.8)];
  const lower = (t) => [cx - t * w * 0.88, cy - h * 0.4 * Math.sin((t * Math.PI) / 2)];
  const n = 20;
  const top = Array.from({ length: n + 1 }, (_, i) => upper(i / n)),
    bottom = Array.from({ length: n + 1 }, (_, i) => lower(i / n));
  const grow = (pts, dy) => pts.map(([x, y]) => [x, y + dy]);
  // White lip band round the mouth, the dark mouth, then the red throat line.
  c.add(lip, [[cx + w * 0.03, cy], ...grow(top, h * 0.045), ...grow(bottom, -h * 0.045).reverse()]);
  c.add(dark, [...top, ...[...bottom].reverse()]);
  const throat = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n,
      [ux, uy] = upper(t),
      [, ly] = lower(t);
    return [ux, uy + (ly - uy) * 0.5];
  });
  c.add(mouth, [...grow(throat, h * 0.035), ...grow(throat, -h * 0.035).reverse()]);
  const teeth = 10;
  for (let i = 0; i < teeth; i++) {
    const t0 = 0.06 + (i / teeth) * 0.93,
      t1 = 0.06 + ((i + 1) / teeth) * 0.93,
      tm = (t0 + t1) / 2;
    const gap = (t) => upper(t)[1] - lower(t)[1];
    c.add(tooth, [upper(t1), upper(t0), [upper(tm)[0], upper(tm)[1] - gap(tm) * 0.46]]);
    c.add(tooth, [lower(t0), lower(t1), [lower(tm)[0], lower(tm)[1] + gap(tm) * 0.46]]);
  }
  if (eye) {
    const ex = w * 0.6,
      ey = h * 0.86;
    c.add(lip, [
      [ex + w * 0.09, ey - h * 0.01],
      [ex, ey + h * 0.08],
      [ex - w * 0.08, ey + h * 0.01],
      [ex - w * 0.01, ey - h * 0.06],
    ]);
    c.circle(mouth, ex - w * 0.005, ey + h * 0.008, h * 0.042, 20);
    c.circle(dark, ex - w * 0.01, ey + h * 0.008, h * 0.02, 14);
  }
  return c.graphic('Shark mouth');
}

/* ------------------------------------------------------------------ paint helpers ---- */

/** Camouflage whose patches keep one physical size across slots of different extents. */
export function camo(bounds, slot, colors, period, seed, style) {
  const b = bounds[slot];
  const longest = b ? Math.max(...b.max.map((v, i) => v - b.min[i])) : period;
  return {
    colors,
    scale: Math.max(0.05, Math.round((longest / period) * 1000) / 1000),
    seed,
    ...(style ? { style } : {}),
  };
}

/** The same paint for a list of slots. */
export function paintAll(names, paint) {
  return Object.fromEntries(names.map((n) => [n, typeof paint === 'function' ? paint(n) : paint]));
}

/**
 * A taildragger authored in its flight datum and posed nose-up by `angleDeg` about X, then
 * lifted by `lift` (the builders' body.rotation.x = -angle, position.y = offset). Returns the
 * datum-to-model `pose`, the posed `up` and `fwd` axes, and `station(space, slot, z, ahead)`: the
 * half-space ahead of (or behind) the datum station z, cut square to the fuselage.
 */
export function posedFrame(angleDeg, lift) {
  const a = (angleDeg * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  const pose = ([x, y, z]) => [x, y * c + z * s + lift, -y * s + z * c];
  const up = [0, c, -s],
    fwd = [0, s, c];
  return {
    pose,
    up,
    fwd,
    down: up.map((v) => -v),
    station: (space, slot, z, ahead) =>
      space.plane(slot, ahead ? fwd : fwd.map((v) => -v), pose([0, 0, z])),
    /** Above (side 1) or below (-1) the datum line through (z0, y0) and (z1, y1). */
    line: (space, slot, [z0, y0], [z1, y1], side) => {
      const p0 = pose([0, y0, z0]),
        p1 = pose([0, y1, z1]);
      return space.sideLine(slot, [p0[2], p0[1]], [p1[2], p1[1]], side);
    },
  };
}
