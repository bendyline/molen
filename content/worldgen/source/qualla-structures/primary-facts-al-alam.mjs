import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const alAlamCase = 'al-alam-palace-ceremonial-cube-and-wings';
export const alAlamModel = 'al_alam_palace';

const builder =
  'https://shapoorji.in/wp-content/uploads/2017/04/Shapoorji-Pallonji-International.pdf';
const museum = 'https://www.nm.gov.om/en/about-the-museum?action=ground';
const observer =
  'https://dev.scholarsbank.uoregon.edu/server/api/core/bitstreams/13d34f87-7626-4d86-824e-0339942aef2f/content';
const sha = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export function inspectAlAlamFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    function load(ref, name) {
      if (ref?.path !== name) throw Error('Palace evidence path changed');
      const bytes = fs.readFileSync(path.join(dir, name));
      if (sha(bytes) !== ref.sha256) throw Error('Palace evidence hash changed');
      return JSON.parse(bytes);
    }
    const text = load(
      proof.primarySources,
      'reference-rights/al-alam-written-architectural-facts.json',
    );
    const exclusions = load(
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const native = load(proof.nativeIdentity, 'native-map/ceremonial-palace-outline.json');
    const contractor = text.sources.find((source) => source.url === builder)?.facts;
    const axis = text.sources.find((source) => source.url === museum)?.facts;
    const columns = text.sources.find((source) => source.url === observer)?.facts;
    if (
      proof.primarySources.use !== 'factual-text-only' ||
      text.mode !== 'factual-text-only' ||
      text.imageryUsed !== false ||
      exclusions.selectedImages !== 0 ||
      !exclusions.candidates.some(
        (candidate) =>
          candidate.sourceUrl.endsWith('Alam_Palace_Muscat.JPG') &&
          candidate.reason.includes('rights in the depicted architecture are unresolved'),
      ) ||
      contractor?.centralMassing !== 'cube' ||
      contractor?.longWings !== 2 ||
      axis?.palaceOppositeMuseumOnCeremonialBoulevard !== true ||
      columns?.frontGoldColumns !== 2 ||
      columns?.frontBlueColumns !== 2 ||
      columns?.overreachingRoof !== true
    )
      return fail('palace-written-cube-wings-and-columns-unbound');

    const ways = [native.building, native.precinct],
      ids = [66645876, 66647557];
    if (
      ways[0]?.id !== ids[0] ||
      ways[1]?.id !== ids[1] ||
      ways[0].tags.castle_type !== 'palace' ||
      ways[1].tags.wikidata !== 'Q2121461' ||
      ways[1].tags['name:en'] !== 'Al Alam Palace' ||
      frame.mappedIdentity?.wikidataId !== 'Q2121461' ||
      controls.dimensions?.wingCount !== 2 ||
      controls.dimensions?.frontGoldColumns !== 2 ||
      controls.dimensions?.frontBlueColumns !== 2
    )
      return fail('palace-native-identity-changed');

    const [lon, lat] = frame.anchor,
      rad = Math.PI / 180,
      degree = 6378137 * rad,
      longitudeDegree = degree * Math.cos(lat * rad),
      c = Math.cos(frame.heading),
      s = Math.sin(frame.heading);
    const nodes = new Map(native.nodes.map((node) => [node.id, node]));
    for (const [i, way] of ways.entries()) {
      const feature = frame.features[i];
      const ids = way.nodes.slice(0, -1);
      if (feature.id !== `way/${way.id}` || feature.points.length !== ids.length)
        return fail('palace-native-feature-count-changed');
      for (const [j, id] of ids.entries()) {
        const node = nodes.get(id);
        const x = (node.lon - lon) * longitudeDegree,
          z = (lat - node.lat) * degree;
        const projected = [c * x - s * z, s * x + c * z];
        if (projected.some((v, k) => Math.abs(v - feature.points[j][k]) > 0.00001))
          return fail('palace-native-outline-changed');
      }
    }
    if (JSON.stringify(frame.features[0].points) !== JSON.stringify(frame.geometry.outline))
      return fail('palace-primary-outline-changed');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: sha(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The mapped palace enclosure and building bind the location. Its contractor describes the central block and two wings, with the museum and a firsthand written observation supplying the forecourt relationship and columns. Heights, profiles and finer details are estimated.',
    };
  } catch {
    return fail('palace-factual-evidence-invalid');
  }
}
