/**
 * What a place of worship carries on its roof. A map gives a place of worship its religion; the
 * tower or dome that says so from across a town follows the religion and, for churches, the part
 * of the world. These are the commonest forms, not a survey: a mapped church in Greece gets a dome
 * whether or not that church has one.
 */
import type { BuildingCrown } from '@bendyline/molen-worldgen/kernel';

/** Architectural regions whose churches are domed (the Orthodox and Oriental traditions). */
const DOMED_CHURCHES: ReadonlySet<string> = new Set([
  'library.greece',
  'gr.aegean',
  'library.russia',
  'library.caucasus',
  'library.anatolia',
  'library.levant',
  'library.nile',
  'library.east_africa',
]);

/** Regions whose churches stand beside a bell tower with a low cap rather than under a spire. */
const BELFRY_CHURCHES: ReadonlySet<string> = new Set([
  'library.italy',
  'it.central',
  'library.iberia',
  'fr.midi',
  'library.adriatic',
  'library.mexico',
  'library.central_america',
  'library.caribbean',
  'library.colombia',
  'library.andes',
  'library.brazil',
  'library.chile',
  'library.southern_south_america',
  'library.philippines',
  'us.southwest',
]);

/** Smaller than this a church is a chapel, with at most a dome, m². */
const CHAPEL_AREA = 110;

/**
 * Crowns for a place of worship of `religion` (the map's own word: `christian`, `muslim`,
 * `hindu`, ...) in an architectural region, on a footprint of `areaM2`. Empty for traditions
 * whose halls are told by their roof and materials alone, and for an unknown religion.
 */
export function worshipCrowns(
  religion: string | undefined,
  regionId: string | undefined,
  areaM2: number,
): BuildingCrown[] {
  switch (religion) {
    case 'christian': {
      if (regionId !== undefined && DOMED_CHURCHES.has(regionId)) return ['dome'];
      if (areaM2 < CHAPEL_AREA) return [];
      return regionId !== undefined && BELFRY_CHURCHES.has(regionId) ? ['belfry'] : ['spire'];
    }
    case 'muslim':
      return areaM2 < CHAPEL_AREA ? ['minaret'] : ['dome', 'minaret'];
    case 'hindu':
    case 'jain':
      return ['shikhara'];
    case 'sikh':
      return ['dome'];
    default:
      return [];
  }
}
