// Glyph atlases for world lettering (molen/glyph-atlas@1): signed distance fields rasterized from
// licensed font outlines with plain arithmetic, so the bytes are identical on every OS and CPU.
// No canvas, WASM rasterizer or system font. Used by scripts/build-fonts.mjs.

/** Line segments per quadratic and cubic curve: plenty at the sizes an atlas is drawn at. */
const QUAD_STEPS = 8;
const CUBIC_STEPS = 12;
/** Empty texels between packed glyphs, so filtering never reads a neighbor's ink. */
const GUTTER = 1;

/** Outline of one glyph as closed polylines, in texels, Y down (opentype's path convention). */
function contours(glyph, emSize) {
  const path = glyph.getPath(0, 0, emSize);
  const out = [];
  let current = [],
    x = 0,
    y = 0;
  const close = () => {
    if (current.length > 2) out.push(current);
    current = [];
  };
  for (const c of path.commands) {
    if (c.type === 'M') {
      close();
      current.push([c.x, c.y]);
    } else if (c.type === 'L') current.push([c.x, c.y]);
    else if (c.type === 'Q') {
      for (let i = 1; i <= QUAD_STEPS; i++) {
        const t = i / QUAD_STEPS,
          u = 1 - t;
        current.push([
          u * u * x + 2 * u * t * c.x1 + t * t * c.x,
          u * u * y + 2 * u * t * c.y1 + t * t * c.y,
        ]);
      }
    } else if (c.type === 'C') {
      for (let i = 1; i <= CUBIC_STEPS; i++) {
        const t = i / CUBIC_STEPS,
          u = 1 - t;
        const a = u * u * u,
          b = 3 * u * u * t,
          d = 3 * u * t * t,
          e = t * t * t;
        current.push([
          a * x + b * c.x1 + d * c.x2 + e * c.x,
          a * y + b * c.y1 + d * c.y2 + e * c.y,
        ]);
      }
    } else if (c.type === 'Z') close();
    if (c.type !== 'Z') {
      x = c.x;
      y = c.y;
    }
  }
  close();
  return out;
}

/** Distance field of one glyph into a `w x h` byte image; origin is the image's (0,0) texel corner. */
function distanceField(polys, ox, oy, w, h, range) {
  const segments = [];
  for (const poly of polys)
    for (let i = 0; i < poly.length; i++) {
      const [ax, ay] = poly[i];
      const [bx, by] = poly[(i + 1) % poly.length];
      if (ax === bx && ay === by) continue;
      segments.push([ax - ox, ay - oy, bx - ox, by - oy]);
    }
  const image = new Uint8Array(w * h);
  const reach = range + 1;
  for (let j = 0; j < h; j++) {
    const py = j + 0.5;
    // Crossings of this row's ray, for the nonzero winding rule.
    for (let i = 0; i < w; i++) {
      const px = i + 0.5;
      let best = reach * reach,
        winding = 0;
      for (const [ax, ay, bx, by] of segments) {
        if (ay <= py !== by <= py) {
          const cx = ax + ((py - ay) * (bx - ax)) / (by - ay);
          if (cx > px) winding += by > ay ? 1 : -1;
        }
        if (
          (ax < bx ? ax : bx) - reach > px ||
          (ax > bx ? ax : bx) + reach < px ||
          (ay < by ? ay : by) - reach > py ||
          (ay > by ? ay : by) + reach < py
        )
          continue;
        const dx = bx - ax,
          dy = by - ay;
        let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = ax + t * dx - px,
          ey = ay + t * dy - py;
        const squared = ex * ex + ey * ey;
        if (squared < best) best = squared;
      }
      const distance = Math.sqrt(best) * (winding !== 0 ? 1 : -1);
      const value = Math.round(127.5 + (127.5 * distance) / range);
      image[j * w + i] = value < 0 ? 0 : value > 255 ? 255 : value;
    }
  }
  return image;
}

const round = (value, places = 6) => {
  const scale = places === 6 ? 1e6 : 1e4;
  const result = Math.round(value * scale) / scale;
  return result === 0 ? 0 : result;
};

/**
 * Build a glyph atlas document and its pages.
 *
 * faces: [{ id, font (opentype.Font), family, weight, style?, characters (string), kerning?
 * (string of characters whose pairs keep their kerning) }]
 * Returns { doc, pages: Uint8Array[] }; `doc.pages[i].path` is `${pagePrefix}.${i}.r8`.
 */
