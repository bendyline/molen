import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const butkaraCase = 'butkara-i-great-stupa-ruins';
export const butkaraModel = 'butkara_stupa';

const archaeologyRecord = 'https://doam.gov.pk/public/sites/3304';
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export function inspectButkaraFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    function load(record, name) {
      if (record?.path !== name) throw Error('Butkara evidence path changed');
      const bytes = fs.readFileSync(path.join(dir, name));
      if (hash(bytes) !== record.sha256) throw Error('Butkara evidence hash changed');
      return JSON.parse(bytes);
    }
    const text = load(
      proof.primarySources,
      'reference-rights/butkara-excavation-written-facts.json',
    );
    const exclusions = load(
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const native = load(proof.nativeIdentity, 'native-map/butkara-and-saidu-identities.json');
    const registry = text.sources.find((source) => source.url === archaeologyRecord);
    const dimensions = text.sources.find((source) =>
      source.source.includes('Domenico Faccenna'),
    )?.facts;
    if (
      proof.primarySources.use !== 'factual-text-only' ||
      text.imageryUsed !== false ||
      exclusions.selectedImages !== 0 ||
      exclusions.unadoptedIllustration?.firstRevision !== 4276287 ||
      native.actual.id !== 450094928 ||
      native.actual.tags?.name !== 'Butkara Stupa' ||
      native.differentSite.id !== 1078000527 ||
      native.differentSite.tags?.name !== 'Saidu Sharif Monastery' ||
      frame.mappedIdentity?.way !== native.actual.id ||
      JSON.stringify(frame.anchor) !== JSON.stringify(registry?.facts.coordinate) ||
      native.originalStoryCoordinate?.[1] === frame.anchor[1] ||
      dimensions.plan !== 'circular' ||
      controls.dimensions.phase1CoreDiameter !== dimensions.phase1[0] ||
      controls.dimensions.phase1SurvivingHeight !== dimensions.phase1[1] ||
      controls.dimensions.phase2Diameter !== dimensions.phase2[0] ||
      controls.dimensions.phase3LowerDiameter !== dimensions.phase3[0] ||
      controls.dimensions.phase3UpperDiameter !== dimensions.phase3[1] ||
      controls.dimensions.phase4Diameter !== dimensions.phase4[0] ||
      controls.dimensions.phase4SurvivingHeight !== dimensions.phase4[1] ||
      controls.dimensions.ambulacrumWidth !== dimensions.ambulacrumWidth ||
      controls.dimensions.phase5Diameter !== dimensions.phase5Diameter
    )
      return fail('butkara-identity-or-excavated-dimensions-unbound');

    const [lon, lat] = frame.anchor;
    const radians = Math.PI / 180;
    const meters = 6378137 * radians;
    const longitudeScale = meters * Math.cos(lat * radians);
    const points = frame.features[0]?.points ?? [];
    if (
      frame.heading !== 0 ||
      native.actual.nodes.length !== 7 ||
      points.length !== native.actual.nodes.length ||
      JSON.stringify(points) !== JSON.stringify(controls.dimensions.outline) ||
      native.actual.nodes.some(([x, z], i) => {
        const [localX, localZ] = points[i];
        return (
          Math.abs(localX - (x - lon) * longitudeScale) > 0.00001 ||
          Math.abs(localZ - (lat - z) * meters) > 0.00001
        );
      })
    )
      return fail('butkara-precinct-projection-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The official Butkara I coordinates and named precinct distinguish it from Saidu Sharif. The original excavator’s written dimensions describe the surviving Great Stupa, with representative nearby ruins.',
    };
  } catch {
    return fail('butkara-primary-facts-invalid');
  }
}
