import {
  resolveSoundProfile,
  type SoundProfile,
  type SoundProfileCabin,
  type SoundProfileLayer,
  type SoundProfileMatch,
  type SoundProfilesDoc,
  validate,
} from '@bendyline/molen-schema';
import type { AudioPackSetLike } from './packs';

/** A profile with everything it extends folded in. */
export interface ResolvedSoundProfile {
  id: string;
  layers: SoundProfileLayer[];
  cabin?: SoundProfileCabin;
  horn?: string;
  start?: string;
  stop?: string;
  maxDistance: number;
}

/** Profiles merged from several documents; later documents win. */
export interface SoundProfileSet {
  readonly components: readonly string[];
  readonly match: readonly SoundProfileMatch[];
  resolve(id: string): ResolvedSoundProfile | undefined;
  readonly ids: readonly string[];
}

const DEFAULT_RANGE_M = 400;

/**
 * Merge sound-profile documents, earliest first. A later document's match rules are tried before
 * an earlier one's, and its profiles replace same-id ones, so a project can re-voice one family by
 * shipping a document with one rule and one profile.
 */
export function mergeSoundProfiles(docs: readonly SoundProfilesDoc[]): SoundProfileSet {
  const profiles: Record<string, SoundProfile> = {};
  const match: SoundProfileMatch[] = [];
  const components = new Set<string>();
  for (const doc of docs) {
    Object.assign(profiles, doc.profiles);
    match.unshift(...doc.match);
    for (const c of doc.components) components.add(c);
  }
  const cache = new Map<string, ResolvedSoundProfile | undefined>();
  return {
    components: [...components],
    match,
    ids: Object.keys(profiles),
    resolve(id) {
      if (cache.has(id)) return cache.get(id);
      const r = resolveSoundProfile({ profiles }, id);
      const out = r
        ? {
            id,
            layers: r.layers,
            maxDistance: r.maxDistance ?? DEFAULT_RANGE_M,
            ...(r.cabin ? { cabin: r.cabin } : {}),
            ...(r.horn ? { horn: r.horn } : {}),
            ...(r.start ? { start: r.start } : {}),
            ...(r.stop ? { stop: r.stop } : {}),
          }
        : undefined;
      cache.set(id, out);
      return out;
    },
  };
}

/** Every `provides["sound-profiles"]` document in a pack set, validated; invalid ones are skipped. */
export async function loadPackSoundProfiles(
  set: AudioPackSetLike,
  onWarning?: (message: string) => void,
): Promise<SoundProfilesDoc[]> {
  const out: SoundProfilesDoc[] = [];
  for (const { pack, path } of set.provided('sound-profiles')) {
    const ref = `pack:${pack.manifest.id}/${path}`;
    const result = validate('sound-profiles', await set.readJson(ref));
    if (!result.ok) {
      onWarning?.(`${ref} is not a valid sound-profiles document:\n${result.formatted}`);
      continue;
    }
    out.push(result.value as SoundProfilesDoc);
  }
  return out;
}
