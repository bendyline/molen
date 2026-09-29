import type { SoundbankDoc, SoundEntry } from '@bendyline/molen-schema';

/** A bank document plus where its clip paths resolve (e.g. `pack:molen.sounds/`, `sounds/`). */
export interface SoundbankInput {
  doc: SoundbankDoc;
  /** Prefix joined to every clip path; default none (clips are provider refs as written). */
  base?: string;
}

export interface ResolvedSound {
  id: string;
  entry: SoundEntry;
  /** Clip refs ready for `AssetProvider.load`. */
  refs: readonly string[];
  /** Id of the bank that supplied this sound (later banks override earlier ones). */
  bank: string;
}

export interface SoundBank {
  resolve(id: string): ResolvedSound | undefined;
  ids(): readonly string[];
}

function joinRef(base: string | undefined, clip: string): string {
  if (base === undefined || base === '') return clip;
  return base.endsWith('/') ? `${base}${clip}` : `${base}/${clip}`;
}

/** Merge banks; a later bank's sound replaces an earlier one with the same id (reskinning). */
export function mergeSoundbanks(inputs: readonly (SoundbankDoc | SoundbankInput)[]): SoundBank {
  const sounds = new Map<string, ResolvedSound>();
  for (const input of inputs) {
    const { doc, base } = 'doc' in input ? input : { doc: input, base: undefined };
    for (const [id, entry] of Object.entries(doc.sounds)) {
      sounds.set(id, { id, entry, refs: entry.clips.map((c) => joinRef(base, c)), bank: doc.id });
    }
  }
  const ids = [...sounds.keys()].sort();
  return { resolve: (id) => sounds.get(id), ids: () => ids };
}

/** 32-bit string/number hash (FNV-1a + fmix32); deterministic across hosts. */
export function hash32(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const s = typeof part === 'number' ? `#${part}` : `|${part}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Deterministic [0, 1) from any key parts. */
export function unitRandom(...parts: (string | number)[]): number {
  return hash32(...parts) / 4294967296;
}
