import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function readEvidence(dir, record, filename) {
  if (record?.path !== filename) throw Error('Unexpected Futai evidence path');
  const bytes = fs.readFileSync(path.join(dir, filename));
  if (hash(bytes) !== record.sha256) throw Error('Futai evidence hash mismatch');
  return JSON.parse(bytes);
}

/** Bind Taipei's written restoration record to the named mansion footprint and section. */
export function inspectFutaiMansionPrimaryFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const archive = readEvidence(
      dir,
      proof.primarySources,
      'reference-rights/taipei-municipal-facts.json',
    );
    const { way } = readEvidence(
      dir,
      proof.nativeIdentity,
      'native-map/futai-street-mansion-controls.json',
    );
    const fact = (domain) =>
      archive.sources.find(({ url }) => new URL(url).hostname === domain)?.facts;
    const city = fact('culture.gov.taipei');
    const identity = fact('english.culture.gov.taipei');
    const restoration = fact('www-ws.gov.taipei');
    const { section } = controls;
    if (
      archive.mode !== 'factual-text-only' ||
      proof.primarySources.use !== archive.mode ||
      archive.imageryUsed !== false ||
      identity?.address !== '26 Yanping South Road' ||
      identity.roofMaterial !== 'copper' ||
      city?.stoneArcade !== 'semicircular' ||
      city.arcadeStone !== 'Qilian sandstone' ||
      city.upperStructure !== 'timber' ||
      city.storeys !== section.storeys ||
      city.roof !== section.roof.form ||
      city.dormerCount !== section.roof.dormers.length ||
      restoration?.restoredPublicOpening !== controls.representedDate ||
      section.arcade.spanCenters.length !== 3 ||
      section.arcade.columns.length !== section.arcade.spanCenters.length + 1
    )
      return fail('futai-restored-arcade-and-mansard-facts-unbound');

    const [lon, lat] = frame.anchor;
    const meters = (6378137 * Math.PI) / 180;
    const lonScale = meters * Math.cos((lat * Math.PI) / 180);
    const c = Math.cos(frame.heading);
    const s = Math.sin(frame.heading);
    const outline = frame.geometry.polygons[0];
    if (
      way.attributes.id !== '462816761' ||
      proof.nativeIdentity.way !== way.attributes.id ||
      frame.mappedIdentity.way !== way.attributes.id ||
      way.tags.wikidata !== 'Q7676292' ||
      frame.mappedIdentity.wikidataId !== way.tags.wikidata ||
      controls.wikidataId !== way.tags.wikidata ||
      outline.length !== 4 ||
      way.nodes.length !== 5 ||
      way.nodes[0].id !== way.nodes.at(-1).id ||
      !way.nodes.slice(0, -1).every((node, i) => {
        const x = (Number(node.lon) - lon) * lonScale;
        const z = (lat - Number(node.lat)) * meters;
        return Math.hypot(c * x - s * z - outline[i][0], s * x + c * z - outline[i][1]) < 1e-7;
      }) ||
      Math.abs(section.width - (outline[2][0] - outline[1][0])) > 0.03 ||
      Math.abs(section.depth - (outline[1][1] - outline[0][1])) > 0.03
    )
      return fail('futai-native-footprint-changed');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The named four-corner building outline and municipal description support a two-story restored shop house with a stone arcade and three copper mansard dormers. Wall sections, window sizes, and side and rear treatments are estimates.',
    };
  } catch {
    return fail('futai-primary-facts-evidence-invalid');
  }
}
