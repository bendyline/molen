import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { Vector3 } from 'three';
import { expect, it } from 'vitest';
import { createAircraftVisual } from '../../client/dist/aircraft.mjs';
import { cockpitFontProfiles, cockpitFontTexture } from '../scripts/aircraft/cockpit-lettering.mjs';
import { cockpitFinishLibrary } from '../scripts/aircraft/cockpit-surfaces.mjs';
import { GLTFLoader } from './helpers/gltf-loader.mjs';

const root = new URL('../../../content/entities/', import.meta.url);
it.each(
  Object.keys(cockpitFinishLibrary.profiles),
)('%s keeps cockpit finishes portable, bounded and out of the airframe', async (slug) => {
  const profile = cockpitFinishLibrary.profiles[slug];
  const source = JSON.parse(await readFile(new URL(`source/aircraft/${slug}/source.json`, root)));
  const definition = JSON.parse(
    await readFile(new URL(`source/aircraft/${slug}/entity.types.json`, root)),
  );
  const interior = definition.types[source.id].components.aircraft.spec.visual.interior;
  expect(source.files.textures.length).toBeGreaterThanOrEqual(9);
  // Up to eight shared finishes plus three explicit lettering roles.
  expect(source.files.textures.length).toBeLessThanOrEqual(27);
  const fontProfile = cockpitFontProfiles[slug];
  const fontTextures = source.files.textures.filter((t) => t.id.startsWith('cockpit-font-'));
  expect(fontTextures.length, `${slug} has actual font textures`).toBeGreaterThan(0);
  expect(fontTextures.length).toBeLessThanOrEqual(3);
  const canonical = new Map();
  for (const texture of source.files.textures) {
    const bytes = await readFile(new URL(`source/aircraft/${slug}/${texture.path}`, root));
    if (texture.id.startsWith('cockpit-font-')) {
      expect(bytes.equals(cockpitFontTexture(texture.id.slice('cockpit-font-'.length)))).toBe(true);
      canonical.set(texture.id, bytes);
      continue;
    }
    const shared = await readFile(new URL(`source/cockpit-materials/${texture.id}.png`, root));
    expect(bytes.equals(shared), `${texture.id} matches the shared library`).toBe(true);
    canonical.set(texture.id, shared);
    const png = PNG.sync.read(bytes);
    const finish = cockpitFinishLibrary.finishes[texture.id.split('-')[1]];
    const size = finish.size;
    expect([png.width, png.height]).toEqual([size, size]);
    let opaque = true,
      channels = true,
      minimumRoughness = 255,
      minimumNormalZ = 255;
    for (let i = 0; i < png.data.length; i += 4) {
      opaque &&= png.data[i + 3] === 255;
      if (texture.id.endsWith('roughness')) {
        channels &&= png.data[i] === 255 && png.data[i + 2] === 255;
        minimumRoughness = Math.min(minimumRoughness, png.data[i + 1]);
      }
      if (texture.id.endsWith('normal')) minimumNormalZ = Math.min(minimumNormalZ, png.data[i + 2]);
    }
    expect(opaque).toBe(true);
    expect(channels).toBe(true);
    expect(minimumRoughness).toBeGreaterThanOrEqual(Math.floor((finish.roughness - 0.1) * 255));
    expect(minimumNormalZ).toBeGreaterThan(225);
  }
  const bytes = await readFile(
    new URL(source.files.models[0].output.replace('asset.json', 'model.glb'), root),
  );
  for (const glb of [
    bytes,
    await readFile(new URL(`source/aircraft/${slug}/models/source.glb`, root)),
  ]) {
    const jsonSize = glb.readUInt32LE(12);
    const doc = JSON.parse(glb.subarray(20, 20 + jsonSize));
    const embedded = doc.images.filter((image) => image.name?.startsWith('cockpit-'));
    expect(new Set(embedded.map((image) => image.name)).size).toBe(embedded.length);
    expect(embedded.length).toBe(canonical.size);
    let textureBytes = 0;
    for (const image of embedded) {
      expect(image.uri).toBeUndefined();
      const view = doc.bufferViews[image.bufferView];
      const offset = 28 + jsonSize + (view.byteOffset ?? 0);
      textureBytes += view.byteLength;
      expect(glb.subarray(offset, offset + view.byteLength).equals(canonical.get(image.name))).toBe(
        true,
      );
    }
    expect(textureBytes).toBeLessThan(1500000);
  }
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const cabins = new Set([...interior.nodes, 'flight-controls']);
  let printed = 0;
  scene.traverse((mesh) => {
    const font = mesh.material?.userData.molenCockpitLettering;
    if (!font) return;
    printed++;
    expect([fontProfile.panel, fontProfile.dial, fontProfile.display]).toContain(font);
    if (mesh.userData.molenCockpitTextRole)
      expect(font).toBe(fontProfile[mesh.userData.molenCockpitTextRole]);
    expect(mesh.material.map).toBeTruthy();
    expect(mesh.material.emissiveMap).toBeTruthy();
    expect(mesh.material.depthWrite).toBe(false);
    expect(mesh.geometry.attributes.uv.count).toBe(mesh.geometry.attributes.position.count);
  });
  expect(printed).toBeGreaterThan(0);
  let finished = 0,
    backboards = 0;
  const kinds = new Set();
  scene.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.material.userData.molenCockpitFinish) return;
    finished++;
    let owner = mesh;
    while (owner && !cabins.has(owner.name)) owner = owner.parent;
    expect(owner, `${slug}: ${mesh.name} belongs to an interior root`).toBeTruthy();
    const kind = mesh.material.userData.molenCockpitFinish;
    kinds.add(kind);
    if (owner.name !== 'flight-controls' && mesh.userData.molenCockpitSurfaceRole === 'panel')
      backboards++;
    expect(mesh.material.name).not.toMatch(/lettering|legend|display|horizon-sky|horizon-earth/);
    const size = cockpitFinishLibrary.finishes[kind].size;
    expect(mesh.material.map.image.width).toBe(size);
    expect(mesh.material.normalMap.image.width).toBe(size);
    expect(mesh.material.roughnessMap.image.width).toBe(size);
    const uv = mesh.geometry.attributes.uv;
    expect(uv.count).toBe(mesh.geometry.attributes.position.count);
    expect(
      Array.from(
        { length: uv.count },
        (_, i) => Number.isFinite(uv.getX(i)) && Number.isFinite(uv.getY(i)),
      ).every(Boolean),
    ).toBe(true);
    const count = mesh.geometry.index?.count ?? uv.count;
    for (let i = 0; i < count; i += 3) {
      const indices = [0, 1, 2].map((j) => mesh.geometry.index?.getX(i + j) ?? i + j);
      const [a, b, c] = indices.map((j) => [uv.getX(j), uv.getY(j)]);
      expect(
        Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])),
      ).toBeGreaterThan(1e-10);
    }
  });
  expect(finished).toBeGreaterThanOrEqual(3);
  expect(backboards, `${slug}: original instrument backboard is finished`).toBeGreaterThan(0);
  for (const kind of [profile.panel, 'brushed', 'rubber']) expect(kinds.has(kind)).toBe(true);
});

