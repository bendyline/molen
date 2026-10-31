import { readdir, readFile } from 'node:fs/promises';
import { Box3, Group, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { createAircraftVisual } from '../../client/dist/aircraft.mjs';
import { completeAircraftArticulation } from '../scripts/aircraft-articulation.mjs';
import { GLTFLoader } from './helpers/gltf-loader.mjs';

const base = new URL('../../../content/entities/', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, base)));
const slugs = await readdir(new URL('source/aircraft/', base));

it.each([
  'gear',
  'gearPosition',
  'sequencedGear',
])('fallback respects a visibility leaf below an authored %s hinge, including repeat builds', (source) => {
  const root = new Group(),
    hinge = new Group(),
    leaf = new Group();
  hinge.name = 'trunnion';
  leaf.name = 'gear-1';
  root.add(hinge);
  hinge.add(leaf);
  const authored = { node: hinge.name, source, property: 'rotation', axis: 'x', scale: -1.4 };
  const oldFallback = {
    node: leaf.name,
    source: 'gear',
    property: 'rotation',
    axis: 'z',
    ease: 'smooth',
    keys: [
      [0, -Math.PI / 2],
      [0.15, -Math.PI / 2],
      [0.85, 0],
      [1, 0],
    ],
  };
  // A deliberate secondary linkage must survive the cleanup of the old generic curve.
  const linkage = { node: leaf.name, source, property: 'rotation', axis: 'y', scale: 0.1 };
  const spec = {
    model: 'airplane',
    length: 10,
    airplane: {},
    visual: {
      gearNodes: [leaf.name],
      rotors: [],
      animation: {
        bindings: [authored, oldFallback, linkage],
        sources: { position: { component: 'aircraftState', path: ['gearPosition'] } },
        derived: { sequencedGear: { op: 'clamp', args: ['position', 0, 1] } },
      },
    },
  };
  for (let i = 0; i < 2; i++) {
    completeAircraftArticulation(root, spec, { slug: 'fixture' });
    expect(spec.visual.animation.bindings).toEqual([authored, linkage]);
    expect(root.getObjectByName('gear-1-well-door')).toBeUndefined();
  }
});

it('an authored gear-N hinge is not replaced just because of its name', () => {
  const root = new Group(),
    hinge = new Group();
  hinge.name = 'gear-1';
  root.add(hinge);
  const binding = {
    node: hinge.name,
    source: 'gear',
    property: 'rotation',
    axis: 'x',
    scale: -1.4,
  };
  const spec = {
    model: 'airplane',
    length: 10,
    airplane: {},
    visual: {
      gearNodes: [hinge.name],
      rotors: [],
      animation: { bindings: [binding] },
    },
  };
  completeAircraftArticulation(root, spec, { slug: 'fixture' });
  expect(spec.visual.animation.bindings).toEqual([binding]);
});

async function aircraft(slug, pipeline = 'runtime') {
  const definition = await json(`source/aircraft/${slug}/entity.types.json`);
  const c = Object.values(definition.types)[0].components;
  const source = await json(`source/aircraft/${slug}/source.json`);
  const model = source.files.models[0];
  const bytes = await readFile(
    new URL(
      pipeline === 'source'
        ? `source/aircraft/${slug}/${model.path}`
        : model.output.replace('asset.json', 'model.glb'),
      base,
    ),
  );
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const visual = createAircraftVisual(scene, c.aircraft.spec);
  return {
    scene,
    spec: c.aircraft.spec,
    dispose: () => visual.dispose(),
    pose(gearPosition) {
      visual.update(
        { ...c.aircraftState, gearPosition },
        { ...c.aircraftInput, gear: gearPosition === 1 },
        0,
        { gearPosition },
        0,
      );
      scene.updateMatrixWorld(true);
    },
  };
}

function center(node) {
  // Geometry centers survive both the source hierarchy and the importer's transforms.
  return new Box3().setFromObject(node, true).getCenter(new Vector3());
}

