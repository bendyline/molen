import { readFile } from 'node:fs/promises';
import { Box3, Group, Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { instrumentGeometry } from '../scripts/aircraft/instrument-geometry.mjs';
import { detailKit } from '../scripts/aircraft/mesh-kit.mjs';
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
    // The transport kit builds these noses (transport-kit.mjs), so the glareshield is the deck's
    // padded hood and the kit's coaming, measured against the built crown rather than a table.
    const cockpit = root.getObjectByName('cockpit');
    expect(cockpit).toBeDefined();
    const glareshield = [];
    cockpit.traverse((node) => {
      if (node.isMesh && /^coaming-padding|-coaming$/.test(node.material.name))
        glareshield.push(node);
    });
    expect(glareshield.length, 'glareshield padding and coaming').toBeGreaterThan(0);
    const skin = [];
    root.traverse((node) => {
      if (node.isMesh && /^fuselage-skin$|canopy-glazing$/.test(node.name)) skin.push(node);
    });
    const top = new Box3().setFromObject(root).max.y + 1,
      crowns = new Map();
    const crown = (z) => {
      const key = z.toFixed(2);
      if (!crowns.has(key)) {
        const hit = new Raycaster(new Vector3(0, top, z), new Vector3(0, -1, 0)).intersectObjects(
          skin,
          false,
        )[0];
        crowns.set(key, hit?.point.y ?? Number.NEGATIVE_INFINITY);
      }
      return crowns.get(key);
    };
    for (const node of glareshield) {
      const positions = node.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const v = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld);
        expect(v.y, 'glareshield stays beneath nose skin').toBeLessThanOrEqual(crown(v.z) + 0.001);
      }
    }
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
