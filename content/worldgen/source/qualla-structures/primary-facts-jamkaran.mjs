import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const jamkaranCase = 'jamkaran-verified-prayer-halls-and-courtyard';
export const jamkaranModel = 'jamkaran_mosque';

const metersPerDegree = (6378137 * Math.PI) / 180;
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function boundDocument(dir, evidence, expectedPath) {
  if (evidence?.path !== expectedPath) throw Error('Unexpected Jamkaran source path');
  const bytes = readFileSync(join(dir, expectedPath));
  if (hash(bytes) !== evidence.sha256) throw Error('Unbound Jamkaran document');
  return JSON.parse(bytes);
}

export function inspectJamkaranFacts({ dir, controls, frame, proof }) {
  try {
    const native = boundDocument(
      dir,
      proof.nativeIdentity,
      'native-map/jamkaran-prayer-halls.json',
    );
    const facts = boundDocument(
      dir,
      proof.primarySources,
      'reference-rights/primary-source-facts.json',
    );
    const oxford = facts.sources.find((row) => row.key === 'oxford-fieldwork');
    const ministry = facts.sources.find((row) => row.key === 'iran-cultural-institute');
    const fieldwork = facts.sources.find((row) => row.key === 'abdollahi-field-survey');
    const [lon, lat] = frame.anchor;
    const c = Math.cos(frame.heading),
      s = Math.sin(frame.heading);
    const matches = ([lng, phi], [a, b]) => {
      const x = (lng - lon) * metersPerDegree * Math.cos((lat * Math.PI) / 180);
      const z = (lat - phi) * metersPerDegree;
      return Math.hypot(c * x - s * z - a, s * x + c * z - b) < 0.00001;
    };
    const geometry = controls.dimensions;
    const footprintMatches = (way, footprint) =>
      way?.coordinates?.length === footprint?.length &&
      way.coordinates.every((point, i) => matches(point, footprint[i]));
    if (
      native.place?.id !== 4738088179 ||
      native.place.tags.wikidata !== 'Q1681449' ||
      frame.mappedIdentity?.wikidataId !== native.place.tags.wikidata ||
      proof.nativeIdentity.sha256 !== frame.sourceHash ||
      proof.nativeIdentity.way !== 684924911 ||
      facts.model !== jamkaranModel ||
      controls.model !== jamkaranModel ||
      proof.primarySources.use !== 'factual-text-only' ||
      !facts.sources.every((row) => row.use === 'factual-text-only') ||
      oxford?.facts?.entryMinaretHeightMeters !== 85 ||
      oxford.facts.secondaryDomes !== 4 ||
      oxford.facts.centralDomeColor !== 'turquoise' ||
      oxford.facts.entryMinaretShaft !== 'octagonal' ||
      ministry?.facts?.iwanMinaretHeightMeters !== 60 ||
      fieldwork?.facts?.surveyedCourtyard !== true ||
      geometry.halls.length !== 9 ||
      geometry.domes.length !== 5 ||
      JSON.stringify(frame.geometry.outline) !== JSON.stringify(geometry.courtyard) ||
      !footprintMatches(
        native.ways.find((way) => way.id === 480849586),
        geometry.courtyard,
      ) ||
      !geometry.halls.every((hall) =>
        footprintMatches(
          native.ways.find((way) => way.id === hall.id),
          hall.outline,
        ),
      ) ||
      !geometry.domes.every((dome) =>
        footprintMatches(
          native.ways.find((way) => way.id === dome.id),
          dome.outline,
        ),
      )
    )
      return { status: 'needs-review', reason: 'jamkaran-control-mismatch' };

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The exact mapped halls, domes and courtyard align with firsthand field descriptions of the five domes, prayer hall and portal minarets.',
    };
  } catch {
    return { status: 'needs-review', reason: 'jamkaran-facts-invalid' };
  }
}
