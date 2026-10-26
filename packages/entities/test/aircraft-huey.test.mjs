import { readFile } from 'node:fs/promises';
import { DoubleSide, Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from './helpers/gltf-loader.mjs';

describe.each(['source', 'imported'])('UH-1H windshield clearance (%s)', (version) => {
  it('keeps the panel housing and coaming inside both windshield corners', async () => {
    const path =
      version === 'source'
        ? 'source/aircraft/uh-1h/models/source.glb'
        : 'assets/molen/entities/aircraft/uh_1h/model.glb';
    const bytes = await readFile(new URL(`../../../content/entities/${path}`, import.meta.url));
    const { scene } = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    );
    scene.updateMatrixWorld(true);
    const cockpit = scene.getObjectByName('cockpit'),
      housing = [],
      shell = [];
    cockpit.traverse((mesh) => {
      if (
        !mesh.isMesh ||
        !['huey-panel', 'huey-coaming'].some(
          (name) => mesh.material.name === name || mesh.material.name.startsWith(`${name}-`),
        )
      )
        return;
      // Check the whole volume, including surfaces facing away from the observer.
      mesh.material.side = DoubleSide;
      housing.push(mesh);
    });
    scene.traverse((mesh) => {
      if (mesh.isMesh && ['huey-glazing', 'huey-olive-drab'].includes(mesh.material.name))
        shell.push(mesh);
    });
    const ray = new Raycaster(),
      direction = new Vector3(0, 0, -1);
    let sampled = 0;
    // Scan from outside toward the dashboard. The old constant-depth housing
    // protruded by almost 20 cm; every sampled panel point must now sit behind skin/glass.
    for (const side of [-1, 1])
      for (let column = 0; column <= 20; column++)
        for (let row = 0; row <= 30; row++) {
          const x = side * (0.5 + column * 0.025),
            y = 1.15 + row * 0.025;
          ray.set(new Vector3(x, y, 4), direction);
          const panel = ray.intersectObjects(housing, false)[0];
          if (!panel || panel.point.z < 2.35) continue;
          const surface = ray.intersectObjects(shell, false)[0];
          expect(surface, `missing enclosure at ${x},${y}`).toBeDefined();
          expect(panel.distance - surface.distance, `clearance at ${x},${y}`).toBeGreaterThan(
            0.003,
          );
          sampled++;
        }
    expect(sampled).toBeGreaterThan(300);
    scene.traverse((mesh) => {
      if (mesh.isMesh) mesh.geometry.dispose();
    });
  });
});
