/** Join untextured encodeGlb outputs without flattening their reusable mesh instances.
 * This deliberately accepts only our static generator subset, not arbitrary imported glTF.
 */
export function encodeAuthoredAssembly(parts, generator = 'Molen authored assembly') {
  if (!parts.length) throw new Error('An assembly requires at least one part');
  const doc = {
    asset: { version: '2.0', generator },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: [],
    meshes: [],
    materials: [],
    accessors: [],
    bufferViews: [],
    buffers: [{ byteLength: 0 }],
  };
  const binaries = [],
    materialIds = new Map(),
    names = new Set();
  let byteOffset = 0;
  for (const part of parts) {
    if (!part.name || names.has(part.name)) throw new Error('Assembly part names must be unique');
    names.add(part.name);
    const bytes = Buffer.from(part.glb);
    if (
      bytes.readUInt32LE(0) !== 0x46546c67 ||
      bytes.readUInt32LE(4) !== 2 ||
      bytes.readUInt32LE(8) !== bytes.length
    )
      throw new Error(`${part.name}: invalid generated GLB`);
    const jsonLength = bytes.readUInt32LE(12),
      binaryHeader = 20 + jsonLength;
    const input = JSON.parse(bytes.subarray(20, binaryHeader).toString('utf8'));
    if (
      bytes.readUInt32LE(16) !== 0x4e4f534a ||
      bytes.readUInt32LE(binaryHeader + 4) !== 0x004e4942
    )
      throw new Error(`${part.name}: expected JSON and BIN chunks`);
    if (
      input.meshes?.length !== 1 ||
      input.buffers?.length !== 1 ||
      input.images?.length ||
      input.textures?.length ||
      input.skins?.length ||
      input.animations?.length ||
      input.extensionsUsed?.length ||
      input.nodes?.length !== 1 ||
      input.nodes[0].mesh !== 0 ||
      ['matrix', 'translation', 'rotation', 'scale', 'children'].some(
        (k) => input.nodes[0][k] !== undefined,
      )
    )
      throw new Error(`${part.name}: unsupported assembly source; use a static encodeGlb mesh`);
    const materialMap = input.materials.map((material) => {
      const key = JSON.stringify(material);
      if (!materialIds.has(key)) {
        materialIds.set(key, doc.materials.length);
        doc.materials.push(material);
      }
      return materialIds.get(key);
    });
    const viewBase = doc.bufferViews.length,
      accessorBase = doc.accessors.length;
    for (const view of input.bufferViews) {
      if (view.buffer !== 0 || view.extensions)
        throw new Error(`${part.name}: unsupported buffer view`);
      doc.bufferViews.push({ ...view, byteOffset: (view.byteOffset ?? 0) + byteOffset });
    }
    for (const accessor of input.accessors) {
      if (accessor.sparse || accessor.extensions || accessor.bufferView === undefined)
        throw new Error(`${part.name}: unsupported accessor`);
      doc.accessors.push({ ...accessor, bufferView: accessor.bufferView + viewBase });
    }
    const meshIndex = doc.meshes.length;
    doc.meshes.push({
      name: part.name,
      primitives: input.meshes[0].primitives.map((p) => {
        if (p.targets || p.extensions) throw new Error(`${part.name}: unsupported primitive`);
        return {
          ...p,
          attributes: Object.fromEntries(
            Object.entries(p.attributes).map(([k, v]) => [k, v + accessorBase]),
          ),
          ...(p.indices === undefined ? {} : { indices: p.indices + accessorBase }),
          ...(p.material === undefined ? {} : { material: materialMap[p.material] }),
        };
      }),
    });
    if (!part.instances?.length) throw new Error(`${part.name}: no instances`);
    const transforms = [];
    for (const [index, instance] of part.instances.entries()) {
      const translation = instance.translation ?? [0, 0, 0],
        angle = instance.angle ?? 0;
      if (
        translation.length !== 3 ||
        !translation.every(Number.isFinite) ||
        !Number.isFinite(angle)
      )
        throw new Error(`${part.name}: invalid transform`);
      const node = {
        name: `${part.name}-${index}`,
        mesh: meshIndex,
        translation,
        rotation: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)],
      };
      transforms.push(node);
      if (!part.gpuInstances) {
        doc.scenes[0].nodes.push(doc.nodes.length);
        doc.nodes.push(node);
      }
    }
    const length = bytes.readUInt32LE(binaryHeader),
      data = bytes.subarray(binaryHeader + 8, binaryHeader + 8 + length);
    if (data.length !== length || length % 4 || binaryHeader + 8 + length !== bytes.length)
      throw new Error(`${part.name}: invalid BIN length`);
    binaries.push(data);
    byteOffset += length;
    if (part.gpuInstances) {
      const attribute = (key, size, type) => {
        const bytes = Buffer.alloc(transforms.length * size * 4);
        transforms.forEach((node, i) => {
          node[key].forEach((value, j) => {
            bytes.writeFloatLE(value, (i * size + j) * 4);
          });
        });
        const bufferView = doc.bufferViews.length;
        doc.bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.length });
        binaries.push(bytes);
        byteOffset += bytes.length;
        const id = doc.accessors.length;
        doc.accessors.push({ bufferView, componentType: 5126, count: transforms.length, type });
        return id;
      };
      const attributes = {
        TRANSLATION: attribute('translation', 3, 'VEC3'),
        ROTATION: attribute('rotation', 4, 'VEC4'),
      };
      doc.extensionsUsed = ['EXT_mesh_gpu_instancing'];
      doc.extensionsRequired = ['EXT_mesh_gpu_instancing'];
      doc.scenes[0].nodes.push(doc.nodes.length);
      doc.nodes.push({
        name: part.name,
        mesh: meshIndex,
        extensions: { EXT_mesh_gpu_instancing: { attributes } },
      });
    }
  }
  doc.buffers[0].byteLength = byteOffset;
  const raw = Buffer.from(JSON.stringify(doc)),
    json = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32);
  raw.copy(json);
  const header = Buffer.alloc(20),
    binaryHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + byteOffset, 8);
  header.writeUInt32LE(json.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  binaryHeader.writeUInt32LE(byteOffset, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, json, binaryHeader, ...binaries]);
}
