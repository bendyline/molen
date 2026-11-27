/**
 * Livery authoring kit: vector artwork for markings (real-font lettering, insignia, SVG paths)
 * and model-space helpers for anchors and paint zones. Everything is original vector drawing;
 * no reference image pixels. Output matches the `molen/fleet-liveries@1` livery schema.
 *
 * Artwork is drawn on a Canvas measured in metres (the projector's physical width and height,
 * origin bottom-left, y up) and normalized to the schema's 0..1 coordinates by `graphic()`.
 */
import * as T from 'three';
import { shapePolygons, textShapes } from '../lettering-outlines.mjs';

const round = (v) => Math.round(v * 10000) / 10000;

/** Sutherland–Hodgman clip of a ring to the unit box (in canvas units). */
function clipRing(points, width, height) {
  let out = points;
  for (const [axis, limit, keepAbove] of [
    [0, 0, true],
    [0, width, false],
    [1, 0, true],
    [1, height, false],
  ]) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i],
        b = input[(i + 1) % input.length];
      const ina = keepAbove ? a[axis] >= limit : a[axis] <= limit,
        inb = keepAbove ? b[axis] >= limit : b[axis] <= limit;
      if (ina) out.push(a);
      if (ina !== inb) {
        const t = (limit - a[axis]) / (b[axis] - a[axis]);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    if (out.length < 3) return [];
  }
  return out;
}

