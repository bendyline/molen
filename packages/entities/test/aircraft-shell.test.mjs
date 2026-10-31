import { readFile } from 'node:fs/promises';
import { Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from './helpers/gltf-loader.mjs';

// The Mustang stands in its three-point attitude: generate.mjs authors it in the flight datum
// (interior.json's eye) and poses it nose-up onto its wheels (entity.types.json's pilotEye).
// Recover that pitch and lift from the two eyes so the cockpit checks keep their datum points.
const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const mustangSource = '../../../content/entities/source/aircraft/p-51/';
const DATUM_EYE = (await json(`${mustangSource}models/interior.json`)).eye;
const MUSTANG_EYE = Object.values((await json(`${mustangSource}entity.types.json`)).types)[0]
  .components.aircraft.spec.pilotEye;
const PITCH =
  Math.acos(MUSTANG_EYE[2] / Math.hypot(DATUM_EYE[1], DATUM_EYE[2])) -
  Math.atan2(DATUM_EYE[1], DATUM_EYE[2]);
const LIFT = MUSTANG_EYE[1] - (DATUM_EYE[1] * Math.cos(PITCH) + DATUM_EYE[2] * Math.sin(PITCH));
/** Flight-datum direction, then point, posed into the standing Mustang; and back to datum height. */
const turn = ([x, y, z]) => [
  x,
  y * Math.cos(PITCH) + z * Math.sin(PITCH),
  z * Math.cos(PITCH) - y * Math.sin(PITCH),
];
const posed = (p) => turn(p).map((v, i) => (i === 1 ? v + LIFT : v));
const datumY = ({ y, z }) => (y - LIFT) * Math.cos(PITCH) - z * Math.sin(PITCH);

async function load(kind, version) {
  const sourceDirectory = kind === 'p51d' ? 'p-51' : 'oh-6';
  const path =
    version === 'source'
      ? `../../../content/entities/source/aircraft/${sourceDirectory}/models/source.glb`
      : `../../../content/entities/assets/molen/entities/aircraft/${kind}/model.glb`;
  const bytes = await readFile(new URL(path, import.meta.url));
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  scene.updateMatrixWorld(true);
  return scene;
}
function hit(scene, origin, direction) {
  const hits = new Raycaster(
    new Vector3(...origin),
    new Vector3(...direction).normalize(),
  ).intersectObject(scene, true);
  expect(hits.length, `No surface at ${origin}`).toBeGreaterThan(0);
  return hits[0];
}

describe.each(['source', 'imported'])('aircraft cabin enclosure (%s)', (version) => {
  it('closes the Mustang lower sidewalls from the pilot eye with inward-facing opaque skin', async () => {
    const scene = await load('p51d', version);
    const lining = scene.getObjectByName('fuselage-interior');
    const eye = new Vector3(...MUSTANG_EYE);
    // Test the actual single-sided lining: exterior-only rays missed the reversed winding.
    // Sample below the canopy rail, beside the panel and down toward both footwells.
    for (const side of [-1, 1])
      for (const y of [1.35, 1.6, 1.85, 2.04])
        for (const z of [-0.6, -0.2, 0.3, 0.7, 0.9]) {
          const direction = new Vector3(...posed([side * 0.39, y, z])).sub(eye).normalize();
          const surface = hit(lining, eye.toArray(), direction.toArray());
          expect(surface.object.material.transparent).toBe(false);
          expect(surface.distance).toBeLessThan(1.5);
          const normal = surface.face.normal.clone().transformDirection(surface.object.matrixWorld);
          expect(normal.dot(direction)).toBeLessThan(-0.05);
          const shading = surface.object.geometry.getAttribute('normal');
          const vertexNormal = new Vector3()
            .fromBufferAttribute(shading, surface.face.a)
            .transformDirection(surface.object.matrixWorld);
          expect(vertexNormal.dot(normal)).toBeGreaterThan(0.8);
        }
  });
  it('keeps the Mustang wing crown beneath the cockpit floor and footboards', async () => {
    const scene = await load('p51d', version);
    for (const x of [-0.3, -0.2, 0, 0.2, 0.3])
      for (const z of [0.1, 0.4, 0.65, 0.9]) {
        const surface = hit(scene, posed([x, 1.7, z]), turn([0, -1, 0]));
        expect(surface.object.name).not.toMatch(/^wing/);
        expect(datumY(surface.point)).toBeGreaterThan(1.38);
        expect(surface.object.material.transparent).toBe(false);
      }
  });
  it('hides the Mustang seat sides behind opaque bodywork below the canopy sill', async () => {
    const scene = await load('p51d', version);
    for (const side of [-1, 1])
      for (const y of [1.75, 1.88, 2.01])
        for (const z of [-0.8, -0.35, 0.3]) {
          const surface = hit(scene, posed([side * 3, y, z]), [-side, 0, 0]);
          expect(surface.object.name).toBe('fuselage');
          expect(surface.object.material.transparent).toBe(false);
          expect(Math.abs(surface.point.x)).toBeGreaterThan(0.3);
          // The interior lining must not conceal inverted exterior winding.
          const normal = surface.face.normal.clone().transformDirection(surface.object.matrixWorld);
          expect(normal.x * side).toBeGreaterThan(0);
        }
    // Compare the floor with the shell directly; the wings cross these lower rays outside it.
    for (const side of [-1, 1])
      for (const y of [1.34, 1.38])
        for (const z of [-0.7, -0.35, 0.3, 0.95]) {
          const origin = posed([side, y, z]),
            direction = [-side, 0, 0];
          const skin = hit(scene.getObjectByName('fuselage'), origin, direction);
          const floor = hit(scene.getObjectByName('floor'), origin, direction);
          expect(floor.distance - skin.distance).toBeGreaterThan(0.005);
        }
  });
  it('encloses both OH-6 door bottoms and the cabin roof with solid panels', async () => {
    const scene = await load('oh6', version);
    // The arched OH-6A door glazing reaches lower than the old rectangular window.
    for (const side of [-1, 1])
      for (const y of [1.06, 1.1, 1.14])
        for (const z of [-0.1, 0.45, 0.85]) {
          const surface = hit(scene, [side * 3, y, z], [-side, 0, 0]);
          expect(surface.object.material.transparent).toBe(false);
          expect(Math.abs(surface.point.x)).toBeGreaterThan(0.65);
        }
    const cabin = scene.getObjectByName('cabin-panels');
    expect(cabin).toBeDefined();
    const roof = hit(cabin, [0.3, 3.5, 0.1], [0, -1, 0]);
    expect(roof.object.material.transparent).toBe(false);
    // The real OH-6A egg is low: its roof is about 2.0 m up, under a 2.48 m rotor hub.
    expect(roof.point.y).toBeGreaterThan(1.85);
    const normal = roof.face.normal.clone().transformDirection(roof.object.matrixWorld);
    expect(normal.y).toBeGreaterThan(0);
  });
  it.each([
    ['p51d', MUSTANG_EYE, turn([0.15, 0, 1])],
    ['oh6', [-0.38, 1.7, 0.6], [0.15, 0, 1]],
  ])('keeps forward visibility through the %s windscreen', async (kind, eye, ahead) => {
    const scene = await load(kind, version);
    // Look just beside the central windscreen divider, along the airframe's datum.
    const surface = hit(scene, eye, ahead);
    expect(surface.object.material.transparent).toBe(true);
    expect(surface.object.material.opacity).toBeLessThan(0.3);
  });
});

describe.each(['source', 'imported'])('reference aircraft details (%s)', (version) => {
  it('uses the OH-6A four-blade main rotor and two-blade tail rotor', async () => {
    const scene = await load('oh6', version);
    const main = scene.getObjectByName('main-rotor');
    const tail = scene.getObjectByName('tail-rotor');
    const mainBlades = [],
      tailBlades = [];
    main.traverse((node) => {
      if (/^rotor-blade-\d+$/.test(node.name)) mainBlades.push(node);
    });
    tail.traverse((node) => {
      if (/^tail-blade-\d+$/.test(node.name)) tailBlades.push(node);
    });
    expect(mainBlades).toHaveLength(4);
    expect(tailBlades).toHaveLength(2);
    expect(scene.getObjectByName('tail-brace--1')).toBeDefined();
    expect(scene.getObjectByName('tail-brace-1')).toBeDefined();
    expect(scene.getObjectByName('t-tail')).toBeUndefined();
  });
  it('gives each aircraft its own mechanical cockpit', async () => {
    const mustang = await load('p51d', version);
    const cayuse = await load('oh6', version);
    expect(mustang.getObjectByName('k14-gunsight')).toBeDefined();
    expect(mustang.getObjectByName('throttle-quadrant')).toBeDefined();
    expect(mustang.getObjectByName('manifold-instrument')).toBeDefined();
    expect(cayuse.getObjectByName('pedestal-body')).toBeDefined();
    expect(cayuse.getObjectByName('torque-instrument')).toBeDefined();
    expect(cayuse.getObjectByName('control-stick_1')).toBeDefined();
    // Gauges face the pilot, rather than being hidden behind the panel's back face.
    for (const [scene, eye, gaugeId] of [
      [mustang, MUSTANG_EYE, 'airspeed-instrument'],
      [cayuse, [-0.38, 1.7, 0.6], 'airspeed-instrument'],
    ]) {
      const gauge = scene.getObjectByName(gaugeId);
      const target = new Vector3();
      gauge.getWorldPosition(target);
      const origin = new Vector3(...eye);
      const surface = hit(scene, eye, target.sub(origin).toArray());
      expect(surface.object.name).toMatch(/airspeed-(cover|hub|pointer|dial)/);
      expect(surface.object.name).not.toBe('instrument-panel');
    }
  });
});
