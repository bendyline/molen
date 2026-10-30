/** Non-photographic reconstruction of a sufficiently specified simple structure.
 * This does not approve an image or relax any imagery license check. Each supported
 * case binds an exact primary description, numeric controls and native identity.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { collectReferences } from './prepare-batch.mjs';
import { inspectAcropolePrimaryFacts } from './primary-facts-acropole.mjs';
import { inspectActPrimaryFacts } from './primary-facts-act.mjs';
import { inspectAndenesPrimaryFacts } from './primary-facts-andenes.mjs';
import { inspectBosschaPrimaryFacts } from './primary-facts-bosscha.mjs';
import { inspectBrisbanePrimaryFacts } from './primary-facts-brisbane.mjs';
import { inspectBristolPrimaryFacts } from './primary-facts-bristol.mjs';
import { inspectBruneiPrimaryFacts } from './primary-facts-brunei.mjs';
import { inspectBujagaliPrimaryFacts } from './primary-facts-bujagali.mjs';
import { inspectDucorPrimaryFacts } from './primary-facts-ducor.mjs';
import { inspectHobartPrimaryFacts } from './primary-facts-hobart.mjs';
import { inspectIndependencePrimaryFacts } from './primary-facts-independence.mjs';
import { inspectKaptaiPrimaryFacts } from './primary-facts-kaptai.mjs';
import { inspectMaputoPrimaryFacts } from './primary-facts-maputo.mjs';
import { inspectMarkarPrimaryFacts } from './primary-facts-markar.mjs';
import { inspectQingdaoPrimaryFacts } from './primary-facts-qingdao.mjs';
import { inspectRoyePrimaryFacts } from './primary-facts-roye.mjs';
import { inspectSerpentinePrimaryFacts } from './primary-facts-serpentine.mjs';
import { inspectSorpePrimaryFacts } from './primary-facts-sorpe.mjs';
import { inspectXumaPrimaryFacts } from './primary-facts-xuma.mjs';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const read = (p) => JSON.parse(fs.readFileSync(p));
const text = (b) =>
  b
    .toString()
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&rsquo;|&#8217;|&#039;/g, "'")
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const inside = (dir, p) =>
  typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
    ? path.join(dir, p)
    : null;

export function referenceInventoryHash(inventory) {
  return hash(JSON.stringify({ candidates: inventory.candidates, conflicts: inventory.conflicts }));
}

export function inspectPrimaryFactsReconstruction({
  dir,
  entry,
  references,
  currentReferences,
  qualla,
  structures,
  inventory: suppliedInventory,
}) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  if (references?.method !== 'primary-facts-only') return fail('not-selected');
  try {
    const proof = read(path.join(dir, 'primary-facts-reconstruction.json'));
    const controls = read(path.join(dir, 'plan-controls.json'));
    const frame = read(path.join(dir, 'map-frame.json'));
    if (
      proof.format !== 'molen/primary-facts-reconstruction@1' ||
      {
        'cunningham-monument-qhr-650225': 'allan_cunningham_monument',
        'maputo-katembe-engineering-2019': 'maputo_katembe_bridge',
        'andenes-owner-construction-2016': 'andenes_lighthouse',
        'sorpe-owner-engineering-and-cascade-2022': 'sorpe_dam',
        'bosscha-owner-zeiss-dome-dimensions': 'bosscha_zeiss_dome',
        'independence-hall-designer-account-1953': 'independence_memorial_hall',
        'act-instrument-and-optical-design-2011': 'atacama_cosmology_telescope',
        'bujagali-whole-built-composite-dam-2012': 'bujagali_hydroelectric_power_station',
        'serpentine-government-construction-post-upgrade-2007': 'serpentine_dam_western_australia',
        'markar-historian-height-and-museum-clock-form-2026': 'markar_clock_tower',
        'brunei-renovation-designer-and-whole-customs-plan-2023': 'brunei_energy_hub',
        'xuma-official-single-storey-and-transmitted-heritage-house-2013': 'dr_xuma_house',
        'hobart-state-heritage-whole-theatre-and-flytower-2024': 'theatre_royal_hobart',
        'qingdao-municipal-original-office-and-crenellated-tower-2021': 'qingdao_observatory',
        'bristol-restorer-owner-whole-courtyard-hotel-intact-2014': 'bristol_hotel_odesa',
        'ducor-eyewitness-whole-eight-floor-concrete-ruin-2016': 'ducor_hotel',
        'roye-primary-research-eight-floor-tiered-podium-and-tower-2012': 'edward_j_roye_building',
        'acropole-eyewitness-three-storey-blue-shutters-and-patios-2020': 'acropole_hotel',
        'brisbane-icomos-raised-roof-and-original-designer-hall-2002': 'brisbane_festival_hall',
        'kaptai-primary-engineering-whole-dam-spillway-five-units-2018': 'kaptai_dam',
      }[proof.case] !== entry.modelIdentity ||
      proof.model !== entry.modelIdentity ||
      proof.structureId !== entry.structureId ||
      proof.imageryUsed !== false ||
      references.references?.length !== 0 ||
      (references.externalReferences?.length ?? 0) !== 0 ||
      currentReferences?.method !== references.method ||
      currentReferences?.inputHash !== references.inputHash ||
      proof.review?.status !== 'reviewed-primary-facts' ||
      !proof.review.notes?.trim() ||
      !proof.estimates?.length
    )
      return fail('invalid-factual-scope');
    const inventory = suppliedInventory ?? collectReferences(qualla, structures, entry);
    if (
      !inventory.candidates.length ||
      proof.quallaFirst?.inventoryHash !== referenceInventoryHash(inventory) ||
      proof.quallaFirst?.families !== inventory.candidates.length ||
      proof.quallaFirst?.questionableImageryAdopted !== false
    )
      return fail('qualla-search-stale');
    if (proof.case === 'kaptai-primary-engineering-whole-dam-spillway-five-units-2018')
      return inspectKaptaiPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'maputo-katembe-engineering-2019')
      return inspectMaputoPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'xuma-official-single-storey-and-transmitted-heritage-house-2013')
      return inspectXumaPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'hobart-state-heritage-whole-theatre-and-flytower-2024')
      return inspectHobartPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'qingdao-municipal-original-office-and-crenellated-tower-2021')
      return inspectQingdaoPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'bristol-restorer-owner-whole-courtyard-hotel-intact-2014')
      return inspectBristolPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'ducor-eyewitness-whole-eight-floor-concrete-ruin-2016')
      return inspectDucorPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'roye-primary-research-eight-floor-tiered-podium-and-tower-2012')
      return inspectRoyePrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'acropole-eyewitness-three-storey-blue-shutters-and-patios-2020')
      return inspectAcropolePrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'brisbane-icomos-raised-roof-and-original-designer-hall-2002')
      return inspectBrisbanePrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'andenes-owner-construction-2016')
      return inspectAndenesPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'sorpe-owner-engineering-and-cascade-2022')
      return inspectSorpePrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'bosscha-owner-zeiss-dome-dimensions')
      return inspectBosschaPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'brunei-renovation-designer-and-whole-customs-plan-2023')
      return inspectBruneiPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'markar-historian-height-and-museum-clock-form-2026')
      return inspectMarkarPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'serpentine-government-construction-post-upgrade-2007')
      return inspectSerpentinePrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'bujagali-whole-built-composite-dam-2012')
      return inspectBujagaliPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'act-instrument-and-optical-design-2011')
      return inspectActPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'independence-hall-designer-account-1953')
      return inspectIndependencePrimaryFacts({ dir, proof, controls, frame });
    const source = proof.primarySource;
    if (
      source?.url !==
        'https://www.qld.gov.au/environment/land/heritage/council/media-releases/cunningham-monument-is-now-a-heritage-listed-memorial' ||
      source.use !== 'factual-text-only' ||
      source.retrieval !== 'web-open-extracted-cache' ||
      !source.path?.endsWith('.txt')
    )
      return fail('wrong-primary-source');
    const file = inside(dir, source.path),
      bytes = file && fs.readFileSync(file);
    if (!bytes || hash(bytes) !== source.sha256) return fail('primary-source-unbound');
    const body = text(bytes);
    if (
      ![
        'Cunningham Monument is now a heritage-listed memorial',
        'Standing five metres high and three by three metres at its base',
        'stone cairn in the form of an obelisk on a stepped cement-rendered base',
        'within a low-fenced enclosure',
        'completed and officially unveiled',
        '11 June 1927',
      ].every((s) => body.includes(s))
    )
      return fail('primary-description-incomplete');
    const nativeFile = inside(dir, proof.nativeIdentity?.path),
      nativeBytes = nativeFile && fs.readFileSync(nativeFile);
    if (!nativeBytes || hash(nativeBytes) !== proof.nativeIdentity.sha256)
      return fail('native-identity-unbound');
    const node = JSON.parse(nativeBytes).elements?.find(
      (n) => n.type === 'node' && n.id === 1542097343,
    );
    if (
      node?.tags?.historic !== 'memorial' ||
      node?.tags?.name !== 'Allan Cunningham' ||
      frame.mappedIdentity?.wikidataId !== 'Q130550538' ||
      frame.sourceUrl !== 'https://www.openstreetmap.org/node/1542097343' ||
      frame.anchor?.some((v, i) => Math.abs(v - [node.lon, node.lat][i]) > 1e-9) ||
      controls.model !== entry.modelIdentity ||
      controls.monument?.height !== 5 ||
      controls.monument?.baseWidth !== 3 ||
      controls.monument?.baseDepth !== 3 ||
      controls.wholeScope !== 'obelisk-and-intrinsic-stepped-base-and-low-enclosure'
    )
      return fail('identity-or-measured-controls-disagree');
    return {
      status: 'passed',
      method: references.method,
      imageryUsed: false,
      evidenceHash: hash(fs.readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Exact primary dimensions and construction description, full simple physical scope and native identity verified. Fine divisions, stone pattern, plaque sizes and enclosure dimensions remain estimates. No photographic fidelity or image license approval claimed.',
    };
  } catch {
    return fail('missing-or-invalid-factual-evidence');
  }
}
