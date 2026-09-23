/** Shared grammar for ids and references used by every worldgen format. */

/** Namespaced dotted id, e.g. `molen.worldgen.pnw.house`. */
export const DOTTED_ID_RE: RegExp = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

/** Contained relative POSIX path (no drive, no leading slash, no `..` segments, no backslashes). */
export const REL_PATH_RE: RegExp = /^(?![A-Za-z]:|[/\\])(?!.*\\)(?!.*(?:^|\/)\.\.(?:\/|$)).+$/;

export const COLOR_RE: RegExp = /^#[0-9a-fA-F]{6}$/;

/** `palette:#rrggbb`, `matgraph:<id or path>`, or `pixelgrid:<id or path>`. */
export const MATERIAL_REF_RE: RegExp = /^(palette:#[0-9a-fA-F]{6}|matgraph:\S+|pixelgrid:\S+)$/;

/** `builtin:<name>` or a namespaced asset id. */
export const MODEL_REF_RE: RegExp =
  /^(builtin:[a-z][a-z0-9_.]*|[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+)$/;

/**
 * The procedural builtin models. Landmarks (`builtin:bench`, `builtin:sign.grocery`) are builtins
 * too, but they come from the landmark library the host loads, so they are checked when a model
 * library prepares them rather than here.
 */
export const BUILTIN_MODELS: readonly string[] = [
  'builtin:box',
  'builtin:tree.mapped.broadleaf',
  'builtin:tree.mapped.needleleaf',
  'builtin:tree.conifer',
  'builtin:tree.conifer.fir',
  'builtin:tree.conifer.pine',
  'builtin:tree.deciduous',
  'builtin:tree.deciduous.oak',
  'builtin:tree.deciduous.birch',
  'builtin:shrub',
  'builtin:rock',
];

export interface ParsedMaterialRef {
  kind: 'palette' | 'matgraph' | 'pixelgrid';
  ref: string;
}

export function parseMaterialRef(value: string): ParsedMaterialRef | undefined {
  const separator = value.indexOf(':');
  if (separator <= 0) return undefined;
  const kind = value.slice(0, separator);
  if (kind !== 'palette' && kind !== 'matgraph' && kind !== 'pixelgrid') return undefined;
  return { kind, ref: value.slice(separator + 1) };
}

/** Is a material or model reference URL-ish (resolved as a path, not a pack id)? */
export function isUrlishRef(ref: string): boolean {
  return ref.includes('/') || ref.startsWith('./') || /^https?:/.test(ref);
}

/** Parse `#rrggbb` into linear-ish RGB in 0..1 (no gamma conversion; palettes are authored in sRGB). */
export function parseColor(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255];
}
