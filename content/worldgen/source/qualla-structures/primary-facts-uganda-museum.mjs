import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const ugandaMuseumCase = 'uganda-museum-standing-modernist-core';
export const ugandaMuseumModel = 'uganda_museum';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export function inspectUgandaMuseumFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  function readEvidence(record, expectedPath) {
    if (record?.path !== expectedPath) throw Error('Unexpected Uganda Museum evidence path');
    const bytes = fs.readFileSync(path.join(dir, expectedPath));
    if (hash(bytes) !== record.sha256) throw Error('Uganda Museum evidence changed');
    return JSON.parse(bytes);
  }

  try {
    const written = readEvidence(
      proof.primarySources,
      'reference-rights/uganda-museum-written-facts.json',
    );
    const exclusions = readEvidence(
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const { museum, building } = readEvidence(
      proof.nativeIdentity,
      'native-map/kiira-road-standing-museum.json',
    );
    const conservation = written.sources.find(
      ({ url }) => url === 'https://media.getty.edu/Text/a51b13fd-72ba-582e-9273-3d8c971efee7.pdf',
    );
    const mapped = frame.features[0];
    if (
      proof.primarySources.use !== 'factual-text-only' ||
      written.imageryUsed !== false ||
      exclusions.selectedImages !== 0 ||
      conservation?.facts?.openingYear !== 1954 ||
      conservation.facts.skylightDome !== true ||
      conservation.facts.sawLeafGalleryWalls !== true ||
      conservation.facts.naturalHistoryPlan !== 'octagonal' ||
      museum.id !== 615341411 ||
      museum.tags?.wikidata !== 'Q7877613' ||
      building.id !== 358486215 ||
      building.tags['addr:housenumber'] !== '5' ||
      building.tags['addr:street'] !== 'Kiira Road' ||
      building.points.length !== 31 ||
      frame.mappedIdentity.way !== building.id ||
      mapped?.id !== 'way/358486215' ||
      JSON.stringify(controls.dimensions.outline) !== JSON.stringify(mapped.points)
    )
      return fail('uganda-museum-standing-identity-or-architectural-facts-unbound');

    const [lon, lat] = frame.anchor;
    const radians = Math.PI / 180;
    const meters = 6378137 * radians;
    const longitudeScale = meters * Math.cos(lat * radians);
    const c = Math.cos(frame.heading),
      s = Math.sin(frame.heading);
    const movedVertex = building.points.some(([longitude, latitude], i) => {
      const x = (longitude - lon) * longitudeScale;
      const z = (lat - latitude) * meters;
      const [a, b] = mapped.points[i];
      return Math.abs(c * x - s * z - a) > 0.00001 || Math.abs(s * x + c * z - b) > 0.00001;
    });
    if (movedVertex) return fail('uganda-museum-mapped-architecture-changed');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The museum conservation team documents the modernist entry, skylight, saw-leaf gallery, two-storey wing and separate octagonal addition. The address-matched standing outline controls placement and exterior dimensions.',
    };
  } catch {
    return fail('uganda-museum-primary-facts-invalid');
  }
}
