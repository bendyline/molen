import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const bruneiCouncilCase = 'brunei-legislative-council-native-plan-and-owner-description';
export const bruneiCouncilModel = 'legislative_council_building_brunei';

const information =
  'https://www.information.gov.bn/Brunei%20Today%20PDF%20Library/2010/brunei_today_march_2010.pdf';
const secretariat = 'https://www.councils.gov.bn/wp-content/uploads/2026/03/FAQ-MMN22-ENG.pdf';
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

function readEvidence(dir, receipt, file) {
  if (receipt?.path !== file) throw new Error(`Unexpected Legislative Council evidence ${file}`);
  const bytes = readFileSync(join(dir, file));
  if (hash(bytes) !== receipt.sha256)
    throw new Error(`Legislative Council evidence changed ${file}`);
  return JSON.parse(bytes);
}

export function inspectBruneiCouncilFacts({ dir, proof, controls, frame, inventory }) {
  const needsReview = (reason) => ({ status: 'needs-review', reason });
  try {
    const facts = readEvidence(
      dir,
      proof.primarySources,
      'reference-rights/owner-building-facts.json',
    );
    const { elements } = readEvidence(
      dir,
      proof.nativeIdentity,
      'native-map/council-and-covered-approach.json',
    );
    const council = elements.find((row) => row.type === 'way' && row.id === 474517272);
    const approach = elements.find((row) => row.type === 'way' && row.id === 474517267);
    const nodes = new Map(
      elements.filter(({ type }) => type === 'node').map((node) => [node.id, node]),
    );
    const [lon, lat] = frame.anchor;
    const meters = (6378137 * Math.PI) / 180;
    const lonMeters = meters * Math.cos((lat * Math.PI) / 180);
    const c = Math.cos(frame.heading);
    const s = Math.sin(frame.heading);
    const matches = ({ lon: a, lat: b }, [x, z]) => {
      const east = (a - lon) * lonMeters;
      const south = (lat - b) * meters;
      return Math.hypot(c * east - s * south - x, s * east + c * south - z) < 0.001;
    };
    const bounds = frame.geometry.outline;
    if (
      council?.tags?.name !== 'State Legislative Council' ||
      council.tags['addr:city'] !== 'Bandar Seri Begawan' ||
      council.tags['addr:street'] !== 'Jalan Dewan Majlis' ||
      council.nodes.length !== 41 ||
      council.nodes[0] !== council.nodes.at(-1) ||
      approach?.tags?.covered !== 'yes' ||
      approach.tags.service !== 'driveway' ||
      frame.mappedIdentity.buildingWay !== council.id ||
      frame.mappedIdentity.coveredApproach !== approach.id ||
      bounds.length !== 40 ||
      !council.nodes.slice(0, -1).every((id, i) => matches(nodes.get(id), bounds[i])) ||
      !approach.nodes.every((id, i) => matches(nodes.get(id), controls.dimensions.coveredDrive[i]))
    )
      return needsReview('brunei-council-native-footprint-or-approach-unbound');

    const dims = controls.dimensions;
    const [short, long] = dims.ceremonialColumnGroups;
    if (
      facts.mode !== 'factual-text-only' ||
      facts.imageryUsed !== false ||
      facts.opened !== '2008-03-04' ||
      !facts.sources.some(({ url }) => url === information) ||
      !facts.sources.some(({ url }) => url === secretariat) ||
      facts.identifiedArchitecture.storeys !== 4 ||
      facts.identifiedArchitecture.centralDomeOpenings !== 29 ||
      facts.identifiedArchitecture.asymmetricProgramInTwoWings !== true ||
      dims.storeys !== 4 ||
      dims.domeOpenings !== 29 ||
      short !== 5 ||
      long !== 9 ||
      !(dims.wingRoof < dims.domeSpring && dims.domeSpring < dims.domeApex) ||
      !inventory.candidates.every(({ sourceUrl }) =>
        facts.excludedImages.some((row) => row.sourceUrl === sourceUrl && row.reason),
      )
    )
      return needsReview('brunei-council-written-architecture-or-image-exclusions-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The full named building outline and its covered ceremonial drive anchor the reconstruction. The government records four storeys, the column groups, side wings, and the drum with 29 openings. Upper heights, roof sections, and exterior finishes are estimated.',
    };
  } catch {
    return needsReview('brunei-council-factual-evidence-invalid');
  }
}
