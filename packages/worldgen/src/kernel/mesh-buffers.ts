/**
 * Growable mesh builder keyed by material. Faces are emitted with explicit normals and the
 * winding is fixed to face the normal, so callers list corners in any order. Vertices are never
 * shared across faces with different normals (hard architectural edges), except inside caps.
 */

import { type Triangulation, triangulatePolygon } from './triangulate';
import {
  MATERIAL_SLOTS,
  type MaterialSlot,
  type MeshBuffers,
  type MeshGroup,
  type RGB,
  type Vec2,
  type Vec3,
} from './types';

interface Part {
  slot: MaterialSlot;
  ref: string;
  /** Divides emitted UVs (meters per texture repeat); undefined = 1:1. */
  uvScale: [number, number] | undefined;
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
}

export interface BuilderMark {
  lengths: Map<string, [vertices: number, indices: number]>;
}

export function materialKey(slot: MaterialSlot, ref: string): string {
  return `${slot}:${ref}`;
}

function toByte(value: number): number {
  const clamped = value < 0 ? 0 : value > 1 ? 1 : value;
  return Math.round(clamped * 255);
}

function facesNormal(a: Vec3, b: Vec3, c: Vec3, n: Vec3): boolean {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const acx = c[0] - a[0];
  const acy = c[1] - a[1];
  const acz = c[2] - a[2];
  const cx = aby * acz - abz * acy;
  const cy = abz * acx - abx * acz;
  const cz = abx * acy - aby * acx;
  return cx * n[0] + cy * n[1] + cz * n[2] >= 0;
}

