import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const chandigarhMuseumCase = 'chandigarh-art-museum-native-129784715-eight-roof-lanterns';
export const chandigarhMuseumModel = 'government_museum_and_art_gallery_chandigarh';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function readEvidence(dir, record, expectedPath) {
  if (record?.path !== expectedPath) throw Error('Unexpected Chandigarh evidence path');
  const bytes = readFileSync(join(dir, expectedPath));
  if (hash(bytes) !== record.sha256) throw Error('Chandigarh evidence hash mismatch');
  return JSON.parse(bytes);
}

export function inspectChandigarhMuseumPrimaryFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const written = readEvidence(
      dir,
      proof.primarySources,
      'reference-rights/primary-source-facts.json',
    );
    const native = readEvidence(
      dir,
      proof.nativeIdentity,
      'native-map/museum-and-architecture-museum.json',
    );
    const owner = written.sources.find(
      ({ key, url }) =>
        key === 'museum-architecture' &&
        url === 'https://chdmuseum.gov.in/index.php/home/architecturegov',
    );
    const conservation = written.sources.find(
      ({ key, url }) =>
        key === 'getty-conservation-report' &&
        url ===
          'https://www.getty.edu/conservation/publications_resources/pdf_publications/pdf/environmental-management-at-chandigarh-analysis-and-strategies.pdf',
    );
    const heritage = written.sources.find(
      ({ key, url }) =>
        key === 'chandigarh-administration' && url === 'https://chdpr.gov.in/press/3951',
    );
    const publicDomain = inventory.candidates.filter(({ license }) =>
      ['Public domain', 'CC0', 'CC0 1.0'].includes(license),
    );
    if (
      written.format !== 'molen/primary-architectural-facts@1' ||
      written.model !== chandigarhMuseumModel ||
      proof.primarySources.use !== 'factual-text-only' ||
      ![owner, conservation, heritage].every((record) => record?.use === 'factual-text-only') ||
      owner.facts.sawtoothRoofShafts !== 8 ||
      owner.facts.exposedReinforcedConcrete !== true ||
      heritage.facts.standingGradeOneHeritage !== true ||
      conservation.facts.roofLanterns !== 8 ||
      conservation.facts.southwestEntrancePortico !== true ||
      conservation.facts.alternatingPiersAndRoundPilotis !== true ||
      conservation.facts.exteriorFiredClayCladding !== true ||
      conservation.facts.galleryAeratorsPerNorthwestAndSoutheast !== 15 ||
      conservation.facts.atriumHeightMeters !== 10.7 ||
      publicDomain.length !== 1 ||
      publicDomain[0].sourceUrl !== 'https://commons.wikimedia.org/wiki/File:Mask_Kullu.jpg'
    )
      return fail('chandigarh-museum-primary-sources-or-exclusions-unbound');

    const building = native.elements.find(({ id, type }) => id === 129784715 && type === 'way');
    const neighbor = native.elements.find(({ id, type }) => id === 225023241 && type === 'way');
    const nodes = new Map(
      native.elements.filter(({ type }) => type === 'node').map((node) => [node.id, node]),
    );
    const [lon, lat] = frame.anchor;
    const meters = (Math.PI * 6378137) / 180;
    const c = Math.cos(frame.heading);
    const s = Math.sin(frame.heading);
    const matches = ({ lon: lon1, lat: lat1 }, [u, v]) => {
      const x = (lon1 - lon) * meters * Math.cos((lat * Math.PI) / 180);
      const z = (lat - lat1) * meters;
      return Math.hypot(c * x - s * z - u, s * x + c * z - v) < 0.000008;
    };
    const outline = frame.geometry.outline;
    const { section } = controls;
    if (
      building?.tags.wikidata !== 'Q3112812' ||
      building.tags.tourism !== 'museum' ||
      building.tags.name !== frame.mappedIdentity.name ||
      neighbor?.tags.name !== 'Chandigarh Architecture Museum' ||
      building.id !== proof.nativeIdentity.way ||
      building.tags.wikidata !== proof.nativeIdentity.wikidata ||
      building.tags.wikidata !== frame.mappedIdentity.wikidataId ||
      outline.length !== 14 ||
      building.nodes[0] !== building.nodes.at(-1) ||
      building.nodes.length !== outline.length + 1 ||
      !building.nodes.slice(0, -1).every((id, i) => matches(nodes.get(id), outline[i])) ||
      controls.model !== chandigarhMuseumModel ||
      controls.representedDate !== 'present' ||
      section.estimated !== true ||
      section.roofLanterns.length !== owner.facts.sawtoothRoofShafts ||
      !section.roofLanterns.every((x, i, a) => Number.isFinite(x) && (i === 0 || x > a[i - 1])) ||
      section.wingRings.length !== 2 ||
      new Set([...section.mainRing, ...section.wingRings.flat()]).size !== outline.length ||
      section.galleryAeratorCountPerSide !==
        conservation.facts.galleryAeratorsPerNorthwestAndSoutheast ||
      !(
        section.walkLevel < section.gallerySoffit &&
        section.gallerySoffit < section.galleryFloor &&
        section.galleryFloor < section.roofDeck &&
        section.roofDeck < section.baffleTop
      )
    )
      return fail('chandigarh-museum-native-plan-or-sections-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Verified the native whole-building outline and the primary written records for the pilotis, recessed glazing, fired-clay walls and eight roof lanterns. Vertical sections, bay alignment and localized finish are estimates.',
    };
  } catch {
    return fail('chandigarh-museum-primary-facts-invalid');
  }
}
