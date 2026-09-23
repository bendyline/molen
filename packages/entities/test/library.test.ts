import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { createMolenEntitiesAssetIndex, MOLEN_ENTITY_IDS } from '../src/index';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/entities');

describe('molen entities library', () => {
  it('exposes stable client URLs for every asset id', () => {
    const index = createMolenEntitiesAssetIndex('https://assets.example/entities/');
    expect(Object.keys(index)).toEqual(MOLEN_ENTITY_IDS);
    expect(index['molen.entities.tree.conifer.pine']).toBe(
      'https://assets.example/entities/assets/tree/conifer/pine/model.glb',
    );
  });

  it.each(MOLEN_ENTITY_IDS)('ships a valid, checksummed GLB sidecar for %s', async (id) => {
    const sidecarPath = resolve(
      root,
      'assets',
      (id.includes('.aircraft.') || id.includes('.vehicle.')
        ? id
        : id.replace('molen.entities.', '')
      ).replaceAll('.', '/'),
      'asset.json',
    );
    const sidecar = JSON.parse(await readFile(sidecarPath, 'utf8')) as {
      files: { main: string };
      hash: string;
      stats: { triangles: number };
    };
    const checked = validate('asset', sidecar);
    expect(checked.ok).toBe(true);
    const glb = await readFile(resolve(dirname(sidecarPath), sidecar.files.main));
    expect(glb.subarray(0, 4).toString('ascii')).toBe('glTF');
    expect(`sha256:${createHash('sha256').update(glb).digest('hex')}`).toBe(sidecar.hash);
    expect(sidecar.stats.triangles).toBeGreaterThan(0);
  });

  it('ships valid project, type, and gallery documents', async () => {
    const project = validate(
      'project',
      JSON.parse(await readFile(resolve(root, 'project.json'), 'utf8')),
    );
    const typeDocs = await Promise.all(
      ['entities', 'aircraft', 'vehicle'].map(async (name) =>
        validate(
          'types',
          JSON.parse(await readFile(resolve(root, `types/${name}.types.json`), 'utf8')),
        ),
      ),
    );
    const scene = validate(
      'scene',
      JSON.parse(await readFile(resolve(root, 'scenes/gallery.scene.json'), 'utf8')),
    );
    expect(project.ok).toBe(true);
    expect(typeDocs.every((types) => types.ok)).toBe(true);
    expect(scene.ok).toBe(true);
  });

  it.each([
    'p51d',
    'oh6',
  ])('keeps the editable %s master paired with its imported asset', async (kind) => {
    const sourceDirectory = kind === 'p51d' ? 'p-51' : 'oh-6';
    const sidecar = JSON.parse(
      await readFile(resolve(root, `assets/molen/entities/aircraft/${kind}/asset.json`), 'utf8'),
    ) as { sourceHash: string };
    const source = await readFile(
      resolve(root, `source/aircraft/${sourceDirectory}/models/source.glb`),
    );
    expect(`sha256:${createHash('sha256').update(source).digest('hex')}`).toBe(sidecar.sourceHash);
    const types = validate(
      'types',
      JSON.parse(await readFile(resolve(root, 'types/aircraft.types.json'), 'utf8')),
    );
    const scene = validate(
      'scene',
      JSON.parse(await readFile(resolve(root, 'scenes/aircraft.scene.json'), 'utf8')),
    );
    expect(types.ok).toBe(true);
    expect(scene.ok).toBe(true);
  });

  it.each([
    'compact',
    'sedan',
    'suv',
    'pickup',
    'van',
  ])('keeps the editable %s vehicle master paired with its imported asset', async (kind) => {
    const sidecar = JSON.parse(
      await readFile(resolve(root, `assets/molen/entities/vehicle/${kind}/asset.json`), 'utf8'),
    ) as { sourceHash: string };
    const source = await readFile(resolve(root, `source/vehicles/${kind}/models/source.glb`));
    expect(`sha256:${createHash('sha256').update(source).digest('hex')}`).toBe(sidecar.sourceHash);
  });
});
