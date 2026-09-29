import { type SoundbankDoc, validate } from '@bendyline/molen-schema';
import type { SoundbankInput } from './bank';

/** The slice of a `@bendyline/molen-pack` PackSet this needs (structural: no pack dependency). */
export interface AudioPackSetLike {
  provided(role: string): { pack: { readonly manifest: { readonly id: string } }; path: string }[];
  readJson<T = unknown>(ref: string): Promise<T>;
}

/**
 * Every `provides.soundbank` document in a pack set, validated, with clip refs rooted in its pack
 * (`pack:<id>/<dir>/`), ready for `createAudioLayer({ banks, provider: set.assetProvider() })`.
 * Invalid banks are reported through `onWarning` and skipped.
 */
export async function loadPackSoundbanks(
  set: AudioPackSetLike,
  onWarning?: (message: string) => void,
): Promise<SoundbankInput[]> {
  const out: SoundbankInput[] = [];
  for (const { pack, path } of set.provided('soundbank')) {
    const ref = `pack:${pack.manifest.id}/${path}`;
    const result = validate('soundbank', await set.readJson(ref));
    if (!result.ok) {
      onWarning?.(`${ref} is not a valid soundbank:\n${result.formatted}`);
      continue;
    }
    const slash = path.lastIndexOf('/');
    out.push({
      doc: result.value as SoundbankDoc,
      base: `pack:${pack.manifest.id}/${slash >= 0 ? path.slice(0, slash + 1) : ''}`,
    });
  }
  return out;
}