function circlePoints(cx, cy, r, segments = 48, start = 0) {
  return Array.from({ length: segments }, (_, i) => {
    const a = start + (i * Math.PI * 2) / segments;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

function starPoints(cx, cy, outer, inner, n = 5, rotation = 0) {
  return Array.from({ length: n * 2 }, (_, i) => {
    const a = rotation + Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 ? inner : outer;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

const reverse = (ring) => [...ring].reverse();

/** Minimal SVG path parser (M L H V C S Q T Z, absolute and relative; A approximated by lines). */
export function svgShapePath(d) {
  const path = new T.ShapePath();
  const tokens = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+\.?)(?:e-?\d+)?/g) ?? [];
  let i = 0,
    command = '',
    x = 0,
    y = 0,
    startX = 0,
    startY = 0,
    lastControl = null;
  const number = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) command = tokens[i++];
    const rel = command === command.toLowerCase() && command !== 'z' && command !== 'Z';
    const ox = rel ? x : 0,
      oy = rel ? y : 0;
    switch (command.toUpperCase()) {
      case 'M':
        x = ox + number();
        y = oy + number();
        path.moveTo(x, y);
        startX = x;
        startY = y;
        command = rel ? 'l' : 'L';
        lastControl = null;
        break;
      case 'L':
        x = ox + number();
        y = oy + number();
        path.lineTo(x, y);
        lastControl = null;
        break;
      case 'H':
        x = (rel ? x : 0) + number();
        path.lineTo(x, y);
        lastControl = null;
        break;
      case 'V':
        y = (rel ? y : 0) + number();
        path.lineTo(x, y);
        lastControl = null;
        break;
      case 'C': {
        const x1 = ox + number(),
          y1 = oy + number(),
          x2 = ox + number(),
          y2 = oy + number();
        x = ox + number();
        y = oy + number();
        path.bezierCurveTo(x1, y1, x2, y2, x, y);
        lastControl = [x2, y2];
        break;
      }
      case 'S': {
        const x1 = lastControl ? 2 * x - lastControl[0] : x,
          y1 = lastControl ? 2 * y - lastControl[1] : y;
        const x2 = ox + number(),
          y2 = oy + number();
        x = ox + number();
        y = oy + number();
        path.bezierCurveTo(x1, y1, x2, y2, x, y);
        lastControl = [x2, y2];
        break;
      }
      case 'Q': {
        const x1 = ox + number(),
          y1 = oy + number();
        x = ox + number();
        y = oy + number();
        path.quadraticCurveTo(x1, y1, x, y);
        lastControl = [x1, y1];
        break;
      }
      case 'T': {
        const x1 = lastControl ? 2 * x - lastControl[0] : x,
          y1 = lastControl ? 2 * y - lastControl[1] : y;
        x = ox + number();
        y = oy + number();
        path.quadraticCurveTo(x1, y1, x, y);
        lastControl = [x1, y1];
        break;
      }
      case 'A': {
        // Endpoint arc approximated by its chord midpoint bulge: rare in our artwork.
        i += 5;
        x = ox + number();
        y = oy + number();
        path.lineTo(x, y);
        lastControl = null;
        break;
      }
      case 'Z':
        x = startX;
        y = startY;
        path.currentPath?.closePath?.();
        lastControl = null;
        break;
      default:
        throw new Error(`Unsupported SVG path command ${command}`);
    }
  }
  return path;
}

/** Artwork on a canvas in metres; `graphic()` normalizes it for the livery schema. */
export class Canvas {
  constructor(width, height) {
    if (!(width > 0 && height > 0)) throw new Error('Canvas needs a positive size');
    this.width = width;
    this.height = height;
    this.shapes = [];
  }
  /** One flat shape: an outer ring and holes, in canvas units. */
  add(color, points, holes = []) {
    this.shapes.push({ color, points, holes });
    return this;
  }
  rect(color, x, y, w, h) {
    return this.add(color, [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ]);
  }
  /** A rectangle rotated about its centre by `angle` radians. */
  box(color, cx, cy, w, h, angle = 0) {
    const c = Math.cos(angle),
      s = Math.sin(angle);
    return this.add(
      color,
      [
        [-w / 2, -h / 2],
        [w / 2, -h / 2],
        [w / 2, h / 2],
        [-w / 2, h / 2],
      ].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]),
    );
  }
  circle(color, cx, cy, r, segments = 64) {
    return this.add(color, circlePoints(cx, cy, r, segments));
  }
  /** An annulus: outer radius r1, inner r0. */
  ring(color, cx, cy, r0, r1, segments = 64) {
    return this.add(color, circlePoints(cx, cy, r1, segments), [
      reverse(circlePoints(cx, cy, r0, segments)),
    ]);
  }
  star(color, cx, cy, outer, inner = outer * 0.382, n = 5, rotation = 0) {
    return this.add(color, starPoints(cx, cy, outer, inner, n, rotation));
  }
  /** Shapes from three.js Shape objects positioned by a transform function. */
  shapesFrom(color, shapes, map = (p) => p, segments = 4) {
    for (const { points, holes } of shapePolygons(shapes, segments))
      this.add(
        color,
        points.map(map),
        holes.map((h) => h.map(map)),
      );
    return this;
  }
  /**
   * Lettering in a licensed font. `x`, `y` place the line's anchor; `height` is the cap height;
   * `align` left/center/right; `maxWidth` condenses a line that would run longer.
   */
  text(
    color,
    label,
    { x, y, height, face = 'technical', align = 'center', tracking = 0, maxWidth, slant = 0 },
  ) {
    const { shapes, width } = textShapes(label, { height, face, align, tracking });
    const squeeze = maxWidth && width > maxWidth ? maxWidth / width : 1;
    return this.shapesFrom(color, shapes, ([px, py]) => [x + px * squeeze + py * slant, y + py]);
  }
  /** SVG path data drawn into a box: viewBox [vx, vy, vw, vh] maps onto (x, y, w, h). */
  path(color, d, { viewBox, x, y, w, h, flipY = true, segments = 8 }) {
    const [vx, vy, vw, vh] = viewBox;
    const shapes = svgShapePath(d).toShapes(!flipY);
    return this.shapesFrom(
      color,
      shapes,
      ([px, py]) => [
        x + ((px - vx) / vw) * w,
        flipY ? y + h - ((py - vy) / vh) * h : y + ((py - vy) / vh) * h,
      ],
      segments,
    );
  }
  /** Normalized artwork for the schema, clipped to the canvas, rounded to 1e-4. */
  graphic(label) {
    const shapes = [];
    for (const shape of this.shapes) {
      const outer = clipRing(shape.points, this.width, this.height);
      if (outer.length < 3) continue;
      const norm = (ring) => ring.map(([x, y]) => [round(x / this.width), round(y / this.height)]);
      const holes = shape.holes
        .map((h) => clipRing(h, this.width, this.height))
        .filter((h) => h.length >= 3)
        .map(norm);
      shapes.push({ color: shape.color, points: norm(outer), ...(holes.length ? { holes } : {}) });
    }
    if (!shapes.length) throw new Error(`${label ?? 'graphic'}: no artwork inside the canvas`);
    return { ...(label ? { label } : {}), shapes };
  }
}

