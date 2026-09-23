// Hand-written contract for a validated pixel-grid texture (docs/06-materials-and-assets.md §2).
export interface PixelGridDoc {
  format: 'molen/pixelgrid@1';
  size: [number, number];
  /** Single-code-point key -> "transparent" or "#rrggbb"/"#rrggbbaa". */
  palette: Record<string, string>;
  /** Exactly `size[1]` rows of exactly `size[0]` characters. */
  rows: string[];
  slots: { baseColor: boolean; emissive: boolean };
  filter: 'nearest' | 'linear';
}
