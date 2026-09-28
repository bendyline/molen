import { describe, expect, it } from 'vitest';
import { hasOnlyEmbeddedImages } from '../src/client/structure-image-ownership';

describe('fresh GLTF image ownership', () => {
  it('owns exclusively embedded images, including shared bufferView references', () => {
    expect(hasOnlyEmbeddedImages({ images: [{ bufferView: 0 }, { bufferView: 0 }] })).toBe(true);
  });

  it.each([
    { images: [{ uri: 'shared.png' }] },
    { images: [{ uri: 'data:image/png;base64,AAAA' }] },
    { images: [{ bufferView: 0 }, { uri: 'shared.png' }] },
    { images: [{ bufferView: 0, uri: 'shared.png' }] },
    { images: [{ bufferView: -1 }] },
    { images: [null] },
    {},
  ])('preserves image ownership when not every image is proven embedded: %j', (document) => {
    expect(hasOnlyEmbeddedImages(document)).toBe(false);
  });
});