export function normalize3(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

export class MeshBufferBuilder {
  private readonly parts = new Map<string, Part>();

  private part(slot: MaterialSlot, ref: string): Part {
    const key = materialKey(slot, ref);
    let part = this.parts.get(key);
    if (part === undefined) {
      part = {
        slot,
        ref,
        uvScale: undefined,
        positions: [],
        normals: [],
        uvs: [],
        colors: [],
        indices: [],
      };
      this.parts.set(key, part);
    }
    return part;
  }

  private pushVertex(part: Part, p: Vec3, n: Vec3, uv: Vec2, color: RGB): number {
    const index = part.positions.length / 3;
    part.positions.push(p[0], p[1], p[2]);
    part.normals.push(n[0], n[1], n[2]);
    const scale = part.uvScale;
    if (scale === undefined) part.uvs.push(uv[0], uv[1]);
    else part.uvs.push(uv[0] / scale[0], uv[1] / scale[1]);
    part.colors.push(toByte(color[0]), toByte(color[1]), toByte(color[2]));
    return index;
  }

  /**
   * Meters per texture repeat applied to every UV emitted for (slot, ref) from now on; set it
   * before emitting a building's faces so each texture repeats at its authored scale.
   */
  setUvScale(slot: MaterialSlot, ref: string, scale: [number, number] | undefined): void {
    this.part(slot, ref).uvScale = scale;
  }

  addTriangle(
    slot: MaterialSlot,
    ref: string,
    p: readonly [Vec3, Vec3, Vec3],
    n: Vec3,
    uv: readonly [Vec2, Vec2, Vec2],
    color: RGB,
  ): void {
    const part = this.part(slot, ref);
    const a = this.pushVertex(part, p[0], n, uv[0], color);
    const b = this.pushVertex(part, p[1], n, uv[1], color);
    const c = this.pushVertex(part, p[2], n, uv[2], color);
    if (facesNormal(p[0], p[1], p[2], n)) part.indices.push(a, b, c);
    else part.indices.push(a, c, b);
  }

  addQuad(
    slot: MaterialSlot,
    ref: string,
    p: readonly [Vec3, Vec3, Vec3, Vec3],
    n: Vec3,
    uv: readonly [Vec2, Vec2, Vec2, Vec2],
    color: RGB,
  ): void {
    const part = this.part(slot, ref);
    const a = this.pushVertex(part, p[0], n, uv[0], color);
    const b = this.pushVertex(part, p[1], n, uv[1], color);
    const c = this.pushVertex(part, p[2], n, uv[2], color);
    const d = this.pushVertex(part, p[3], n, uv[3], color);
    if (facesNormal(p[0], p[1], p[2], n)) part.indices.push(a, b, c, a, c, d);
    else part.indices.push(a, c, b, a, d, c);
  }

  /** Fan-triangulate a convex polygon (used for gable pentagons). */
  addConvexPolygon(
    slot: MaterialSlot,
    ref: string,
    points: readonly Vec3[],
    n: Vec3,
    uvOf: (p: Vec3) => Vec2,
    color: RGB,
  ): void {
    if (points.length < 3) return;
    const part = this.part(slot, ref);
    const indices = points.map((point) => this.pushVertex(part, point, n, uvOf(point), color));
    const first = points[0] as Vec3;
    for (let index = 1; index + 1 < points.length; index++) {
      const b = points[index] as Vec3;
      const c = points[index + 1] as Vec3;
      const ia = indices[0] as number;
      const ib = indices[index] as number;
      const ic = indices[index + 1] as number;
      if (facesNormal(first, b, c, n)) part.indices.push(ia, ib, ic);
      else part.indices.push(ia, ic, ib);
    }
  }

  /**
   * Triangulated cap over a ring with holes. `heightOf` gives each 2D vertex its y so caps can
   * lie on sloped planes; `n` is the shared face normal. Returns false when triangulation fails.
   */
  addCap(
    slot: MaterialSlot,
    ref: string,
    outer: readonly Vec2[],
    holes: readonly (readonly Vec2[])[],
    heightOf: (p: Vec2) => number,
    n: Vec3,
    uvOf: (p: Vec2) => Vec2,
    color: RGB,
  ): boolean {
    const triangulation: Triangulation | undefined = triangulatePolygon(outer, holes);
    if (triangulation === undefined) return false;
    const part = this.part(slot, ref);
    const points: Vec3[] = triangulation.vertices.map((point) => [
      point[0],
      heightOf(point),
      point[1],
    ]);
    const base = points.map((point, index) =>
      this.pushVertex(part, point, n, uvOf(triangulation.vertices[index] as Vec2), color),
    );
    for (let index = 0; index + 2 < triangulation.indices.length; index += 3) {
      const ia = triangulation.indices[index] as number;
      const ib = triangulation.indices[index + 1] as number;
      const ic = triangulation.indices[index + 2] as number;
      const a = points[ia] as Vec3;
      const b = points[ib] as Vec3;
      const c = points[ic] as Vec3;
      if (facesNormal(a, b, c, n)) {
        part.indices.push(base[ia] as number, base[ib] as number, base[ic] as number);
      } else {
        part.indices.push(base[ia] as number, base[ic] as number, base[ib] as number);
      }
    }
    return true;
  }

  /** Merge already generated geometry, preserving per-building UVs and vertex colors. */
  append(source: MeshBufferBuilder): void {
    for (const sourcePart of source.parts.values()) {
      if (sourcePart.indices.length === 0) continue;
      const target = this.part(sourcePart.slot, sourcePart.ref);
      const offset = target.positions.length / 3;
      for (const value of sourcePart.positions) target.positions.push(value);
      for (const value of sourcePart.normals) target.normals.push(value);
      for (const value of sourcePart.uvs) target.uvs.push(value);
      for (const value of sourcePart.colors) target.colors.push(value);
      for (const value of sourcePart.indices) target.indices.push(value + offset);
    }
  }

  materialKeys(): string[] {
    return [...this.parts.entries()]
      .filter(([, part]) => part.indices.length > 0)
      .map(([key]) => key);
  }

  mark(): BuilderMark {
    const lengths = new Map<string, [number, number]>();
    for (const [key, part] of this.parts) {
      lengths.set(key, [part.positions.length, part.indices.length]);
    }
    return { lengths };
  }

  /** Highest vertex emitted since a mark, without inspecting earlier buildings. */
  maxYSince(mark: BuilderMark): number {
    let max = Number.NEGATIVE_INFINITY;
    for (const [key, part] of this.parts) {
      for (let i = (mark.lengths.get(key)?.[0] ?? 0) + 1; i < part.positions.length; i += 3)
        max = Math.max(max, part.positions[i] as number);
    }
    return max;
  }

  /** Fit recently emitted geometry vertically; normals use the inverse scale. */
  transformYSince(mark: BuilderMark, origin: number, target: number, scale: number): void {
    for (const [key, part] of this.parts) {
      for (let i = mark.lengths.get(key)?.[0] ?? 0; i < part.positions.length; i += 3) {
        part.positions[i + 1] = target + ((part.positions[i + 1] as number) - origin) * scale;
        const n = normalize3([
          part.normals[i] as number,
          (part.normals[i + 1] as number) / scale,
          part.normals[i + 2] as number,
        ]);
        part.normals[i] = n[0];
        part.normals[i + 1] = n[1];
        part.normals[i + 2] = n[2];
      }
    }
  }

  rollback(mark: BuilderMark): void {
    for (const [key, part] of this.parts) {
      const saved = mark.lengths.get(key);
      const [positions, indices] = saved ?? [0, 0];
      part.positions.length = positions;
      part.normals.length = positions;
      part.uvs.length = (positions / 3) * 2;
      part.colors.length = positions;
      part.indices.length = indices;
    }
  }

  vertexCount(): number {
    let count = 0;
    for (const part of this.parts.values()) count += part.positions.length / 3;
    return count;
  }

  triangleCount(): number {
    let count = 0;
    for (const part of this.parts.values()) count += part.indices.length / 3;
    return count;
  }

  /** Approximate GPU bytes for the current content. */
  bytes(): number {
    const vertices = this.vertexCount();
    let indices = 0;
    for (const part of this.parts.values()) indices += part.indices.length;
    return vertices * (12 + 12 + 8 + 3) + indices * 4;
  }

  groupCount(): number {
    let count = 0;
    for (const part of this.parts.values()) if (part.indices.length > 0) count++;
    return count;
  }

  isEmpty(): boolean {
    return this.triangleCount() === 0;
  }

  finalize(): MeshBuffers {
    const ordered = [...this.parts.values()]
      .filter((part) => part.indices.length > 0)
      .sort(
        (a, b) =>
          MATERIAL_SLOTS.indexOf(a.slot) - MATERIAL_SLOTS.indexOf(b.slot) ||
          (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0),
      );
    let vertexTotal = 0;
    let indexTotal = 0;
    for (const part of ordered) {
      vertexTotal += part.positions.length / 3;
      indexTotal += part.indices.length;
    }
    const positions = new Float32Array(vertexTotal * 3);
    const normals = new Float32Array(vertexTotal * 3);
    const uvs = new Float32Array(vertexTotal * 2);
    const colors = new Uint8Array(vertexTotal * 3);
    const indices = new Uint32Array(indexTotal);
    const groups: MeshGroup[] = [];
    let vertexOffset = 0;
    let indexOffset = 0;
    for (const part of ordered) {
      positions.set(part.positions, vertexOffset * 3);
      normals.set(part.normals, vertexOffset * 3);
      uvs.set(part.uvs, vertexOffset * 2);
      colors.set(part.colors, vertexOffset * 3);
      for (let index = 0; index < part.indices.length; index++) {
        indices[indexOffset + index] = (part.indices[index] as number) + vertexOffset;
      }
      groups.push({
        start: indexOffset,
        count: part.indices.length,
        slot: part.slot,
        materialRef: part.ref,
      });
      vertexOffset += part.positions.length / 3;
      indexOffset += part.indices.length;
    }
    return {
      positions,
      normals,
      uvs,
      colors,
      indices,
      groups,
      vertexCount: vertexTotal,
      triangleCount: indexTotal / 3,
      bytes:
        positions.byteLength +
        normals.byteLength +
        uvs.byteLength +
        colors.byteLength +
        indices.byteLength,
    };
  }
}
