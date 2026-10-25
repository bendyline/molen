/** Font-backed, batched lettering shared by Node, workers and renderers. No DOM or GPU state. */
import { z } from 'zod';

/** Glyph coordinates and advance are in em units, Y up. Triangles face +Z. */
export interface VectorGlyph {
  advance: number;
  positions: number[];
  indices: number[];
}

/** Compiled outlines: fonts remain content supplied by the host, never embedded in library code. */
export interface VectorFont {
  format: 'molen/vector-font@1';
  id: string;
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  ascent: number;
  descent: number;
  lineHeight: number;
  glyphs: Record<string, VectorGlyph>;
  /** Keys are pairs of Unicode characters, including supplementary code points. */
  kerning: Record<string, number>;
}

export interface FontLibrary {
  defaultFont: string;
  fonts: Readonly<Record<string, VectorFont>>;
  /** Semantic roles, e.g. highway, sans, serif and mono. Values are font ids. */
  roles?: Readonly<Record<string, string>>;
}

const glyphSchema = z
  .strictObject({
    advance: z.number().finite().nonnegative().max(16),
    positions: z.array(z.number().finite().min(-16).max(16)).max(32768),
    indices: z.array(z.int().nonnegative()).max(98304),
  })
  .superRefine((glyph, ctx) => {
    if (
      glyph.positions.length % 2 ||
      glyph.indices.length % 3 ||
      glyph.indices.some((i) => i >= glyph.positions.length / 2)
    )
      ctx.addIssue({ code: 'custom', message: 'Invalid glyph triangle buffers' });
  });

export const vectorFontSchema: z.ZodType<VectorFont> = z
  .strictObject({
    format: z.literal('molen/vector-font@1'),
    id: z.string().min(1).max(100),
    family: z.string().min(1).max(100),
    weight: z.number().min(1).max(1000),
    style: z.enum(['normal', 'italic']),
    ascent: z.number().positive().max(16),
    descent: z.number().nonpositive().min(-16),
    lineHeight: z.number().positive().max(32),
    glyphs: z.record(
      z.string().refine((key) => Array.from(key).length === 1),
      glyphSchema,
    ),
    kerning: z.record(
      z.string().refine((key) => Array.from(key).length === 2),
      z.number().finite().min(-16).max(16),
    ),
  })
  .refine(
    (font) => Boolean(font.glyphs['?']) && Object.keys(font.glyphs).length <= 65536,
    'A font needs a ? replacement glyph and at most 65536 glyphs',
  );

const fontCatalogSchema = z.strictObject({
  format: z.literal('molen/font-catalog@1'),
  defaultFont: z.string().min(1),
  fonts: z.record(
    z.string().min(1),
    z.string().regex(/^(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9_./-]+\.json$/),
  ),
  roles: z.record(z.string(), z.string()).optional(),
});

/** Read catalog-relative font documents through the host's file/pack loader; never fetches URLs. */
export async function loadFontLibrary(
  catalog: unknown,
  read: (path: string) => Promise<unknown>,
): Promise<FontLibrary> {
  const doc = fontCatalogSchema.parse(catalog);
  const entries = await Promise.all(
    Object.entries(doc.fonts).map(async ([id, path]) => {
      if (path.startsWith('/')) throw new Error('Font paths must be catalog-relative');
      const font = vectorFontSchema.parse(await read(path));
      if (font.id !== id) throw new Error(`Font catalog id ${id} does not match ${font.id}`);
      return [id, font] as const;
    }),
  );
  const fonts = Object.fromEntries(entries);
  for (const id of [doc.defaultFont, ...Object.values(doc.roles ?? {})])
    if (!Object.hasOwn(fonts, id)) throw new Error(`Font catalog references missing font ${id}`);
  return { defaultFont: doc.defaultFont, fonts, ...(doc.roles ? { roles: doc.roles } : {}) };
}

export interface TextLayoutOptions {
  /** A font id or semantic role in the library. */
  font?: string;
  fallbackFonts?: readonly string[];
  /** Maximum em size in world units (default 1). Fitting never stretches glyphs. */
  size?: number;
  maxWidth?: number;
  maxHeight?: number;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'baseline' | 'center' | 'top';
  /** Additional advance in em units. */
  letterSpacing?: number;
  /** Baseline spacing in em units, default the face's lineHeight. */
  lineHeight?: number;
  overflow?: 'shrink' | 'ellipsis';
  /** Bounds CPU/geometry work; default 256, maximum 4096 Unicode characters. */
  maxCharacters?: number;
}

export interface TextMeshData {
  positions: Float32Array;
  indices: Uint32Array;
  /** The rendered text after normalization/length limiting/ellipsis. */
  text: string;
  width: number;
  height: number;
  missingGlyphs: string[];
  truncated: boolean;
}

interface Letter {
  font: VectorFont;
  glyph: VectorGlyph;
  char: string;
  x: number;
}

