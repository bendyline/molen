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

describe('human hips and stance', () => {
  for (const tier of [0, 1, 2] as const) {
    it(`closes the hips and both legs into one surface at tier ${tier}`, () => {
      // Trousers are one block from the waistband to the crotch, splitting into two legs: the
      // only open edges are the waistband's top ring and a hem above the shoe.
      for (const legs of ['long', 'shorts', 'cropped'] as const) {
        const d = resolveFigureDescriptor({ preset: 'human.adult', features: { legs } });
        const { buffers } = generateFigureBody(d, tier);
        const p = buffers.positions;
        const edges = new Map<string, { a: number; b: number; count: number }>();
        for (const g of buffers.groups.filter((g) => g.region === 'bottom')) {
          for (let i = g.start; i < g.start + g.count; i += 3) {
            for (let e = 0; e < 3; e++) {
              const a = buffers.indices[i + e] as number,
                b = buffers.indices[i + ((e + 1) % 3)] as number;
              const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
              const edge = edges.get(key) ?? { a, b, count: 0 };
              edge.count++;
              edges.set(key, edge);
            }
          }
        }
        // The trousers themselves: what is joined to their lowest vertex (not the patch pockets).
        const joined = new Map<number, number[]>();
        for (const e of edges.values()) {
          joined.set(e.a, [...(joined.get(e.a) ?? []), e.b]);
          joined.set(e.b, [...(joined.get(e.b) ?? []), e.a]);
        }
        let lowest = -1;
        for (const v of joined.keys())
          if (lowest < 0 || (p[v * 3 + 1] as number) < (p[lowest * 3 + 1] as number)) lowest = v;
        const trousers = new Set<number>();
        const queue = [lowest];
        for (let i = 0; i < queue.length; i++) {
          const v = queue[i] as number;
          if (trousers.has(v)) continue;
          trousers.add(v);
          queue.push(...(joined.get(v) ?? []));
        }
        const open = [...edges.values()].filter((e) => e.count === 1 && trousers.has(e.a));
        const levels = new Set(
          open
            .flatMap((e) => [p[e.a * 3 + 1] as number, p[e.b * 3 + 1] as number])
            .map((h) => (h / d.height).toFixed(4)),
        );
        // A hem short of the shoe is open where the bare leg goes on, on one level for both legs.
        expect([...levels].length, legs).toBe(legs === 'long' ? 1 : 2);
        expect(Math.max(...[...levels].map(Number)), legs).toBeGreaterThan(0.56);
        expect([...edges.values()].every((e) => e.count <= 2)).toBe(true);
      }
    });
  }

  it('stands on adult landmarks, with a spine that curves', () => {
    const d = resolveFigureDescriptor({ preset: 'human.adult' });
    const H = d.height;
    const rig = deriveRig(d);
    const bind = rigBindModel(rig);
    const y = (name: string): number => (bind[(rig.index[name] as number) * 7 + 1] as number) / H;
    // Hip joint, knee and ankle (in a shoe), and legs that reach what they always reached.
    expect(y('upperLeg.l')).toBeCloseTo(0.52, 2);
    expect(y('lowerLeg.l')).toBeCloseTo(0.275, 2);
    expect(y('foot.l')).toBeCloseTo(0.04, 3);
    expect(rig.legLength / H).toBeCloseTo(0.48, 6);
    const { buffers } = generateFigureBody(d, 0, rig);
    const p = buffers.positions;
    const trousers = new Set<number>();
    const shirt = new Set<number>();
    for (const g of buffers.groups)
      if (g.region === 'bottom' || g.region === 'top')
        for (let i = g.start; i < g.start + g.count; i++)
          (g.region === 'bottom' ? trousers : shirt).add(buffers.indices[i] as number);
    /** [breadth, front, back] of a vertex set within a band of heights (of stature). */
    const band = (set: Set<number>, from: number, to: number): [number, number, number] => {
      let x = 0,
        front = -Infinity,
        back = Infinity;
      for (const v of set) {
        const h = (p[v * 3 + 1] as number) / H;
        if (h < from || h > to) continue;
        x = Math.max(x, Math.abs(p[v * 3] as number));
        front = Math.max(front, p[v * 3 + 2] as number);
        back = Math.min(back, p[v * 3 + 2] as number);
      }
      return [(2 * x) / H, front / H, back / H];
    };
    // The crotch: the lowest point of the trousers on the middle line.
    let crotch = Infinity;
    for (const v of trousers)
      if (Math.abs(p[v * 3] as number) < 1e-6) crotch = Math.min(crotch, p[v * 3 + 1] as number);
    expect(crotch / H).toBeGreaterThan(0.46);
    expect(crotch / H).toBeLessThan(0.49);
    // Hips about 0.2 of stature across, the seat well behind the hip joints.
    const hips = band(trousers, 0.5, 0.54);
    expect(hips[0]).toBeGreaterThan(0.19);
    expect(hips[0]).toBeLessThan(0.21);
    expect(-hips[2]).toBeGreaterThan(hips[1] + 0.012);
    // The chest stands forward of the belly, the shoulder blades behind the hollow of the back.
    const chest = band(shirt, 0.72, 0.75);
    const waist = band(shirt, 0.6, 0.64);
    expect(chest[1]).toBeGreaterThan(waist[1] + 0.008);
    expect(-chest[2]).toBeGreaterThan(-waist[2] + 0.012);
    expect(-hips[2]).toBeGreaterThan(-waist[2] + 0.02);
    // Trousers hang as cloth: a leg about 0.08 of stature through at the knee, not a stocking.
    const knee = band(trousers, 0.27, 0.28);
    expect(knee[1] - knee[2]).toBeGreaterThan(0.075);
  });
});
