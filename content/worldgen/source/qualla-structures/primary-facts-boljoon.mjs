import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const museumUrl =
  'https://www.nationalmuseum.gov.ph/2021/11/11/the-patrocinio-de-maria-church-in-boljoon-cebu/';
const conservationUrl =
  'https://weblinks.nationalmuseum.gov.ph/wp-content/uploads/2025/10/24142103/Bidding-Documents-Boljoon.pdf';
const hash = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

function readPinned(dir, record, relativePath) {
  if (record?.path !== relativePath) throw Error('Evidence path mismatch');
  const bytes = fs.readFileSync(path.join(dir, relativePath));
  if (hash(bytes) !== record.sha256) throw Error('Evidence hash mismatch');
  return JSON.parse(bytes);
}

/** Validate the written museum facts and complete original mapped outline. */
export function inspectBoljoonPrimaryFacts({ dir, proof, controls, frame }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const museumSource = proof.primarySources.find((source) => source.key === 'museum');
    const conservationSource = proof.primarySources.find((source) => source.key === 'conservation');
    const museum = readPinned(
      dir,
      museumSource,
      'reference-rights/national-museum-architectural-facts.json',
    );
    const conservation = readPinned(
      dir,
      conservationSource,
      'reference-rights/national-museum-conservation-facts.json',
    );
    const { nave, convent, belfry } = controls.section;
    const roof = museum.facts.mainRoof;
    if (
      museumSource.url !== museumUrl ||
      museum.sourceUrl !== museumUrl ||
      conservationSource.url !== conservationUrl ||
      conservation.sourceUrl !== conservationUrl ||
      [museumSource, conservationSource, museum, conservation].some(
        (source) => source.use !== 'factual-text-only',
      ) ||
      ![
        'pedimented east façade',
        'trefoil-arched niche',
        'adjoining two-storey convent',
        'Massive buttresses',
        'north of the façade',
        '39 to 28 degrees',
      ].every((locator) => museum.sourceLocators.includes(locator)) ||
      roof.upperSlopeDegrees !== 39 ||
      roof.lowerSlopeDegrees !== 28 ||
      roof.replacementYear !== 2007 ||
      nave.upperSlopeDegrees !== roof.upperSlopeDegrees ||
      nave.lowerSlopeDegrees !== roof.lowerSlopeDegrees ||
      !conservation.facts.conventExterior.includes('timber clapboard') ||
      conservation.facts.blockhouseDimensionsUsedForBelfry !== false
    )
      return fail('boljoon-museum-architectural-facts-unbound');

    const { building } = readPinned(dir, proof.nativeIdentity, 'native-map/exterior-controls.json');
    const ring = building.coordinates.slice(0, -1);
    const local = frame.geometry.polygons[0];
    if (
      building.id !== 542521547 ||
      proof.nativeIdentity.wayId !== building.id ||
      frame.mappedIdentity.wayId !== building.id ||
      building.tags.name !== frame.mappedIdentity.name ||
      proof.nativeIdentity.wikidataId !== 'Q18750187' ||
      frame.mappedIdentity.wikidataId !== 'Q18750187' ||
      controls.wikidataId !== 'Q18750187' ||
      controls.representedDate !== museum.publishedOn ||
      building.nodes.length !== 17 ||
      ring.length !== 16 ||
      local.length !== ring.length ||
      building.nodes[0] !== building.nodes.at(-1) ||
      JSON.stringify(ring[0]) !== JSON.stringify(building.coordinates.at(-1))
    )
      return fail('boljoon-original-mapped-church-identity-unbound');

    const [lon, lat] = frame.anchor;
    const meters = (6378137 * Math.PI) / 180;
    const latScale = Math.cos((lat * Math.PI) / 180);
    const c = Math.cos(frame.heading);
    const s = Math.sin(frame.heading);
    for (const [[nodeLon, nodeLat], [expectedX, expectedZ]] of ring.map((point, i) => [
      point,
      local[i],
    ])) {
      const x = (nodeLon - lon) * meters * latScale;
      const z = -(nodeLat - lat) * meters;
      if (Math.hypot(c * x - s * z - expectedX, s * x + c * z - expectedZ) > 1e-7)
        return fail('boljoon-original-outline-changed');
    }
    if (
      convent.bounds.length !== 2 ||
      convent.eaves <= convent.floor ||
      convent.eaves >= nave.eaves ||
      belfry.center[0] <= nave.bounds[1] ||
      belfry.center[1] < nave.bounds[3] - belfry.depth ||
      !(
        belfry.base < belfry.lowerTop &&
        belfry.lowerTop < belfry.upperFloor &&
        belfry.upperFloor < belfry.roofEaves &&
        belfry.roofEaves < belfry.roofTop
      )
    )
      return fail('boljoon-massing-disagrees-with-written-layout');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The named sixteen-corner church outline and the museum’s written architectural facts support the church, attached convent and approximate north belfry. The main roof pitches match the reported angles. Sections, tower footprint, ornament and finish are estimates.',
    };
  } catch {
    return fail('boljoon-primary-factual-evidence-invalid');
  }
}