/* ---------------------------------------------------------------- national insignia ---- */

/**
 * United States national insignia: white star in a blue disc with white side bars carrying a
 * red stripe, all in a thin blue border (the 1947 pattern). `r` is the disc radius; the whole
 * mark is 4r wide. `style: 'lowvis'` draws only outlines in `color` (tactical gray schemes).
 */
export function usInsignia(c, cx, cy, r, { style = 'full', color = '#47515a', stroke } = {}) {
  const blue = '#203a74',
    red = '#b22234',
    white = '#ffffff';
  const barH = r * 0.5,
    border = r / 8;
  // Silhouette of disc plus bars (optionally inset): arcs above and below the bars, bar ends.
  const silhouette = (inset) => {
    const R = r + border - inset,
      half = barH / 2 + border - inset,
      L = 2 * r + border - inset;
    const a0 = Math.asin(Math.min(1, half / R));
    const pts = [];
    pts.push([cx + L, cy - half], [cx + L, cy + half]);
    for (let i = 0; i <= 40; i++) {
      const a = a0 + ((Math.PI - 2 * a0) * i) / 40;
      pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
    }
    pts.push([cx - L, cy + half], [cx - L, cy - half]);
    for (let i = 0; i <= 40; i++) {
      const a = Math.PI + a0 + ((Math.PI - 2 * a0) * i) / 40;
      pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
    }
    return pts;
  };
  const star = (scale) => starPoints(cx, cy, r * scale, r * scale * 0.382);
  if (style === 'lowvis') {
    const t = stroke ?? r * 0.09;
    c.add(color, silhouette(border), [reverse(silhouette(border + t))]);
    c.add(color, star(1), [reverse(star(1 - t / r / 0.55))]);
    // The stripe lines inside the bars.
    for (const side of [-1, 1]) c.rect(color, side > 0 ? cx + r : cx - 2 * r, cy - t / 2, r, t);
    return c;
  }
  c.add(blue, silhouette(0));
  c.rect(white, cx - 2 * r, cy - barH / 2, 4 * r, barH);
  c.circle(blue, cx, cy, r);
  for (const side of [-1, 1]) c.rect(red, side > 0 ? cx + r : cx - 2 * r, cy - r / 12, r, r / 6);
  c.add(white, star(1));
  return c;
}

/** Concentric roundel: `rings` lists colors from the outside in, equal widths unless given. */
export function roundel(c, cx, cy, r, rings, widths) {
  const w = widths ?? rings.map(() => 1 / rings.length);
  let outer = r;
  rings.forEach((color, k) => {
    const inner = Math.max(0, outer - r * w[k]);
    if (k === rings.length - 1 || inner <= 0) c.circle(color, cx, cy, outer);
    else c.ring(color, cx, cy, inner, outer);
    outer = inner;
  });
  return c;
}

/** Common roundels by air arm; colors outside in (approximate standard shades). */
export const ROUNDELS = {
  raf: ['#2a3f87', '#ffffff', '#c8102e'],
  rafLowVis: ['#5b7aa6', '#c97a83'],
  france: ['#c8102e', '#ffffff', '#1e3a8a'],
  italy: ['#0e8a3e', '#ffffff', '#ce2b37'],
  netherlands: ['#ae1c28', '#ffffff', '#21468b'],
  belgium: ['#ef3340', '#fdda24', '#111111'],
  norway: ['#ba0c2f', '#ffffff', '#00205b'],
  denmark: ['#c8102e', '#ffffff', '#c8102e'],
  portugalLike: ['#0e6b3a', '#c8102e'],
  spain: ['#c60b1e', '#ffc400', '#c60b1e'],
  hungary: ['#cd2a3e', '#ffffff', '#436f4d'],
  india: ['#ff9933', '#ffffff', '#138808'],
  greece: ['#0d5eaf', '#ffffff', '#0d5eaf'],
  turkey: ['#e30a17', '#ffffff', '#e30a17'],
  egypt: ['#ce1126', '#ffffff', '#111111'],
  brazil: ['#009c3b', '#ffdf00', '#002776'],
};

