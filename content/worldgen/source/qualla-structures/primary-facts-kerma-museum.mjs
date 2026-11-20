import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const kermaMuseumCase = 'kerma-museum-verified-nubian-vault-envelope';
export const kermaMuseumModel = 'kerma_museum';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export function inspectKermaMuseumFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  const readEvidence = (record, expectedPath) => {
    if (record?.path !== expectedPath) throw Error('Unexpected Kerma Museum evidence path');
    const bytes = fs.readFileSync(path.join(dir, expectedPath));
    if (hash(bytes) !== record.sha256) throw Error('Kerma Museum evidence changed');
    return JSON.parse(bytes);
  };

  try {
    const written = readEvidence(
      proof.primarySources,
      'reference-rights/kerma-museum-written-facts.json',
    );
    const excluded = readEvidence(
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const native = readEvidence(
      proof.nativeIdentity,
      'native-map/kerma-museum-mapped-building.json',
    );
    const building = native.ways[1057605107];
    const mapped = frame.features.find((feature) => feature.id === 'way/1057605107');
    const architecture = written.sources.find(
      ({ url }) => url === 'https://kerma.ch/en/museum/',
    )?.facts;
    const authorship = written.sources.find(({ facts }) => facts.architect)?.facts;
    if (
      proof.primarySources.use !== 'factual-text-only' ||
      written.imageryUsed !== false ||
      excluded.selectedImages !== 0 ||
      architecture?.openingYear !== 2008 ||
      architecture?.roofType !== 'Nubian vaults' ||
      architecture?.apertures !== 'triangular daylight openings' ||
      architecture?.entranceFaces !== 'Western Deffufa' ||
      authorship?.architect !== 'Abdalla Sabbar' ||
      native.museum.id !== 4720410789 ||
      native.museum.tags.wikidata !== 'Q57980405' ||
      native.ways[184538219].tags.wikidata !== 'Q71551737' ||
      building.id !== frame.mappedIdentity.way ||
      building.nodes.length !== 25 ||
      !mapped ||
      JSON.stringify(controls.dimensions.outline) !== JSON.stringify(mapped.points)
    )
      return fail('kerma-museum-standing-identity-or-architectural-facts-unbound');

    const [lon, lat] = frame.anchor;
    const radians = Math.PI / 180;
    const northScale = 6378137 * radians;
    const eastScale = northScale * Math.cos(lat * radians);
    const c = Math.cos(frame.heading);
    const s = Math.sin(frame.heading);
    const toLocal = ([longitude, latitude]) => {
      const x = (longitude - lon) * eastScale;
      const z = (lat - latitude) * northScale;
      return [c * x - s * z, s * x + c * z];
    };
    if (
      mapped.points.length !== 24 ||
      building.nodes
        .slice(0, -1)
        .some((p, i) =>
          toLocal(p).some(
            (coordinate, axis) => Math.abs(coordinate - mapped.points[i][axis]) > 0.00001,
          ),
        ) ||
      toLocal(native.ways[184538219].nodes[0])[1] > -140
    )
      return fail('kerma-museum-mapped-envelope-or-entrance-direction-changed');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The museum and archaeological mission document the west entry, central exhibition hall and triangular daylight openings in Nubian vaults. The mapped envelope and unchanged terrain control the exterior and siting.',
    };
  } catch {
    return fail('kerma-museum-primary-facts-invalid');
  }
}
