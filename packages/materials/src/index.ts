export type { MaterialBaker, MaterialBakeWorker } from './bake-worker';
export { createMaterialBakeWorkerPool, installMaterialBakeWorker } from './bake-worker';
export { bakeMatGraph } from './matgraph';
export type { MatGraphDoc, MatNode, RampStop } from './matgraph-types';
export { fbm, gradientNoise, valueNoise, worley } from './noise';
export { bakePalette } from './palette';
export { bakePixelGrid } from './pixelgrid';
export type { PixelGridDoc } from './pixelgrid-types';
export { registerMaterialSchemas } from './schema';
export type { SvgMeta, SvgWasmSource, SvgWasmUrl } from './svg';
export { bakeSvg, initSvg } from './svg';
export type { BakedMaterial, MaterialSlot, RGBAImage } from './types';
export { createImage } from './types';
export type { ApplyUvPaintOptions } from './uvpaint';
export { applyUvPaint, dilate, maskToIslands, rectIslandMap } from './uvpaint';

// Register capability schemas on import so tooling that imports this package can validate them.
import { registerMaterialSchemas } from './schema';

registerMaterialSchemas();
