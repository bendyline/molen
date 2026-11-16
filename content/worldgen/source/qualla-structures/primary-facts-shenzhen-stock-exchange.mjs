import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const shenzhenStockExchangeCase = 'shenzhen-stock-exchange-oma-arup-dimensioned-podium';
export const shenzhenStockExchangeModel = 'shenzhen_stock_exchange';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function readProof(dir, source, expectedPath) {
  if (source?.path !== expectedPath)
    throw Error('Unexpected Shenzhen Stock Exchange evidence path');
  const bytes = fs.readFileSync(path.join(dir, expectedPath));
  if (hash(bytes) !== source.sha256) throw Error('Shenzhen Stock Exchange evidence hash mismatch');
  return JSON.parse(bytes);
}

export function inspectShenzhenStockExchangeFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const archive = readProof(
      dir,
      proof.primarySources,
      'reference-rights/shenzhen-stock-exchange-facts.json',
    );
    const excluded = readProof(
      dir,
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const native = readProof(dir, proof.nativeIdentity, 'native-map/footprint.json');
    const engineer = archive.sources.find(
      ({ url }) =>
        url ===
        'https://www.arup.com/globalassets/downloads/arup-journal/the-arup-journal-2014-issue-2.pdf',
    );
    const architect = archive.sources.find(
      ({ url }) => url === 'https://www.oma.com/projects/shenzhen-stock-exchange',
    );
    const exclusions = new Map(excluded.candidates.map((row) => [row.sourceUrl, row.reason]));
    if (
      archive.mode !== 'factual-text-only' ||
      archive.imageryUsed !== false ||
      proof.primarySources.use !== archive.mode ||
      engineer?.facts.podiumClearanceMeters !== 36 ||
      engineer.facts.podiumPlanMeters?.join(',') !== '163,99' ||
      engineer.facts.towerPlanMeters?.join(',') !== '55,55' ||
      engineer.facts.podiumStructuralStories !== 3 ||
      architect?.facts.raisedPodium !== true ||
      excluded.selectedImages !== 0 ||
      !inventory.candidates.every(({ sourceUrl }) => exclusions.get(sourceUrl)?.trim())
    )
      return fail('shenzhen-exchange-dimensions-or-image-exclusions-unbound');

    const feature = (type, id) => native.elements.find((row) => row.type === type && row.id === id);
    const podium = feature('relation', 12502051);
    const tower = feature('way', 529086136);
    const exchange = feature('way', 923157986);
    const byId = new Map(
      native.elements.filter((row) => row.type === 'node').map((row) => [row.id, row]),
    );
    const [lon, lat] = frame.anchor;
    const degrees = (6378137 * Math.PI) / 180;
    const lonScale = degrees * Math.cos((lat * Math.PI) / 180);
    const cosine = Math.cos(frame.heading);
    const sine = Math.sin(frame.heading);
    const matches = (way, ring) =>
      way &&
      ring?.length === way.nodes.length - 1 &&
      ring.every(([x, z], index) => {
        const node = byId.get(way.nodes[index]);
        const dx = (node.lon - lon) * lonScale;
        const dz = (lat - node.lat) * degrees;
        return Math.hypot(dx * cosine - dz * sine - x, dx * sine + dz * cosine - z) < 0.001;
      });
    const dimensions = controls.dimensions;
    if (
      proof.nativeIdentity.way !== exchange?.id ||
      exchange.tags.wikidata !== 'Q517750' ||
      exchange.tags['addr:housenumber'] !== '2012' ||
      frame.mappedIdentity.wikidataId !== exchange.tags.wikidata ||
      podium?.tags.min_height !== '36' ||
      podium.tags.height !== '64' ||
      podium.members.find((member) => member.role === 'outer')?.ref !== 146864424 ||
      tower?.tags.height !== '245.8' ||
      tower.tags['building:levels'] !== '46' ||
      !matches(exchange, frame.geometry.outline) ||
      !matches(feature('way', 146864424), frame.geometry.podium) ||
      !matches(tower, frame.geometry.upperTower) ||
      controls.model !== shenzhenStockExchangeModel ||
      dimensions.podiumSoffitY !== 36 ||
      dimensions.podiumRoofY !== 64 ||
      dimensions.towerTopY !== 245.8
    )
      return fail('shenzhen-exchange-mapped-structure-or-height-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'OMA and Arup document the raised podium, clearance, tower and roof garden. The mapped tower and part relations bind their position and the chosen height. Panel rhythm and detailing are estimates.',
    };
  } catch {
    return fail('shenzhen-exchange-source-evidence-invalid');
  }
}
