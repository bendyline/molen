/**
 * Encode generated mesh buffers as a core glTF 2.0 binary (GLB): one mesh, one primitive per
 * material group, POSITION / NORMAL / TEXCOORD_0 / COLOR_0 attributes, unsigned-int indices, and
 * plain PBR materials. Uses DataView only, so it runs anywhere the core runs.
 */

import type { MeshBuffers } from './types';

export interface GlbMaterialMeta {
  name: string;
  /** Base color factor multiplied by COLOR_0; default white. */
  baseColorFactor?: [number, number, number, number];
  roughness?: number;
  metallic?: number;
}

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const FLOAT = 5126;
const UNSIGNED_BYTE = 5121;
const UNSIGNED_INT = 5125;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;

function align4(value: number): number {
  return (value + 3) & ~3;
}

function bounds(array: Float32Array, stride: number): { min: number[]; max: number[] } {
  const min = new Array<number>(stride).fill(Number.POSITIVE_INFINITY);
  const max = new Array<number>(stride).fill(Number.NEGATIVE_INFINITY);
  for (let index = 0; index < array.length; index += stride) {
    for (let axis = 0; axis < stride; axis++) {
      const value = array[index + axis] as number;
      min[axis] = Math.min(min[axis] as number, value);
      max[axis] = Math.max(max[axis] as number, value);
    }
  }
  if (array.length === 0) return { min: min.map(() => 0), max: max.map(() => 0) };
  return { min, max };
}

export function encodeGlb(
  buffers: MeshBuffers,
  materials: readonly GlbMaterialMeta[] = [],
  generator = '@bendyline/molen-worldgen',
): Uint8Array {
  const views: Array<{ data: Uint8Array; target: number }> = [];
  const bufferViews: Array<{ buffer: 0; byteOffset: number; byteLength: number; target: number }> =
    [];
  let binaryLength = 0;
  const addView = (array: ArrayBufferView, target: number): number => {
    binaryLength = align4(binaryLength);
    const data = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    bufferViews.push({ buffer: 0, byteOffset: binaryLength, byteLength: data.byteLength, target });
    views.push({ data, target });
    binaryLength += data.byteLength;
    return bufferViews.length - 1;
  };
  const positionView = addView(buffers.positions, ARRAY_BUFFER);
  const normalView = addView(buffers.normals, ARRAY_BUFFER);
  const uvView = addView(buffers.uvs, ARRAY_BUFFER);
  const colorView = addView(buffers.colors, ARRAY_BUFFER);
  const indexView = addView(buffers.indices, ELEMENT_ARRAY_BUFFER);
  binaryLength = align4(binaryLength);

  const positionBounds = bounds(buffers.positions, 3);
  const accessors: Record<string, unknown>[] = [
    {
      bufferView: positionView,
      componentType: FLOAT,
      count: buffers.vertexCount,
      type: 'VEC3',
      min: positionBounds.min,
      max: positionBounds.max,
    },
    { bufferView: normalView, componentType: FLOAT, count: buffers.vertexCount, type: 'VEC3' },
    { bufferView: uvView, componentType: FLOAT, count: buffers.vertexCount, type: 'VEC2' },
    {
      bufferView: colorView,
      componentType: UNSIGNED_BYTE,
      normalized: true,
      count: buffers.vertexCount,
      type: 'VEC3',
    },
  ];
  const primitives = buffers.groups.map((group, index) => {
    accessors.push({
      bufferView: indexView,
      byteOffset: group.start * 4,
      componentType: UNSIGNED_INT,
      count: group.count,
      type: 'SCALAR',
    });
    return {
      attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2, COLOR_0: 3 },
      indices: accessors.length - 1,
      material: index,
      mode: 4,
    };
  });
  const materialList = buffers.groups.map((group, index) => {
    const meta = materials[index];
    return {
      name: meta?.name ?? `${group.slot}:${group.materialRef}`,
      pbrMetallicRoughness: {
        baseColorFactor: meta?.baseColorFactor ?? [1, 1, 1, 1],
        metallicFactor: meta?.metallic ?? 0,
        roughnessFactor: meta?.roughness ?? 0.9,
      },
      doubleSided: false,
      alphaMode: 'OPAQUE',
    };
  });
  const json = {
    asset: { version: '2.0', generator },
    scene: 0,
    scenes: [{ name: 'Scene', nodes: [0] }],
    nodes: [{ name: 'worldgen', mesh: 0 }],
    meshes: [{ name: 'worldgen', primitives }],
    materials: materialList,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binaryLength }],
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const paddedJson = align4(jsonBytes.byteLength);
  const totalLength = 12 + 8 + paddedJson + 8 + binaryLength;
  const glb = new Uint8Array(totalLength);
  const view = new DataView(glb.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, paddedJson, true);
  view.setUint32(16, CHUNK_JSON, true);
  glb.fill(0x20, 20, 20 + paddedJson);
  glb.set(jsonBytes, 20);
  const binaryHeader = 20 + paddedJson;
  view.setUint32(binaryHeader, binaryLength, true);
  view.setUint32(binaryHeader + 4, CHUNK_BIN, true);
  const binaryStart = binaryHeader + 8;
  for (let index = 0; index < views.length; index++) {
    const entry = views[index] as { data: Uint8Array };
    const meta = bufferViews[index] as { byteOffset: number };
    glb.set(entry.data, binaryStart + meta.byteOffset);
  }
  return glb;
}