function tires(node) {
  const meshes = [];
  node.traverse((n) => {
    if (n.isMesh && /tire|rubber/i.test(n.material?.name ?? '')) meshes.push(n);
  });
  expect(meshes.length).toBeGreaterThan(0);
  const bounds = new Box3();
  for (const mesh of meshes) bounds.union(new Box3().setFromObject(mesh, true));
  return bounds;
}

for (const pipeline of ['source', 'runtime']) {
  it(`P-51 ${pipeline}: mirrored wheels follow one canted trunnion through the entire stroke`, async () => {
    const a = await aircraft('p-51', pipeline);
    const legs = [-1, 1].map((side) => a.scene.getObjectByName(`gear-${side}-leg`));
    const wheels = legs.map((leg) => {
      let wheel;
      leg.traverse((n) => {
        if (n.isMesh && n.name.startsWith('main-wheel')) wheel = n;
      });
      expect(wheel).toBeDefined();
      return wheel;
    });
    const hinges = [-1, 1].map((side) => a.scene.getObjectByName(`gear-${side}`));
    a.pose(1);
    const down = wheels.map(center);
    const pivots = hinges.map((n) => n.getWorldPosition(new Vector3()));
    const radius = down.map((p, i) => p.distanceTo(pivots[i]));
    for (let step = 20; step >= 0; step--) {
      const gear = step / 20;
      a.pose(gear);
      const points = wheels.map(center);
      expect(points[0].x, `gear=${gear}: mirrored X`).toBeCloseTo(-points[1].x, 3);
      expect(points[0].y, `gear=${gear}: equal Y`).toBeCloseTo(points[1].y, 3);
      expect(points[0].z, `gear=${gear}: equal Z`).toBeCloseTo(points[1].z, 3);
      for (const [i, point] of points.entries()) {
        expect(hinges[i].getWorldPosition(new Vector3()).distanceTo(pivots[i])).toBeLessThan(1e-6);
        expect(point.distanceTo(pivots[i])).toBeCloseTo(radius[i], 3);
        expect(legs[i].quaternion.angleTo(legs[i].quaternion.clone().identity())).toBeLessThan(
          1e-6,
        );
      }
    }
    const stowed = wheels.map(center);
    for (const [i, point] of stowed.entries()) {
      expect(Math.abs(point.x)).toBeLessThan(Math.abs(down[i].x) - 0.8);
      expect(point.y).toBeGreaterThan(down[i].y + 0.8);
    }
    for (const gear of [0, 1]) {
      a.pose(gear);
      for (const side of [-1, 1])
        expect(a.scene.getObjectByName(`wheel-door-${side}`).rotation.x).toBeCloseTo(0, 6);
    }
    a.pose(0.5);
    for (const side of [-1, 1])
      expect(a.scene.getObjectByName(`wheel-door-${side}`).rotation.x).toBeGreaterThan(1);
    a.dispose();
  });

  it(`Dash 8 ${pipeline}: main gear retracts aft into nacelles, nose gear forward`, async () => {
    const a = await aircraft('dash-8-q400', pipeline);
    const gear = [0, 1, 2].map((i) => a.scene.getObjectByName(`gear-${i}`));
    a.pose(1);
    const down = gear.map(center);
    a.pose(0);
    const up = gear.map(center);
    for (let i = 0; i < 3; i++) {
      expect(up[i].x).toBeCloseTo(down[i].x, 3);
      expect(up[i].y).toBeGreaterThan(down[i].y + 0.4);
      expect((up[i].z - down[i].z) * (i === 0 ? 1 : -1)).toBeGreaterThan(0.4);
    }
    for (const main of gear.slice(1)) {
      const bounds = tires(main);
      // The broad aft nacelle bay, ahead of its narrow tail cone. The previous
      // pivot sent the aft-folding wheels through that tapered outer skin.
      expect(bounds.min.y).toBeGreaterThan(2.65);
      expect(bounds.max.y).toBeLessThan(3.65);
      expect(bounds.min.z).toBeGreaterThan(-2);
      expect(bounds.max.z).toBeLessThan(-1);
    }
    a.dispose();
  });

  it(`F-16 ${pipeline}: main wheels fold aft/up symmetrically and clear the belly`, async () => {
    const a = await aircraft('f-16b', pipeline);
    const mains = [1, 2].map((i) => a.scene.getObjectByName(`F16-gear-${i}`));
    a.pose(1);
    const down = mains.map((n) => tires(n).getCenter(new Vector3()));
    expect(down[0].x).toBeCloseTo(-1.1811, 3);
    expect(down[1].x).toBeCloseTo(1.1811, 3);
    for (const p of down) {
      expect(p.y).toBeCloseTo(0.32385, 3);
      expect(p.z).toBeCloseTo(0, 3);
    }
    let previous = down;
    for (let step = 19; step >= 0; step--) {
      a.pose(step / 20);
      const points = mains.map((n) => tires(n).getCenter(new Vector3()));
      expect(points[0].x).toBeCloseTo(-points[1].x, 3);
      expect(points[0].y).toBeCloseTo(points[1].y, 3);
      expect(points[0].z).toBeCloseTo(points[1].z, 3);
      for (let i = 0; i < 2; i++) expect(points[i].y).toBeGreaterThan(previous[i].y);
      previous = points;
    }
    const stowed = mains.map(tires);
    for (const bounds of stowed) {
      expect(bounds.min.y).toBeGreaterThan(1.2);
      expect(bounds.max.y).toBeLessThan(2.05);
      expect(bounds.min.x).toBeGreaterThan(-0.7);
      expect(bounds.max.x).toBeLessThan(0.7);
      expect(bounds.max.z).toBeLessThan(-0.1);
    }
    expect(stowed[1].min.x - stowed[0].max.x).toBeGreaterThan(0.01);
    a.dispose();
  });
}

