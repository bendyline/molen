/**
 * Licensed font outlines as vector shapes: exterior model lettering and livery artwork.
 *
 * The fonts are pinned OFL files in the repository, parsed with opentype.js; no host font,
 * browser renderer or network is involved, so the output is byte-deterministic. Glyphs come
 * back as three.js Shapes (outer contours with their holes) in a y-up frame, laid out on one
 * line and placed by an alignment box, ready for ShapeGeometry or for flattening to polygons.
 */
import { readFileSync } from 'node:fs';
import * as T from 'three';
import opentype from 'three/addons/libs/opentype.module.js';

const FILES = {
  // Clear technical sans serif: stencils, registrations, military lettering.
  technical: '../../../content/earth/source/fonts/Overpass-SemiBold.ttf',
  // Lighter face for civil titles and fine print.
  regular: '../../../content/earth/source/fonts/Overpass-Regular.ttf',
  // Geometric, Futura-like: period aircraft and the house wordmark.
  geometric: '../../../content/entities/fonts/Jost-500-Medium.ttf',
  // Monospaced: serial blocks and codes that read best evenly spaced.
  mono: '../../../content/earth/source/fonts/OverpassMono-SemiBold.ttf',
};
const fonts = new Map();
/** The parsed font for a face id (cached). */
export function letteringFont(face = 'technical') {
  let font = fonts.get(face);
  if (!font) {
    const path = FILES[face];
    if (!path) throw new Error(`Unknown lettering face: ${face}`);
    const bytes = readFileSync(new URL(path, import.meta.url));
    font = opentype.parse(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    fonts.set(face, font);
  }
  return font;
}

/** One glyph path (opentype commands, y down) as y-up three.js Shapes with holes. */
function pathShapes(commands, dx, scale, dy) {
  const path = new T.ShapePath();
  const p = (x, y) => [(x + dx) * scale, -y * scale + dy];
  for (const c of commands) {
    if (c.type === 'M') path.moveTo(...p(c.x, c.y));
    else if (c.type === 'L') path.lineTo(...p(c.x, c.y));
    else if (c.type === 'Q') path.quadraticCurveTo(...p(c.x1, c.y1), ...p(c.x, c.y));
    else if (c.type === 'C') path.bezierCurveTo(...p(c.x1, c.y1), ...p(c.x2, c.y2), ...p(c.x, c.y));
  }
  // TrueType outer contours run clockwise in a y-up frame; holes run the other way.
  return path.toShapes(false);
}

/**
 * Lay out one line of text and return its glyph shapes in metres (or any unit).
 * `height` is the cap height (an H's height). `align` positions the line's box:
 * x in {left, center, right}, y in {baseline, middle} (middle centres the cap height on 0).
 * `tracking` adds space between letters as a fraction of the cap height.
 */
export function textShapes(
  label,
  { height = 1, face = 'technical', align = 'center', middle = true, tracking = 0 } = {},
) {
  const font = letteringFont(face);
  const cap = font.charToGlyph('H').getBoundingBox();
  const unitsPerCap = cap.y2 - cap.y1 || font.unitsPerEm * 0.7;
  const scale = height / unitsPerCap;
  const glyphs = font.stringToGlyphs(label);
  const advances = [];
  let width = 0;
  for (let i = 0; i < glyphs.length; i++) {
    let advance = glyphs[i].advanceWidth ?? 0;
    if (i < glyphs.length - 1) advance += font.getKerningValue(glyphs[i], glyphs[i + 1]) ?? 0;
    if (i < glyphs.length - 1) advance += tracking * unitsPerCap;
    advances.push(advance);
    width += i < glyphs.length - 1 ? advance : (glyphs[i].advanceWidth ?? 0);
  }
  const start = align === 'left' ? 0 : align === 'right' ? -width : -width / 2;
  const shapes = [];
  let x = start;
  for (let i = 0; i < glyphs.length; i++) {
    const commands = glyphs[i].getPath(0, 0, font.unitsPerEm).commands;
    // `middle` centres the cap height on y 0.
    if (commands.length) shapes.push(...pathShapes(commands, x, scale, middle ? -height / 2 : 0));
    x += advances[i];
  }
  return { shapes, width: width * scale, height };
}

/** Flatten shapes to polygons with holes: [{ points: [[x,y]...], holes: [[[x,y]...]] }]. */
export function shapePolygons(shapes, segments = 4) {
  return shapes.map((shape) => {
    const { shape: outer, holes } = shape.extractPoints(segments);
    const ring = (points) => {
      const out = points.map((v) => [v.x, v.y]);
      const first = out[0],
        last = out.at(-1);
      if (out.length > 1 && first[0] === last[0] && first[1] === last[1]) out.pop();
      return out;
    };
    return { points: ring(outer), holes: holes.map(ring) };
  });
}
