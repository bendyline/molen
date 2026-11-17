import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const saoJoaoFrancisCase = 'sao-joao-del-rei-standing-rococo-church-native-envelope';

const historyUrl =
  'https://museudainconfidencia.museus.gov.br/wp-content/uploads/2019/11/Oficinadoinconfidencia_n2.pdf';
const inventoryUrl = 'https://saojoaodelreitransparente.com.br/works/view/698';
const hash = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

function pinned(dir, record, expectedPath) {
  if (record?.path !== expectedPath) throw Error('Evidence path mismatch');
  const bytes = readFileSync(join(dir, expectedPath));
  if (hash(bytes) !== record.sha256) throw Error('Evidence hash mismatch');
  return JSON.parse(bytes);
}

export function inspectSaoJoaoFrancisPrimaryFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const catalog = pinned(
      dir,
      proof.primarySources.find(({ key }) => key === 'museum'),
      'reference-rights/museum-building-history.json',
    );
    const inventory = pinned(
      dir,
      proof.primarySources.find(({ key }) => key === 'inventory'),
      'reference-rights/local-historical-inventory.json',
    );
    if (
      catalog.sourceUrl !== historyUrl ||
      inventory.sourceUrl !== inventoryUrl ||
      catalog.use !== 'factual-text-only' ||
      inventory.use !== 'factual-text-only' ||
      catalog.designMatchesStandingBuilding !== false ||
      inventory.facts.roundTowers !== 2 ||
      inventory.facts.cross !== 'Lorraine' ||
      inventory.facts.navePlan !== 'curved' ||
      inventory.facts.forecourtBalustradeYear !== 1880
    )
      return fail('sao-joao-del-rei-written-architecture-unbound');

    const { elements } = pinned(dir, proof.nativeIdentity, 'native-map/church-and-cemetery.json');
    const ways = elements.filter(({ type }) => type === 'way');
    const church = ways.find(({ id }) => id === 164767346);
    const cemetery = ways.find(({ id }) => id === 164552764);
    const nodes = new Map(
      elements.filter(({ type }) => type === 'node').map((node) => [node.id, node]),
    );
    const outline = frame.geometry.outline;
    if (
      church?.tags.wikidata !== 'Q10300735' ||
      cemetery?.tags.landuse !== 'cemetery' ||
      frame.mappedIdentity.wikidataId !== church.tags.wikidata ||
      frame.mappedIdentity.buildingWay !== church.id ||
      frame.mappedIdentity.cemeteryWay !== cemetery.id ||
      proof.nativeIdentity.wayId !== church.id ||
      controls.wikidataId !== church.tags.wikidata ||
      controls.representedDate !== 'present' ||
      church.nodes.length !== 13 ||
      church.nodes[0] !== church.nodes.at(-1) ||
      outline.length !== 12
    )
      return fail('sao-joao-del-rei-native-identity-unbound');

    const [lon, lat] = frame.anchor;
    const meters = (6378137 * Math.PI) / 180;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const c = Math.cos(frame.heading),
      s = Math.sin(frame.heading);
    const matches = church.nodes.slice(0, -1).every((id, i) => {
      const node = nodes.get(id);
      const x = (node.lon - lon) * meters * cosLat;
      const z = (lat - node.lat) * meters;
      return Math.hypot(x * c - z * s - outline[i][0], x * s + z * c - outline[i][1]) < 0.00002;
    });
    const { facade, nave, tower, chancel, laterSacristy } = controls.section;
    if (
      !matches ||
      !(facade.z < tower.z && tower.z < chancel.bounds[2]) ||
      !(
        tower.radius > 0 &&
        tower.lowerCorniceY < tower.drumTopY &&
        tower.drumTopY < tower.domeTipY
      ) ||
      Math.abs(tower.domeTipY - Number(church.tags.height)) > 2 ||
      nave.stations[3][1] <= nave.stations[0][1] ||
      laterSacristy.bounds[1] >= chancel.bounds[0]
    )
      return fail('sao-joao-del-rei-authored-geometry-controls-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The church and cemetery retain independent mapped boundaries. The final round towers, carved frontispiece, curved nave and later forecourt follow the written building record. Roof sections, trim, steps and stone relief are approximate.',
    };
  } catch {
    return fail('sao-joao-del-rei-factual-evidence-invalid');
  }
}
