import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const pggmbCase = 'pggmb-jalan-kianggeh-tower';
export const pggmbModel = 'pggmb_building';

const owner = 'https://pggmb.org.bn/tentang-pggmb/';
const opening = 'https://www.pelitabrunei.gov.bn/Arkib%20Dokumen/2002/15%20MEI%202002.pdf';
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export function inspectPggmbFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    function load(record, name) {
      if (record?.path !== name) throw Error('PGGMB evidence path changed');
      const bytes = fs.readFileSync(path.join(dir, name));
      if (hash(bytes) !== record.sha256) throw Error('PGGMB evidence hash changed');
      return JSON.parse(bytes);
    }
    const text = load(proof.primarySources, 'reference-rights/pggmb-building-written-facts.json');
    const exclusions = load(
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const native = load(proof.nativeIdentity, 'native-map/jalan-kianggeh-footprint.json');
    const ownerRecord = text.sources.find((record) => record.url === owner)?.facts;
    const event = text.sources.find((record) => record.url === opening)?.facts;
    const points = frame.features[0]?.points ?? [];
    if (
      proof.primarySources.use !== 'factual-text-only' ||
      text.imageryUsed !== false ||
      exclusions.selectedImages !== 0 ||
      ownerRecord?.standingStoreys !== 17 ||
      ownerRecord?.street !== 'Jalan Kianggeh' ||
      event?.sameSiteAsOriginal !== true ||
      event?.replacementOpening !== '2002-05-14' ||
      native.tags?.name !== 'PGGMB Building' ||
      native.tags?.['building:levels'] !== '17' ||
      native.id !== 314217096 ||
      frame.mappedIdentity?.way !== native.id ||
      frame.mappedIdentity?.wikidataId !== 'Q7119163' ||
      controls.dimensions?.levels !== 17 ||
      native.nodes.length !== 5 ||
      points.length !== native.nodes.length ||
      JSON.stringify(points) !== JSON.stringify(controls.dimensions.outline)
    )
      return fail('pggmb-standing-identity-or-17-storey-record-unbound');

    const [lon, lat] = frame.anchor;
    const radians = Math.PI / 180;
    const meters = 6378137 * radians;
    const longitudeScale = meters * Math.cos(lat * radians);
    const c = Math.cos(frame.heading);
    const s = Math.sin(frame.heading);
    const changed = native.nodes.some(([longitude, latitude], index) => {
      const x = (longitude - lon) * longitudeScale;
      const z = (lat - latitude) * meters;
      return (
        Math.abs(c * x - s * z - points[index][0]) > 0.00001 ||
        Math.abs(s * x + c * z - points[index][1]) > 0.00001
      );
    });
    if (changed) return fail('pggmb-projected-standing-exterior-changed');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The owner, contemporary opening record and current 17-storey footprint identify the same mixed-use PGGMB tower. Upper dimensions and street elevations are estimates.',
    };
  } catch {
    return fail('pggmb-primary-facts-invalid');
  }
}
