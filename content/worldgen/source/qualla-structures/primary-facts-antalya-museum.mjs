import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const antalyaMuseumCase = 'antalya-museum-2024-mapped-gallery-roofs';
export const antalyaMuseumModel = 'antalya_museum';

function hash(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function readEvidence(dir, record, expectedPath) {
  if (record?.path !== expectedPath) throw Error('Unexpected Antalya evidence path');
  const bytes = readFileSync(join(dir, expectedPath));
  if (hash(bytes) !== record.sha256) throw Error('Antalya evidence hash mismatch');
  return JSON.parse(bytes);
}

export function inspectAntalyaMuseumFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const source = readEvidence(
      dir,
      proof.primarySources,
      'reference-rights/primary-source-facts.json',
    );
    const map = readEvidence(dir, proof.nativeIdentity, 'native-map/standing-museum-2024.json');
    const conservation = source.sources.find(
      ({ url }) =>
        url ===
        'https://antalyakentkonseyi.org.tr/antalya-arkeoloji-muzesi-binasinin-yikilarak-farkli-bir-mimari-projeyle-insasina-iliskin-rapor',
    );
    const architects = source.sources.find(
      ({ url }) => url === 'https://archives.saltresearch.org/handle/123456789/204443',
    );
    const closure = source.sources.find(({ key }) => key === 'governor-closure-notice');
    if (
      source.format !== 'molen/primary-architectural-facts@1' ||
      source.model !== antalyaMuseumModel ||
      proof.primarySources.use !== 'factual-text-only' ||
      ![conservation, architects, closure].every((s) => s?.use === 'factual-text-only') ||
      !conservation.facts.laterHippedTileRoofs ||
      !conservation.facts.enclosedLapidarium ||
      !conservation.facts.attachedTwoStoreyAdditions ||
      !architects.facts.separateExhibitionRanges ||
      closure.facts.closedToVisitors !== controls.validUntil
    )
      return fail('antalya-museum-written-facts-unbound');
    const [lon, lat] = frame.anchor,
      radians = Math.PI / 180;
    const length = radians * 6378137,
      c = Math.cos(frame.heading),
      s = Math.sin(frame.heading);
    const pointsMatch = ([a, b], [u, v]) => {
      const x = (a - lon) * length * Math.cos(lat * radians),
        z = (lat - b) * length;
      return Math.hypot(c * x - s * z - u, s * x + c * z - v) < 0.000008;
    };
    const outline = frame.geometry.outline;
    if (
      map.id !== 435948613 ||
      map.version !== 21 ||
      map.timestamp.slice(0, 10) !== controls.validFrom ||
      frame.mappedIdentity.wikidataId !== 'Q843241' ||
      map.tags.wikidata !== frame.mappedIdentity.wikidataId ||
      map.sourceUrl !== frame.sourceUrl ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      !map.nodeRecords.every((n) => n.timestamp <= map.timestamp) ||
      map.nodes.length !== 69 ||
      outline.length !== 69 ||
      !map.nodes.every((p, i) => pointsMatch(p, outline[i])) ||
      JSON.stringify(controls.dimensions.outline) !== JSON.stringify(outline) ||
      controls.model !== antalyaMuseumModel ||
      controls.representedDate !== '2024-06-26' ||
      controls.validUntil !== '2025-07-16' ||
      controls.dimensions.factualModuleMeters !== 1.5 ||
      !controls.dimensions.estimatedHeights ||
      !controls.dimensions.ranges.some((r) => r.name === 'lapidarium')
    )
      return fail('antalya-museum-historic-native-outline-or-controls-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Bound the 69-point historic museum and the written record of the late roof and lapidarium alterations. Individual roof divisions, windows and overall heights are architectural estimates.',
    };
  } catch {
    return fail('antalya-museum-facts-invalid');
  }
}
