/**
 * Shared artwork and placement helpers for the UH-1H, Bell 412EP, CH-47F, OH-6 and UH-60M
 * liveries. Every mark here is an original vector drawing (flags, insignia, medical crosses,
 * cavalry sabres), drawn from public descriptions of the designs, never traced.
 */

/** Paint colors shared by the helicopter liveries (approximate FED-STD-595 / RAL shades). */
export const PAINT = {
  // FS 34087 olive drab, the Vietnam-era Army finish.
  oliveDrab: '#545a3c',
  // FS 34031 / 383 CARC aircraft green, today's US Army helicopter finish.
  aircraftGreen: '#4a5043',
  black: '#17191a',
  stencilBlack: '#1d2021',
  white: '#f1f0ea',
  red: '#b5262b',
  insigniaYellow: '#e2b52c',
};

/** Lettering centred on its own canvas: cap height `h * fill`, squeezed into the width. */
export function label(k, text, w, h, color, opts = {}) {
  const { fill = 0.8, ...rest } = opts;
  return new k.Canvas(w, h)
    .text(color, text, { x: w / 2, y: h / 2, height: h * fill, maxWidth: w * 0.98, ...rest })
    .graphic(text);
}

/** A red cross on a white square (medical evacuation marking), `s` the square's side. */
export function redCross(c, cx, cy, s, { white = PAINT.white, red = '#c1121c' } = {}) {
  c.rect(white, cx - s / 2, cy - s / 2, s, s);
  const arm = s * 0.78,
    w = s * 0.26;
  c.rect(red, cx - w / 2, cy - arm / 2, w, arm);
  c.rect(red, cx - arm / 2, cy - w / 2, arm, w);
  return c;
}

/** Vertical bars filling a box, colors from left to right (fin flashes, flags). */
export function bars(c, x, y, w, h, colors) {
  for (const [i, color] of colors.entries())
    c.rect(color, x + (i * w) / colors.length, y, w / colors.length, h);
  return c;
}

/** Horizontal bands filling a box, colors from top to bottom. */
export function bands(c, x, y, w, h, colors) {
  for (const [i, color] of colors.entries())
    c.rect(color, x, y + h - ((i + 1) * h) / colors.length, w, h / colors.length);
  return c;
}

/** An eleven-point maple leaf (original outline), `s` its height. */
export function mapleLeaf(c, cx, cy, s, color) {
  const leaf = [
    [0, 0.5],
    [0.07, 0.36],
    [0.16, 0.41],
    [0.13, 0.2],
    [0.27, 0.28],
    [0.24, 0.18],
    [0.38, 0.2],
    [0.31, 0.08],
    [0.35, 0.02],
    [0.16, -0.08],
    [0.19, -0.18],
    [0.025, -0.15],
    [0.025, -0.42],
    [-0.025, -0.42],
    [-0.025, -0.15],
    [-0.19, -0.18],
    [-0.16, -0.08],
    [-0.35, 0.02],
    [-0.31, 0.08],
    [-0.38, 0.2],
    [-0.24, 0.18],
    [-0.27, 0.28],
    [-0.13, 0.2],
    [-0.16, 0.41],
    [-0.07, 0.36],
  ];
  return c.add(
    color,
    leaf.map(([x, y]) => [cx + x * s, cy + y * s]),
  );
}

/** The Canadian flag: red, white square, red, with the leaf; `w` = 2h. */
export function canadaFlag(c, x, y, w, h) {
  c.rect('#d52b1e', x, y, w / 4, h);
  c.rect('#ffffff', x + w / 4, y, w / 2, h);
  c.rect('#d52b1e', x + (3 * w) / 4, y, w / 4, h);
  return mapleLeaf(c, x + w / 2, y + h * 0.5, h * 0.82, '#d52b1e');
}