it.each(slugs)('%s: gear poses are finite and reversible on the imported model', async (slug) => {
  const a = await aircraft(slug);
  const names = new Set([
    ...a.spec.visual.gearNodes,
    ...(a.spec.visual.animation?.bindings ?? [])
      .filter((b) => /gear|door|strut|wheel/i.test(b.node))
      .map((b) => b.node),
  ]);
  a.scene.traverse((node) => {
    if (/^(gear|main-gear|nose-gear|tail-gear|skid|outrigger|landing-gear)/.test(node.name))
      names.add(node.name);
  });
  const nodes = [...names].map((name) => {
    const node = a.scene.getObjectByName(name);
    expect(node, name).toBeDefined();
    return node;
  });
  const snapshot = (position) => {
    a.pose(position);
    return nodes.map((n) => ({ visible: n.visible, matrix: n.matrixWorld.toArray() }));
  };
  const expected = new Map([0, 0.15, 0.35, 0.5, 0.7, 0.85, 1].map((p) => [p, snapshot(p)]));
  const fixed =
    a.spec.model === 'helicopter'
      ? a.spec.helicopter.fixedGear !== false
      : !!a.spec.airplane.fixedGear;
  if (fixed) expect(expected.get(0)).toEqual(expected.get(1));
  else {
    expect(nodes.length).toBeGreaterThan(0);
    expect(expected.get(0)).not.toEqual(expected.get(1));
  }
  for (const [position, matrices] of expected)
    for (const { matrix } of matrices)
      expect(matrix.every(Number.isFinite), `${slug} gear=${position}`).toBe(true);
  // Mid-stroke reversal must return to the same geometry without accumulated transforms.
  for (const position of [1, 0.7, 0.35, 0.5, 0.85, 1, 0, 0.15, 0.5, 0.15, 0])
    expect(snapshot(position), `${slug} gear=${position}`).toEqual(expected.get(position));
  a.dispose();
});
