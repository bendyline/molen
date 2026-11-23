import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const kilbegganDistilleryCase = 'kilbeggan-distillery-national-inventory-mill-race';
export const kilbegganDistilleryModel = 'kilbeggan_distillery';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function readRecord(dir, evidence, name) {
  if (evidence?.path !== name) throw Error('Unexpected distillery evidence path');
  const bytes = readFileSync(join(dir, name));
  if (hash(bytes) !== evidence.sha256) throw Error('Distillery evidence hash mismatch');
  return JSON.parse(bytes);
}

export function inspectKilbegganDistilleryFacts({ dir, controls, frame, proof }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const native = readRecord(dir, proof.nativeIdentity, 'native-map/distillery-and-millrace.json');
    const sources = readRecord(
      dir,
      proof.primarySources,
      'reference-rights/primary-source-facts.json',
    );
    const facts = new Map(sources.sources.map((source) => [source.key, source]));
    const distillery = facts.get('niah-15321006'),
      mill = facts.get('niah-15321008');
    const survey = facts.get('westmeath-industrial-survey'),
      wheel = facts.get('erih-waterwheel');
    if (
      sources.format !== 'molen/primary-architectural-facts@1' ||
      sources.model !== kilbegganDistilleryModel ||
      proof.primarySources.use !== 'factual-text-only' ||
      [distillery, mill, survey, wheel].some((source) => source?.use !== 'factual-text-only') ||
      !distillery.url.startsWith(
        'https://www.buildingsofireland.ie/buildings-search/building/15321006/',
      ) ||
      !mill.url.startsWith(
        'https://www.buildingsofireland.ie/buildings-search/building/15321008/',
      ) ||
      !distillery.facts.openCourtyard ||
      !distillery.facts.segmentalCarriageOpening ||
      !distillery.facts.rectangularRedBrickStack ||
      !mill.facts.undershotWheel ||
      !mill.facts.timberPaddles ||
      !survey.facts.easternWatermillRange ||
      wheel.facts.diameterMeters !== 4.7 ||
      wheel.facts.widthMeters !== 3.4
    )
      return fail('kilbeggan-distillery-written-sources-unbound');

    const [lon, lat] = frame.anchor,
      meters = (Math.PI * 6378137) / 180;
    const c = Math.cos(frame.heading),
      s = Math.sin(frame.heading);
    const matches = ([a, b], [u, v]) => {
      const x = (a - lon) * meters * Math.cos((lat * Math.PI) / 180);
      const z = (lat - b) * meters;
      return Math.hypot(c * x - s * z - u, s * x + c * z - v) < 0.000008;
    };
    const mapped = (way, id, local) =>
      way.id === id &&
      way.nodes.length === local.length &&
      way.nodes.every((point, i) => matches(point, local[i]));
    const { dimensions } = controls;
    if (
      frame.sourceUrl !== 'https://www.openstreetmap.org/way/472350093' ||
      native.sourceUrl !== frame.sourceUrl ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      proof.nativeIdentity.way !== 472350093 ||
      frame.mappedIdentity.wikidataId !== 'Q1867525' ||
      native.ways.main.tags.wikidata !== frame.mappedIdentity.wikidataId ||
      !mapped(native.ways.main, 472350093, frame.geometry.outline) ||
      !mapped(native.ways.west, 472422293, frame.geometry.polygons[1]) ||
      !mapped(native.ways.westStore, 686305016, frame.geometry.polygons[2]) ||
      native.points.wheel.id !== 4665596125 ||
      native.points.wheel.tags.man_made !== 'watermill' ||
      !matches(native.points.wheel.coordinate, dimensions.wheel.center) ||
      dimensions.wheel.diameter !== wheel.facts.diameterMeters ||
      dimensions.wheel.width !== wheel.facts.widthMeters ||
      controls.model !== kilbegganDistilleryModel ||
      !dimensions.roofAndStackHeightsEstimated ||
      !Array.isArray(dimensions.court) ||
      dimensions.court.length !== 4
    )
      return fail('kilbeggan-distillery-footprint-or-wheel-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The mapped distillery and watermill agree with the national inventory, county survey and documented 4.7 by 3.4 m waterwheel. Roof divisions, stack height and some courtyard widths are estimated.',
    };
  } catch {
    return fail('kilbeggan-distillery-facts-invalid');
  }
}
