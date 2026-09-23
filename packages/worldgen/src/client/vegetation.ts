/** Shared, opaque vegetation meshes. Built once per library, never once per placement. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Point = [number, number, number];

function colored(geometry: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  // All parts use the same attribute layout so bark and foliage share one draw call.
  geometry.deleteAttribute('uv');
  const positions = geometry.getAttribute('position');
  const color = new THREE.Color(hex);
  const colors = new Float32Array(positions.count * 3);
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox as THREE.Box3;
  const height = Math.max(0.01, bounds.max.y - bounds.min.y);
  for (let i = 0; i < positions.count; i++) {
    const t = (positions.getY(i) - bounds.min.y) / height;
    const shade = 0.78 + 0.22 * t;
    colors.set([color.r * shade, color.g * shade, color.b * shade], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const result = geometry.index === null ? geometry : geometry.toNonIndexed();
  if (result !== geometry) geometry.dispose();
  result.computeBoundingSphere();
  return result;
}

function stem(height: number, radius: number, hex: string): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(radius * 0.4, radius, height, 6);
  geometry.translate(0, height / 2, 0);
  return colored(geometry, hex);
}

/** A closed crown with overlapping branch contours, not separate horizontal skirts. */
function evergreen(pine: boolean, coarse: boolean): THREE.BufferGeometry {
  const height = pine ? 11.8 : 13.6;
  const radius = pine ? 3.5 : 3.15;
  const base = pine ? 0.19 : 0.08;
  // Bottom pole to tip. The gently scalloped contour stays solid even from below.
  const profile: Array<[number, number]> = [
    [0, 0],
    [0.035, 0.72],
    [0.12, 1],
    [0.23, 0.83],
    [0.3, 0.87],
    [0.42, 0.65],
    [0.49, 0.69],
    [0.62, 0.45],
    [0.7, 0.48],
    [0.83, 0.25],
    [1, 0],
  ];
  const sides = coarse ? 6 : 12;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let ring = 0; ring < profile.length; ring++) {
    const [t, width] = profile[ring] as [number, number];
    for (let side = 0; side < sides; side++) {
      const angle = (side / sides) * Math.PI * 2;
      const lobe = 1 + 0.13 * Math.sin(angle * 5 + ring * 0.8) + 0.08 * Math.cos(angle * 3 - ring);
      const r = radius * width * lobe;
      const droop = width * 0.15 * Math.sin(angle * 5 + ring);
      positions.push(
        Math.cos(angle) * r + Math.sin(t * 4) * 0.16,
        height * (base + t * (1 - base)) + droop,
        Math.sin(angle) * r * (pine ? 0.86 : 0.94),
      );
      if (ring === 0) continue;
      const a = (ring - 1) * sides + side;
      const b = (ring - 1) * sides + ((side + 1) % sides);
      const c = ring * sides + side;
      const d = ring * sides + ((side + 1) % sides);
      if (ring > 1) indices.push(a, c, b);
      if (ring < profile.length - 1) indices.push(b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return combine([
    stem(height * 0.48, pine ? 0.29 : 0.32, '#70533b'),
    colored(geometry, pine ? '#577b45' : '#3e7052'),
  ]);
}

function crown(
  center: Point,
  scale: Point,
  hex: string,
  phase: number,
  coarse = false,
): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(1, coarse ? 0 : 1);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    // Coordinate-based perturbation keeps coincident vertices together (no cracks).
    const bulge = 1 + 0.09 * Math.sin(x * 7 + y * 4 + phase) * Math.cos(z * 6 - phase);
    positions.setXYZ(i, x * bulge, y * bulge, z * bulge);
  }
  geometry.scale(...scale);
  geometry.translate(...center);
  geometry.computeVertexNormals();
  return colored(geometry, hex);
}

function broadleaf(birch: boolean, coarse: boolean): THREE.BufferGeometry {
  const parts = [stem(birch ? 7 : 5.6, birch ? 0.19 : 0.38, birch ? '#c8c2a2' : '#73523a')];
  const spread = birch ? 1.15 : 1.9;
  for (let i = 0; i < 4; i++) {
    const angle = i * 2.4;
    parts.push(
      crown(
        [Math.cos(angle) * spread, (birch ? 5.6 : 4.7) + i * 0.55, Math.sin(angle) * spread],
        birch ? [1.7, 2.7, 1.6] : [2.6, 2.45, 2.3],
        birch
          ? (['#7c9854', '#8ba55b', '#76974f', '#9bad64'][i] as string)
          : (['#547d3e', '#658b46', '#718f48', '#608640'][i] as string),
        i,
        coarse,
      ),
    );
  }
  parts.push(
    crown(
      [0.25, birch ? 9 : 7.6, -0.15],
      birch ? [1.6, 2.3, 1.6] : [2.6, 2.5, 2.4],
      birch ? '#9eaf66' : '#78984e',
      5,
      coarse,
    ),
  );
  return combine(parts);
}

function combine(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (geometry === null) throw new Error('vegetation geometry attributes must match');
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Meter-sized trees and ground features. No textures or asset loader. */
export function createVegetationGeometry(
  name: string,
  coarse: boolean | 'distant' = false,
): THREE.BufferGeometry | undefined {
  if (coarse === 'distant') {
    if (name.startsWith('tree.conifer')) {
      const pine = name.endsWith('pine');
      const height = pine ? 11.8 : 13.6;
      const geometry = new THREE.ConeGeometry(pine ? 3.5 : 3.15, height, 6);
      geometry.translate(0, height / 2, 0);
      return colored(geometry, pine ? '#577b45' : '#3e7052');
    }
    if (name.startsWith('tree.deciduous')) {
      const birch = name.endsWith('birch');
      return crown(
        [0, birch ? 6.4 : 5.7, 0],
        birch ? [2.8, 4.9, 2.8] : [4.4, 4.4, 4.2],
        birch ? '#8ba55b' : '#658b46',
        1,
        true,
      );
    }
    if (name === 'shrub') return crown([0, 0.9, 0], [1.7, 0.95, 1.45], '#628247', 1, true);
    coarse = true;
  }
  switch (name) {
    case 'tree.conifer':
    case 'tree.conifer.fir':
      return evergreen(false, coarse);
    case 'tree.conifer.pine':
      return evergreen(true, coarse);
    case 'tree.deciduous':
    case 'tree.deciduous.oak':
      return broadleaf(false, coarse);
    case 'tree.deciduous.birch':
      return broadleaf(true, coarse);
    case 'shrub':
      return combine([
        crown([0, 0.9, 0], [1.15, 0.95, 0.95], '#628247', 1, coarse),
        crown([0.8, 0.65, 0.15], [0.85, 0.7, 0.8], '#759251', 2, coarse),
        crown([-0.55, 0.55, 0.5], [0.8, 0.6, 0.75], '#527540', 3, coarse),
      ]);
    case 'rock':
      return crown([0, 0.6, 0], [1.2, 0.85, 0.9], '#92958b', 7, coarse);
    default:
      return undefined;
  }
}
