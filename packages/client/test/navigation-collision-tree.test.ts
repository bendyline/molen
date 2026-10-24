import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import type { Octree } from 'three/addons/math/Octree.js';
import { describe, expect, it } from 'vitest';
import { CollisionTree } from '../src/navigation/collision-tree';

function floor(y: number): THREE.Triangle {
  return new THREE.Triangle(
    new THREE.Vector3(-100, y, -100),
    new THREE.Vector3(0, y, 100),
    new THREE.Vector3(100, y, -100),
  );
}

function inventory(tree: Octree): { nodes: number; depth: number; triangles: THREE.Triangle[] } {
  const children = tree.subTrees.map(inventory);
  return {
    nodes: 1 + children.reduce((sum, child) => sum + child.nodes, 0),
    depth: 1 + Math.max(0, ...children.map((child) => child.depth)),
    triangles: [...tree.triangles, ...children.flatMap((child) => child.triangles)],
  };
}

describe('collision tree', () => {
  it('bounds rebuild work for thousands of coincident road and portal triangles', () => {
    const tree = new CollisionTree();
    const triangles = Array.from({ length: 4096 }, () => floor(0));
    for (const triangle of triangles) tree.addTriangle(triangle);
    tree.build();
    const stored = inventory(tree);
    // Structural limits avoid a timing-sensitive test and catch recursive triangle duplication.
    expect(stored.triangles).toHaveLength(triangles.length);
    expect(new Set(stored.triangles)).toEqual(new Set(triangles));
    expect(stored.nodes).toBeLessThanOrEqual(512);
    expect(stored.depth).toBeLessThanOrEqual(10);
    const hit = tree.rayIntersect(
      new THREE.Ray(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -1, 0)),
    );
    expect(hit ? hit.distance : undefined).toBe(2);
  });

  it('keeps long triangles queryable across partitions and returns the nearest support', () => {
    const tree = new CollisionTree();
    const road = floor(0);
    tree.addTriangle(road);
    for (let i = 0; i < 64; i++) {
      const triangle = floor(1 + i);
      for (const point of [triangle.a, triangle.b, triangle.c]) point.x += i * 1000;
      tree.addTriangle(triangle);
    }
    tree.build();
    const ray = new THREE.Ray(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, -1, 0));
    const hit = tree.rayIntersect(ray);
    expect(hit ? hit.distance : undefined).toBe(2);
    const candidates: THREE.Triangle[] = [];
    tree.getSphereTriangles(new THREE.Sphere(new THREE.Vector3(45, 0, -70), 0.5), candidates);
    expect(candidates).toContain(road);
    const capsule = new Capsule(
      new THREE.Vector3(45, 0.2, -70),
      new THREE.Vector3(45, 0.4, -70),
      0.3,
    );
    const contact = tree.capsuleIntersect(capsule);
    expect(contact ? contact.normal.y : undefined).toBeCloseTo(1);
    expect(contact ? contact.depth : undefined).toBeCloseTo(0.1);
  });

  it('stores scattered triangles once and finds the same nearest front-face hits as a brute-force scan', () => {
    let seed = 7;
    const random = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const tree = new CollisionTree();
    const triangles: THREE.Triangle[] = [];
    for (let i = 0; i < 3000; i++) {
      // Plant-like clumps on a coarse grid, so many centers tie along an axis.
      const x = Math.round(random() * 40) - 20;
      const z = Math.round(random() * 40) - 20;
      const y = random() * 3;
      const triangle = new THREE.Triangle(
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(x + random(), y + random(), z),
        new THREE.Vector3(x, y + random(), z + random()),
      );
      triangles.push(triangle);
      tree.addTriangle(triangle);
    }
    tree.build();
    const stored = inventory(tree);
    expect(stored.triangles).toHaveLength(triangles.length);
    expect(new Set(stored.triangles)).toEqual(new Set(triangles));
    const point = new THREE.Vector3();
    for (let i = 0; i < 64; i++) {
      const ray = new THREE.Ray(
        new THREE.Vector3(random() * 40 - 20, 5, random() * 40 - 20),
        new THREE.Vector3(random() - 0.5, -1, random() - 0.5).normalize(),
      );
      let nearest = Number.POSITIVE_INFINITY;
      for (const { a, b, c } of triangles)
        if (ray.intersectTriangle(a, b, c, true, point))
          nearest = Math.min(nearest, point.distanceTo(ray.origin));
      const hit = tree.rayIntersect(ray);
      if (nearest === Number.POSITIVE_INFINITY) expect(hit).toBe(false);
      else expect(hit ? hit.distance : undefined).toBeCloseTo(nearest, 9);
    }
  });

  it('clears evicted geometry and supports empty and single-leaf rebuilds', () => {
    const tree = new CollisionTree();
    const ray = new THREE.Ray(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -1, 0));
    tree.build();
    expect(tree.rayIntersect(ray)).toBe(false);
    tree.addTriangle(floor(0)).build();
    expect(tree.rayIntersect(ray)).not.toBe(false);
    tree.clear().build();
    expect(tree.rayIntersect(ray)).toBe(false);
    tree.addTriangle(floor(1)).build();
    const hit = tree.rayIntersect(ray);
    expect(hit ? hit.distance : undefined).toBe(1);
  });
});
