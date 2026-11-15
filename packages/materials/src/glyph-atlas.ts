/**
 * Glyph atlases: letters drawn from one shared distance-field texture, two triangles each,
 * instead of triangulated outlines. A `molen/glyph-atlas@1` document carries the metrics (small,
 * plain data a worker can lay text out with) and names its pages, raw 8-bit images the renderer
 * uploads once. Documents from several packs combine into one set, pages stacked top to bottom in
 * one texture, so a region pack can add the letters its place names use. No DOM, canvas, GPU
 * state or system font is involved, and layout is plain arithmetic, identical in every runtime.
 */
import { z } from 'zod';

/**
 * One glyph: `[advance]` for a glyph with no ink (a space), otherwise
 * `[advance, left, bottom, right, top, page, x0, y0, x1, y1]`. Advance and the plane box are in
 * em, from the pen on the baseline with Y up; the box is exactly the texel rectangle
 * `[x0, x1) × [y0, y1)` on `page` (row 0 is the page's first row, the glyph's top at `y0`),
 * including the distance field's padding around the ink.
 */
export type GlyphAtlasGlyph = number[];

export interface GlyphAtlasFace {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  /** Font-wide metrics in em. */
  ascent: number;
  descent: number;
  lineHeight: number;
  capHeight: number;
  glyphs: Record<string, GlyphAtlasGlyph>;
  /** Pair adjustments in em; keys are two characters. */
  kerning?: Record<string, number>;
}

export interface GlyphAtlasPage {
  /** Raw 8-bit distance values, `width * height` bytes, relative to the document's own path. */
  path: string;
  width: number;
  height: number;
}

export interface GlyphAtlasDoc {
  format: 'molen/glyph-atlas@1';
  id: string;
  /** Texels per em at which the glyphs were rasterized. */
  emSize: number;
  /** Texels of signed distance across the byte range: 128 is the outline, 255 that far inside. */
  distanceRange: number;
  /** Texels of distance field kept around each glyph's ink. */
  padding: number;
  pages: GlyphAtlasPage[];
  defaultFace: string;
  faces: Record<string, GlyphAtlasFace>;
  /** Semantic names (`sans`, `bold`, `serif`) for face ids. */
  roles?: Record<string, string>;
}

const finite = z.number().finite();
const glyphSchema = z
  .array(finite)
  .refine((g) => g.length === 1 || g.length === 10, 'a glyph is [advance] or 10 numbers');
const faceSchema = z.strictObject({
  family: z.string().min(1).max(100),
  weight: z.number().min(1).max(1000),
  style: z.enum(['normal', 'italic']),
  ascent: finite.positive().max(4),
  descent: finite.nonpositive().min(-4),
  lineHeight: finite.positive().max(8),
  capHeight: finite.positive().max(4),
  glyphs: z.record(
    z.string().refine((key) => Array.from(key).length === 1),
    glyphSchema,
  ),
  kerning: z
    .record(
      z.string().refine((key) => Array.from(key).length === 2),
      finite.min(-4).max(4),
    )
    .optional(),
});
const pathSchema = z.string().regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9_./-]+$/);
const atlasSchema = z
  .strictObject({
    format: z.literal('molen/glyph-atlas@1'),
    id: z.string().min(1).max(100),
    emSize: z.int().min(8).max(256),
    distanceRange: finite.positive().max(64),
    padding: z.int().min(0).max(64),
    pages: z
      .array(
        z.strictObject({
          path: pathSchema,
          width: z.int().min(1).max(8192),
          height: z.int().min(1).max(8192),
        }),
      )
      .min(1)
      .max(8),
    defaultFace: z.string().min(1),
    faces: z.record(z.string().min(1).max(100), faceSchema),
    roles: z.record(z.string().min(1), z.string().min(1)).optional(),
  })
  .superRefine((doc, ctx) => {
    for (const id of [doc.defaultFace, ...Object.values(doc.roles ?? {})])
      if (!Object.hasOwn(doc.faces, id))
        ctx.addIssue({ code: 'custom', message: `glyph atlas names missing face ${id}` });
    for (const [faceId, face] of Object.entries(doc.faces)) {
      if (!Object.hasOwn(face.glyphs, ' '))
        ctx.addIssue({ code: 'custom', message: `face ${faceId} has no space` });
      for (const [char, g] of Object.entries(face.glyphs)) {
        if (g.length === 1) continue;
        const page = doc.pages[g[5] as number];
        const [x0, y0, x1, y1] = g.slice(6) as [number, number, number, number];
        if (
          page === undefined ||
          ![x0, y0, x1, y1].every(Number.isInteger) ||
          x0 < 0 ||
          y0 < 0 ||
          x1 <= x0 ||
          y1 <= y0 ||
          x1 > page.width ||
          y1 > page.height
        )
          ctx.addIssue({ code: 'custom', message: `glyph ${faceId}/${char} lies off its page` });
      }
    }
  });

