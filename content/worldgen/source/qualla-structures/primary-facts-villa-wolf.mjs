import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const villaWolfCase = 'gubin-villa-wolf-ruins-and-archive-research';
export const villaWolfModel = 'villa_wolf';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const historicalSite = 'https://www.openstreetmap.org/node/1942749789';
const culturalRegister =
  'https://guben-gubin.eu/en/discover-guben-gubin/cultural-register/gubin/monuments/dgi14';
const archiveResearch =
  'https://www.academia.edu/122795108/Ludwig_Mies_van_der_Rohe_Planning_Inventory_and_Design_Process_An_analysis_of_the_Villa_Wolf_drawings_in_the_MoMA_archives_in_New_York';

function readEvidence(dir, receipt, file) {
  if (receipt?.path !== file) throw new Error(`Unexpected Villa Wolf evidence ${file}`);
  const bytes = readFileSync(join(dir, file));
  if (hash(bytes) !== receipt.sha256) throw new Error(`Villa Wolf evidence changed ${file}`);
  return JSON.parse(bytes);
}

export function inspectVillaWolfFacts({ dir, proof, controls, frame, inventory }) {
  const needsReview = (reason) => ({ status: 'needs-review', reason });
  try {
    const facts = readEvidence(
      dir,
      proof.primarySources,
      'reference-rights/villa-building-facts.json',
    );
    const { elements } = readEvidence(
      dir,
      proof.nativeIdentity,
      'native-map/villa-ruins-and-park.json',
    );
    const site = elements.find((row) => row.type === 'node' && row.id === 1942749789);
    const park = elements.find((row) => row.type === 'way' && row.id === 183857165);
    if (
      site?.tags?.historic !== 'ruins' ||
      site.tags['name:de'] !== 'Villa Wolf' ||
      park?.tags?.name !== 'Park Waszkiewicza' ||
      frame.sourceUrl !== historicalSite ||
      frame.anchor.some((coordinate, i) => coordinate !== [site.lon, site.lat][i]) ||
      frame.mappedIdentity.historicalSite !== site.id ||
      frame.mappedIdentity.park !== park.id ||
      frame.currentWorldEligible !== false ||
      frame.validFrom !== '1927-01-01' ||
      frame.validUntil !== '1945-01-01'
    )
      return needsReview('villa-wolf-site-or-historical-dates-unbound');

    if (
      facts.mode !== 'factual-text-only' ||
      facts.imageryUsed !== false ||
      ![culturalRegister, archiveResearch].every((url) =>
        facts.sources.some((row) => row.url === url),
      ) ||
      facts.identifiedArchitecture.clinkerBond !== 'Gothic' ||
      controls.dimensions.storeys !== 3 ||
      controls.dimensions.livingWingFaces !== 'southwest' ||
      controls.dimensions.outlineBasis !== 'approximate-historic-envelope' ||
      !inventory.candidates.every(({ path, sourceUrl }) =>
        facts.excludedImages.some(
          (row) => row.path === path && row.sourceUrl === sourceUrl && row.reason,
        ),
      )
    )
      return needsReview('villa-wolf-architecture-or-image-exclusions-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Archival written research and the cultural register establish the clinker volumes, terraced hillside site, glazed southwest rooms and destruction era. The map supplies a location for the ruins. The historical footprint, orientation, levels and fenestration are estimates.',
    };
  } catch {
    return needsReview('villa-wolf-factual-evidence-invalid');
  }
}
