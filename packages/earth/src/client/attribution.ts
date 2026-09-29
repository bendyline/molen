// Required credits for real-world data. ODbL and the OSM Foundation guidelines require the map
// credit to stay visible without interaction, so an Earth view always shows these; this turns a
// package's attribution records into short, ordered credits a host can render as text or links.

import type { TerrainPackageAttribution } from '@bendyline/molen-terrain/kernel';

export interface EarthCredit {
  /** The party to credit: the attribution text up to its first ';'. */
  label: string;
  /** Full attribution text, for an expanded credits panel. */
  text: string;
  license: string;
  /** Link for the label; OpenStreetMap credits link to its copyright page. */
  url?: string;
}

const OSM_COPYRIGHT = 'https://www.openstreetmap.org/copyright';

function isOpenStreetMap(text: string): boolean {
  return text.includes('OpenStreetMap');
}

/** Short credits for a package's attribution records, OpenStreetMap first. */
export function earthCredits(attribution: readonly TerrainPackageAttribution[]): EarthCredit[] {
  return [...attribution]
    .sort((left, right) => Number(isOpenStreetMap(right.text)) - Number(isOpenStreetMap(left.text)))
    .map((entry) => {
      const osm = isOpenStreetMap(entry.text);
      const url = osm ? (entry.sourceUrl ?? OSM_COPYRIGHT) : (entry.sourceUrl ?? entry.licenseUrl);
      return {
        label: (entry.text.split(';')[0] ?? entry.text).trim(),
        text: entry.text,
        license: entry.license,
        ...(url !== undefined ? { url } : {}),
      };
    });
}

/** One line of plain-text credits, e.g. for a canvas overlay or an accessible label. */
export function formatEarthCredits(credits: readonly EarthCredit[]): string {
  return credits.map((credit) => credit.label).join(' · ');
}
