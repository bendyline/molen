import { readFile } from 'node:fs/promises';
import { Box3, Group, Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { instrumentGeometry } from '../scripts/aircraft/instrument-geometry.mjs';
import { detailKit } from '../scripts/aircraft/mesh-kit.mjs';
import { transportPoint, transportProfiles } from '../scripts/aircraft/transport-profiles.mjs';
import { aircraftPanelTools } from '../scripts/vehicle-interiors.mjs';
import { GLTFLoader } from './helpers/gltf-loader.mjs';

const base = new URL('../../../content/entities/', import.meta.url);
const transports = [
  'airbus-a320neo',
  'a220-300',
  'boeing-737-800',
  'citation-cj4',
  'gulfstream-g650er',
  'embraer-e175',
  'dash-8-q400',
];
describe.each(['source', 'runtime'])('transport fit (%s)', (version) => {
  it.each(
    transports,
  )('%s keeps nacelles above ground and encloses the lower cockpit', async (slug) => {
    const manifest = JSON.parse(
      await readFile(new URL(`source/aircraft/${slug}/source.json`, base)),
    );
    const types = JSON.parse(
      await readFile(new URL(`source/aircraft/${slug}/entity.types.json`, base)),
    );
    const spec = types.types[manifest.id].components.aircraft.spec;
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
    const deck = root.getObjectByName('fitted-glareshield-deck');
    expect(deck).toBeDefined();
    deck.traverse((node) => {
      if (!node.isMesh) return;
      const positions = node.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const v = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld);
        const roof = transportPoint(spec, transportProfiles[slug], v.z, 0)[1];
        expect(v.y, 'glareshield stays beneath nose skin').toBeLessThanOrEqual(roof + 0.001);
      }
    });
    const extent = new Box3().setFromObject(root).getSize(new Vector3());
    expect(Math.abs(extent.x - spec.span)).toBeLessThan(0.16);
    for (const name of ['engine-1', 'engine-2']) {
      const engine = root.getObjectByName(name);
      expect(engine).toBeDefined();
      expect(new Box3().setFromObject(engine).min.y).toBeGreaterThan(0.4);
    }
    const eye = new Vector3(...spec.pilotEye);
    for (const x of [-1, -0.5, 0, 0.5, 1])
      for (const z of [-0.5, 0, 0.5, 1]) {
        const ray = new Raycaster(eye, new Vector3(x, -1.5, z).normalize(), 0, 4);
        expect(
          ray.intersectObject(root, true).some((h) => !h.object.material.transparent),
          `lower ray ${x},${z}`,
        ).toBe(true);
      }
  });
});
it('mounts aircraft gauge cans behind a narrow lip instead of a projecting cylinder', () => {
  const root = new Group(),
    d = detailKit(root, 'flush-gauge');
  aircraftPanelTools(d).gauge(0, 0, 0, 0.07);
  d.finish();
  const bounds = new Box3().setFromObject(root);
  expect(bounds.min.z).toBeGreaterThan(-0.01);
  expect(bounds.max.z).toBeGreaterThan(0.006);
  const analog = new Group(),
    ins = instrumentGeometry(analog, 'regression');
  ins.dial(
    'airspeed',
    [0, 0, 0],
    0.07,
    'airspeed',
    [
      [0, 0],
      [100, 2],
    ],
    [0, 50, 100],
    'KTS',
  );
  const dialBounds = new Box3().setFromObject(analog);
  expect(dialBounds.min.z).toBeGreaterThan(-0.008);
  expect(dialBounds.max.z).toBeGreaterThan(0.008);
});
