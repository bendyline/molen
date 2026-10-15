// loadEarthContent merges the entity types of every opened pack that provides them.
import type { Pack } from '@bendyline/molen-pack';
import { describe, expect, it } from 'vitest';
import { loadEarthContent } from '../src/client/content';

/** A pack whose `provides.types` documents are the given in-memory docs; no bytes to read. */
function typesPack(id: string, docs: Record<string, unknown>[]): Pack {
  const paths = docs.map((_, i) => `types/${i}.types.json`);
  return {
    manifest: { id, version: '1.2.3', provides: { types: paths } },
    readJson: async (path: string) => {
      const doc = docs[paths.indexOf(path)];
      if (doc === undefined) throw new Error(`no document at ${path}`);
      return doc;
    },
    readBytes: async () => {
      throw new Error('no bytes in this test');
    },
  } as unknown as Pack;
}

function typesDoc(namespace: string, ids: string[]): Record<string, unknown> {
  return {
    format: 'molen/types@1',
    namespace,
    types: Object.fromEntries(
      ids.map((id) => [
        `${namespace}.${id}`,
        { components: { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } } },
      ]),
    ),
  };
}

describe('Earth content entity types', () => {
  it('merges the types of every opened pack, the entities pack first', async () => {
    const host = typesPack('qualla.tourco', [typesDoc('qualla.tourco', ['figure.guide'])]);
    const entities = typesPack('molen.entities', [
      typesDoc('molen.entities', ['tree.pine']),
      typesDoc('molen.entities', ['prop.bench']),
    ]);
    const other = typesPack('example.props', [typesDoc('example.props', ['prop.crate'])]);
    // Opened in host-first order; the stock entities still lead the merged library.
    const content = await loadEarthContent([host, entities, other], { stylePack: false });
    expect(content.types?.ids()).toEqual([
      'molen.entities.tree.pine',
      'molen.entities.prop.bench',
      'qualla.tourco.figure.guide',
      'example.props.prop.crate',
    ]);
    expect(content.types?.has('qualla.tourco.figure.guide')).toBe(true);
    expect(content.parkedVehicles).toEqual([]);
  });

  it('merges a host pack without the entities pack, and has no types without any', async () => {
    const host = typesPack('qualla.tourco', [typesDoc('qualla.tourco', ['figure.guide'])]);
    const silent = {
      manifest: { id: 'molen.sky', version: '1.0.0', provides: {} },
      readJson: async () => {
        throw new Error('nothing to read');
      },
    } as unknown as Pack;
    expect((await loadEarthContent([silent, host], { stylePack: false })).types?.ids()).toEqual([
      'qualla.tourco.figure.guide',
    ]);
    expect((await loadEarthContent([silent], { stylePack: false })).types).toBeUndefined();
  });

  it('rejects a type id declared by two packs, naming both', async () => {
    const entities = typesPack('molen.entities', [typesDoc('molen.entities', ['tree.pine'])]);
    const clash = typesPack('example.fork', [typesDoc('molen.entities', ['tree.pine'])]);
    await expect(loadEarthContent([entities, clash], { stylePack: false })).rejects.toThrow(
      /molen\.entities\.tree\.pine.*molen\.entities@1\.2\.3.*example\.fork@1\.2\.3/,
    );
  });
});
