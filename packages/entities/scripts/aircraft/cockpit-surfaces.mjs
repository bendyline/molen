/** Small, original cockpit finishes. No photographs, baked lighting or host canvas dependency. */
import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { Float32BufferAttribute, Vector3 } from 'three';

const finishes = {
  panel: { size: 256, repeat: 0.12, roughness: 0.8, normal: 0.4 },
  paint: { repeat: 0.12, roughness: 0.72, normal: 0.16 },
  vinyl: { repeat: 0.1, roughness: 0.79, normal: 0.22 },
  canvas: { repeat: 0.08, roughness: 0.94, normal: 0.3 },
  webbing: { repeat: 0.06, roughness: 0.9, normal: 0.24 },
};
const tag = 'molenCockpitFinish';
const noise = (x, y, size = 128) => {
  let n = Math.imul(((x + size) % size) + 17, 374761393);
  n = Math.imul(n ^ Math.imul(((y + size) % size) + 31, 668265263), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
const height = (kind, x, y) => {
  if (kind === 'panel') {
    // Periodic, smoothly interpolated enamel stipple: millimetre-scale bumps, not pixel noise.
    const smoothNoise = (step) => {
      const px = x / step,
        py = y / step,
        ix = Math.floor(px),
        iy = Math.floor(py);
      const fx = px - ix,
        fy = py - iy,
        u = fx * fx * (3 - 2 * fx),
        v = fy * fy * (3 - 2 * fy);
      const n = (dx, dy) => noise(ix + dx, iy + dy, 256 / step);
      return (n(0, 0) * (1 - u) + n(1, 0) * u) * (1 - v) + (n(0, 1) * (1 - u) + n(1, 1) * u) * v;
    };
    return smoothNoise(4) * 0.65 + smoothNoise(8) * 0.25 + noise(x, y, 256) * 0.1;
  }
  const grain = noise(x, y);
  if (kind === 'canvas') return 0.35 * grain + 0.65 * ((Math.floor(x / 4) + Math.floor(y / 4)) % 2);
  if (kind === 'webbing')
    return 0.2 * grain + 0.6 * (x % 4 < 2 ? 1 : 0) + 0.2 * (y % 8 < 2 ? 1 : 0);
  if (kind === 'vinyl') return 0.65 * noise(Math.floor(x / 2), Math.floor(y / 2)) + 0.35 * grain;
  return grain;
};
const byte = (v) => Math.max(0, Math.min(255, Math.round(v)));
const images = new Map();
function image(kind, slot) {
  const key = `${kind}-${slot}`;
  if (images.has(key)) return images.get(key);
  const size = finishes[kind].size ?? 128;
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const h = height(kind, x, y),
        offset = (y * size + x) * 4;
      let rgb;
      if (slot === 'basecolor') {
        // Near-white multiplies the existing aircraft-specific colour; no fake edge wear or AO.
        const v = byte(
          (kind === 'panel' ? 238 : 244) +
            (h - 0.5) * (kind === 'panel' ? 22 : kind === 'paint' ? 8 : 18),
        );
        rgb = [v, v, v];
      } else if (slot === 'roughness') {
        // glTF metallic-roughness: G = roughness, B = existing metalness factor, R unused.
        rgb = [
          255,
          byte(255 * (finishes[kind].roughness + (h - 0.5) * (kind === 'panel' ? 0.2 : 0.08))),
          255,
        ];
      } else {
        const n = new Vector3(
          height(kind, (x + size - 1) % size, y) - height(kind, (x + 1) % size, y),
          height(kind, x, (y + size - 1) % size) - height(kind, x, (y + 1) % size),
          kind === 'panel' ? 0.65 : 2,
        ).normalize();
        rgb = n.toArray().map((v) => byte((v * 0.5 + 0.5) * 255));
      }
      png.data.set([...rgb, 255], offset);
    }
  const result = PNG.sync.write(png, { filterType: 4, deflateLevel: 9 });
  images.set(key, result);
  return result;
}

/** Finish only explicitly selected cabin surfaces; clone shared materials to protect the airframe. */
export function finishCockpit(cabin, select) {
  const materials = new Map();
  cabin.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const kind = select(mesh);
    if (!kind) return;
    if (!finishes[kind] || Array.isArray(mesh.material))
      throw Error(`Invalid cockpit finish: ${kind}`);
    let variants = materials.get(mesh.material);
    if (!variants) {
      variants = new Map();
      materials.set(mesh.material, variants);
    }
    if (!variants.has(kind)) {
      const material = mesh.material.clone();
      material.name += `-${kind}`;
      material.userData[tag] = kind;
      material.roughness = 1;
      if (!['paint', 'panel'].includes(kind)) material.metalness = 0;
      variants.set(kind, material);
    }
    mesh.material = variants.get(kind);
    // Per-triangle box projection avoids stretching on panel edges and supports merged geometry.
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    const p = geometry.attributes.position,
      uv = [],
      indices = [],
      a = new Vector3(),
      b = new Vector3(),
      c = new Vector3();
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i).multiply(mesh.scale);
      b.fromBufferAttribute(p, i + 1).multiply(mesh.scale);
      c.fromBufferAttribute(p, i + 2).multiply(mesh.scale);
      const n = b.clone().sub(a).cross(c.clone().sub(a));
      // Rounded primitives can contain collapsed pole triangles. They have no UV tangent frame.
      if (n.lengthSq() > 1e-18) indices.push(i, i + 1, i + 2);
      const axes = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)];
      const dominant = axes.indexOf(Math.max(...axes));
      const u = dominant === 0 ? 2 : 0,
        v = dominant === 1 ? 2 : 1;
      for (const point of [a, b, c])
        uv.push(
          point.getComponent(u) / finishes[kind].repeat,
          point.getComponent(v) / finishes[kind].repeat,
        );
    }
    geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    if (indices.length !== p.count) geometry.setIndex(indices);
    mesh.geometry = geometry;
  });
}

