import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const herbertCottageCase = 'herbert-cottage-state-heritage-description-and-parcel';
export const herbertCottageModel = 'xavier_and_sadie_herbert_s_cottage';
const register = 'https://apps.des.qld.gov.au/heritage-register/detail/?id=601739';
const hash = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;

export function inspectHerbertCottageFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  function read(record, expectedPath) {
    if (record.path !== expectedPath) throw Error('Unexpected evidence path');
    const bytes = fs.readFileSync(path.join(dir, expectedPath));
    if (hash(bytes) !== record.sha256) throw Error('Evidence hash mismatch');
    return JSON.parse(bytes);
  }
  try {
    const archive = read(proof.primarySources, 'reference-rights/herbert-cottage-facts.json');
    const excluded = read(
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const native = read(proof.nativeIdentity, 'native-map/footprint.json');
    const source = archive.sources.find((source) => source.url === register)?.facts;
    const reasons = new Map(excluded.candidates.map((row) => [row.sourceUrl, row.reason]));
    if (
      archive.mode !== 'factual-text-only' ||
      archive.imageryUsed !== false ||
      proof.primarySources.use !== archive.mode ||
      source?.placeId !== 601739 ||
      source.address !== '399 Kamerunga Road' ||
      source.storeys !== 1 ||
      source.roof !== 'hipped-corrugated-metal' ||
      source.enclosedVerandahs !== 2 ||
      source.attachedSideCarport !== 'east-skillion' ||
      excluded.selectedImages !== 0 ||
      !inventory.candidates.every((row) => reasons.get(row.sourceUrl)?.trim())
    )
      return fail('herbert-cottage-design-or-exclusions-unbound');
    const way = native.elements.find(
      (row) => row.type === 'way' && row.id === proof.nativeIdentity.way,
    );
    const parcel = native.heritageBoundary;
    const nodes = new Map(
      native.elements.filter((row) => row.type === 'node').map((row) => [row.id, row]),
    );
    const [lon, lat] = frame.anchor;
    const m = (Math.PI / 180) * 6378137,
      sx = m * Math.cos((lat * Math.PI) / 180);
    const cos = Math.cos(frame.heading),
      sin = Math.sin(frame.heading);
    if (
      way?.id !== 291923346 ||
      way.nodes.length !== 5 ||
      parcel?.properties.place_id !== 601739 ||
      parcel.properties.area_sqm !== 646 ||
      frame.mappedIdentity.qhr !== 601739 ||
      controls.model !== herbertCottageModel ||
      frame.geometry.outline.length !== 4 ||
      !frame.geometry.outline.every(([x, z], i) => {
        const node = nodes.get(way.nodes[i]);
        const a = (node.lon - lon) * sx,
          b = (lat - node.lat) * m;
        return Math.hypot(cos * a - sin * b - x, sin * a + cos * b - z) < 0.001;
      })
    )
      return fail('herbert-cottage-mapped-frontage-or-heritage-site-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'State heritage entry 601739 and its GIS parcel document the surviving timber cottage. The road-facing mapped roof and heritage description guide the architecture. Its exact rear divisions and elevations are estimates.',
    };
  } catch {
    return fail('herbert-cottage-evidence-invalid');
  }
}