export function buildGlyphAtlas({
  id,
  faces,
  emSize,
  distanceRange,
  pageWidth = 2048,
  maxPageHeight = 2048,
  pagePrefix,
  defaultFace,
  roles,
}) {
  const padding = Math.ceil(distanceRange) + 1;
  const glyphs = [];
  const docFaces = {};
  for (const spec of faces) {
    const { font } = spec;
    const upm = font.unitsPerEm;
    const capGlyph = font.charToGlyph('H');
    const capBox = capGlyph.getBoundingBox();
    const hhea = font.tables.hhea;
    const face = {
      family: spec.family,
      weight: spec.weight,
      style: spec.style ?? 'normal',
      ascent: round(hhea.ascender / upm),
      descent: round(hhea.descender / upm),
      lineHeight: round((hhea.ascender - hhea.descender + hhea.lineGap) / upm),
      capHeight: round(
        capGlyph.index > 0 ? capBox.y2 / upm : (font.tables.os2?.sCapHeight ?? 0.7 * upm) / upm,
      ),
      glyphs: {},
    };
    const chars = Array.from(new Set(Array.from(spec.characters))).sort(
      (a, b) => a.codePointAt(0) - b.codePointAt(0),
    );
    for (const char of chars) {
      const glyph = font.charToGlyph(char);
      if (glyph.index === 0 && char !== ' ') continue;
      const advance = round(glyph.advanceWidth / upm);
      const polys = contours(glyph, emSize);
      if (polys.length === 0) {
        face.glyphs[char] = [advance];
        continue;
      }
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const poly of polys)
        for (const [x, y] of poly) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      const x0 = Math.floor(minX) - padding,
        y0 = Math.floor(minY) - padding;
      const w = Math.ceil(maxX) + padding - x0,
        h = Math.ceil(maxY) + padding - y0;
      glyphs.push({
        face: spec.id,
        char,
        advance,
        x0,
        y0,
        w,
        h,
        image: distanceField(polys, x0, y0, w, h, distanceRange),
      });
    }
    if (spec.kerning) {
      const kerning = {};
      const pairs = Array.from(spec.kerning).filter((char) => font.charToGlyph(char).index > 0);
      for (const left of pairs)
        for (const right of pairs) {
          const amount = font.getKerningValue(font.charToGlyph(left), font.charToGlyph(right));
          const em = round(amount / upm, 4);
          if (Math.abs(em) >= 0.005) kerning[left + right] = em;
        }
      if (Object.keys(kerning).length > 0) face.kerning = kerning;
    }
    docFaces[spec.id] = face;
  }
  // Shelf packing, tallest first, so rows waste little height. Ties keep face and code point order.
  const order = glyphs
    .map((glyph, index) => ({ glyph, index }))
    .sort((a, b) => b.glyph.h - a.glyph.h || a.index - b.index);
  const pages = [];
  let page = 0,
    x = 0,
    y = 0,
    shelf = 0;
  for (const { glyph } of order) {
    if (glyph.w + GUTTER > pageWidth) throw new Error(`glyph ${glyph.char} is wider than a page`);
    if (x + glyph.w + GUTTER > pageWidth) {
      x = 0;
      y += shelf + GUTTER;
      shelf = 0;
    }
    if (y + glyph.h + GUTTER > maxPageHeight) {
      pages.push(y);
      page++;
      x = 0;
      y = 0;
      shelf = 0;
    }
    glyph.page = page;
    glyph.px = x + GUTTER;
    glyph.py = y + GUTTER;
    x += glyph.w + GUTTER;
    shelf = Math.max(shelf, glyph.h);
  }
  pages.push(y + shelf);
  // Page heights round up to 16 rows: whole blocks for compressed mip levels on every GPU.
  const heights = pages.map((used) => Math.max(16, Math.ceil((used + GUTTER) / 16) * 16));
  const images = heights.map((height) => new Uint8Array(pageWidth * height));
  for (const glyph of glyphs) {
    const image = images[glyph.page];
    for (let row = 0; row < glyph.h; row++)
      image.set(
        glyph.image.subarray(row * glyph.w, (row + 1) * glyph.w),
        (glyph.py + row) * pageWidth + glyph.px,
      );
    // Plane box in em, Y up, exactly the texel rectangle.
    docFaces[glyph.face].glyphs[glyph.char] = [
      glyph.advance,
      round(glyph.x0 / emSize),
      round(-(glyph.y0 + glyph.h) / emSize),
      round((glyph.x0 + glyph.w) / emSize),
      round(-glyph.y0 / emSize),
      glyph.page,
      glyph.px,
      glyph.py,
      glyph.px + glyph.w,
      glyph.py + glyph.h,
    ];
  }
  // Glyph maps in code point order, so documents diff and hash stably.
  for (const face of Object.values(docFaces)) {
    face.glyphs = Object.fromEntries(
      Object.entries(face.glyphs).sort((a, b) => a[0].codePointAt(0) - b[0].codePointAt(0)),
    );
  }
  const doc = {
    format: 'molen/glyph-atlas@1',
    id,
    emSize,
    distanceRange,
    padding,
    pages: heights.map((height, index) => ({
      path: `${pagePrefix}.${index}.r8`,
      width: pageWidth,
      height,
    })),
    defaultFace,
    faces: docFaces,
    ...(roles ? { roles } : {}),
  };
  return { doc, pages: images };
}
