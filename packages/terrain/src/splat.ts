import type { TerrainDescriptor, TerrainLayer } from './descriptor-types';

// Height/slope auto-banding -> per-vertex color (v1 splat shading, docs/05 §5.3). Terrain-owned
// (not matgraph nodes). Layers without `auto` form the base; layers with `auto` bands blend in
// where their height/slope window matches.

const DEFAULT_COLORS: Record<string, string> = {
  grass: '#4a7a3a',
  rock: '#6a6a66',
  snow: '#e8ecf2',
  dirt: '#6b4f33',
  sand: '#c8b88a',
  water: '#2a4a6a',
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    Number.parseInt(h.slice(0, 2), 16) / 255,
    Number.parseInt(h.slice(2, 4), 16) / 255,
    Number.parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function layerColor(layer: TerrainLayer): [number, number, number] {
  if (layer.color !== undefined) return hexToRgb(layer.color);
  const named = DEFAULT_COLORS[layer.name];
  return hexToRgb(named ?? '#808080');
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x >= edge1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Weight for a layer at a given height/slope from its auto band (1 if no band = base layer). */
function layerWeight(layer: TerrainLayer, height: number, slope: number): number {
  const auto = layer.auto;
  if (auto === undefined) return 1; // base layer always present
  let w = 1;
  const f = 0.1; // band feather
  if (auto.heightMin !== undefined)
    w *= smoothstep(auto.heightMin - auto.heightMin * f - 1, auto.heightMin, height);
  if (auto.heightMax !== undefined)
    w *= 1 - smoothstep(auto.heightMax, auto.heightMax + auto.heightMax * f + 1, height);
  if (auto.slopeMin !== undefined) w *= smoothstep(auto.slopeMin - 0.1, auto.slopeMin, slope);
  if (auto.slopeMax !== undefined) w *= 1 - smoothstep(auto.slopeMax, auto.slopeMax + 0.1, slope);
  return w;
}

export type TerrainPalette = (height: number, slope: number) => [number, number, number];

/** Compile once per mesh build. The snapshot is independent of later descriptor edits. */
export function compileTerrainPalette(descriptor: TerrainDescriptor): TerrainPalette {
  const layers = descriptor.layers;
  if (layers.length === 0) {
    const min = descriptor.height.min;
    const range = descriptor.height.max - min || 1;
    return (height) => {
      // No layers: simple height ramp green->grey->white.
      const t = (height - min) / range;
      if (t < 0.5) return [0.29 + t * 0.2, 0.48, 0.23];
      return [0.5 + (t - 0.5) * 0.9, 0.5 + (t - 0.5) * 0.9, 0.45 + (t - 0.5) * 1.1];
    };
  }
  const baseLayers = layers.filter((layer) => layer.auto === undefined);
  const baseSource: TerrainLayer[] =
    baseLayers.length > 0 ? baseLayers : [layers[0] as TerrainLayer];
  const baseColors = baseSource.map(layerColor);
  const base: [number, number, number] = [
    baseColors.reduce((sum, value) => sum + value[0], 0) / baseColors.length,
    baseColors.reduce((sum, value) => sum + value[1], 0) / baseColors.length,
    baseColors.reduce((sum, value) => sum + value[2], 0) / baseColors.length,
  ];
  const overlays = layers
    .filter((layer) => layer.auto !== undefined)
    .map((layer) => ({
      layer: { ...layer, auto: { ...layer.auto } },
      color: layerColor(layer),
    }));
  return (height, slope) => {
    let [r, g, b] = base;
    // Auto bands are ordered overlays: a fully matching band expresses its authored color instead
    // of being permanently diluted by the base layer. Feathered boundaries still interpolate.
    for (const { layer, color: overlay } of overlays) {
      const weight = layerWeight(layer, height, slope);
      if (weight <= 0) continue;
      r += (overlay[0] - r) * weight;
      g += (overlay[1] - g) * weight;
      b += (overlay[2] - b) * weight;
    }
    return [r, g, b];
  };
}

/** Convenience sampling API; mesh builders reuse the compiled function for every vertex. */
export function splatColor(
  descriptor: TerrainDescriptor,
  height: number,
  slope: number,
): [number, number, number] {
  return compileTerrainPalette(descriptor)(height, slope);
}
