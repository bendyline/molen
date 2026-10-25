import type { LiveryData, LiveryGraphic, LiveryPaint, LiverySlot } from '@bendyline/molen-schema';
import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

export interface LiveryVisual {
  readonly warnings: readonly string[];
  /** Restore originals and release only the resources owned by this livery. */
  dispose(): void;
}

function inside(x: number, y: number, points: [number, number][]): boolean {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i] as [number, number],
      b = points[j] as [number, number];
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
      hit = !hit;
  }
  return hit;
}

function textureFrom(bytes: Uint8Array, size: number): THREE.DataTexture {
  const texture = new THREE.DataTexture(bytes, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Flat vector artwork, including outlined text; no browser fonts or image downloads. */
export function liveryGraphicTexture(graphic: LiveryGraphic, size = 256): THREE.DataTexture {
  const bytes = new Uint8Array(size * size * 4);
  for (const shape of graphic.shapes) {
    const hex = Number.parseInt(shape.color.slice(1), 16);
    const xs = shape.points.map((p) => p[0]),
      ys = shape.points.map((p) => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs) * size)),
      x1 = Math.min(size, Math.ceil(Math.max(...xs) * size));
    const y0 = Math.max(0, Math.floor(Math.min(...ys) * size)),
      y1 = Math.min(size, Math.ceil(Math.max(...ys) * size));
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        if (!inside((x + 0.5) / size, (y + 0.5) / size, shape.points)) continue;
        const i = (y * size + x) * 4;
        bytes[i] = (hex >> 16) & 255;
        bytes[i + 1] = (hex >> 8) & 255;
        bytes[i + 2] = hex & 255;
        bytes[i + 3] = 255;
      }
  }
  return textureFrom(bytes, size);
}

function camouflageTexture(pattern: NonNullable<LiveryPaint['camouflage']>): THREE.DataTexture {
  const size = 128,
    bytes = new Uint8Array(size * size * 4);
  const hash = (x: number, y: number): number => {
    let h = Math.imul((x & 7) + 31 * (y & 7), 374761393) ^ pattern.seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const fx = (x * 8) / size,
        fy = (y * 8) / size,
        ix = Math.floor(fx),
        iy = Math.floor(fy);
      let u = fx - ix,
        v = fy - iy;
      u = u * u * (3 - 2 * u);
      v = v * v * (3 - 2 * v);
      const n = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u),
        THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u),
        v,
      );
      const color = pattern.colors[
        Math.min(pattern.colors.length - 1, Math.floor(n * pattern.colors.length))
      ] as string;
      const hex = Number.parseInt(color.slice(1), 16),
        i = (y * size + x) * 4;
      bytes[i] = (hex >> 16) & 255;
      bytes[i + 1] = (hex >> 8) & 255;
      bytes[i + 2] = hex & 255;
      bytes[i + 3] = 255;
    }
  const texture = textureFrom(bytes, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.channel = 3;
  texture.repeat.setScalar(pattern.scale);
  return texture;
}

const materialsOf = (mesh: THREE.Mesh): THREE.Material[] =>
  Array.isArray(mesh.material) ? mesh.material : [mesh.material];
// Remember bind-pose matrices across selections, even after a door/control surface has moved.
const restMatrices = new WeakMap<THREE.Object3D, Map<THREE.Mesh, THREE.Matrix4>>();

/** Extract just a slot's triangles, including material arrays with geometry groups. */
function surfaceGeometry(mesh: THREE.Mesh, names: Set<string>): THREE.BufferGeometry {
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const materials = materialsOf(mesh),
    groups = Array.isArray(mesh.material)
      ? source.groups
      : [{ start: 0, count: source.getAttribute('position').count, materialIndex: 0 }];
  const positions: number[] = [],
    normals: number[] = [];
  const p = source.getAttribute('position'),
    n = source.getAttribute('normal');
  for (const group of groups) {
    if (!names.has(materials[group.materialIndex ?? 0]?.name ?? '')) continue;
    for (let i = group.start; i < Math.min(p.count, group.start + group.count); i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      if (n) normals.push(n.getX(i), n.getY(i), n.getZ(i));
    }
  }
  source.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  else geometry.computeVertexNormals();
  return geometry;
}

