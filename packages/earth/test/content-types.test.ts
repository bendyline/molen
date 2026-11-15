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

  it('leaves out a type that fails its checks, with a warning, and loads the rest', async () => {
    const doc = typesDoc('molen.entities', ['tree.pine', 'prop.bench']);
    Object.assign((doc.types as Record<string, object>)['molen.entities.prop.bench'] as object, {
      components: { transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1], wobble: 1 } },
    });
    const warnings: string[] = [];
    const full = await loadEarthContent([typesPack('molen.entities', [doc])], {
      stylePack: false,
      onWarning: (message) => warnings.push(message),
    });
    expect(full.types?.ids()).toEqual(['molen.entities.tree.pine']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/"molen\.entities\.prop\.bench" left out.*wobble/);
    // Structure checks, for packs validated where they were built, keep the field.
    const structure = await loadEarthContent([typesPack('molen.entities', [doc])], {
      stylePack: false,
      typeChecks: 'structure',
      onWarning: (message) => warnings.push(message),
    });
    expect(structure.types?.ids()).toEqual([
      'molen.entities.tree.pine',
      'molen.entities.prop.bench',
    ]);
    expect(warnings).toHaveLength(1);
  });

  it('reads the style pack while the entity types are still arriving', async () => {
    let release = (): void => {};
    const arrived = new Promise<void>((resolve) => {
      release = resolve;
    });
    const reads: string[] = [];
    const slow = typesPack('molen.entities', [typesDoc('molen.entities', ['tree.pine'])]);
    const readTypes = slow.readJson.bind(slow);
    Object.assign(slow, {
      readJson: async (path: string) => {
        reads.push(`types ${path}`);
        await arrived;
        return readTypes(path);
      },
    });
    const missing = (id: string) =>
      ({
        manifest: { id, version: '1.0.0', provides: {} },
        readJson: async (path: string) => {
          reads.push(`${id} ${path}`);
          throw new Error(`no ${path} in this test`);
        },
      }) as unknown as Pack;
    const loading = loadEarthContent([
      slow,
      missing('molen.worldgen.default'),
      missing('molen.earth'),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(reads).toContain('molen.worldgen.default stylepack.json');
    release();
    const content = await loading;
    expect(content.types?.ids()).toEqual(['molen.entities.tree.pine']);
    expect(content.worldgenError).toMatch(/unavailable: no .+ in this test/);
  });

  it('rejects a type id declared by two packs, naming both', async () => {
    const entities = typesPack('molen.entities', [typesDoc('molen.entities', ['tree.pine'])]);
    const clash = typesPack('example.fork', [typesDoc('molen.entities', ['tree.pine'])]);
    await expect(loadEarthContent([entities, clash], { stylePack: false })).rejects.toThrow(
      /molen\.entities\.tree\.pine.*molen\.entities@1\.2\.3.*example\.fork@1\.2\.3/,
    );
  });
});