/** Proportional advances, pair kerning, fallback fonts, multiline alignment and uniform fitting. */
export function buildTextMesh(
  value: string,
  library: FontLibrary,
  options: TextLayoutOptions = {},
): TextMeshData {
  const resolve = (name: string): VectorFont => {
    const id = library.roles?.[name] ?? name;
    const font = Object.hasOwn(library.fonts, id) ? library.fonts[id] : undefined;
    if (!font) throw new Error(`Unknown font: ${name}`);
    return font;
  };
  const primary = resolve(options.font ?? library.defaultFont);
  const faces = [primary, ...(options.fallbackFonts ?? []).map(resolve)];
  const size = options.size ?? 1,
    spacing = options.letterSpacing ?? 0;
  const lineHeight = options.lineHeight ?? primary.lineHeight;
  const limit = options.maxCharacters ?? 256;
  for (const [key, v] of Object.entries({
    size,
    lineHeight,
    maxWidth: options.maxWidth,
    maxHeight: options.maxHeight,
  }))
    if (v !== undefined && (!Number.isFinite(v) || v <= 0))
      throw new Error(`${key} must be positive and finite`);
  if (!Number.isFinite(spacing) || spacing < 0 || spacing > 16)
    throw new Error('letterSpacing must be between 0 and 16 em');
  if (!Number.isInteger(limit) || limit < 1 || limit > 4096)
    throw new Error('maxCharacters must be 1–4096');
  const chars = Array.from(value.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, '    '));
  let truncated = chars.length > limit;
  if (truncated) chars.splice(Math.max(0, limit - 1), chars.length, '…');
  const missing = new Set<string>();
  const find = (char: string): { font: VectorFont; glyph: VectorGlyph; char: string } => {
    for (const font of faces) {
      if (Object.hasOwn(font.glyphs, char))
        return { font, glyph: font.glyphs[char] as VectorGlyph, char };
    }
    missing.add(char);
    return { font: primary, glyph: primary.glyphs['?'] as VectorGlyph, char: '?' };
  };
  const measure = (line: string): { letters: Letter[]; min: number; max: number } => {
    const letters: Letter[] = [];
    let cursor = 0,
      min = 0,
      max = 0;
    let previous: Letter | undefined;
    for (const char of line) {
      const next = find(char);
      if (previous)
        cursor +=
          spacing +
          (previous.font === next.font ? (next.font.kerning[previous.char + next.char] ?? 0) : 0);
      const letter = { ...next, x: cursor };
      letters.push(letter);
      for (let i = 0; i < next.glyph.positions.length; i += 2) {
        min = Math.min(min, cursor + (next.glyph.positions[i] as number));
        max = Math.max(max, cursor + (next.glyph.positions[i] as number));
      }
      cursor += next.glyph.advance;
      max = Math.max(max, cursor);
      previous = letter;
    }
    return { letters, min, max };
  };
  const lines = chars
    .join('')
    .split('\n')
    .map((line) => {
      if (
        options.overflow !== 'ellipsis' ||
        options.maxWidth === undefined ||
        (() => {
          const bounds = measure(line);
          return (bounds.max - bounds.min) * size <= (options.maxWidth as number);
        })()
      )
        return line;
      const letters = Array.from(line);
      const suffix = faces.some((font) => Object.hasOwn(font.glyphs, '…')) ? '…' : '...';
      // Bounded logarithmic fitting instead of repeatedly measuring every shorter prefix.
      let lo = 0,
        hi = letters.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const bounds = measure(letters.slice(0, mid).join('') + suffix);
        if ((bounds.max - bounds.min) * size <= options.maxWidth) lo = mid;
        else hi = mid - 1;
      }
      if (lo) {
        truncated = true;
        return letters.slice(0, lo).join('') + suffix;
      }
      truncated = true;
      return suffix;
    });
  // Only missing characters that survive ellipsis are reported.
  missing.clear();
  const measured = lines.map(measure);
  const width = Math.max(0, ...measured.map((line) => line.max - line.min));
  let bottom = 0,
    top = 0,
    hasInk = false;
  measured.forEach((line, row) => {
    for (const letter of line.letters)
      for (let i = 1; i < letter.glyph.positions.length; i += 2) {
        const y = (letter.glyph.positions[i] as number) - row * lineHeight;
        bottom = hasInk ? Math.min(bottom, y) : y;
        top = hasInk ? Math.max(top, y) : y;
        hasInk = true;
      }
  });
  const height = top - bottom;
  const scale = Math.min(
    size,
    options.maxWidth === undefined || width === 0 ? size : options.maxWidth / width,
    options.maxHeight === undefined || height === 0 ? size : options.maxHeight / height,
  );
  const yOffset =
    options.verticalAlign === 'center'
      ? -(top + bottom) / 2
      : options.verticalAlign === 'top'
        ? -top
        : 0;
  const positions: number[] = [],
    indices: number[] = [];
  measured.forEach((line, row) => {
    const xOffset =
      options.align === 'center'
        ? -(line.min + line.max) / 2
        : options.align === 'right'
          ? -line.max
          : -line.min;
    for (const letter of line.letters) {
      const base = positions.length / 3;
      for (let i = 0; i < letter.glyph.positions.length; i += 2)
        positions.push(
          (letter.x + (letter.glyph.positions[i] as number) + xOffset) * scale,
          ((letter.glyph.positions[i + 1] as number) - row * lineHeight + yOffset) * scale,
          0,
        );
      for (const index of letter.glyph.indices) indices.push(base + index);
    }
  });
  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    text: lines.join('\n'),
    width: width * scale,
    height: height * scale,
    missingGlyphs: [...missing],
    truncated,
  };
}