/** Royal Canadian Air Force roundel (blue ring, white, red maple leaf). */
export function rcafRoundel(c, cx, cy, r, { lowvis = false } = {}) {
  c.circle(lowvis ? '#4f585c' : '#1d3f8f', cx, cy, r);
  c.circle(lowvis ? '#7c8486' : '#ffffff', cx, cy, r * 0.62);
  return mapleLeaf(c, cx, cy + r * 0.02, r * 1.05, lowvis ? '#4f585c' : '#d52b1e');
}

/** The Japanese flag: red disc on white, 3:2. */
export function japanFlag(c, x, y, w, h) {
  c.rect('#ffffff', x, y, w, h);
  return c.circle('#bc002d', x + w / 2, y + h / 2, h * 0.3);
}

/** The Lithuanian flag: yellow, green, red. */
export function lithuaniaFlag(c, x, y, w, h) {
  return bands(c, x, y, w, h, ['#fdb913', '#006a44', '#c1272d']);
}

/** The Swedish flag: blue with a yellow Nordic cross. */
export function swedenFlag(c, x, y, w, h) {
  c.rect('#006aa7', x, y, w, h);
  c.rect('#fecc02', x + w * 0.31, y, h * 0.2, h);
  return c.rect('#fecc02', x, y + h * 0.4, w, h * 0.2);
}

/** The Norwegian flag: red with a white-fimbriated blue Nordic cross (22:16). */
export function norwayFlag(c, x, y, w, h) {
  c.rect('#ba0c2f', x, y, w, h);
  c.rect('#ffffff', x + w * 0.273, y, w * 0.182, h);
  c.rect('#ffffff', x, y + h * 0.375, w, h * 0.25);
  c.rect('#00205b', x + w * 0.318, y, w * 0.091, h);
  return c.rect('#00205b', x, y + h * 0.4375, w, h * 0.125);
}

/** The Danish flag: red with a white Nordic cross (37:28). */
export function denmarkFlag(c, x, y, w, h) {
  c.rect('#c8102e', x, y, w, h);
  c.rect('#ffffff', x + w * 0.324, y, w * 0.108, h);
  return c.rect('#ffffff', x, y + h * 0.43, w, h * 0.14);
}

/** The Mexican flag: green, white, red; the arms reduced to a plain brown and green device. */
export function mexicoFlag(c, x, y, w, h) {
  bars(c, x, y, w, h, ['#006847', '#ffffff', '#ce1126']);
  c.circle('#8c5a2b', x + w / 2, y + h * 0.53, h * 0.17, 24);
  return c.ring('#3f7a3a', x + w / 2, y + h * 0.5, h * 0.2, h * 0.25, 24);
}

/** Mexican military aircraft insignia: an inverted tricolour triangle, green outside. */
export function mexicoTriangle(c, cx, cy, s) {
  const tri = (size) => {
    const r = size / Math.sqrt(3);
    return [
      [cx - size / 2, cy + r / 2],
      [cx + size / 2, cy + r / 2],
      [cx, cy - r],
    ];
  };
  c.add('#006847', tri(s));
  c.add('#ffffff', tri(s * 0.66));
  return c.add('#ce1126', tri(s * 0.33));
}

/**
 * Lithuanian military aircraft marking: the double Cross of Vytis with flared arm ends,
 * `s` its height, filled `fill` inside an `outline` border.
 */