/** Embed PNGs in the GLTFExporter's single-buffer GLB. Keeps Node builds free of browser polyfills. */
export function embedCockpitTextures(bytes) {
  const jsonSize = bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.subarray(20, 20 + jsonSize).toString());
  const selected = doc.materials?.filter((m) => m.extras?.[tag]) ?? [];
  if (!selected.length) return bytes;
  const parts = [bytes.subarray(28 + jsonSize, 28 + jsonSize + doc.buffers[0].byteLength)];
  let length = parts[0].length;
  doc.samplers ??= [];
  doc.images ??= [];
  doc.textures ??= [];
  const sampler = doc.samplers.length;
  doc.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 });
  const textures = new Map();
  for (const material of selected) {
    const kind = material.extras[tag];
    for (const slot of ['basecolor', 'roughness', 'normal']) {
      const key = `${kind}-${slot}`;
      if (!textures.has(key)) {
        const padding = (4 - (length % 4)) % 4;
        parts.push(Buffer.alloc(padding));
        length += padding;
        const png = image(kind, slot),
          view = doc.bufferViews.length;
        doc.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: png.length });
        parts.push(png);
        length += png.length;
        const source = doc.images.length;
        doc.images.push({ name: `cockpit-${key}`, bufferView: view, mimeType: 'image/png' });
        const index = doc.textures.length;
        doc.textures.push({ sampler, source });
        textures.set(key, index);
      }
      const info = { index: textures.get(key) };
      if (slot === 'normal') material.normalTexture = { ...info, scale: finishes[kind].normal };
      else
        material.pbrMetallicRoughness[
          slot === 'basecolor' ? 'baseColorTexture' : 'metallicRoughnessTexture'
        ] = info;
    }
  }
  doc.buffers[0].byteLength = length;
  const json = Buffer.from(JSON.stringify(doc)),
    jsonPad = Buffer.alloc((4 - (json.length % 4)) % 4, 32);
  const binary = Buffer.concat([...parts, Buffer.alloc((4 - (length % 4)) % 4)]);
  const header = Buffer.alloc(20),
    binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + jsonPad.length + binary.length, 8);
  header.writeUInt32LE(json.length + jsonPad.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  binHeader.writeUInt32LE(binary.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, json, jsonPad, binHeader, binary]);
}

export async function writeCockpitTextures(directory, bytes) {
  const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const kinds = [...new Set(doc.materials?.map((m) => m.extras?.[tag]).filter(Boolean))].sort();
  if (!kinds.length) return [];
  await mkdir(`${directory}/textures`, { recursive: true });
  const entries = [];
  for (const kind of kinds)
    for (const slot of ['basecolor', 'roughness', 'normal']) {
      const path = `textures/cockpit-${kind}-${slot}.png`;
      await writeFile(`${directory}/${path}`, image(kind, slot));
      entries.push({ id: `cockpit-${kind}-${slot}`, path });
    }
  return entries;
}