/** German Balkenkreuz: black cross with white edges (modern Luftwaffe). */
export function balkenkreuz(c, cx, cy, s, { lowvis = false } = {}) {
  const arm = s / 2,
    w = s * 0.18,
    edge = s * 0.06;
  const black = lowvis ? '#3f474d' : '#111111';
  const cross = (half, width) => [
    [cx - width / 2, cy - half],
    [cx + width / 2, cy - half],
    [cx + width / 2, cy - width / 2],
    [cx + half, cy - width / 2],
    [cx + half, cy + width / 2],
    [cx + width / 2, cy + width / 2],
    [cx + width / 2, cy + half],
    [cx - width / 2, cy + half],
    [cx - width / 2, cy + width / 2],
    [cx - half, cy + width / 2],
    [cx - half, cy - width / 2],
    [cx - width / 2, cy - width / 2],
  ];
  if (!lowvis) c.add('#ffffff', cross(arm, w + 2 * edge));
  c.add(black, cross(arm - (lowvis ? 0 : edge), w));
  return c;
}

/** Swedish Air Force roundel: three yellow open crowns on a blue disc with a yellow rim. */
export function swedenRoundel(c, cx, cy, r, { lowvis = false } = {}) {
  const blue = lowvis ? '#5c6670' : '#005b99',
    gold = lowvis ? '#8a9198' : '#fecc02';
  c.circle(gold, cx, cy, r);
  c.circle(blue, cx, cy, r * 0.9);
  const crown = (x, y, s) => {
    // Simplified heraldic crown: band, three points with balls, arch.
    c.rect(gold, x - s * 0.5, y - s * 0.32, s, s * 0.18);
    c.add(gold, [
      [x - s * 0.5, y - s * 0.14],
      [x + s * 0.5, y - s * 0.14],
      [x + s * 0.45, y + s * 0.2],
      [x + s * 0.25, y + 0.02 * s],
      [x, y + s * 0.3],
      [x - s * 0.25, y + 0.02 * s],
      [x - s * 0.45, y + s * 0.2],
    ]);
    for (const dx of [-0.45, 0, 0.45])
      c.circle(gold, x + dx * s, y + (dx ? 0.25 : 0.36) * s, s * 0.07, 12);
  };
  const s = r * 0.62;
  crown(cx - r * 0.38, cy + r * 0.22, s);
  crown(cx + r * 0.38, cy + r * 0.22, s);
  crown(cx, cy - r * 0.38, s);
  return c;
}

/** Swiss marking: white cross on a red square. */
export function swissMark(c, cx, cy, s) {
  c.rect('#d52b1e', cx - s / 2, cy - s / 2, s, s);
  const arm = s * 0.6,
    w = s * 0.2;
  c.rect('#ffffff', cx - w / 2, cy - arm / 2, w, arm);
  c.rect('#ffffff', cx - arm / 2, cy - w / 2, arm, w);
  return c;
}

/** Japanese hinomaru: red disc in a white border. */
export function hinomaru(c, cx, cy, r) {
  c.circle('#ffffff', cx, cy, r);
  c.circle('#bc002d', cx, cy, r * 0.82);
  return c;
}

/** Israeli Air Force: blue Star of David in a white disc. */
export function israelMark(c, cx, cy, r) {
  c.circle('#ffffff', cx, cy, r);
  const t = r * 0.16,
    o = r * 0.78;
  const tri = (rot, size) =>
    [0, 1, 2].map((k) => {
      const a = rot + Math.PI / 2 + (k * Math.PI * 2) / 3;
      return [cx + Math.cos(a) * size, cy + Math.sin(a) * size];
    });
  for (const rot of [0, Math.PI]) c.add('#0038b8', tri(rot, o), [reverse(tri(rot, o - 2 * t))]);
  return c;
}

