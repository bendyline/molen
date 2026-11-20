import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const anpingTreeHouseCase = 'anping-tree-house-five-warehouse-restoration';
export const anpingTreeHouseModel = 'anping_tree_house';

const architect = 'https://alive.businessweekly.com.tw/Article/ARTL000037827';
const city = 'https://www.twtainan.net/zh-tw/attractions/detail/806/';
const osm = 'https://www.openstreetmap.org/way/498039297';
const sha256 = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

export function inspectAnpingTreeHouseFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  const bound = (record, file) => {
    const bytes = readFileSync(path.join(dir, file));
    if (record.path !== file || record.sha256 !== sha256(bytes)) throw Error('Source changed');
    return JSON.parse(bytes);
  };
  try {
    const facts = bound(proof.primarySources, 'reference-rights/warehouse-restoration-facts.json');
    const screening = bound(proof.candidateExclusion, 'reference-rights/image-screening.json');
    const map = bound(proof.nativeIdentity, 'native-map/tree-house-site-and-paths.json');
    const restoration = facts.sources.find((record) => record.url === architect)?.facts;
    const cityFacts = facts.sources.find((record) => record.url === city)?.facts;
    const excluded = new Set(
      screening.candidates.filter((row) => row.reason).map((row) => row.path),
    );
    if (
      facts.imageryUsed !== false ||
      restoration?.warehouses !== 5 ||
      restoration?.warehouseAreaPing !== 400 ||
      restoration?.banyanGroups !== 3 ||
      restoration?.steelMeshPlatforms !== 3 ||
      cityFacts?.roofCondition !== 'banyan canopy over roofless sections' ||
      screening.selectedImages !== 0 ||
      !inventory.candidates.every(({ path }) => excluded.has(path))
    )
      return fail('anping-restoration-facts-or-exclusions-unbound');

    const way = map.elements.find(({ type, id }) => type === 'way' && id === 498039297);
    const trail = map.elements.find(({ type, id }) => type === 'way' && id === 498039306);
    const d = controls.dimensions;
    const totalArea = d.warehouses.reduce(
      (area, { bounds: [x0, z0, x1, z1] }) => area + (x1 - x0) * (z1 - z0),
      0,
    );
    if (
      map.sourceUrl !== osm ||
      way?.tags?.wikidata !== 'Q10946670' ||
      way?.tags?.name !== '安平樹屋' ||
      trail?.tags?.bridge !== 'yes' ||
      trail?.tags?.height !== '5.0' ||
      frame.mappedIdentity?.osm !== way.id ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      frame.geometry.estimated !== true ||
      d.estimated !== true ||
      d.warehouses.length !== restoration.warehouses ||
      Math.abs(totalArea - restoration.warehouseAreaPing * 3.3058) > 95 ||
      d.banyans.length !== restoration.banyanGroups ||
      d.platforms.length !== restoration.steelMeshPlatforms
    )
      return fail('anping-native-site-or-warehouse-controls-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: sha256(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The named precinct and mapped trail register with the city record and restoration architect’s account. Individual warehouse outlines, tree shapes and deck elevations are estimates.',
    };
  } catch {
    return fail('anping-evidence-invalid');
  }
}
