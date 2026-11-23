import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const tunisCathedralCase = 'tunis-cathedral-mapped-perimeter-and-vicar-inventory';
export const tunisCathedralModel = 'cathedral_of_saint_vincent_de_paul';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function record(dir, source, name) {
  if (source?.path !== name) throw Error('Unexpected cathedral evidence path');
  const bytes = readFileSync(join(dir, name));
  if (hash(bytes) !== source.sha256) throw Error('Cathedral evidence hash mismatch');
  return JSON.parse(bytes);
}

export function inspectTunisCathedralFacts({ dir, controls, frame, proof }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const native = record(dir, proof.nativeIdentity, 'native-map/tunis-cathedral-perimeter.json');
    const sources = record(dir, proof.primarySources, 'reference-rights/primary-source-facts.json');
    const survey = sources.sources.find((row) => row.key === 'silvio-moreno-cathedral-inventory');
    const church = sources.sources.find(
      (row) => row.url === 'https://archeologiechretienne.ive.org/?p=294',
    );
    if (
      sources.model !== tunisCathedralModel ||
      proof.primarySources.use !== 'factual-text-only' ||
      survey?.use !== 'factual-text-only' ||
      church?.use !== 'factual-text-only' ||
      survey.facts.naveLengthMeters !== 75 ||
      survey.facts.transeptWidthMeters !== 32 ||
      survey.facts.porchArches !== 3 ||
      survey.facts.bellTowers !== 2 ||
      !church.facts.tiaraCupolas ||
      !survey.facts.crossingDome ||
      !survey.facts.mainRoseWindow
    )
      return fail('tunis-cathedral-written-sources-unbound');

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
    const { outline, naveLengthMeters, transeptWidthMeters, estimatedHeights } =
      controls.dimensions;
    if (
      frame.sourceUrl !== 'https://www.openstreetmap.org/way/100080986' ||
      native.sourceUrl !== frame.sourceUrl ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      native.way.id !== 100080986 ||
      native.way.id !== proof.nativeIdentity.way ||
      frame.mappedIdentity.wikidataId !== 'Q2296514' ||
      native.way.tags.wikidata !== frame.mappedIdentity.wikidataId ||
      native.way.nodes.length !== 22 ||
      frame.geometry.outline.length !== 22 ||
      !native.way.nodes.every((point, i) => matches(point, frame.geometry.outline[i])) ||
      JSON.stringify(outline) !== JSON.stringify(frame.geometry.outline) ||
      controls.model !== tunisCathedralModel ||
      !estimatedHeights ||
      naveLengthMeters !== survey.facts.naveLengthMeters ||
      transeptWidthMeters !== survey.facts.transeptWidthMeters
    )
      return fail('tunis-cathedral-native-footprint-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The native perimeter and cathedral vicar’s account establish the latin-cross plan, twin tiara roofs, large rose window, three-arch porch with paired columns and crossing dome.',
    };
  } catch {
    return fail('tunis-cathedral-facts-invalid');
  }
}