/** Red star with white and blue borders (Russian Air Force pattern). */
export function russianStar(c, cx, cy, r) {
  c.star('#1c3f94', cx, cy, r, r * 0.42);
  c.star('#ffffff', cx, cy, r * 0.9, r * 0.38);
  c.star('#d52b1e', cx, cy, r * 0.78, r * 0.32);
  return c;
}

/** Royal Australian Air Force: red kangaroo in a white disc ringed blue (original outline). */
export function australiaRoundel(c, cx, cy, r, { lowvis = false } = {}) {
  c.circle(lowvis ? '#5a6772' : '#00247d', cx, cy, r);
  c.circle(lowvis ? '#9aa3aa' : '#ffffff', cx, cy, r * 0.66);
  const k = r * 0.6;
  // A bounding kangaroo silhouette: tail, legs, body, head and ears, facing left.
  const kangaroo = [
    [0.62, -0.1],
    [0.3, -0.18],
    [0.12, -0.42],
    [-0.08, -0.46],
    [0.02, -0.3],
    [-0.12, -0.2],
    [-0.28, -0.05],
    [-0.34, 0.12],
    [-0.42, 0.18],
    [-0.5, 0.3],
    [-0.4, 0.36],
    [-0.36, 0.46],
    [-0.3, 0.36],
    [-0.2, 0.34],
    [-0.12, 0.2],
    [0.08, 0.16],
    [0.26, 0.02],
    [0.42, -0.02],
  ].map(([x, y]) => [cx + x * k, cy + y * k]);
  c.add(lowvis ? '#3f474d' : '#c8102e', kangaroo);
  return c;
}

/** Royal Canadian Air Force: red maple leaf in a white disc in a blue ring (original outline). */
export function canadaRoundel(c, cx, cy, r) {
  c.circle('#1c3f94', cx, cy, r);
  c.circle('#ffffff', cx, cy, r * 0.66);
  const k = r * 0.55;
  const leaf = [
    [0, 0.95],
    [0.12, 0.68],
    [0.3, 0.76],
    [0.24, 0.42],
    [0.5, 0.56],
    [0.44, 0.38],
    [0.7, 0.4],
    [0.56, 0.18],
    [0.62, 0.08],
    [0.28, -0.12],
    [0.34, -0.3],
    [0.04, -0.24],
    [0.04, -0.7],
    [-0.04, -0.7],
    [-0.04, -0.24],
    [-0.34, -0.3],
    [-0.28, -0.12],
    [-0.62, 0.08],
    [-0.56, 0.18],
    [-0.7, 0.4],
    [-0.44, 0.38],
    [-0.5, 0.56],
    [-0.24, 0.42],
    [-0.3, 0.76],
    [-0.12, 0.68],
  ].map(([x, y]) => [cx + x * k, cy + y * k]);
  c.add('#d52b1e', leaf);
  return c;
}

/** Finnish Air Force roundel: blue disc on white. */
export function finlandRoundel(c, cx, cy, r) {
  c.circle('#ffffff', cx, cy, r);
  c.circle('#002f6c', cx, cy, r * 0.8);
  c.circle('#ffffff', cx, cy, r * 0.62);
  return c;
}

/**
 * Polish Air Force checkerboard, 1993 pattern (as photographed on both sides of MiG-29s): white
 * top-left and bottom-right, red top-right and bottom-left, each square edged in the opposite
 * color along the outside of the mark. `s` is the full side.
 */
export function polandMark(c, cx, cy, s) {
  const red = '#d4213d',
    white = '#f4f2ee',
    q = s / 2,
    e = s * 0.07;
  for (const [i, j, fill] of [
    [0, 1, white],
    [1, 1, red],
    [0, 0, red],
    [1, 0, white],
  ]) {
    const x = cx - q + i * q,
      y = cy - q + j * q;
    c.rect(fill === white ? red : white, x, y, q, q);
    const left = i === 0 ? e : 0,
      right = i === 1 ? e : 0,
      bottom = j === 0 ? e : 0,
      top = j === 1 ? e : 0;
    c.rect(fill, x + left, y + bottom, q - left - right, q - bottom - top);
  }
  return c;
}

