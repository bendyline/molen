import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const airborneMuseumCase = 'airborne-museum-named-footprint-and-director-history';
export const airborneMuseumModel = 'airborne_division_war_memorial_museum';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function readBound(dir, source, filename) {
  if (source?.path !== filename) throw Error('Unexpected museum evidence path');
  const bytes = readFileSync(join(dir, filename));
  if (hash(bytes) !== source.sha256) throw Error('Museum evidence hash mismatch');
  return JSON.parse(bytes);
}

export function inspectAirborneMuseumFacts({ dir, controls, frame, proof }) {
  try {
    const native = readBound(
      dir,
      proof.nativeIdentity,
      'native-map/airborne-museum-perimeter.json',
    );
    const sources = readBound(
      dir,
      proof.primarySources,
      'reference-rights/primary-source-facts.json',
    );
    const director = sources.sources.find((source) => source.key === 'army-museum-director');
    const operator = sources.sources.find((source) => source.key === 'museum-operator');
    const survey = sources.sources.find((source) => source.key === 'state-roofline');
    if (
      sources.model !== airborneMuseumModel ||
      proof.primarySources.use !== 'factual-text-only' ||
      director?.use !== 'factual-text-only' ||
      operator?.use !== 'factual-text-only' ||
      survey?.use !== 'factual-text-only' ||
      director.facts.purposeBuiltYear !== 1957 ||
      director.facts.majorAdditions !== 3 ||
      !director.facts.sameLocation ||
      !director.facts.openToCivilianGroups ||
      operator.facts.address !== '5108 Ardennes Street' ||
      operator.facts.building !== 'C-6841' ||
      !operator.facts.sameLocation ||
      survey.facts.featureId !== 2787736
    )
      return { status: 'needs-review', reason: 'airborne-museum-written-facts-unbound' };

    const [lon, lat] = frame.anchor;
    const radians = Math.PI / 180;
    const meters = 6378137 * radians;
    const cosine = Math.cos(frame.heading);
    const sine = Math.sin(frame.heading);
    const matches = ([a, b], [u, v]) => {
      const x = (a - lon) * meters * Math.cos(lat * radians);
      const z = (lat - b) * meters;
      return Math.hypot(cosine * x - sine * z - u, sine * x + cosine * z - v) < 0.000008;
    };
    const { outline, approach, estimatedHeights } = controls.dimensions;
    const stateRing = native.stateRoofline.geometry.coordinates[0];
    if (
      native.sourceUrl !== 'https://www.openstreetmap.org/way/1283505518' ||
      native.sourceUrl !== frame.sourceUrl ||
      proof.nativeIdentity.sha256 !== frame.sourceHash ||
      native.way.id !== 1283505518 ||
      native.way.id !== proof.nativeIdentity.way ||
      native.way.id !== frame.mappedIdentity.way ||
      native.way.tags.name !== '82nd Airborne Division War Memorial Museum' ||
      native.way.tags.tourism !== 'museum' ||
      frame.mappedIdentity.wikidataId !== 'Q4644641' ||
      native.stateRoofline.id !== frame.mappedIdentity.stateFeature ||
      native.stateRoofline.id !== survey.facts.featureId ||
      stateRing.length !== 20 ||
      !native.way.nodes.every(([x, y]) =>
        stateRing.some(([a, b]) => Math.hypot((a - x) * 91000, (b - y) * meters) < 4.5),
      ) ||
      native.way.nodes.length !== 17 ||
      outline.length !== native.way.nodes.length ||
      !native.way.nodes.every((point, i) => matches(point, outline[i])) ||
      JSON.stringify(frame.geometry.outline) !== JSON.stringify(outline) ||
      JSON.stringify(approach) !== JSON.stringify(outline.slice(8, 14)) ||
      controls.model !== airborneMuseumModel ||
      !estimatedHeights
    )
      return { status: 'needs-review', reason: 'airborne-museum-native-perimeter-unbound' };

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Independent mapped outlines establish the museum and projecting public approach. The director’s history verifies the permanent building and three additions.',
    };
  } catch {
    return { status: 'needs-review', reason: 'airborne-museum-facts-invalid' };
  }
}
