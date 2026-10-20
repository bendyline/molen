/** Inspect actual imported levels against the original survey, independently of recipe constants. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { hashBytes } from '../../../../../../../packages/worldgen/scripts/structure-model-files.mjs';

const dir = new URL('.', import.meta.url),
  root = new URL('../../../../../../../', dir),
  runtime = new URL('content/worldgen/assets/places/dq/dqc/phoenix_shot_tower/', root),
  read = (n) => JSON.parse(fs.readFileSync(new URL(n, dir))),
  controls = read('survey-controls.json'),
  side = JSON.parse(fs.readFileSync(new URL('asset.json', runtime))),
  req = createRequire(new URL('packages/worldgen/package.json', root)),
  T = req('three'),
  { GLTFLoader } = await import(req.resolve('three/addons/loaders/GLTFLoader.js')),
  results = [];
assert.equal(hashBytes(fs.readFileSync(new URL('models/source.glb', dir))), side.sourceHash);
for (const [index, level] of side.runtimeLods.levels.entries()) {
  const bytes = fs.readFileSync(new URL(level.file, runtime));
  assert.equal(hashBytes(bytes), level.hash);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  gltf.scene.traverse((m) => {
    if (!m.isMesh) return;
    for (const material of Array.isArray(m.material) ? m.material : [m.material])
      material.side = T.DoubleSide;
  });
  gltf.scene.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(gltf.scene),
    ray = (a, y) =>
      new T.Raycaster(
        new T.Vector3(10 * Math.sin(a), y, 10 * Math.cos(a)),
        new T.Vector3(-Math.sin(a), 0, -Math.cos(a)),
        0.001,
        20,
      ).intersectObject(gltf.scene, true)[0];
  assert(box.max.y > 65.8 && box.max.y < 66.2, 'exposed tower must not retain the old71mheight');
  if (index > 1) assert(Math.abs(box.max.y - 66.1888) < 0.005, 'current conductor/roof height');
  let crownHits = 0,
    crownGaps = 0,
    wallHits = 0;
  for (let i = 0; i < controls.battlements; i++) {
    const a = (i * Math.PI * 2) / controls.battlements;
    assert(ray(a, 65.4), `${level.name}: missing surveyed battlement${i}`);
    crownHits++;
    assert(
      !ray(a + Math.PI / controls.battlements, 65.4),
      `${level.name}: extra battlement in surveyed gap${i}`,
    );
    crownGaps++;
    assert(ray(a + 0.12, 64.8), `${level.name}: parapet wall gap`);
    wallHits++;
  }
  // Allow the polygonal outline at lower levels; check the native shell within12mm.
  const tolerance = [0.32, 0.08, 0.025, 0.012][index];
  for (const y of [5, 30, 60]) {
    const expected =
        controls.baseRadius -
        ((controls.baseRadius - controls.topRadius) * (y - controls.firstFloorAboveApproach)) /
          (controls.roofAboveApproach - controls.firstFloorAboveApproach),
      hit = ray(Math.PI / 4, y);
    assert(
      hit && Math.abs(10 - hit.distance - expected) < tolerance,
      `${level.name}: measured taper at${y}m; actual=${hit ? 10 - hit.distance : null}, expected=${expected}, tolerance=${tolerance}`,
    );
  }
  let westWindows = 0;
  if (index > 0)
    for (const y0 of controls.westWindowCentresAboveFirstFloor) {
      const y = y0 + controls.firstFloorAboveApproach,
        outer =
          controls.baseRadius -
          ((controls.baseRadius - controls.topRadius) * (y - controls.firstFloorAboveApproach)) /
            (controls.roofAboveApproach - controls.firstFloorAboveApproach),
        hit = ray(0.025, y);
      assert(
        hit && 10 - hit.distance < outer - 0.055,
        `${level.name}: west opening not recessed at${y}m`,
      );
      westWindows++;
    }
  let doorHits = 0;
  for (const y of [0.3, 1.2, 2.4, 2.6]) {
    assert(ray(0, y), `${level.name}: gap in closed curved steel entrance at${y}m`);
    doorHits++;
  }
  results.push({
    name: level.name,
    hash: level.hash,
    triangles: level.triangles,
    crownHits,
    crownGaps,
    wallHits,
    westWindows,
    doorHits,
    bounds: { min: box.min.toArray(), max: box.max.toArray() },
  });
}
console.log(
  JSON.stringify(
    {
      format: 'molen/structure-survey-validation@1',
      status: 'passed',
      sourceHash: side.sourceHash,
      runtimeHash: side.hash,
      controls: hashBytes(fs.readFileSync(new URL('survey-controls.json', dir))),
      levels: results,
    },
    null,
    2,
  ),
);
