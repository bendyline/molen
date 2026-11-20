import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const blachernaeCase = 'blachernae-standing-mapped-church-and-garden';
export const blachernaeModel = 'church_of_st_mary_of_blachernae';

const surveyUrl = 'https://istanbulansiklopedisi.org/handle/rek/5203?locale=en';
const architectureUrl = 'https://cdn2.islamansiklopedisi.org.tr/dosya/4/C04001568.pdf';
const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export function inspectBlachernaeFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  function checked(record, relative) {
    const bytes = fs.readFileSync(path.join(dir, relative));
    if (record.path !== relative || record.sha256 !== sha256(bytes))
      throw new Error('Source evidence changed');
    return JSON.parse(bytes);
  }
  try {
    const facts = checked(proof.primarySources, 'reference-rights/standing-church-facts.json');
    const exclusions = checked(proof.candidateExclusion, 'reference-rights/image-screening.json');
    const map = checked(proof.nativeIdentity, 'native-map/church-and-walled-garden.json');
    const survey = facts.sources.find((source) => source.url === surveyUrl);
    const architecture = facts.sources.find((source) => source.url === architectureUrl);
    const reviewed = new Set(
      exclusions.candidates.filter(({ reason }) => reason).map(({ path }) => path),
    );
    if (
      facts.imageryUsed !== false ||
      survey?.year !== 1947 ||
      survey?.facts?.entry !== 'glazed timber narthex' ||
      survey?.facts?.bellSupport !== 'simple iron lattice in the garden' ||
      architecture?.facts?.roof !== 'tile-covered timber roof' ||
      architecture?.facts?.walls !== 'masonry' ||
      exclusions.selectedImages !== 0 ||
      !inventory.candidates.every(({ path }) => reviewed.has(path)) ||
      controls.dimensions.estimated !== true
    )
      return fail('blachernae-sources-or-exclusions-unbound');

    const way = map.elements.find((element) => element.type === 'way' && element.id === 329233993);
    const fence = map.elements.find(
      (element) => element.type === 'way' && element.id === 1115488854,
    );
    const nodes = new Map(
      map.elements
        .filter((element) => element.type === 'node')
        .map((element) => [element.id, element]),
    );
    const [lon, lat] = frame.anchor;
    const metre = (6378137 * Math.PI) / 180;
    const parallel = metre * Math.cos((lat * Math.PI) / 180);
    function followsMap(outline, feature) {
      return (
        Array.isArray(outline) &&
        outline.length === feature.nodes.length - 1 &&
        outline.every(([x, z], i) => {
          const node = nodes.get(feature.nodes[i]);
          return (
            node &&
            Math.hypot((node.lon - lon) * parallel - x, (lat - node.lat) * metre - z) < 0.001
          );
        })
      );
    }
    if (
      proof.nativeIdentity.way !== way?.id ||
      way?.tags?.wikidata !== 'Q1069807' ||
      fence?.tags?.barrier !== 'wall' ||
      frame.heading !== 0 ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      !followsMap(frame.geometry.outline, way) ||
      !followsMap(controls.dimensions.outline, way) ||
      !followsMap(controls.dimensions.enclosure, fence)
    )
      return fail('blachernae-mapped-church-or-enclosure-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: sha256(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Two published architectural accounts and the named church and garden outlines establish the standing masonry church. Heights, minor openings and the bell frame location are approximate.',
    };
  } catch {
    return fail('blachernae-evidence-invalid');
  }
}
