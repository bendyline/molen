import * as THREE from 'three';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StructureModelLibrary } from '../../src/client/structure-models';

class Bitmap {
  close = vi.fn();
}
beforeEach(() => vi.stubGlobal('ImageBitmap', Bitmap));
afterEach(() => vi.unstubAllGlobals());

function material(image: unknown, shared = false): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ map: new THREE.Texture(image) });
  if (shared)
    result.userData.molenSurface = { ref: 'matgraph:shared', slot: 'wall', uv: 'repeats' };
  return result;
}
function scene(...materials: THREE.Material[]): THREE.Group {
  const group = new THREE.Group();
  for (const value of materials) group.add(new THREE.Mesh(new THREE.BoxGeometry(), value));
  return group;
}

it('closes one owned fallback bitmap after all of its distinct textures are replaced', async () => {
  const image = new Bitmap(),
    sharedImage = new Bitmap();
  const borrowed = material(sharedImage);
  const library = new StructureModelLibrary(
    async () => scene(material(image, true), material(image, true)),
    {
      ownsImageBitmaps: true,
      resolveSurface: () => borrowed,
    },
  );
  await library.acquire('a');
  expect(image.close).toHaveBeenCalledTimes(1);
  expect(sharedImage.close).not.toHaveBeenCalled();
  library.release('a');
  library.dispose();
  expect(image.close).toHaveBeenCalledTimes(1);
  expect(sharedImage.close).not.toHaveBeenCalled();
  borrowed.map?.dispose();
  borrowed.dispose();
});

it('keeps bitmap aliases used by a retained original material alive until the final release', async () => {
  const image = new Bitmap();
  const borrowed = new THREE.MeshStandardMaterial();
  const library = new StructureModelLibrary(
    async () => scene(material(image, true), material(image)),
    {
      ownsImageBitmaps: true,
      resolveSurface: () => borrowed,
    },
  );
  await library.acquire('a');
  expect(image.close).not.toHaveBeenCalled();
  library.release('a');
  library.dispose();
  expect(image.close).toHaveBeenCalledTimes(1);
  borrowed.dispose();
});

it('never closes bitmap aliases used by borrowed shared materials', async () => {
  const image = new Bitmap();
  const borrowed = material(image);
  const library = new StructureModelLibrary(async () => scene(material(image, true)), {
    ownsImageBitmaps: true,
    resolveSurface: () => borrowed,
  });
  await library.acquire('a');
  library.release('a');
  library.dispose();
  expect(image.close).not.toHaveBeenCalled();
  borrowed.map?.dispose();
  borrowed.dispose();
});

it('waits for both transferred scenes to release a shared bitmap', async () => {
  const image = new Bitmap();
  const library = new StructureModelLibrary(async () => scene(material(image)), {
    ownsImageBitmaps: true,
  });
  await library.acquire('a');
  await library.acquire('b');
  library.release('a');
  expect(image.close).not.toHaveBeenCalled();
  library.release('b');
  library.dispose();
  expect(image.close).toHaveBeenCalledTimes(1);
});

it('closes a transferred bitmap that loads after disposal', async () => {
  const image = new Bitmap();
  let finish!: (object: THREE.Object3D) => void;
  const library = new StructureModelLibrary(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    { ownsImageBitmaps: true },
  );
  const loading = library.acquire('late');
  library.dispose();
  finish(scene(material(image)));
  await expect(loading).rejects.toThrow('disposed');
  library.release('late');
  library.dispose();
  expect(image.close).toHaveBeenCalledTimes(1);
});

it('preserves external-cache image ownership and ignores arbitrary close-like data', async () => {
  const external = new Bitmap(),
    closeLike = { close: vi.fn() };
  const externalLibrary = new StructureModelLibrary(async () => scene(material(external)));
  const ownedLibrary = new StructureModelLibrary(async () => scene(material(closeLike)), {
    ownsImageBitmaps: true,
  });
  await externalLibrary.acquire('external');
  await ownedLibrary.acquire('owned');
  externalLibrary.dispose();
  ownedLibrary.dispose();
  expect(external.close).not.toHaveBeenCalled();
  expect(closeLike.close).not.toHaveBeenCalled();
});

it('preserves borrowed texture aliases when a later resolver fails', async () => {
  const borrowedImage = new Bitmap(),
    ownedImage = new Bitmap();
  const first = material(borrowedImage, true),
    second = material(ownedImage, true);
  const borrowed = new THREE.MeshStandardMaterial({ map: first.map });
  const dispose = vi.spyOn(first.map as THREE.Texture, 'dispose');
  let resolved = 0;
  const library = new StructureModelLibrary(async () => scene(first, second), {
    ownsImageBitmaps: true,
    resolveSurface: () => {
      if (resolved++ > 0) throw new Error('surface unavailable');
      return borrowed;
    },
  });
  await expect(library.acquire('failed')).rejects.toThrow('surface unavailable');
  library.dispose();
  expect(dispose).not.toHaveBeenCalled();
  expect(borrowedImage.close).not.toHaveBeenCalled();
  expect(ownedImage.close).toHaveBeenCalledTimes(1);
  borrowed.map?.dispose();
  borrowed.dispose();
});

it.each([
  'shared.png',
  'data:image/png;base64,AAAA',
])('preserves host-cached URI images across reloads with per-scene ownership: %s', async (uri) => {
  const cacheEnabled = THREE.Cache.enabled;
  const cacheKey = 'image-bitmap:' + uri;
  const cachedImage = new Bitmap(),
    embeddedImage = new Bitmap();
  const ownedScenes = new WeakSet<THREE.Object3D>();
  THREE.Cache.enabled = true;
  THREE.Cache.add(cacheKey, cachedImage);
  const library = new StructureModelLibrary(
    async (ref) => {
      const result = scene(
        material(ref === 'embedded' ? embeddedImage : THREE.Cache.get(cacheKey)),
      );
      if (ref === 'embedded') ownedScenes.add(result);
      return result;
    },
    { ownsImageBitmaps: (value) => ownedScenes.has(value) },
  );
  try {
    await library.acquire('embedded');
    library.release('embedded');
    expect(embeddedImage.close).toHaveBeenCalledTimes(1);
    for (let reload = 0; reload < 2; reload++) {
      const model = await library.acquire('uri');
      const mesh = model.scene.children[0] as THREE.Mesh<
        THREE.BufferGeometry,
        THREE.MeshStandardMaterial
      >;
      expect(mesh.material.map?.image).toBe(cachedImage);
      expect(cachedImage.close).not.toHaveBeenCalled();
      library.release('uri');
    }
    library.dispose();
    expect(cachedImage.close).not.toHaveBeenCalled();
  } finally {
    library.dispose();
    THREE.Cache.remove(cacheKey);
    THREE.Cache.enabled = cacheEnabled;
  }
});

it('disposes scene resources but preserves image ownership if its predicate fails', async () => {
  const image = new Bitmap();
  const original = material(image);
  const loaded = scene(original);
  const textureDispose = vi.spyOn(original.map as THREE.Texture, 'dispose');
  const geometryDispose = vi.spyOn((loaded.children[0] as THREE.Mesh).geometry, 'dispose');
  const library = new StructureModelLibrary(async () => loaded, {
    ownsImageBitmaps: () => {
      throw new Error('ownership unknown');
    },
  });
  await expect(library.acquire('failed')).rejects.toThrow('ownership unknown');
  library.dispose();
  expect(image.close).not.toHaveBeenCalled();
  expect(textureDispose).toHaveBeenCalledTimes(1);
  expect(geometryDispose).toHaveBeenCalledTimes(1);
});
