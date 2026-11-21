import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const sulaymaniyahMuseumCase = 'sulaymaniyah-museum-salim-street-building';
export const sulaymaniyahMuseumModel = 'sulaymaniyah_museum';

const surveyUrl = 'https://openjicareport.jica.go.jp/pdf/12384079.pdf';
const museumHistoryUrl = 'https://doi.org/10.2307/j.ctv1nzfvzr.9';
const ownershipUrl =
  'https://www.minpaku.ac.jp/assets/pages/research/exchange/training/museology/nl2023.pdf';
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export function inspectSulaymaniyahMuseumFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    function load(record, name) {
      if (record?.path !== name) throw Error('Museum evidence path changed');
      const bytes = fs.readFileSync(path.join(dir, name));
      if (hash(bytes) !== record.sha256) throw Error('Museum evidence hash changed');
      return JSON.parse(bytes);
    }
    const text = load(proof.primarySources, 'reference-rights/museum-written-facts.json');
    const exclusions = load(
      proof.candidateExclusion,
      'reference-rights/article-image-exclusions.json',
    );
    const native = load(proof.nativeIdentity, 'native-map/salim-street-museum-outline.json');
    const survey = text.sources.find((source) => source.url === surveyUrl)?.facts;
    const director = text.sources.find((source) => source.url === museumHistoryUrl)?.facts;
    const curators = text.sources.find((source) => source.url === ownershipUrl)?.facts;
    if (
      proof.primarySources.use !== 'factual-text-only' ||
      text.imageryUsed !== false ||
      exclusions.selectedImages !== 0 ||
      !exclusions.candidates.some(
        (entry) =>
          entry.sourceUrl.includes('Amna_Suraka') && entry.reason.includes('distinct museum'),
      ) ||
      survey?.completionYear !== 1980 ||
      survey?.singleAboveGradeExhibitionLevel !== true ||
      director?.centralHall !== true ||
      director?.sideGalleries !== 2 ||
      curators?.street !== 'Salim Street' ||
      frame.mappedIdentity?.relation !== 14585092 ||
      controls.dimensions?.levels !== 1 ||
      native.relation?.id !== 14585092 ||
      native.relation?.tags?.['name:en'] !== 'Slemani Museum' ||
      native.relation?.tags?.['addr:street'] !== 'Salim Street' ||
      native.relation?.tags?.['building:levels'] !== '1'
    )
      return fail('sulaymaniyah-museum-building-identity-or-architectural-facts-unbound');

    const [lon, lat] = frame.anchor;
    const rad = Math.PI / 180;
    const m = 6378137 * rad;
    const mx = m * Math.cos(lat * rad);
    const c = Math.cos(frame.heading);
    const s = Math.sin(frame.heading);
    const memberIds = [1094991208, 1094991209];
    if (
      native.ways.length !== 2 ||
      JSON.stringify(native.relation.members) !== JSON.stringify(memberIds)
    )
      return fail('sulaymaniyah-museum-native-members-changed');
    for (const [i, way] of native.ways.entries()) {
      const observed = frame.features[i];
      const nodes = way.nodes.slice(0, -1);
      if (
        way.id !== memberIds[i] ||
        observed.id !== `way/${way.id}` ||
        nodes.length !== [4, 11][i] ||
        observed.points.length !== nodes.length ||
        JSON.stringify(observed.points) !== JSON.stringify(controls.dimensions.polygons[i])
      )
        return fail('sulaymaniyah-museum-mapped-envelope-changed');
      for (const [j, node] of nodes.entries()) {
        const x = (node.lon - lon) * mx;
        const z = (lat - node.lat) * m;
        const projected = [c * x - s * z, s * x + c * z];
        if (projected.some((value, axis) => Math.abs(value - observed.points[j][axis]) > 0.00001))
          return fail('sulaymaniyah-museum-projected-original-map-changed');
      }
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The exact mapped single-storey footprint and the museum director and field survey establish the main gallery block and entrance range. The façade details are architectural estimates.',
    };
  } catch {
    return fail('sulaymaniyah-museum-primary-facts-invalid');
  }
}
