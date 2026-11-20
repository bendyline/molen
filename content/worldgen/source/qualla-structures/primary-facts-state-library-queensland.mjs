import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const stateLibraryQueenslandCase = 'queensland-state-library-south-bank-knowledge-walk';
export const stateLibraryQueenslandModel = 'state_library_of_queensland';

const libraryWayIds = [146305691, 34200092, 297483708, 489453080, 489453078];
const digest = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export function inspectStateLibraryQueenslandFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    function record(evidence, file) {
      if (evidence?.path !== file) throw Error('Library evidence path changed');
      const bytes = fs.readFileSync(path.join(dir, file));
      if (digest(bytes) !== evidence.sha256) throw Error('Library evidence hash changed');
      return JSON.parse(bytes);
    }
    const written = record(
      proof.primarySources,
      'reference-rights/south-bank-written-architectural-facts.json',
    );
    const excluded = record(
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const native = record(proof.nativeIdentity, 'native-map/south-bank-library-controls.json');
    const exterior = written.sources.find(
      (source) => source.url === 'https://www.slq.qld.gov.au/photography-tour',
    )?.facts;
    const layout = written.sources.find(
      (source) => source.url === 'https://www.slq.qld.gov.au/visit/maps-level',
    )?.facts;
    if (
      proof.primarySources.use !== 'factual-text-only' ||
      written.mode !== 'factual-text-only' ||
      written.imageryUsed !== false ||
      excluded.selectedImages !== 0 ||
      !excluded.candidates.some(
        (r) =>
          r.sourceUrl.endsWith('Golf_Queensland_workshop_1.jpg') &&
          r.reason.includes('workshop classroom'),
      ) ||
      exterior?.streetExteriorBlades !== true ||
      exterior?.knowledgeWalk?.floatingBalcony !== true ||
      exterior?.knowledgeWalk?.levels !== 5 ||
      exterior?.redBoxVisibleFromRiverwalk !== true ||
      layout?.coveredOpenAirPlaza !== true ||
      String(layout?.redBoxLevels) !== '2,3' ||
      layout?.distinctEdgeAnnex !== true
    )
      return fail('south-bank-library-written-evidence-or-image-exclusions-changed');
    if (
      frame.mappedIdentity?.wikidataId !== 'Q2050653' ||
      controls.wikidataId !== 'Q2050653' ||
      controls.dimensions?.mainLevels !== 5 ||
      controls.dimensions?.edgeLevels !== 2 ||
      native.ways[0].tags.wikidata !== 'Q2050653' ||
      native.ways[0].tags['building:levels'] !== '5' ||
      native.ways[1].tags.name !== 'The Edge' ||
      native.ways[1].tags.operator !== 'State Library of Queensland' ||
      String(native.ways.map((way) => way.id)) !== String(libraryWayIds) ||
      String(frame.features.map((feature) => feature.id)) !==
        String(libraryWayIds.map((id) => `way/${id}`))
    )
      return fail('south-bank-library-identity-changed');

    const [lon, lat] = frame.anchor;
    const radians = Math.PI / 180,
      latScale = radians * 6378137;
    const lonScale = latScale * Math.cos(lat * radians);
    const c = Math.cos(frame.heading),
      s = Math.sin(frame.heading);
    const lookup = new Map(native.nodes.map((n) => [n.id, n]));
    const geometry = [...frame.geometry.polygons, ...frame.geometry.centerlines];
    for (const [i, way] of native.ways.entries()) {
      const ids = i < 2 ? way.nodes.slice(0, -1) : way.nodes;
      if (geometry[i]?.length !== ids.length) return fail('south-bank-library-point-count-changed');
      for (const [j, id] of ids.entries()) {
        const point = lookup.get(id);
        const x = (point.lon - lon) * lonScale,
          z = (lat - point.lat) * latScale;
        const nativePoint = [x * c - z * s, x * s + z * c];
        if (
          nativePoint.some((v, axis) => Math.abs(v - geometry[i][j][axis]) > 0.00001) ||
          String(frame.features[i].points[j]) !== String(geometry[i][j])
        )
          return fail('south-bank-library-native-geometry-changed');
      }
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: digest(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The current library and annex outlines and mapped public paths bind both structures and the open walk. The library and original architects describe the glazed reading room, open river decks and exterior blades. Roof divisions, heights and finer finishes are estimated.',
    };
  } catch {
    return fail('south-bank-library-factual-evidence-invalid');
  }
}