/** Validate a `molen/glyph-atlas@1` document. */
export function parseGlyphAtlas(doc: unknown): GlyphAtlasDoc {
  return atlasSchema.parse(doc) as GlyphAtlasDoc;
}

/** Where one document page sits in a set's combined texture. */
export interface GlyphAtlasSetPage {
  /** Index of the document in the list the set was made from. */
  doc: number;
  /** The document's page index and path. */
  page: number;
  path: string;
  /** First row of the page in the combined texture; pages start at column 0. */
  top: number;
  width: number;
  height: number;
}

export interface AtlasTextOptions {
  /** A face id or role; default the first document's default face. */
  font?: string;
  /** Box the ink is fitted into, in output units. */
  maxWidth: number;
  maxHeight: number;
  /** Largest em size in output units (default no limit beyond the box). */
  size?: number;
  /** Extra advance between letters, in em (default 0). */
  letterSpacing?: number;
  /** 1 or 2 (default 1): with 2, a line break is used where it sets the letters larger. */
  maxLines?: number;
}

export interface AtlasTextLayout {
  /** The face the text was set in: the first candidate holding every character. */
  face: string;
  lines: string[];
  /** Output units per em. */
  scale: number;
  /** Fitted ink extent, output units. */
  width: number;
  height: number;
  /** Cap height in output units: what decides when the letters are worth drawing. */
  capHeight: number;
  /**
   * Per glyph `x0, y0, x1, y1, u0, v0, u1, v1`: the quad's lower-left and upper-right corners in
   * output units, Y up and centered on the fitted block, and the combined texture's coordinates
   * at those same corners.
   */
  quads: Float32Array;
}

export interface GlyphAtlasSet {
  /** Content hash of the documents, for cache keys. */
  readonly hash: string;
  readonly docs: readonly GlyphAtlasDoc[];
  /** Combined texture size: the widest page, and every page's height stacked. */
  readonly width: number;
  readonly height: number;
  readonly distanceRange: number;
  readonly pages: readonly GlyphAtlasSetPage[];
  /** The face that would set `text`, or undefined when no face holds every character. */
  faceFor(text: string, font?: string): string | undefined;
  /** Lay out `text`; undefined when no face holds every character. */
  layout(text: string, options: AtlasTextOptions): AtlasTextLayout | undefined;
}

