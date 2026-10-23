/** Three.js adapter and offline outline compiler for the shared font engine. */
import {
  buildTextMesh,
  type FontLibrary,
  type TextLayoutOptions,
  type VectorFont,
  type VectorGlyph,
  vectorFontSchema,
} from '@bendyline/molen-materials/text';
import * as THREE from 'three';
import { Font, type FontData } from 'three/addons/loaders/FontLoader.js';

export type {
  FontLibrary,
  TextLayoutOptions,
  TextMeshData,
  VectorFont,
  VectorGlyph,
} from '@bendyline/molen-materials/text';
export { buildTextMesh, loadFontLibrary, vectorFontSchema } from '@bendyline/molen-materials/text';

export interface CompileVectorFontOptions {
  id: string;
  /** Explicit subset, including ? and space. Default: every character in the typeface. */
  characters?: string;
  weight?: number;
  style?: 'normal' | 'italic';
  /** Segments per outline curve, 2–32; default 6 for medium-fi signage. */
  curveSegments?: number;
  /** Optional pair adjustments in em units from the source font's kerning tables. */
  kerning?: Record<string, number>;
}

/** Compile typeface JSON (including TTFLoader output) once, then store the result in a pack.
 * Node and browser compatible; no canvas or OS font dependency. Does not fetch a font.
 */
export function compileVectorFont(data: FontData, options: CompileVectorFontOptions): VectorFont {
  const segments = options.curveSegments ?? 6;
  if (!Number.isInteger(segments) || segments < 2 || segments > 32)
    throw new Error('curveSegments must be 2–32');
  const font = new Font(data);
  const glyphs: Record<string, VectorGlyph> = {};
  const round = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;
  for (const char of new Set(Array.from(options.characters ?? Object.keys(data.glyphs).join('')))) {
    const glyph = data.glyphs[char];
    if (!glyph) continue;
    const geometry = new THREE.ShapeGeometry(font.generateShapes(char, 1), segments);
    const position = geometry.getAttribute('position');
    const points: number[] = [];
    for (let i = 0; i < position.count; i++)
      points.push(round(position.getX(i)), round(position.getY(i)));
    glyphs[char] = {
      advance: round(glyph.ha / data.resolution),
      positions: points,
      indices: Array.from(geometry.index?.array ?? []),
    };
    geometry.dispose();
  }
  const metrics = data as FontData & { ascender?: number; descender?: number };
  return vectorFontSchema.parse({
    format: 'molen/vector-font@1',
    id: options.id,
    family: data.familyName,
    weight: options.weight ?? 400,
    style: options.style ?? 'normal',
    ascent: round((metrics.ascender ?? data.boundingBox.yMax) / data.resolution),
    descent: round((metrics.descender ?? data.boundingBox.yMin) / data.resolution),
    lineHeight: round(
      ((metrics.ascender ?? data.boundingBox.yMax) - (metrics.descender ?? data.boundingBox.yMin)) /
        data.resolution,
    ),
    glyphs,
    kerning: options.kerning ?? {},
  });
}

/** Caller owns/disposes the geometry and chooses its material, color, transform and batching. */
export function createTextGeometry(
  text: string,
  fonts: FontLibrary,
  options: TextLayoutOptions = {},
): THREE.BufferGeometry {
  const data = buildTextMesh(text, fonts, options);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.textLayout = {
    text: data.text,
    width: data.width,
    height: data.height,
    missingGlyphs: data.missingGlyphs,
    truncated: data.truncated,
  };
  return geometry;
}