function projectPaint(
  mesh: THREE.Mesh,
  bounds: THREE.Box3,
  transform: THREE.Matrix4,
  names: readonly string[],
): THREE.BufferGeometry {
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const p = geometry.getAttribute('position'),
    uv = geometry.getAttribute('uv3')
      ? Float32Array.from(geometry.getAttribute('uv3').array)
      : new Float32Array(p.count * 2);
  const selected = new Uint8Array(p.count);
  if (!Array.isArray(mesh.material)) selected.fill(1);
  else
    for (const group of geometry.groups) {
      if (!names.includes(mesh.material[group.materialIndex ?? 0]?.name ?? '')) continue;
      selected.fill(1, group.start, Math.min(p.count, group.start + group.count));
    }
  const extent = bounds.getSize(new THREE.Vector3()),
    scale = Math.max(extent.x, extent.y, extent.z, 0.001);
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    if (!selected[i]) continue;
    a.fromBufferAttribute(p, i).applyMatrix4(transform);
    b.fromBufferAttribute(p, i + 1).applyMatrix4(transform);
    c.fromBufferAttribute(p, i + 2).applyMatrix4(transform);
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    const axis =
      Math.abs(normal.y) >= Math.max(Math.abs(normal.x), Math.abs(normal.z))
        ? 'y'
        : Math.abs(normal.x) > Math.abs(normal.z)
          ? 'x'
          : 'z';
    for (const [j, point] of [a, b, c].entries()) {
      uv[(i + j) * 2] =
        ((axis === 'x' ? point.z : point.x) - (axis === 'x' ? bounds.min.z : bounds.min.x)) / scale;
      uv[(i + j) * 2 + 1] =
        ((axis === 'y' ? point.z : point.y) - (axis === 'y' ? bounds.min.z : bounds.min.y)) / scale;
    }
  }
  geometry.setAttribute('uv3', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

/** Apply to an instance, never a cache template. Does not mutate shared materials or geometry. */
export function applyLivery(model: THREE.Object3D, data: LiveryData): LiveryVisual {
  const variant = data.variants.find((v) => v.id === data.selected);
  if (!variant) throw new Error(`Unknown livery: ${data.selected}`);
  const warnings: string[] = [];
  const originals = new Map<
    THREE.Mesh,
    { material: THREE.Mesh['material']; geometry: THREE.BufferGeometry }
  >();
  const materials = new Set<THREE.Material>(),
    geometries = new Set<THREE.BufferGeometry>(),
    textures = new Set<THREE.Texture>();
  const decals: THREE.Mesh[] = [];
  const remember = (mesh: THREE.Mesh): void => {
    if (!originals.has(mesh))
      originals.set(mesh, { material: mesh.material, geometry: mesh.geometry });
  };
  model.updateWorldMatrix(true, true);
  const rootInverse = model.matrixWorld.clone().invert();
  let rest = restMatrices.get(model);
  if (!rest) {
    rest = new Map();
    model.traverse((object) => {
      if (object instanceof THREE.Mesh)
        rest?.set(object, rootInverse.clone().multiply(object.matrixWorld));
    });
    restMatrices.set(model, rest);
  }
  const matrix = (mesh: THREE.Mesh): THREE.Matrix4 =>
    (rest?.get(mesh) ?? rootInverse.clone().multiply(mesh.matrixWorld)).clone();
  const slots = new Map<
    string,
    { meshes: THREE.Mesh[]; bounds: THREE.Box3; binding: LiverySlot }
  >();
  for (const [name, binding] of Object.entries(data.slots)) {
    const subtree = binding.node === undefined ? model : model.getObjectByName(binding.node);
    const meshes: THREE.Mesh[] = [],
      bounds = new THREE.Box3();
    subtree?.traverse((object) => {
      if (
        !(object instanceof THREE.Mesh) ||
        !materialsOf(object).some((m) => binding.materials.includes(m.name))
      )
        return;
      if ((object as THREE.SkinnedMesh).isSkinnedMesh || object.morphTargetInfluences?.length) {
        warnings.push(`Slot ${name}: deforming mesh ${object.name} is unsupported`);
        return;
      }
      meshes.push(object);
      const surface = surfaceGeometry(object, new Set(binding.materials));
      surface.applyMatrix4(matrix(object));
      surface.computeBoundingBox();
      if (surface.boundingBox) bounds.union(surface.boundingBox);
      surface.dispose();
    });
    if (!meshes.length || bounds.isEmpty()) warnings.push(`Slot ${name}: no matching surface`);
    slots.set(name, { meshes, bounds, binding });
  }
  const painted = new Map<THREE.Mesh, Set<number>>();
  for (const [name, paint] of Object.entries(variant.paints)) {
    const slot = slots.get(name);
    if (!slot || slot.bounds.isEmpty()) {
      warnings.push(`Paint ${name}: missing slot`);
      continue;
    }
    const clones = new Map<THREE.Material, THREE.Material>();
    const texture = paint.camouflage ? camouflageTexture(paint.camouflage) : undefined;
    if (texture) textures.add(texture);
    for (const mesh of slot.meshes) {
      remember(mesh);
      const used = painted.get(mesh) ?? new Set<number>();
      painted.set(mesh, used);
      const next = materialsOf(mesh).map((source, index) => {
        if (!slot.binding.materials.includes(source.name)) return source;
        if (used.has(index)) {
          warnings.push(`Paint ${name}: overlapping slot on ${mesh.name}`);
          return source;
        }
        used.add(index);
        let clone = clones.get(source);
        if (!clone) {
          clone = source.clone();
          clones.set(source, clone);
          materials.add(clone);
          if ('color' in clone) (clone as THREE.MeshStandardMaterial).color.set(paint.color);
          if ('roughness' in clone && paint.roughness !== undefined)
            (clone as THREE.MeshStandardMaterial).roughness = paint.roughness;
          if ('metalness' in clone && paint.metalness !== undefined)
            (clone as THREE.MeshStandardMaterial).metalness = paint.metalness;
          if ('map' in clone) (clone as THREE.MeshStandardMaterial).map = texture ?? null;
          if ('vertexColors' in clone) (clone as THREE.MeshStandardMaterial).vertexColors = false;
          if (texture && 'color' in clone)
            (clone as THREE.MeshStandardMaterial).color.set('#ffffff');
          clone.needsUpdate = true;
        }
        return clone;
      });
      mesh.material = Array.isArray(mesh.material) ? next : (next[0] as THREE.Material);
      if (texture) {
        mesh.geometry = projectPaint(mesh, slot.bounds, matrix(mesh), slot.binding.materials);
        geometries.add(mesh.geometry);
      }
    }
  }
  for (const marking of variant.markings ?? []) {
    const anchor = data.anchors?.[marking.anchor],
      slot = anchor && slots.get(anchor.slot);
    if (!anchor || !slot || slot.bounds.isEmpty()) {
      warnings.push(`Marking ${marking.anchor}: missing surface`);
      continue;
    }
    const extent = slot.bounds.getSize(new THREE.Vector3());
    const position = new THREE.Vector3(...anchor.position).multiply(extent).add(slot.bounds.min);
    const size = new THREE.Vector3(...anchor.size).multiplyScalar(
      Math.max(extent.x, extent.y, extent.z),
    );
    const rotation = new THREE.Euler(...anchor.rotation);
    const direction = new THREE.Vector3(0, 0, 1).applyEuler(rotation);
    const texture = liveryGraphicTexture(marking.graphic);
    textures.add(texture);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      roughness: 0.65,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    materials.add(material);
    let count = 0;
    for (const mesh of slot.meshes) {
      const surface = surfaceGeometry(mesh, new Set(slot.binding.materials));
      const toRoot = matrix(mesh);
      surface.applyMatrix4(toRoot);
      const p = surface.getAttribute('position'),
        n = surface.getAttribute('normal'),
        indices: number[] = [];
      const doubleSided = materialsOf(mesh).some(
        (m) => slot.binding.materials.includes(m.name) && m.side === THREE.DoubleSide,
      );
      for (let i = 0; i < p.count; i += 3) {
        const facing = new THREE.Vector3().fromBufferAttribute(n, i).dot(direction);
        if (facing > 0.05) indices.push(i, i + 1, i + 2);
        else if (doubleSided && facing < -0.05) {
          // Thin, two-sided shells may be wound inward. Orient the projected sticker outward.
          indices.push(i, i + 2, i + 1);
          for (let j = i; j < i + 3; j++) n.setXYZ(j, -n.getX(j), -n.getY(j), -n.getZ(j));
        }
      }
      surface.setIndex(indices);
      const geometry = new DecalGeometry(new THREE.Mesh(surface), position, rotation, size);
      surface.dispose();
      if (!geometry.getAttribute('position').count) {
        geometry.dispose();
        continue;
      }
      geometry.applyMatrix4(toRoot.invert());
      geometries.add(geometry);
      const decal = new THREE.Mesh(geometry, material);
      decal.name = `livery:${marking.anchor}`;
      decal.userData.liveryMarking = true;
      decal.receiveShadow = true;
      decal.renderOrder = 1;
      mesh.add(decal);
      decals.push(decal);
      count++;
    }
    if (!count) warnings.push(`Marking ${marking.anchor}: projector misses its surface`);
  }
  let disposed = false;
  return {
    warnings,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const decal of decals) decal.removeFromParent();
      for (const [mesh, original] of originals) {
        mesh.material = original.material;
        mesh.geometry = original.geometry;
      }
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    },
  };
}
