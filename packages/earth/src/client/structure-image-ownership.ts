/** GLTFLoader decodes bufferView images from fresh blob URLs, which Three's cache excludes.
 * URI/data-URI images may instead reuse a host-owned bitmap. Be conservative for mixed scenes. */
export function hasOnlyEmbeddedImages(document: unknown): boolean {
  if (document === null || typeof document !== 'object') return false;
  const images = (document as { images?: unknown }).images;
  return (
    Array.isArray(images) &&
    images.every(
      (image: unknown) =>
        image !== null &&
        typeof image === 'object' &&
        !('uri' in image) &&
        'bufferView' in image &&
        Number.isSafeInteger(image.bufferView) &&
        (image.bufferView as number) >= 0,
    )
  );
}
