import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const coquimboMosqueCase = 'coquimbo-mosque-operator-minaret-and-mapped-hall';
export const coquimboMosqueModel = 'mohammed_vi_mosque_coquimbo';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function readProof(dir, source, expectedPath) {
  if (source?.path !== expectedPath) throw Error('Unexpected Coquimbo mosque evidence path');
  const bytes = fs.readFileSync(path.join(dir, expectedPath));
  if (hash(bytes) !== source.sha256) throw Error('Coquimbo mosque evidence hash mismatch');
  return JSON.parse(bytes);
}

export function inspectCoquimboMosqueFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const archive = readProof(
      dir,
      proof.primarySources,
      'reference-rights/coquimbo-building-facts.json',
    );
    const excluded = readProof(
      dir,
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const native = readProof(dir, proof.nativeIdentity, 'native-map/footprint.json');
    const owner = archive.sources.find(
      ({ url }) => url === 'https://www.centromohammed6.cl/centro/',
    );
    const agency = archive.sources.find(
      ({ url }) =>
        url ===
        'https://www.onar.gob.cl/representantes-de-onar-visitan-mezquita-centro-mohamed-vi-de-coquimbo/',
    );
    const exclusions = new Map(excluded.candidates.map((row) => [row.sourceUrl, row.reason]));
    if (
      archive.mode !== 'factual-text-only' ||
      archive.imageryUsed !== false ||
      proof.primarySources.use !== archive.mode ||
      owner?.facts.totalHeightMeters !== 43 ||
      owner.facts.minaretModel !== 'Koutoubia' ||
      owner.facts.structure !== 'reinforced concrete' ||
      agency?.facts.minaretHeightMeters !== 40 ||
      agency.facts.prayerRooms !== 2 ||
      excluded.selectedImages !== 0 ||
      !inventory.candidates.every(({ sourceUrl }) => exclusions.get(sourceUrl)?.trim())
    )
      return fail('coquimbo-written-architecture-or-image-exclusions-unbound');

    const byId = new Map(
      native.elements.filter((row) => row.type === 'node').map((row) => [row.id, row]),
    );
    const building = native.elements.find((row) => row.type === 'way' && row.id === 373872240);
    const poi = byId.get(1098897672);
    const [lon, lat] = frame.anchor;
    const radians = Math.PI / 180;
    const scale = 6378137 * radians;
    const cosine = Math.cos(frame.heading);
    const sine = Math.sin(frame.heading);
    const matches = (nodeId, [x, z]) => {
      const node = byId.get(nodeId);
      const dx = (node.lon - lon) * scale * Math.cos(lat * radians);
      const dz = (lat - node.lat) * scale;
      return Math.hypot(dx * cosine - dz * sine - x, dx * sine + dz * cosine - z) < 0.001;
    };
    const outline = frame.geometry.outline;
    if (
      proof.nativeIdentity.way !== building?.id ||
      building.tags.website !== 'https://www.centromohammed6.cl/' ||
      building.tags['addr:street'] !== 'Los Granados' ||
      poi?.tags.wikidata !== 'Q1131701' ||
      frame.mappedIdentity.wikidataId !== poi.tags.wikidata ||
      outline.length !== building.nodes.length - 1 ||
      !outline.every((point, index) => matches(building.nodes[index], point)) ||
      controls.model !== coquimboMosqueModel ||
      controls.dimensions?.minaretTopY !== 43 ||
      controls.dimensions.estimated !== true
    )
      return fail('coquimbo-mapped-footprint-or-height-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The center and national religious affairs office establish the site, concrete material, Koutoubia reference and published heights. The native polygon links the tower projection and hall. Sections and finish are estimates.',
    };
  } catch {
    return fail('coquimbo-source-evidence-invalid');
  }
}
