import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const victoriaLawCourtsCase = 'former-victoria-law-courts-bastion-square-heritage';
export const victoriaLawCourtsModel = 'former_victoria_law_courts';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function readRecord(dir, evidence, path) {
  if (evidence?.path !== path) throw Error('Unexpected courthouse evidence path');
  const bytes = readFileSync(join(dir, path));
  if (hash(bytes) !== evidence.sha256) throw Error('Courthouse evidence hash mismatch');
  return JSON.parse(bytes);
}

export function inspectVictoriaLawCourtsFacts({ dir, controls, frame, proof }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const native = readRecord(
      dir,
      proof.nativeIdentity,
      'native-map/bastion-square-courthouse.json',
    );
    const sources = readRecord(
      dir,
      proof.primarySources,
      'reference-rights/primary-source-facts.json',
    );
    const heritage = sources.sources.find(
      (row) =>
        row.url === 'https://www.historicplaces.ca/en/rep-reg/place-lieu.aspx?id=14664&pid=0',
    );
    const city = sources.sources.find((row) => row.key === 'victoria-downtown-heritage-inventory');
    const museum = sources.sources.find((row) => row.url === 'https://mmbc.bc.ca/about/about-us/');
    if (
      sources.model !== victoriaLawCourtsModel ||
      proof.primarySources.use !== 'factual-text-only' ||
      [heritage, city, museum].some((row) => row?.use !== 'factual-text-only') ||
      heritage.facts.storeys !== 3 ||
      heritage.facts.roundEastTowers !== 2 ||
      heritage.facts.southEntranceTowers !== 2 ||
      heritage.facts.originalArches !== 3 ||
      !heritage.facts.flatRoof ||
      !city.facts.stuccoOverBrick ||
      museum.facts.bastionSquareOccupancyStart !== 1965 ||
      museum.facts.bastionSquarePublicClosure !== 2014
    )
      return fail('victoria-courthouse-written-facts-unbound');

    const [lon, lat] = frame.anchor,
      radians = Math.PI / 180;
    const meters = 6378137 * radians,
      c = Math.cos(frame.heading),
      s = Math.sin(frame.heading);
    const matches = ([a, b], [u, v]) => {
      const x = (a - lon) * meters * Math.cos(lat * radians);
      const z = (lat - b) * meters;
      return Math.hypot(c * x - s * z - u, s * x + c * z - v) < 0.000008;
    };
    const { outline, eastTowers, southTowers, estimateVerticalDimensions } = controls.dimensions;
    if (
      controls.model !== victoriaLawCourtsModel ||
      !estimateVerticalDimensions ||
      !estimateVerticalDimensions.roof ||
      eastTowers.length !== 2 ||
      southTowers.length !== 2 ||
      frame.mappedIdentity.wikidataId !== 'Q23768713' ||
      native.way.id !== 95036974 ||
      native.way.id !== proof.nativeIdentity.way ||
      native.way.id !== frame.mappedIdentity.way ||
      native.way.tags['addr:housenumber'] !== '28' ||
      native.way.tags['addr:street'] !== 'Bastion Square' ||
      frame.sourceUrl !== 'https://www.openstreetmap.org/way/95036974' ||
      native.sourceUrl !== frame.sourceUrl ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      native.way.nodes.length !== 24 ||
      frame.geometry.outline.length !== 24 ||
      !native.way.nodes.every((point, i) => matches(point, frame.geometry.outline[i])) ||
      JSON.stringify(outline) !== JSON.stringify(frame.geometry.outline)
    )
      return fail('victoria-courthouse-native-footprint-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Confirmed the 28 Bastion Square footprint, the four courthouse towers and the museum’s former tenancy. Façade subdivisions and heights are reconstructions.',
    };
  } catch {
    return fail('victoria-courthouse-facts-invalid');
  }
}