/** Republic of Korea Air Force: taegeuk in a white disc, blue ring. */
export function koreaRoundel(c, cx, cy, r) {
  c.circle('#0047a0', cx, cy, r);
  c.circle('#ffffff', cx, cy, r * 0.8);
  const t = r * 0.56;
  c.circle('#cd2e3a', cx, cy, t);
  // Lower half blue with the two interlocking lobes.
  const half = Array.from({ length: 33 }, (_, i) => {
    const a = Math.PI + (i * Math.PI) / 32;
    return [cx + Math.cos(a) * t, cy + Math.sin(a) * t];
  });
  c.add('#0047a0', half);
  c.circle('#0047a0', cx + t / 2, cy, t / 2, 32);
  c.circle('#cd2e3a', cx - t / 2, cy, t / 2, 32);
  return c;
}

/* ---------------------------------------------------------------- common art ---- */

/** A horizontal band of chevrons or checks across a canvas strip (tail bands, nose checks). */
export function checks(c, x, y, w, h, colors, columns, rows = 2) {
  const cw = w / columns,
    ch = h / rows;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < columns; i++)
      c.rect(colors[(i + j) % colors.length], x + i * cw, y + j * ch, cw, ch);
  return c;
}

/* ---------------------------------------------------------------- model space ---- */

/**
 * Model-space helpers bound to one model's slot bounds (from build-aircraft-liveries.mjs).
 * Anchors and zone planes are authored in metres in the model frame (+Z nose, +X left, +Y up)
 * and converted to the schema's slot-relative fractions here.
 */
export function modelSpace(bounds) {
  const box = (slot) => {
    const b = bounds[slot];
    if (!b) throw new Error(`Unknown or empty paint slot ${slot}`);
    return b;
  };
  return {
    bounds,
    /**
     * A projector: `center` on the surface, `facing` out of it, `up` the artwork's up,
     * `width`/`height` of the artwork and `depth` of the projection (metres).
     */
    anchor(slot, { center, facing, up = [0, 1, 0], width, height, depth = 0.4 }) {
      const { min, max } = box(slot);
      const extent = max.map((v, i) => v - min[i]);
      const longest = Math.max(...extent);
      const z = new T.Vector3(...facing).normalize();
      const y = new T.Vector3(...up);
      y.sub(z.clone().multiplyScalar(y.dot(z))).normalize();
      const x = new T.Vector3().crossVectors(y, z);
      const euler = new T.Euler().setFromRotationMatrix(new T.Matrix4().makeBasis(x, y, z));
      return {
        slot,
        position: center.map((v, i) => round((v - min[i]) / (extent[i] || 1))),
        size: [width, height, depth].map((v) => round(v / longest)),
        rotation: [euler.x, euler.y, euler.z].map(round),
      };
    },
    /** A half-space: the side of a plane through `point` that `normal` points into. */
    plane(slot, normal, point) {
      const { min, max } = box(slot);
      const extent = max.map((v, i) => v - min[i]);
      return {
        normal: normal.map((v, i) => round(v * extent[i])),
        offset: round(normal.reduce((s, v, i) => s + v * (point[i] - min[i]), 0)),
      };
    },
    /** Shorthands: everything above / below a height, ahead of / behind a station. */
    above(slot, y) {
      return this.plane(slot, [0, 1, 0], [0, y, 0]);
    },
    below(slot, y) {
      return this.plane(slot, [0, -1, 0], [0, y, 0]);
    },
    ahead(slot, z) {
      return this.plane(slot, [0, 0, 1], [0, 0, z]);
    },
    behind(slot, z) {
      return this.plane(slot, [0, 0, -1], [0, 0, z]);
    },
    /** A line in the side view from (z0, y0) to (z1, y1): points above it (`side` 1) or below. */
    sideLine(slot, [z0, y0], [z1, y1], side = 1) {
      const dz = z1 - z0,
        dy = y1 - y0;
      // Normal perpendicular to the line in the y-z plane, pointing up for side 1.
      let n = [0, dz, -dy];
      if (n[1] < 0) n = n.map((v) => -v);
      return this.plane(
        slot,
        n.map((v) => v * side),
        [0, y0, z0],
      );
    },
  };
}
