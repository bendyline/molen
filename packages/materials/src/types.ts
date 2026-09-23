export interface RGBAImage {
  width: number;
  height: number;
  /** RGBA8, row-major, length = width * height * 4. */
  data: Uint8ClampedArray;
}

export type MaterialSlot = 'baseColor' | 'roughness' | 'metalness' | 'normal' | 'emissive' | 'ao';

export interface BakedMaterial {
  slots: Partial<Record<MaterialSlot, RGBAImage>>;
  meta: { filter: 'nearest' | 'linear'; alphaTest?: number };
}

const MAX_IMAGE_DIMENSION = 8192;
const MAX_IMAGE_PIXELS = 16_777_216;

/** @internal Shared allocation guard for every public rasterizer. */
export function assertImageDimensions(width: number, height: number): void {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new Error(`image dimensions must be positive safe integers, got ${width}x${height}`);
  }
  if (
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    throw new Error(
      `image dimensions exceed the ${MAX_IMAGE_DIMENSION}px/${MAX_IMAGE_PIXELS}-pixel limit`,
    );
  }
}

export function createImage(width: number, height: number): RGBAImage {
  assertImageDimensions(width, height);
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}
