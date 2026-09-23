import { Document, NodeIO } from '@gltf-transform/core';
import { PNG } from 'pngjs';

/** A small opaque RGBA PNG with a deterministic gradient (non-power-of-two on purpose). */
export function buildPng(width: number, height: number, seed: number): Uint8Array {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      png.data[i] = (x * 255) / Math.max(1, width - 1);
      png.data[i + 1] = (y * 255) / Math.max(1, height - 1);
      png.data[i + 2] = (seed * 37) % 256;
      png.data[i + 3] = 255;
    }
  }
  return new Uint8Array(PNG.sync.write(png));
}

/**
 * Textured unit quad fixture: one material with a baseColor (sRGB) and a normal (linear) PNG,
 * both 20x12 so the packer's power-of-two snapping is exercised (-> 16x16).
 */
export async function buildTexturedQuadGlb(): Promise<Uint8Array> {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const positions = new Float32Array([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5]);
  const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
  const indices = new Uint16Array([0, 2, 1, 0, 3, 2]);
  const pos = doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer);
  const uv = doc.createAccessor().setType('VEC2').setArray(uvs).setBuffer(buffer);
  const idx = doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer);
  const albedo = doc
    .createTexture('albedo')
    .setImage(buildPng(20, 12, 1))
    .setMimeType('image/png');
  const normal = doc
    .createTexture('normal')
    .setImage(buildPng(20, 12, 2))
    .setMimeType('image/png');
  const material = doc
    .createMaterial('painted')
    .setBaseColorTexture(albedo)
    .setNormalTexture(normal);
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', pos)
    .setAttribute('TEXCOORD_0', uv)
    .setIndices(idx)
    .setMaterial(material);
  const mesh = doc.createMesh('QuadMesh').addPrimitive(prim);
  const node = doc.createNode('Quad').setMesh(mesh);
  doc.createScene('scene').addChild(node);
  return new NodeIO().writeBinary(doc);
}
