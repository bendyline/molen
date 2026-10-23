import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  deriveRig,
  generateFigureBody,
  resolveFigureDescriptor,
  rigBindModel,
} from '../src/kernel';

describe('human visible surfaces', () => {
  for (const tier of [0, 1, 2] as const) {
    it(`joins both sleeves to the torso without open shoulder edges at tier ${tier}`, () => {
      const d = resolveFigureDescriptor({ preset: 'human.adult' });
      const rig = deriveRig(d);
      const bind = rigBindModel(rig);
      const { buffers } = generateFigureBody(d, tier, rig);
      const p = buffers.positions;
      const neighbours = new Map<number, Set<number>>();
      const edges = new Map<string, { a: number; b: number; count: number }>();
      for (const g of buffers.groups.filter((g) => g.region === 'top' || g.region === 'sleeves')) {
        for (let i = g.start; i < g.start + g.count; i += 3) {
          const face = Array.from(buffers.indices.slice(i, i + 3));
          for (let e = 0; e < 3; e++) {
            const a = face[e] as number,
              b = face[(e + 1) % 3] as number;
            const set = neighbours.get(a) ?? new Set<number>();
            set.add(b);
            neighbours.set(a, set);
            const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
            const edge = edges.get(key) ?? { a, b, count: 0 };
            edge.count++;
            edges.set(key, edge);
          }
        }
      }
      const nearest = (x: number, y: number, z: number): number => {
        let best = -1,
          distance = Infinity;
        for (const v of neighbours.keys()) {
          const delta = Math.hypot(
            (p[v * 3] as number) - x,
            (p[v * 3 + 1] as number) - y,
            (p[v * 3 + 2] as number) - z,
          );
          if (delta < distance) {
            best = v;
            distance = delta;
          }
        }
        return best;
      };
      const chestY = bind[(rig.index.chest as number) * 7 + 1] as number;
      const neckY = bind[(rig.index.neck as number) * 7 + 1] as number;
      const start = nearest(0, chestY, rig.metrics.torsoRadius * 0.94);
      const reached = new Set<number>(),
        queue = [start];
      for (let i = 0; i < queue.length; i++) {
        const v = queue[i] as number;
        if (reached.has(v)) continue;
        reached.add(v);
        queue.push(...(neighbours.get(v) ?? []));
      }
      for (const side of ['l', 'r']) {
        const o = (rig.index[`hand.${side}`] as number) * 7;
        expect(
          reached.has(nearest(bind[o] as number, bind[o + 1] as number, bind[o + 2] as number)),
        ).toBe(true);
      }
      for (const { a, b, count } of edges.values()) {
        const y = ((p[a * 3 + 1] as number) + (p[b * 3 + 1] as number)) / 2;
        if (reached.has(a) && y > chestY && y < neckY) expect(count).toBe(2);
      }
    });

    it(`keeps eyes in front of the face and trousers closed at tier ${tier}`, () => {
      const d = resolveFigureDescriptor({ preset: 'human.adult' });
      const rig = deriveRig(d);
      const bind = rigBindModel(rig);
      const { buffers } = generateFigureBody(d, tier, rig);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
      geometry.setIndex(new THREE.BufferAttribute(buffers.indices, 1));
      const material = new THREE.MeshBasicMaterial();
      const mesh = new THREE.Mesh(geometry, material);
      const regionAt = (x: number, y: number): string | undefined => {
        const ray = new THREE.Raycaster(
          new THREE.Vector3(x, y, d.height),
          new THREE.Vector3(0, 0, -1),
        );
        const face = ray.intersectObject(mesh)[0]?.faceIndex;
        if (face === undefined || face === null) return undefined;
        return buffers.groups.find((g) => face * 3 >= g.start && face * 3 < g.start + g.count)
          ?.region;
      };
      try {
        const headY = bind[(rig.index.head as number) * 7 + 1] as number;
        const eyeY = headY + rig.metrics.headLen * (0.1 + 0.9 * 0.495);
        for (const side of [-1, 1])
          expect(regionAt(side * rig.metrics.headWidth * 0.86 * 0.205, eyeY)).toBe('eyes');
        const waistY = bind[(rig.index.spine as number) * 7 + 1] as number;
        for (const side of [-1, 1]) {
          expect(regionAt(side * d.height * 0.008, waistY - d.height * 0.03)).toBe('bottom');
          expect(regionAt(side * d.height * 0.025, waistY + d.height * 0.0195)).toBe('top');
        }
      } finally {
        geometry.dispose();
        material.dispose();
      }
    });
  }
});