it.each([
  'p-51',
  'oh-6',
])('%s keeps curved horizon faces moving behind the fixed aircraft symbol', async (slug) => {
  const source = JSON.parse(await readFile(new URL(`source/aircraft/${slug}/source.json`, root)));
  const definition = JSON.parse(
    await readFile(new URL(`source/aircraft/${slug}/entity.types.json`, root)),
  );
  const c = definition.types[source.id].components;
  const bytes = await readFile(
    new URL(source.files.models[0].output.replace('asset.json', 'model.glb'), root),
  );
  const { scene } = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const ball = scene.getObjectByName('attitude-ball');
  const symbol = scene.getObjectByName('horizon-aircraft');
  expect(ball).toBeDefined();
  expect(symbol.parent).toBe(ball.parent);
  for (const name of ['horizon-sky', 'horizon-earth']) {
    const mesh = ball.getObjectByName(name);
    const p = mesh.geometry.attributes.position,
      n = mesh.geometry.attributes.normal;
    mesh.geometry.computeBoundingBox();
    const size = mesh.geometry.boundingBox.getSize(new Vector3());
    expect(size.z).toBeGreaterThan(size.x * 0.1);
    // Front-facing, smooth normals vary across the curved cap.
    expect(
      Math.max(...Array.from({ length: n.count }, (_, i) => Math.abs(n.getX(i)))),
    ).toBeGreaterThan(0.3);
    expect(Array.from({ length: n.count }, (_, i) => n.getZ(i) < -0.8).every(Boolean)).toBe(true);
    expect(p.count).toBeGreaterThan(100);
  }
  const visual = createAircraftVisual(scene, c.aircraft.spec);
  scene.updateMatrixWorld(true);
  const rest = symbol.getWorldPosition(new Vector3());
  for (const direction of [-1, 1]) {
    visual.update(
      { ...c.aircraftState, pitch: direction * 0.2, roll: direction * 0.35 },
      c.aircraftInput,
      0,
      {},
      0,
    );
    scene.updateMatrixWorld(true);
    expect(ball.rotation.x * direction).toBeGreaterThan(0.01);
    expect(ball.rotation.z * direction).toBeLessThan(-0.1);
    expect(symbol.getWorldPosition(new Vector3()).distanceTo(rest)).toBeLessThan(1e-8);
  }
});
