/** Exact vertex sharing for authored buffers. No quantization, normal averaging or decimation. */
export function compactAuthoredMesh(mesh) {
  const attributes = [
    ['positions', 3],
    ['normals', 3],
    ['uvs', 2],
    ['colors', 3],
  ];
  const words = attributes.map(([name]) => {
    const a = mesh[name];
    return a instanceof Float32Array ? new Uint32Array(a.buffer, a.byteOffset, a.length) : a;
  });
  let capacity = 1;
  while (capacity < mesh.vertexCount * 2) capacity *= 2;
  const table = new Uint32Array(capacity),
    remap = new Uint32Array(mesh.vertexCount);
  const kept = new Uint32Array(mesh.vertexCount);
  let count = 0;
  const same = (a, b) =>
    attributes.every(([, stride], i) => {
      for (let k = 0; k < stride; k++)
        if (words[i][a * stride + k] !== words[i][b * stride + k]) return false;
      return true;
    });
  for (let vertex = 0; vertex < mesh.vertexCount; vertex++) {
    let hash = 2166136261;
    for (let i = 0; i < attributes.length; i++) {
      const stride = attributes[i][1];
      for (let k = 0; k < stride; k++)
        hash = Math.imul(hash ^ words[i][vertex * stride + k], 16777619);
    }
    let slot = hash & (capacity - 1);
    while (table[slot] && !same(vertex, table[slot] - 1)) slot = (slot + 1) & (capacity - 1);
    if (!table[slot]) {
      table[slot] = vertex + 1;
      remap[vertex] = count;
      kept[count++] = vertex;
    } else remap[vertex] = remap[table[slot] - 1];
  }
  for (const [name, stride] of attributes) {
    const before = mesh[name],
      after = new before.constructor(count * stride);
    for (let i = 0; i < count; i++)
      after.set(before.subarray(kept[i] * stride, (kept[i] + 1) * stride), i * stride);
    mesh[name] = after;
  }
  mesh.indices = mesh.indices.map((i) => remap[i]);
  mesh.vertexCount = count;
  mesh.bytes = attributes.reduce((s, [name]) => s + mesh[name].byteLength, mesh.indices.byteLength);
}