/** cyrb53: a small, fast 53-bit string hash; stable across runtimes. */
function cyrb53(value: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Characters that never begin a line (closing marks, small kana, the long-vowel mark). */
const NO_LINE_START = new Set(
  Array.from(
    '、。，．・：；？！ー）」』】〕〉》ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ)]},.:;!?',
  ),
);
/** Characters that never end a line (opening marks). */
const NO_LINE_END = new Set(Array.from('（「『【〔〈《([{'));
/** Scripts set without spaces, where a line may break between any two letters. */
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

interface Face {
  id: string;
  doc: number;
  face: GlyphAtlasFace;
  /** Ink inset from the plane box, em. */
  inset: number;
  emSize: number;
}

/**
 * Combine glyph atlas documents (metrics only; pixels stay with the renderer). Every document must
 * share one distance range, so a single material reads them all. Later documents add faces; the
 * first document's default face is the set's default.
 */
export function createGlyphAtlasSet(input: readonly unknown[]): GlyphAtlasSet {
  if (input.length === 0) throw new Error('a glyph atlas set needs at least one document');
  const docs = input.map(parseGlyphAtlas);
  const first = docs[0] as GlyphAtlasDoc;
  const range = first.distanceRange;
  if (docs.some((doc) => doc.distanceRange !== range))
    throw new Error('glyph atlas documents in one set must share a distance range');
  const ids = new Set<string>();
  for (const doc of docs) {
    if (ids.has(doc.id)) throw new Error(`glyph atlas ${doc.id} listed twice`);
    ids.add(doc.id);
  }
  const pages: GlyphAtlasSetPage[] = [];
  let width = 0,
    height = 0;
  for (const [d, doc] of docs.entries())
    for (const [p, page] of doc.pages.entries()) {
      pages.push({
        doc: d,
        page: p,
        path: page.path,
        top: height,
        width: page.width,
        height: page.height,
      });
      width = Math.max(width, page.width);
      height += page.height;
    }
  const pageTop = (doc: number, page: number): number =>
    (pages.find((p) => p.doc === doc && p.page === page) as GlyphAtlasSetPage).top;
  const faces = new Map<string, Face>();
  docs.forEach((doc, d) => {
    for (const [id, face] of Object.entries(doc.faces)) {
      if (faces.has(id)) throw new Error(`glyph atlas face ${id} defined twice`);
      faces.set(id, { id, doc: d, face, inset: doc.padding / doc.emSize, emSize: doc.emSize });
    }
  });
  /** Faces to try for a font name: its own face in each document, then each default. */
  const candidates = (font: string | undefined): Face[] => {
    const list: Face[] = [];
    const add = (id: string | undefined): void => {
      const face = id !== undefined ? faces.get(id) : undefined;
      if (face !== undefined && !list.includes(face)) list.push(face);
    };
    if (font !== undefined && faces.has(font)) add(font);
    for (const doc of docs) if (font !== undefined) add(doc.roles?.[font]);
    for (const doc of docs) add(doc.defaultFace);
    return list;
  };
  const holds = (face: Face, chars: readonly string[]): boolean =>
    chars.every((char) => Object.hasOwn(face.face.glyphs, char));
  const pick = (chars: readonly string[], font: string | undefined): Face | undefined =>
    candidates(font).find((face) => holds(face, chars));
  const prepare = (text: string): string[] =>
    Array.from(text.normalize('NFC').replace(/\s+/g, ' ').trim());

  const advanceOf = (face: Face, chars: readonly string[], spacing: number): number => {
    let x = 0;
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i] as string;
      if (i > 0) x += spacing + (face.face.kerning?.[(chars[i - 1] as string) + char] ?? 0);
      x += face.face.glyphs[char]?.[0] ?? 0;
    }
    return x;
  };
  /** Ink extent of one line, em: [left, bottom, right, top]. */
  const inkOf = (face: Face, chars: readonly string[], spacing: number): number[] => {
    let x = 0,
      left = Infinity,
      right = -Infinity,
      bottom = Infinity,
      top = -Infinity;
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i] as string;
      if (i > 0) x += spacing + (face.face.kerning?.[(chars[i - 1] as string) + char] ?? 0);
      const g = face.face.glyphs[char] as GlyphAtlasGlyph;
      if (g.length > 1) {
        left = Math.min(left, x + (g[1] as number) + face.inset);
        bottom = Math.min(bottom, (g[2] as number) + face.inset);
        right = Math.max(right, x + (g[3] as number) - face.inset);
        top = Math.max(top, (g[4] as number) - face.inset);
      }
      x += g[0] as number;
    }
    return left <= right ? [left, bottom, right, top] : [0, 0, 0, 0];
  };
  /** Line breaks worth trying: after a space, or between letters of an unspaced script. */
  const breaks = (chars: readonly string[]): number[] => {
    const spaces: number[] = [];
    const any: number[] = [];
    for (let i = 1; i < chars.length; i++) {
      const before = chars[i - 1] as string,
        after = chars[i] as string;
      if (after === ' ') continue;
      if (before === ' ') spaces.push(i);
      else if (
        (UNSPACED.test(before) || UNSPACED.test(after)) &&
        !NO_LINE_START.has(after) &&
        !NO_LINE_END.has(before)
      )
        any.push(i);
    }
    return spaces.length > 0 ? spaces : any;
  };
  const trimmed = (chars: readonly string[]): string[] => {
    let a = 0,
      b = chars.length;
    while (a < b && chars[a] === ' ') a++;
    while (b > a && chars[b - 1] === ' ') b--;
    return chars.slice(a, b);
  };

  return {
    hash: cyrb53(JSON.stringify(docs)),
    docs,
    width,
    height,
    distanceRange: range,
    pages,
    faceFor(text, font) {
      const chars = prepare(text);
      if (chars.length === 0) return undefined;
      return pick(chars, font)?.id;
    },
    layout(text, options) {
      const chars = prepare(text);
      if (chars.length === 0) return undefined;
      const face = pick(chars, options.font);
      if (face === undefined) return undefined;
      const { maxWidth, maxHeight } = options;
      if (!(maxWidth > 0) || !(maxHeight > 0) || !Number.isFinite(maxWidth + maxHeight))
        throw new Error('atlas text needs a positive, finite box');
      const spacing = options.letterSpacing ?? 0;
      const size = options.size ?? Infinity;
      const leading = Math.min(face.face.lineHeight, 1.2);
      // Candidate layouts: one line, and the most balanced two-line break.
      const layouts: string[][][] = [[chars]];
      if ((options.maxLines ?? 1) >= 2) {
        let best: { lines: string[][]; widest: number } | undefined;
        for (const at of breaks(chars)) {
          const lines = [trimmed(chars.slice(0, at)), trimmed(chars.slice(at))];
          const widest = Math.max(...lines.map((line) => advanceOf(face, line, spacing)));
          if (best === undefined || widest < best.widest) best = { lines, widest };
        }
        if (best !== undefined) layouts.push(best.lines);
      }
      let chosen:
        | { lines: string[][]; scale: number; inks: number[][]; block: number[] }
        | undefined;
      for (const lines of layouts) {
        const inks = lines.map((line) => inkOf(face, line, spacing));
        // The block's ink, with each later line one leading lower.
        const left = Math.min(...inks.map((ink) => ink[0] as number));
        const right = Math.max(...inks.map((ink) => ink[2] as number));
        const top = Math.max(...inks.map((ink, row) => (ink[3] as number) - row * leading));
        const bottom = Math.min(...inks.map((ink, row) => (ink[1] as number) - row * leading));
        const w = right - left,
          h = top - bottom;
        const scale = Math.min(size, w > 0 ? maxWidth / w : size, h > 0 ? maxHeight / h : size);
        // A second line has to earn its place: a tenth larger letters than one line.
        if (chosen === undefined || scale > chosen.scale * 1.1)
          chosen = { lines, scale, inks, block: [left, bottom, right, top] };
      }
      const { lines, scale, inks, block } = chosen as NonNullable<typeof chosen>;
      if (!Number.isFinite(scale) || scale <= 0) return undefined;
      const [, bottom, , top] = block as [number, number, number, number];
      const middle = (top + bottom) / 2;
      const quads: number[] = [];
      lines.forEach((line, row) => {
        const ink = inks[row] as number[];
        // Each line centered on its own ink.
        let x = -((ink[0] as number) + (ink[2] as number)) / 2;
        const baseline = -row * leading - middle;
        for (let i = 0; i < line.length; i++) {
          const char = line[i] as string;
          if (i > 0) x += spacing + (face.face.kerning?.[(line[i - 1] as string) + char] ?? 0);
          const g = face.face.glyphs[char] as GlyphAtlasGlyph;
          if (g.length > 1) {
            const top0 = pageTop(face.doc, g[5] as number);
            quads.push(
              (x + (g[1] as number)) * scale,
              (baseline + (g[2] as number)) * scale,
              (x + (g[3] as number)) * scale,
              (baseline + (g[4] as number)) * scale,
              (g[6] as number) / width,
              (top0 + (g[9] as number)) / height,
              (g[8] as number) / width,
              (top0 + (g[7] as number)) / height,
            );
          }
          x += g[0] as number;
        }
      });
      return {
        face: face.id,
        lines: lines.map((line) => line.join('')),
        scale,
        width: ((block[2] as number) - (block[0] as number)) * scale,
        height: ((block[3] as number) - (block[1] as number)) * scale,
        capHeight: face.face.capHeight * scale,
        quads: new Float32Array(quads),
      };
    },
  };
}

/**
 * Assemble a set's pages into one combined 8-bit texture image (row 0 first), reading each page
 * through the host's loader. `read(doc, path)` resolves a page path against document `doc`.
 */
export async function assembleGlyphAtlasPixels(
  set: GlyphAtlasSet,
  read: (doc: number, path: string) => Promise<ArrayBuffer | Uint8Array>,
): Promise<{ width: number; height: number; data: Uint8Array }> {
  const data = new Uint8Array(set.width * set.height);
  await Promise.all(
    set.pages.map(async (page) => {
      const raw = await read(page.doc, page.path);
      const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
      if (bytes.byteLength !== page.width * page.height)
        throw new Error(
          `glyph atlas page ${page.path} holds ${bytes.byteLength} bytes, not ${page.width * page.height}`,
        );
      for (let row = 0; row < page.height; row++)
        data.set(
          bytes.subarray(row * page.width, (row + 1) * page.width),
          (page.top + row) * set.width,
        );
    }),
  );
  return { width: set.width, height: set.height, data };
}
