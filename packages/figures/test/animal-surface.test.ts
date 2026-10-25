import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { generateFigureBody, resolveFigureDescriptor, rigBindModel } from '../src/kernel';

const animals = ['dog', 'cat', 'horse', 'cow', 'deer', 'sheep'] as const;

describe('animal visible surfaces', () => {
  for (const preset of animals) {
    it(`${preset} has visible eyes at each tier and progressively cheaper geometry`, () => {
      const d = resolveFigureDescriptor({ preset });
      let previous = Infinity;
      for (const tier of [0, 1, 2] as const) {
        const { buffers, rig } = generateFigureBody(d, tier),
          m = rig.metrics;
        expect(buffers.triangleCount).toBeLessThan(previous);
        previous = buffers.triangleCount;
        const bind = rigBindModel(rig),
          o = (rig.index.head as number) * 7;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(buffers.indices, 1));
        const material = new THREE.MeshBasicMaterial(),
          mesh = new THREE.Mesh(geometry, material);
        try {
          for (const side of [-1, 1]) {
            const cat = preset === 'cat',
              eyeZ = cat ? 0.49 : 0.35;
            const center = new THREE.Vector3(
              side * m.headWidth * (cat ? 0.43 : 0.54),
              (bind[o + 1] as number) +
                0.17 * m.headHeight * Math.cos(m.headPitch) -
                eyeZ * m.headLen * Math.sin(m.headPitch),
              (bind[o + 2] as number) +
                0.17 * m.headHeight * Math.sin(m.headPitch) +
                eyeZ * m.headLen * Math.cos(m.headPitch),
            );
            const outward = new THREE.Vector3(
              side * (cat ? 0.5 : 1),
              cat ? 0.1 : 0.15,
              cat ? 1 : 0.3,
            ).normalize();
            const ray = new THREE.Raycaster(
              center.clone().addScaledVector(outward, d.height),
              outward.negate(),
            );
            const face = ray.intersectObject(mesh)[0]?.faceIndex;
            expect(face).toBeTypeOf('number');
            const region = buffers.groups.find(
              (g) => (face as number) * 3 >= g.start && (face as number) * 3 < g.start + g.count,
            )?.region;
            expect(region).toBe('eyes');
          }
          // All four soles lie on the ground, on both sides of both leg pairs.
          for (const side of [-1, 1])
            for (const end of [-1, 1]) {
              let sole = false;
              for (let v = 0; v < buffers.vertexCount; v++) {
                if (
                  (buffers.positions[v * 3] as number) * side > 0 &&
                  (buffers.positions[v * 3 + 2] as number) * end > 0 &&
                  Math.abs(buffers.positions[v * 3 + 1] as number) < 1e-6
                )
                  sole = true;
              }
              expect(sole).toBe(true);
            }
        } finally {
          geometry.dispose();
          material.dispose();
        }
      }
    });

    it(`${preset} supports flat muzzles, alternate ears, hooves and tail styles without invalid surfaces`, () => {
      for (const [ears, tail, horns] of [
        ['none', 'none', 'none'],
        ['round', 'bushy', 'long'],
        ['pointed', 'short', 'antlers'],
      ] as const) {
        const d = resolveFigureDescriptor({
          preset,
          proportions: { snoutLength: 0 },
          features: { ears, tail, horns, feet: 'unguligrade' },
        });
        const { buffers } = generateFigureBody(d, 0);
        expect([...buffers.positions, ...buffers.normals].every(Number.isFinite)).toBe(true);
        expect(buffers.weights?.every((w) => w >= 0 && w <= 1)).toBe(true);
        for (let i = 0; i < buffers.indices.length; i += 3) {
          const triangle = [0, 1, 2].map((k) =>
            new THREE.Vector3().fromArray(
              buffers.positions,
              (buffers.indices[i + k] as number) * 3,
            ),
          );
          const ab = (triangle[1] as THREE.Vector3).sub(triangle[0] as THREE.Vector3);
          const ac = (triangle[2] as THREE.Vector3).sub(triangle[0] as THREE.Vector3);
          expect(ab.cross(ac).lengthSq()).toBeGreaterThan(1e-20);
        }
      }
    });
  }
});
