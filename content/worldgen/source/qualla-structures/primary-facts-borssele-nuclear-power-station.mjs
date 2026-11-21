import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const borsseleCase = 'borssele-public-exterior';
export const borsseleModel = 'borssele_nuclear_power_station';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export function inspectBorsseleFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    function load(record, name) {
      if (record?.path !== name) throw Error('Borssele evidence path changed');
      const bytes = fs.readFileSync(path.join(dir, name));
      if (hash(bytes) !== record.sha256) throw Error('Borssele evidence hash changed');
      return JSON.parse(bytes);
    }
    const text = load(
      proof.primarySources,
      'reference-rights/borssele-exterior-written-facts.json',
    );
    const exclusions = load(
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const native = load(proof.nativeIdentity, 'native-map/mapped-main-exterior.json');
    const operator = text.sources.find(
      (source) => source.url === 'https://www.blikindebol.nl/en/design/',
    );
    const mapped = frame.features[0];
    if (
      proof.primarySources.use !== 'factual-text-only' ||
      text.imageryUsed !== false ||
      exclusions.selectedImages !== 0 ||
      operator?.facts?.recognizableConcreteDome !== true ||
      native.tags?.name !== 'Kernenergiecentrale Borssele' ||
      native.tags?.source !== 'BAG' ||
      native.id !== 272447711 ||
      frame.mappedIdentity?.way !== native.id ||
      mapped?.id !== 'way/272447711' ||
      controls.dimensions?.domeHeight !== Number(native.tags.height) ||
      native.nodes.length !== 135 ||
      JSON.stringify(mapped.points) !== JSON.stringify(controls.dimensions.outline)
    )
      return fail('borssele-identity-or-exterior-description-unbound');

    const [lon, lat] = frame.anchor;
    const radians = Math.PI / 180;
    const meters = 6378137 * radians;
    const longitudeScale = meters * Math.cos(lat * radians);
    const c = Math.cos(frame.heading);
    const s = Math.sin(frame.heading);
    const changed = native.nodes.some(([longitude, latitude], index) => {
      const x = (longitude - lon) * longitudeScale;
      const z = (lat - latitude) * meters;
      return [c * x - s * z, s * x + c * z].some(
        (value, axis) => Math.abs(value - mapped.points[index][axis]) > 0.00001,
      );
    });
    if (changed) return fail('borssele-projected-public-exterior-changed');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'EPZ’s written description identifies the recognizable concrete dome. The named exterior map provides the ground plan and published height, with architectural estimates for the hall, façades and roof details.',
    };
  } catch {
    return fail('borssele-primary-facts-invalid');
  }
}
