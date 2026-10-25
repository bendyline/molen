/** Decode the real embedded PNGs for headless geometry/material tests, without DOM globals. */
import { PNG } from 'pngjs';
import { DataTexture, RepeatWrapping } from 'three';
import { GLTFLoader as ThreeGLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class GLTFLoader extends ThreeGLTFLoader {
  constructor() {
    super();
    this.register((parser) => ({
      name: 'headless-embedded-png',
      async loadTexture(index) {
        const definition = parser.json.textures[index];
        const image = parser.json.images[definition.source];
        if (image.mimeType !== 'image/png' || image.bufferView === undefined)
          throw Error('Headless model tests require embedded PNG textures');
        const bytes = await parser.getDependency('bufferView', image.bufferView);
        const png = PNG.sync.read(Buffer.from(bytes));
        const texture = new DataTexture(new Uint8Array(png.data), png.width, png.height);
        texture.flipY = false;
        texture.wrapS = texture.wrapT = RepeatWrapping;
        texture.needsUpdate = true;
        return texture;
      },
    }));
  }
}
