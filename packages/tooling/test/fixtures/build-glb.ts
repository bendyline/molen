import { Document, NodeIO } from '@gltf-transform/core';

/**
 * Build a tiny deterministic GLB fixture in-memory: a unit cube (12 tris) with a named node,
 * a PBR material, and a 1-second rotation animation. No external files, no textures.
 */
export async function buildCubeGlb(): Promise<Uint8Array> {
  const doc = new Document();
  const buffer = doc.createBuffer();

  // Unit cube centered at origin y in [0,1]: 8 vertices, 12 triangles.
  const p = [
    [-0.5, 0, -0.5],
    [0.5, 0, -0.5],
    [0.5, 0, 0.5],
    [-0.5, 0, 0.5],
    [-0.5, 1, -0.5],
    [0.5, 1, -0.5],
    [0.5, 1, 0.5],
    [-0.5, 1, 0.5],
  ];
  const positions = new Float32Array(p.flat());
  const indices = new Uint32Array([
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 3, 2, 6, 3, 6, 7, 1, 5, 6, 1, 6, 2, 0, 3,
    7, 0, 7, 4,
  ]);

  const posAccessor = doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer);
  const idxAccessor = doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer);
  const material = doc
    .createMaterial('wood')
    .setBaseColorFactor([0.6, 0.4, 0.2, 1])
    .setRoughnessFactor(0.8);
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', posAccessor)
    .setIndices(idxAccessor)
    .setMaterial(material);
  const mesh = doc.createMesh('CrateMesh').addPrimitive(prim);
  const node = doc.createNode('Crate').setMesh(mesh);
  doc.createScene('scene').addChild(node);

  // 1s spin animation on the node (2 keyframes).
  const input = doc
    .createAccessor()
    .setType('SCALAR')
    .setArray(new Float32Array([0, 1]))
    .setBuffer(buffer);
  const output = doc
    .createAccessor()
    .setType('VEC4')
    .setArray(new Float32Array([0, 0, 0, 1, 0, 1, 0, 0]))
    .setBuffer(buffer);
  const sampler = doc.createAnimationSampler().setInput(input).setOutput(output);
  const channel = doc
    .createAnimationChannel()
    .setTargetNode(node)
    .setTargetPath('rotation')
    .setSampler(sampler);
  doc.createAnimation('spin').addSampler(sampler).addChannel(channel);

  return new NodeIO().writeBinary(doc);
}
