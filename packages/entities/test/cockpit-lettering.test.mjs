import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { expect, it } from 'vitest';
import { createAircraftVisual } from '../../client/dist/aircraft.mjs';
import { applyLivery } from '../../client/dist/index.mjs';
import { cockpitFontTexture } from '../scripts/aircraft/cockpit-lettering.mjs';
import { GLTFLoader } from './helpers/gltf-loader.mjs';

const root = new URL('../../../content/entities/', import.meta.url);
it.each([
  ['p-51', 'period'],
  ['oh-6', 'technical'],
])('%s embeds antialiased lettering without changing instrument pivots', async (slug, font) => {
  const source = JSON.parse(await readFile(new URL(`source/aircraft/${slug}/source.json`, root)));
  const atlas = await readFile(
    new URL(`source/aircraft/${slug}/textures/cockpit-font-${font}.png`, root),
  );
  expect(atlas.equals(cockpitFontTexture(font))).toBe(true);
  const png = PNG.sync.read(atlas);
  expect([png.width, png.height]).toEqual([1024, 1024]);
  const alpha = new Set();
  let white = true;
  for (let i = 0; i < png.data.length; i += 4) {
    white &&= png.data[i] === 255 && png.data[i + 1] === 255 && png.data[i + 2] === 255;
    alpha.add(png.data[i + 3]);
  }
  expect(white).toBe(true); // Clear texels must not introduce black mipmap fringes.
  expect(alpha.has(0) && alpha.has(255)).toBe(true);
  expect(alpha.size).toBeGreaterThan(8); // Multiple edge coverage levels, not a binary bitmap font.
  const bytes = await readFile(
    new URL(source.files.models[0].output.replace('asset.json', 'model.glb'), root),
  );
  const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const print = doc.materials.filter((m) => m.extras?.molenCockpitLettering);
  expect(print.length).toBeGreaterThan(0);
  const textures = new Set(print.map((m) => m.pbrMetallicRoughness.baseColorTexture.index));
  expect(textures.size).toBe(1);
  for (const material of print) {
    expect(material.extras.molenCockpitLettering).toBe(font);
    expect(material.alphaMode).toBe('BLEND');
    expect(material.emissiveTexture.index).toBe(
      material.pbrMetallicRoughness.baseColorTexture.index,
    );
    expect(material.extras.molenCockpitFinish).toBeUndefined();
  }
  const texture = doc.textures[[...textures][0]],
    image = doc.images[texture.source];
  const view = doc.bufferViews[image.bufferView],
    offset = 28 + bytes.readUInt32LE(12) + (view.byteOffset ?? 0);
  expect(bytes.subarray(offset, offset + view.byteLength).equals(atlas)).toBe(true);
  expect(doc.samplers[texture.sampler]).toMatchObject({
    magFilter: 9729,
    minFilter: 9987,
    wrapS: 33071,
    wrapT: 33071,
  });
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const label = scene.getObjectByName('airspeed-label');
  expect(label.geometry.index.count).toBe('AIRSPEED'.length * 6);
  expect(label.parent).toBe(scene.getObjectByName('needle-airspeed').parent);
  expect(label.material.map.image.width).toBe(1024);
  expect(label.material.depthWrite).toBe(false);
  const legend = scene.getObjectByName('flight-engine-common-legend');
  expect(legend.material.userData.molenCockpitLettering).toBe(font);
  expect(legend.parent.name).toBe('flight-controls');
  const definition = JSON.parse(
    await readFile(new URL(`source/aircraft/${slug}/entity.types.json`, root)),
  );
  const components = definition.types[source.id].components;
  const visual = createAircraftVisual(scene, components.aircraft.spec);
  visual.update({ ...components.aircraftState, airspeed: 0 }, components.aircraftInput, 0, {}, 0);
  scene.updateMatrixWorld(true);
  const printedPose = label.matrixWorld.clone();
  const needle = scene.getObjectByName('needle-airspeed'),
    restAngle = needle.rotation.z;
  visual.update({ ...components.aircraftState, airspeed: 100 }, components.aircraftInput, 1, {}, 1);
  scene.updateMatrixWorld(true);
  expect(Math.abs(needle.rotation.z - restAngle)).toBeGreaterThan(0.1);
  expect(label.matrixWorld.equals(printedPose)).toBe(true);
  const catalog = JSON.parse(await readFile(new URL('source/liveries.json', root)));
  const liveries = catalog.models[source.id];
  const cockpitMaterials = new Map();
  scene.traverse((node) => {
    if (node.material?.userData.molenCockpitFinish || node.material?.userData.molenCockpitLettering)
      cockpitMaterials.set(node, node.material);
  });
  expect(cockpitMaterials.size).toBeGreaterThan(0);
  for (const variant of liveries.variants) {
    const appearance = applyLivery(scene, { ...liveries, selected: variant.id });
    expect(appearance.warnings).toEqual([]);
    for (const [node, material] of cockpitMaterials) expect(node.material).toBe(material);
    appearance.dispose();
  }
});
