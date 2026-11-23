import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const nanyangHallCase = 'nanyang-hall-mapped-villa-and-conservation-record';
export const nanyangHallModel = 'sun_yat_sen_nanyang_memorial_hall';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function readEvidence(dir, evidence, name) {
  if (evidence?.path !== name) throw Error('Unexpected memorial hall source path');
  const bytes = readFileSync(join(dir, name));
  if (hash(bytes) !== evidence.sha256) throw Error('Memorial hall source hash mismatch');
  return JSON.parse(bytes);
}

export function inspectNanyangHallFacts({ dir, controls, frame, proof }) {
  try {
    const native = readEvidence(
      dir,
      proof.nativeIdentity,
      'native-map/nanyang-hall-perimeter.json',
    );
    const sources = readEvidence(
      dir,
      proof.primarySources,
      'reference-rights/primary-source-facts.json',
    );
    const architecture = sources.sources.find((source) => source.key === 'nhb-monument-focus');
    const listed = sources.sources.find((source) => source.key === 'nhb-listed-monument');
    if (
      sources.model !== nanyangHallModel ||
      proof.primarySources.use !== 'factual-text-only' ||
      architecture?.use !== 'factual-text-only' ||
      listed?.use !== 'factual-text-only' ||
      architecture.facts.levels !== 2 ||
      !architecture.facts.curvedPorteCochere ||
      !architecture.facts.laterRearExtension ||
      !architecture.facts.sideVerandas ||
      !architecture.facts.corinthianColumns ||
      !listed.facts.castIronBalustrade ||
      !listed.facts.verandaOverCarriagePorch
    )
      return { status: 'needs-review', reason: 'nanyang-hall-conservation-facts-unbound' };

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
    const { outline, villa, extension, porch, estimatedHeights } = controls.dimensions;
    if (
      native.sourceUrl !== 'https://www.openstreetmap.org/way/271791487' ||
      native.sourceUrl !== frame.sourceUrl ||
      native.siteUrl !== 'https://www.openstreetmap.org/way/271791474' ||
      proof.nativeIdentity.sha256 !== frame.sourceHash ||
      native.way.id !== 271791487 ||
      native.way.id !== frame.mappedIdentity.way ||
      native.way.id !== proof.nativeIdentity.way ||
      native.site.id !== 271791474 ||
      native.site.id !== frame.mappedIdentity.site ||
      native.site.tags.wikidata !== 'Q10123616' ||
      frame.mappedIdentity.wikidataId !== native.site.tags.wikidata ||
      native.way.nodes.length !== 23 ||
      outline.length !== native.way.nodes.length ||
      !native.way.nodes.every((point, i) => matches(point, outline[i])) ||
      JSON.stringify(frame.geometry.outline) !== JSON.stringify(outline) ||
      JSON.stringify(villa) !== JSON.stringify(outline.slice(1, 14)) ||
      JSON.stringify(extension) !== JSON.stringify([outline[0], ...outline.slice(14)]) ||
      JSON.stringify(porch) !== JSON.stringify(outline.slice(4, 11)) ||
      controls.model !== nanyangHallModel ||
      !estimatedHeights
    )
      return { status: 'needs-review', reason: 'nanyang-hall-native-perimeter-unbound' };

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The mapped building perimeter and National Heritage Board conservation inventory establish the villa, curved carriage porch, verandas and rear extension.',
    };
  } catch {
    return { status: 'needs-review', reason: 'nanyang-hall-facts-invalid' };
  }
}
