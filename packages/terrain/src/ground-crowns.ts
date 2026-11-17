/**
 * The shrub crowns the ground material paints on dry ground (its `landcoverDetail` brush), as
 * plain numbers: the lattice the shader reads its cell values from, and the crown each cell
 * holds. Scatter places a shrub on a painted crown with these, so the crown a camera sees from
 * the air is the shrub it walks up to. No three.js here: the kernel half uses it.
 */

/** Texels across the ground's random lattice; it wraps, so cells repeat every this many. */
export const TERRAIN_GROUND_LATTICE_SIZE = 512;

let lattice: Uint8Array | undefined;

/**
 * Random bytes at integer lattice points (xorshift32: uncorrelated neighbours, the same lattice on
 * every run). The ground material uploads these as its noise texture; shared, never mutated.
 */
export function terrainGroundLattice(): Uint8Array {
  if (lattice === undefined) {
    const data = new Uint8Array(TERRAIN_GROUND_LATTICE_SIZE * TERRAIN_GROUND_LATTICE_SIZE);
    let state = 0x9e3779b9;
    for (let i = 0; i < data.length; i++) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      data[i] = (state >>> 0) & 255;
    }
    lattice = data;
  }
  return lattice;
}

/** One integer cell's lattice value in [0, 1], as the shader reads it at the texel center. */
export function terrainGroundCell(i: number, j: number): number {
  const size = TERRAIN_GROUND_LATTICE_SIZE;
  const col = ((i % size) + size) % size,
    row = ((j % size) + size) % size;
  return (terrainGroundLattice()[row * size + col] as number) / 255;
}

/**
 * Half-meter orthophotos of Yuma's open desert show separate round creosote and mesquite crowns,
 * 2 to 5 m across, over about 4% of vacant ground. The ground paints one candidate crown per
 * `cell`-meter cell, its radius drawn from `radius` and kept inside the cell, and shows it with
 * probability `brush * share / full`: at full brush, crowns cover `share` of the ground.
 */
export const TERRAIN_GROUND_CROWNS = {
  cell: 8,
  radius: [1, 2.6],
  share: 0.1,
} as const;

/** Ground covered when every cell holds a crown: the mean crown area over the cell area. */
export const TERRAIN_GROUND_CROWN_FULL: number =
  (Math.PI * (TERRAIN_GROUND_CROWNS.radius[1] ** 3 - TERRAIN_GROUND_CROWNS.radius[0] ** 3)) /
  (3 *
    (TERRAIN_GROUND_CROWNS.radius[1] - TERRAIN_GROUND_CROWNS.radius[0]) *
    TERRAIN_GROUND_CROWNS.cell ** 2);

/**
 * Lattice offsets, from a crown's cell, of the values that size it, place it in Z and decide
 * whether it shows (X uses the cell's own value). The shader reads exactly these cells.
 */
export const TERRAIN_GROUND_CROWN_OFFSETS: {
  readonly radius: readonly [number, number];
  readonly jitterZ: readonly [number, number];
  readonly shown: readonly [number, number];
} = { radius: [57, 331], jitterZ: [211, 97], shown: [389, 23] };

export interface TerrainGroundCrown {
  /** Center, in the ground's pattern frame (world X and Z meters). */
  x: number;
  z: number;
  radius: number;
  /** The least ground brush (`landcoverDetail` x, 0..1) at which this crown is painted. */
  brush: number;
}

/**
 * The crown of pattern cell (i, j): the cell spans [i, i + 1) * `TERRAIN_GROUND_CROWNS.cell` in
 * world X, and likewise j in Z. The pattern is periodic with the lattice (4,096 m), so any world
 * frame whose coordinates agree modulo that period sees the same crowns.
 */
export function terrainGroundCrown(i: number, j: number): TerrainGroundCrown {
  const { cell, radius: range, share } = TERRAIN_GROUND_CROWNS;
  const { radius: sized, jitterZ, shown } = TERRAIN_GROUND_CROWN_OFFSETS;
  const radius = range[0] + (range[1] - range[0]) * terrainGroundCell(i + sized[0], j + sized[1]);
  const room = cell - 2 * radius;
  return {
    x: (i + 0.5) * cell + (terrainGroundCell(i, j) - 0.5) * room,
    z: (j + 0.5) * cell + (terrainGroundCell(i + jitterZ[0], j + jitterZ[1]) - 0.5) * room,
    radius,
    brush: (terrainGroundCell(i + shown[0], j + shown[1]) * TERRAIN_GROUND_CROWN_FULL) / share,
  };
}
