/** Optional, data-only geographic context for model authoring captures. */
import * as THREE from 'three';
import {
  markTerrainGroundSurface,
  setTerrainShorelineCutouts,
} from '../../../../packages/terrain/src/ground-cutout.ts';
import { reviewClipping } from './landmark-capture-clipping.mjs';

const point = (p, dimensions) =>
  Array.isArray(p) && p.length === dimensions && p.every(Number.isFinite);

export function mediumFiFocus(value, fallback) {
  if (value === undefined) return [...fallback];
  if (!value || !point(value.center, 3)) throw new Error('Invalid review focus');
  return [...value.center];
}

/** Long models need a local focus and a far plane that also admits explicit overview cameras. */
export function mediumFiCameraFar(base, position, lookAt, radius, focused) {
  if (!focused) return base;
  return Math.max(base, Math.hypot(...position.map((v, i) => v - lookAt[i])) + radius * 2 + 1);
}

/** Keep distant water and terrain separable in the depth buffer for corridor overviews. */
export function mediumFiCameraNear(position, lookAt, sphere) {
  const forward = lookAt.map((v, i) => v - position[i]);
  const distance = Math.hypot(...forward);
  const localNear = Math.max(0.1, distance * 0.00005);
  if (sphere.radius < 3000 || distance === 0) return localNear;
  const centerDepth = sphere.center.reduce(
    (sum, value, i) => sum + ((value - position[i]) * forward[i]) / distance,
    0,
  );
  return Math.max(
    localNear,
    reviewClipping(centerDepth - sphere.radius, centerDepth + sphere.radius).near,
  );
}

/** Native map polygons retain islands/holes and independently declared water levels. */
export function createReviewWater(document, color) {
  if (
    document?.format !== 'molen/review-water-surfaces@1' ||
    !Array.isArray(document.layers) ||
    !document.layers.length ||
    document.layers.length > 16
  )
    throw new Error('Invalid review water fixture');
  const group = new THREE.Group();
  group.name = 'native-map-review-water';
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.23, metalness: 0.08 });
  let vertices = 0;
  const stats = {
    layers: document.layers.length,
    elevations: [],
    polygons: 0,
    holes: 0,
    triangles: 0,
  };
  try {
    for (const layer of document.layers) {
      if (
        !Number.isFinite(layer.elevation) ||
        !Array.isArray(layer.polygons) ||
        !layer.polygons.length
      )
        throw new Error('Invalid review water layer');
      const shapes = layer.polygons.map((polygon) => {
        if (!Array.isArray(polygon) || !polygon.length) throw new Error('Invalid water polygon');
        const rings = polygon.map((ring) => {
          if (!Array.isArray(ring) || ring.length < 3 || !ring.every((p) => point(p, 2)))
            throw new Error('Invalid water ring');
          vertices += ring.length;
          if (vertices > 200000) throw new Error('Review water exceeds vertex budget');
          return ring.map(([x, z]) => new THREE.Vector2(x, -z));
        });
        const shape = new THREE.Shape(rings[0]);
        shape.holes = rings.slice(1).map((ring) => new THREE.Path(ring));
        stats.polygons++;
        stats.holes += rings.length - 1;
        return shape;
      });
      const geometry = new THREE.ShapeGeometry(shapes).rotateX(-Math.PI / 2);
      const water = new THREE.Mesh(geometry, material);
      water.name = layer.name ?? 'mapped-water';
      water.position.y = layer.elevation;
      water.receiveShadow = true;
      group.add(water);
      stats.elevations.push(layer.elevation);
      const indices = geometry.getIndex();
      stats.triangles += indices.count / 3;
      if (document.clipTerrain === true) {
        const positions = geometry.getAttribute('position');
        const outlines = [];
        for (let i = 0; i < indices.count; i += 3) {
          outlines.push(
            [i, i + 1, i + 2].map((index) => {
              const v = indices.getX(index);
              return [positions.getX(v), positions.getZ(v)];
            }),
          );
        }
        // The mesh's world transform already contributes the declared water elevation.
        setTerrainShorelineCutouts(
          water,
          outlines,
          outlines.map(() => 0),
        );
        stats.shorelineCutouts = true;
      }
    }
  } catch (error) {
    for (const mesh of group.children) mesh.geometry.dispose();
    material.dispose();
    throw error;
  }
  group.userData.reviewWater = stats;
  return group;
}

/** Connect mapped shorelines to the same rendered terrain triangles used in the review. */
export async function addReviewWaterBanks(group, document, context, color) {
  const { buildTerrainWaterBanks } = await import(
    '../../../../packages/terrain/src/water-shoreline.ts'
  );
  const { origin, tileSize } = context;
  const ring = (points) =>
    points.map(([x, z]) => [(x - origin[0]) / tileSize, (z - origin[1]) / tileSize]);
  const waters = document.layers.flatMap(({ elevation, polygons }) =>
    polygons.map(([outer, ...holes]) => ({
      height: elevation,
      polygon: { outer: ring(outer), holes: holes.map(ring) },
    })),
  );
  const geometry = buildTerrainWaterBanks(waters, context, 0);
  if (!geometry) return;
  const bank = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide }),
  );
  bank.name = 'native-map-review-water-banks';
  // Like the viewer's native banks, these accept model openings and ignore water's own cuts.
  markTerrainGroundSurface(bank, false);
  bank.position.set(origin[0], 0, origin[1]);
  group.add(bank);
  group.userData.reviewWater.bankTriangles = geometry.getAttribute('position').count / 3;
}
