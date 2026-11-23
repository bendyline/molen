import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const copticMuseumCase = 'coptic-museum-mapped-wings-and-archival-architectural-history';
export const copticMuseumModel = 'coptic_museum';

const wingIds = [197960955, 1244954042, 1244954045, 1244954043, 1244954044];
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function boundDocument(dir, binding, expectedPath) {
  if (binding?.path !== expectedPath) throw Error('Unexpected Coptic Museum source path');
  const bytes = readFileSync(join(dir, expectedPath));
  if (hash(bytes) !== binding.sha256) throw Error('Unbound Coptic Museum source');
  return JSON.parse(bytes);
}

export function inspectCopticMuseumFacts({ dir, controls, frame, proof }) {
  try {
    const native = boundDocument(dir, proof.nativeIdentity, 'native-map/coptic-museum-wings.json');
    const facts = boundDocument(
      dir,
      proof.primarySources,
      'reference-rights/primary-source-facts.json',
    );
    const records = Object.fromEntries(facts.sources.map((source) => [source.key, source]));
    const [lon, lat] = frame.anchor;
    const meters = (6378137 * Math.PI) / 180;
    const longitudinalMeters = meters * Math.cos((lat * Math.PI) / 180);
    const c = Math.cos(frame.heading);
    const s = Math.sin(frame.heading);
    const sameRing = (id, ring) => {
      const nativeRing = native.ways.find((way) => way.id === id)?.coordinates;
      return (
        nativeRing?.length === ring?.length &&
        nativeRing.every(([lng, phi], i) => {
          const x = (lng - lon) * longitudinalMeters;
          const z = (lat - phi) * meters;
          return Math.hypot(c * x - s * z - ring[i][0], s * x + c * z - ring[i][1]) < 0.00001;
        })
      );
    };
    const geometry = controls.dimensions;
    if (
      proof.nativeIdentity.way !== 215304755 ||
      native.ways.find((way) => way.id === 215304755)?.tags.wikidata !== 'Q1784177' ||
      frame.mappedIdentity?.wikidataId !== 'Q1784177' ||
      proof.nativeIdentity.sha256 !== frame.sourceHash ||
      facts.model !== copticMuseumModel ||
      controls.model !== facts.model ||
      proof.primarySources.use !== 'factual-text-only' ||
      !facts.sources.every((source) => source.use === 'factual-text-only') ||
      records.operator?.facts.floorsPerWing !== 2 ||
      records.operator?.facts.wings !== 2 ||
      records.church?.facts.connectingCorridor !== true ||
      records.archival?.facts.entranceBays !== 3 ||
      records.archival?.facts.originalPorchColumns !== 6 ||
      geometry.buildings.length !== wingIds.length ||
      geometry.entrance.bays !== 3 ||
      geometry.court.columns !== 6 ||
      !sameRing(215304755, frame.geometry.outline) ||
      !wingIds.every(
        (id, i) => geometry.buildings[i].id === id && sameRing(id, geometry.buildings[i].outline),
      )
    )
      return { status: 'needs-review', reason: 'coptic-museum-control-mismatch' };

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Named museum walls and wing footprints are bound to original mapping. The museum operator and archival architectural study substantiate the two wings, tripartite entrance, court and six-column porch.',
    };
  } catch {
    return { status: 'needs-review', reason: 'coptic-museum-facts-invalid' };
  }
}
