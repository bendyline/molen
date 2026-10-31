import { readFile } from 'node:fs/promises';
import { Box3, DoubleSide, Ray, Raycaster, Triangle, Vector3 } from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { describe, expect, it } from 'vitest';
import { atr72Nose } from '../scripts/aircraft/atr-72-shape.mjs';
import { transportProfiles } from '../scripts/aircraft/transport-profiles.mjs';
import { GLTFLoader } from './helpers/gltf-loader.mjs';

const base = new URL('../../../content/entities/', import.meta.url);
const cases = [
  [
    'atr-72-600',
    ['ATR72-instrument-panel', 'fitted-glareshield-deck', 'ATR72-overhead'],
    atr72Nose,
    6,
  ],
  ['bell-412ep', ['412-instrument-panel']],
  ['boeing-737-800', ['fitted-glareshield-deck'], transportProfiles['boeing-737-800'], 6],
  ['dash-8-q400', ['fitted-glareshield-deck'], transportProfiles['dash-8-q400'], 4],
  ['gulfstream-g650er', ['fitted-glareshield-deck'], transportProfiles['gulfstream-g650er'], 4],
  ['embraer-e175', ['fitted-glareshield-deck'], transportProfiles['embraer-e175'], 4],
];

describe.each(['source', 'runtime'])('nose/dashboard fit (%s)', (version) => {
  it.each(cases)(
    '%s encloses the dashboard behind the actual skin and glazing',
    async (slug, names, profile, paneCount) => {
      const manifest = JSON.parse(
        await readFile(new URL(`source/aircraft/${slug}/source.json`, base)),
      );
      const entry = manifest.files.models.find((m) => m.output);
      const path =
        version === 'source'
          ? `source/aircraft/${slug}/${entry.path}`
          : entry.output.replace('asset.json', 'model.glb');
      const bytes = await readFile(new URL(path, base));
      const root = (
        await new GLTFLoader().parseAsync(
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
          '',
        )
      ).scene;
      root.updateMatrixWorld(true);
      const hull = [];
      const visit = (node) => {
        if (node.name === 'cockpit') return;
        if (node.isMesh) {
          node.material.side = DoubleSide;
          hull.push(node);
        }
        for (const child of node.children) visit(child);
      };
      visit(root);
      const points = new Map();
      for (const name of names) {
        const part = root.getObjectByName(name);
        expect(part, name).toBeDefined();
        part.traverse((node) => {
          if (!node.isMesh) return;
          const position = node.geometry.attributes.position;
          for (let i = 0; i < position.count; i++) {
            const v = new Vector3().fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld);
            points.set(
              v
                .toArray()
                .map((q) => q.toFixed(2))
                .join(','),
              v,
            );
          }
        });
      }
      const bounds = new Box3().setFromObject(root),
        front = bounds.max.z + 1,
        top = bounds.max.y + 1;
      // Index the actual nose triangles once rather than scanning the complete
      // airframe for every instrument vertex. Include both triangle windings.
      const hullTree = new Octree(),
        back = Math.min(...[...points.values()].map((v) => v.z)) - 0.5;
      for (const mesh of hull) {
        const p = mesh.geometry.attributes.position,
          index = mesh.geometry.index;
        for (let i = 0; i < (index?.count ?? p.count); i += 3) {
          const vertices = [0, 1, 2].map((j) =>
            new Vector3()
              .fromBufferAttribute(p, index ? index.getX(i + j) : i + j)
              .applyMatrix4(mesh.matrixWorld),
          );
          if (Math.max(...vertices.map((v) => v.z)) < back) continue;
          hullTree.addTriangle(new Triangle(...vertices));
          hullTree.addTriangle(new Triangle(vertices[2], vertices[1], vertices[0]));
        }
      }
      hullTree.build();
      const protrusions = [];
      for (const v of points.values()) {
        const hit = hullTree.rayIntersect(
          new Ray(
            // Avoid a ray exactly on the source mesh's sin(2π) centre seam.
            new Vector3(v.x + 1e-6, v.y + 1e-6, front),
            new Vector3(0, 0, -1),
          ),
        );
        // Covers the outside-facing backs and shoulders as well as the panel face.
        // A lower-view ray from the pilot cannot detect these protrusions.
        if (!hit || v.z > hit.position.z + 0.012) protrusions.push(v.toArray());
        const roof = hullTree.rayIntersect(
          new Ray(new Vector3(v.x + 1e-6, top, v.z + 1e-6), new Vector3(0, -1, 0)),
        );
        if (!roof || v.y > roof.position.y + 0.012) protrusions.push(v.toArray());
      }
      expect(protrusions, 'dashboard vertices outside the nose envelope').toEqual([]);
      if (profile) {
        expect(profile.glazing.length * 2).toBe(paneCount);
        const brow = profile.glazing[0].slice(2);
        expect(
          Math.abs(brow[0][1] - brow[1][1]),
          'front panes have a level brow, not a pointed arch',
        ).toBeLessThan(0.09);
        const spec = JSON.parse(
          await readFile(new URL(`source/aircraft/${slug}/models/airframe.json`, base)),
        );
        const glass = hull.filter((n) => n.material.transparent);
        for (const side of [-1, 1])
          for (const pane of profile.glazing) {
            const world = pane.map(([x, y, d]) => new Vector3(side * x, y, spec.length / 2 - d));
            for (let i = 1; i < world.length - 1; i++) {
              const a = world[0],
                b = world[i],
                c = world[i + 1];
              const q = a
                .clone()
                .add(b)
                .add(c)
                .multiplyScalar(1 / 3);
              const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
              const hit = new Raycaster(
                q.clone().addScaledVector(normal, 0.04),
                normal.negate(),
                0,
                0.08,
              ).intersectObjects(glass, false);
              expect(
                hit.length,
                'each pane is filled by glazing at its authored position',
              ).toBeGreaterThan(0);
            }
          }
      }
      root.traverse((n) => {
        if (n.isMesh) n.geometry.dispose();
      });
    },
    30000,
  );
});
