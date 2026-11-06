import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import {
  markTerrainGroundSurface,
  TerrainGroundCutoutController,
  terrainGroundSourceGeometry,
} from '../../../../packages/terrain/src/ground-cutout.ts';
import {
  createReviewWater,
  mediumFiCameraFar,
  mediumFiCameraNear,
  mediumFiFocus,
} from './medium-fi-context.mjs';

test('local focus keeps standard views on a remote component without changing legacy cameras', () => {
  assert.deepEqual(mediumFiFocus(undefined, [1, 2, 3]), [1, 2, 3]);
  const focus = { center: [-15300, 4, -710] };
  assert.deepEqual(mediumFiFocus(focus, [0, 0, 0]), focus.center);
  assert.throws(() => mediumFiFocus({ center: [0, NaN, 0] }, [0, 0, 0]), /focus/);
  const position = [3000, 22000, 30000],
    look = [0, 0, 0];
  assert.equal(mediumFiCameraFar(3000, position, look, 16000, false), 3000);
  assert(mediumFiCameraFar(3000, position, look, 16000, true) > Math.hypot(...position) + 16000);
});

test('a distant corridor overview fits the near plane while a passage closeup stays unclipped', () => {
  const bounds = { center: [1200, 7, 2550], radius: 10925 };
  const near = mediumFiCameraNear([6700, 14800, 17100], [650, 0, 500], bounds);
  assert(near > 100 && near < 1000);
  assert.equal(mediumFiCameraNear([-3300, 80, -900], [-3200, 3, -850], bounds), 0.1);
});

test('native water preserves island holes, XZ orientation and independent reservoir levels', () => {
  const box = (x, z, w) => [
    [x, z],
    [x + w, z],
    [x + w, z + w],
    [x, z + w],
    [x, z],
  ];
  const input = {
      format: 'molen/review-water-surfaces@1',
      layers: [
        { name: 'sea', elevation: 0, polygons: [[box(-10, -30, 10), box(-7, -27, 2)]] },
        { name: 'reservoir', elevation: 35, polygons: [[box(20, 40, 8)]] },
      ],
    },
    before = JSON.stringify(input),
    water = createReviewWater(input, '#1b4450');
  water.updateMatrixWorld(true);
  const height = (x, z) => {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
    return ray.intersectObject(water, true)[0]?.point.y;
  };
  assert.equal(height(-9, -29), 0);
  assert.equal(height(-6, -26), undefined);
  assert.equal(height(-9, 29), undefined);
  assert.equal(height(22, 42), 35);
  assert.equal(JSON.stringify(input), before);
  assert.equal(water.userData.reviewWater.holes, 1);
  for (const mesh of water.children) mesh.geometry.dispose();
  water.children[0].material.dispose();
});

test('malformed water input fails before it can silently fill a site with a plane', () => {
  assert.throws(() => createReviewWater({ layers: [] }, '#123456'), /fixture/);
  assert.throws(
    () =>
      createReviewWater(
        {
          format: 'molen/review-water-surfaces@1',
          layers: [{ elevation: Infinity, polygons: [] }],
        },
        '#123456',
      ),
    /layer/,
  );
});

test('optional native shorelines clear only mapped water while preserving the source terrain', () => {
  const square = (a, b) => [
    [a, a],
    [b, a],
    [b, b],
    [a, b],
    [a, a],
  ];
  const water = createReviewWater(
    {
      format: 'molen/review-water-surfaces@1',
      clipTerrain: true,
      layers: [{ elevation: 2, polygons: [[square(-4, 4), square(-1, 1)]] }],
    },
    '#1b4450',
  );
  const source = new THREE.PlaneGeometry(20, 20).rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(source);
  ground.position.y = 3;
  markTerrainGroundSurface(ground);
  const scene = new THREE.Group();
  scene.add(ground, water);
  scene.updateMatrixWorld(true);
  new TerrainGroundCutoutController().update(scene);
  const groundAt = (x, z) =>
    new THREE.Raycaster(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0)).intersectObject(
      ground,
    ).length > 0;
  assert.equal(groundAt(2, 2), false);
  assert.equal(groundAt(0, 0), true);
  assert.equal(groundAt(8, 8), true);
  assert.equal(terrainGroundSourceGeometry(ground), source);
});