export function vytisCross(c, cx, cy, s, { fill = '#ffffff', outline = '#2b2f33' } = {}) {
  const u = s / 10,
    bars = [
      [cy + 2.3 * u, 2.5 * u],
      [cy - 0.9 * u, 3.5 * u],
    ];
  const draw = (color, pad) => {
    c.rect(color, cx - 0.4 * u - pad, cy - 5 * u - pad, 0.8 * u + 2 * pad, 10 * u + 2 * pad);
    for (const [y, half] of bars)
      c.rect(color, cx - half - pad, y - 0.4 * u - pad, 2 * half + 2 * pad, 0.8 * u + 2 * pad);
    // Each arm widens into a flared end over its last unit.
    const flare = (x, y, dx, dy) => {
      const nx = -dy,
        ny = dx,
        a = 0.4 * u + pad,
        b = 0.9 * u + pad,
        len = 1.1 * u;
      c.add(color, [
        [x - dx * len + nx * a, y - dy * len + ny * a],
        [x + dx * pad + nx * b, y + dy * pad + ny * b],
        [x + dx * pad - nx * b, y + dy * pad - ny * b],
        [x - dx * len - nx * a, y - dy * len - ny * a],
      ]);
    };
    flare(cx, cy + 5 * u, 0, 1);
    flare(cx, cy - 5 * u, 0, -1);
    for (const [y, half] of bars) {
      flare(cx + half, y, 1, 0);
      flare(cx - half, y, -1, 0);
    }
  };
  draw(outline, s * 0.04);
  draw(fill, 0);
  return c;
}

/** US Army Cavalry branch device: two crossed sabres, edges up, hilts low (original drawing). */
export function crossedSabres(c, cx, cy, s, color) {
  for (const dir of [-1, 1]) {
    const angle = dir * 0.62,
      cos = Math.cos(angle),
      sin = Math.sin(angle);
    // Curved blade as a polygon along an arc, a guard bar and a grip near the low end.
    const blade = [];
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const t = i / n - 0.5,
        bow = 0.06 * s * (1 - 4 * t * t);
      blade.push([t * s * 0.95, bow + 0.018 * s]);
    }
    for (let i = n; i >= 0; i--) {
      const t = i / n - 0.5,
        bow = 0.06 * s * (1 - 4 * t * t),
        taper = i === n ? 0 : 0.03 * s;
      blade.push([t * s * 0.95, bow - taper + 0.018 * s]);
    }
    const place = ([x, y]) => [cx + (x * cos - y * sin) * dir, cy + x * sin * dir + y * cos];
    c.add(color, blade.map(place));
    const hilt = (x, y, w, h) =>
      c.add(
        color,
        [
          [x - w / 2, y - h / 2],
          [x + w / 2, y - h / 2],
          [x + w / 2, y + h / 2],
          [x - w / 2, y + h / 2],
        ].map(place),
      );
    hilt(-0.47 * s, 0.01 * s, 0.02 * s, 0.11 * s);
    hilt(-0.53 * s, 0.01 * s, 0.1 * s, 0.035 * s);
  }
  return c;
}

/* ------------------------------------------------------------ placement helpers ---- */

/**
 * Two anchors mirrored across the centre line: `${name}-1` on the aircraft's left (+X) and
 * `${name}--1` on the right. `at(side)` returns the centre; `facing` is the left side's normal
 * (mirrored in x for the right); `slot` is a name or a function of the side.
 */
export function sidePair(space, name, { slot, at, facing = [1, 0, 0], up, width, height, depth }) {
  const out = {};
  for (const side of [1, -1]) {
    out[`${name}-${side}`] = space.anchor(typeof slot === 'function' ? slot(side) : slot, {
      center: at(side),
      facing: [facing[0] * side, facing[1], facing[2]],
      ...(up ? { up } : {}),
      width,
      height,
      depth,
    });
  }
  return out;
}

/** Markings for both anchors of a side pair; `flipRight` mirrors art that faces forward. */
export function both(name, graphic, flipRight = false) {
  return [
    { anchor: `${name}-1`, graphic },
    { anchor: `${name}--1`, graphic, ...(flipRight ? { flip: true } : {}) },
  ];
}

/** Art facing forward on both sides: drawn facing the reader's left (the nose on the left side). */
export function forward(name, graphic) {
  return [
    { anchor: `${name}-1`, graphic },
    { anchor: `${name}--1`, graphic, flip: true },
  ];
}

/** A Wikimedia Commons reference by file title. */
export function commons(title, file) {
  return {
    title,
    url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_')).replace(/%2F/g, '/')}`,
  };
}
