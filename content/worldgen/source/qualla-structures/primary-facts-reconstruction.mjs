import {
  aeraAntennaCases,
  inspectAeraAntennaPrimaryFacts,
} from './primary-facts-aera-antennas.mjs';
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
import { inspectAthensPrimaryFacts } from './primary-facts-athens.mjs';
import { augerCampusCases, inspectAugerCampusPrimaryFacts } from './primary-facts-auger-campus.mjs';
import { inspectAugerClfPrimaryFacts } from './primary-facts-auger-clf.mjs';
import { inspectAugerCrsPrimaryFacts } from './primary-facts-auger-crs.mjs';
import { augerEfmCases, inspectAugerEfmPrimaryFacts } from './primary-facts-auger-efm.mjs';
import { augerFdCases, inspectAugerFdPrimaryFacts } from './primary-facts-auger-fd.mjs';
import { augerHeatCases, inspectAugerHeatPrimaryFacts } from './primary-facts-auger-heat.mjs';
import { inspectAugerLidarPrimaryFacts } from './primary-facts-auger-lidar.mjs';
import { inspectAugerSurfacePrimaryFacts } from './primary-facts-auger-surface.mjs';
import { augerTowerCases, inspectAugerTowerPrimaryFacts } from './primary-facts-auger-towers.mjs';
import { inspectAugerWeatherMeterPrimaryFacts } from './primary-facts-auger-weather-meter.mjs';
import { inspectBerlinPrimaryFacts } from './primary-facts-berlin.mjs';
import { inspectBosschaPrimaryFacts } from './primary-facts-bosscha.mjs';
import { inspectBrisbanePrimaryFacts } from './primary-facts-brisbane.mjs';
import { inspectBristolPrimaryFacts } from './primary-facts-bristol.mjs';
import { inspectBruneiPrimaryFacts } from './primary-facts-brunei.mjs';
import { inspectBujagaliPrimaryFacts } from './primary-facts-bujagali.mjs';
import { daiichiCases, inspectDaiichiPrimaryFacts } from './primary-facts-daiichi.mjs';
import { inspectDatongPrimaryFacts } from './primary-facts-datong.mjs';
import { inspectDucorPrimaryFacts } from './primary-facts-ducor.mjs';
import {
  inspectFondukistanPrimaryFacts,
  inspectFondukistanAnnexPrimaryFacts,
} from './primary-facts-fondukistan.mjs';
import { inspectFrayChimneyPrimaryFacts } from './primary-facts-fray-chimney.mjs';
import { inspectGmtPlannedPrimaryFacts } from './primary-facts-gmt-planned.mjs';
import { gmtSupportCases, inspectGmtSupportPrimaryFacts } from './primary-facts-gmt-support.mjs';
import { inspectHobartPrimaryFacts } from './primary-facts-hobart.mjs';
import { inspectIndependencePrimaryFacts } from './primary-facts-independence.mjs';
import { inspectKaptaiPrimaryFacts } from './primary-facts-kaptai.mjs';
import { inspectLasRaicesPrimaryFacts } from './primary-facts-las-raices.mjs';
import { inspectLitoralPrimaryFacts, litoralCases } from './primary-facts-litoral.mjs';
import {
  inspectLitoralEstimatedHallPrimaryFacts,
  litoralEstimatedHallCases,
} from './primary-facts-litoral-estimated-hall.mjs';
import {
  inspectLitoralMicrosoftEstimatedPrimaryFacts,
  litoralMicrosoftEstimatedCases,
} from './primary-facts-litoral-microsoft-estimated.mjs';
import { inspectMaputoPrimaryFacts } from './primary-facts-maputo.mjs';
import { inspectMarkarPrimaryFacts } from './primary-facts-markar.mjs';
import { inspectMroAskapPrimaryFacts } from './primary-facts-mro-askap.mjs';
import { inspectMroBasePrimaryFacts } from './primary-facts-mro-base.mjs';
import { inspectMroControlPrimaryFacts } from './primary-facts-mro-control.mjs';
import { inspectMroDongaPrimaryFacts } from './primary-facts-mro-donga.mjs';
import { inspectMroEdgesPrimaryFacts } from './primary-facts-mro-edges.mjs';
import { inspectMroHubPrimaryFacts } from './primary-facts-mro-hub.mjs';
import { inspectMroMwaPrimaryFacts } from './primary-facts-mro-mwa.mjs';
import { inspectMroReceiverPrimaryFacts } from './primary-facts-mro-receiver.mjs';
import { inspectMroSupportPrimaryFacts, mroSupportCases } from './primary-facts-mro-support.mjs';
import { inspectMroWaterPrimaryFacts } from './primary-facts-mro-water.mjs';
import {
  inspectMubarakCourtPrimaryFacts,
  mubarakCourtCases,
} from './primary-facts-mubarak-court-halls.mjs';
import {
  mubarakEasternEstimatedCases,
  inspectMubarakEasternEstimatedPrimaryFacts,
} from './primary-facts-mubarak-estimated-ranges.mjs';
import { inspectMubarakEasternHallPrimaryFacts } from './primary-facts-mubarak-eastern-hall.mjs';
import { inspectMubarakNorthernPrimaryFacts } from './primary-facts-mubarak-northern-hall.mjs';
import { inspectMubarakNorthwesternPrimaryFacts } from './primary-facts-mubarak-northwestern-hall.mjs';
import { inspectMubarakPinkHallPrimaryFacts } from './primary-facts-mubarak-pink-hall.mjs';
import { inspectMubarakPostOfficePrimaryFacts } from './primary-facts-mubarak-post-office.mjs';
import { inspectMubarakSouthwesternOuterPrimaryFacts } from './primary-facts-mubarak-southwestern-outer-hall.mjs';
import { inspectMubarakUpperLinkPrimaryFacts } from './primary-facts-mubarak-upper-link.mjs';
import {
  inspectOlympicAipStackPrimaryFacts,
  olympicAipStackCase,
  olympicAipStackModel,
} from './primary-facts-olympic-aip-stack.mjs';
import {
  inspectOlympicStackPrimaryFacts,
  olympicStackCases,
} from './primary-facts-olympic-stacks.mjs';
import { inspectPlascoPrimaryFacts } from './primary-facts-plasco.mjs';
import { inspectQingdaoPrimaryFacts } from './primary-facts-qingdao.mjs';
import { inspectQuitoPrimaryFacts } from './primary-facts-quito.mjs';
import { inspectRoyePrimaryFacts } from './primary-facts-roye.mjs';
import { inspectSerePrimaryFacts } from './primary-facts-sere.mjs';
import { inspectSerpentinePrimaryFacts } from './primary-facts-serpentine.mjs';
import { inspectSorpePrimaryFacts } from './primary-facts-sorpe.mjs';
import { inspectTatesMainPrimaryFacts, tatesMainCases } from './primary-facts-tates-main.mjs';
import {
  inspectTatesSupportPrimaryFacts,
  tatesSupportCases,
} from './primary-facts-tates-support.mjs';
import { inspectTehriPrimaryFacts } from './primary-facts-tehri.mjs';
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
        'datong-probable-exhibition-original-outline-explicit-estimates2024':
          'datong_mass_grave_memorial',
        ...aeraAntennaCases,
        ...augerCampusCases,
        ...augerEfmCases,
        'giant-magellan-planned-2024-designer-enclosure-seven-mirrors':
          'giant_magellan_summit_enclosure',
        ...gmtSupportCases,
        ...tatesSupportCases,
        ...tatesMainCases,
        ...litoralCases,
        ...litoralEstimatedHallCases,
        ...litoralMicrosoftEstimatedCases,
        ...daiichiCases,
        ...augerTowerCases,
        ...augerFdCases,
        ...augerHeatCases,
        ...olympicStackCases,
        [olympicAipStackCase]: olympicAipStackModel,
        'fondukistan-monastic-annex-written-functions-original-estimated700':
          'fondukistan_monastic_annex',
        'fondukistan-central-sanctuary-written-DAFA-Carl-niches-estimated650':
          'fondukistan_central_sanctuary',
        'mubarak-mandi-whole-PinkHall-reported95x36ft40ft-fivearches-2012':
          'mubarak_mandi_pink_hall',
        ...mubarakEasternEstimatedCases,
        ...mubarakCourtCases,
        'mubarak-mandi-native-six-corner-northwestern-hall-2012':
          'mubarak_mandi_northwestern_courtyard_hall',
        'mubarak-mandi-native-eight-corner-southwestern-outer-hall-2012':
          'mubarak_mandi_southwestern_outer_hall',
        'mubarak-mandi-native-four-corner-northern-hall-estimated2024':
          'mubarak_mandi_northern_courtyard_hall',
        'mubarak-mandi-native-four-corner-post-office-estimated2023': 'mubarak_mandi_post_office',
        'mubarak-mandi-native-six-corner-eastern-L-hall-height-estimated2023':
          'mubarak_mandi_eastern_courtyard_hall',
        'mubarak-mandi-inferred-whole-southern-upper-link-deorhi-2012':
          'mubarak_mandi_southern_courtyard_upper_link',
        'auger-primary-whole-LIDAR-building-way120464910-2018': 'los_leones_lidar_building',
        'auger-primary-whole-CLF40ft-replacement-container-2018': 'auger_central_laser_shelter',
        'auger-primary-whole-CRS40ft-container-and-known-roof-EFM-2023':
          'aera_central_radio_station',
        'auger-primary-AERAWS-CS110-serial1061-2023': 'aera_weather_site_electric_field_meter',
        'fray-bentos-primary-whole117m-concrete-chimney-native10263472316-2018':
          'fray_bentos_mill_main_chimney',
        'auger-primary-whole-surface-detector-operator-records-2018': 'auger_surface_detector',
        'mro-primary-whole-ASKAP12m-paraboloid-equipment-36nativeinstances-2013':
          'askap_radio_antenna',
        'mro-primary-whole-MWA-PhaseI5m-tile-128originalSWinstances-2013':
          'murchison_widefield_array_tile',
        'mro-primary-whole-EDGES-fourpoint-ASU-November2013': 'murchison_edges_fourpoint_antenna',
        'mro-primary-whole-water-tank-way618004590-2013': 'murchison_western_water_tank',
        'mro-primary-whole-two-plinth-distribution-hub-written200m-2013':
          'murchison_widefield_array_distribution_hub',
        'mro-primary-whole-weather-tight-receiver-integrated-refrigeration-16inferred-instances-2013':
          'murchison_widefield_array_receiver',
        'mro-primary-whole-native-equipment-base-way632829123-2013-estimated':
          'murchison_northwest_equipment_base',
        'mro-primary-whole-independent-MWA-Donga-native629792391-2013':
          'murchison_widefield_array_donga',
        ...mroSupportCases,
        'cunningham-monument-qhr-650225': 'allan_cunningham_monument',
        'mro-primary-whole-independent-shielded-control-building-2013':
          'murchison_control_building',
        'sere-original-whole-two-storey-hipped-house-basement-annex-link-1977': 'mansion_sere',
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
        'tehri-operator-whole-StageI-dam-five-spillways-2014': 'tehri_dam',
        'las-raices-ministry-whole-existing-tunnel-2020': 'las_raices_tunnel',
        'quito-municipal-whole-church-sixchapels-solomonic-facade-2004':
          'church_of_la_compania_quito',
        'athens-owner-whole-sofokleous-sixstorey-office-and-ministry-entrance-2015':
          'athens_stock_exchange',
        'plasco-primary-engineering-whole-independent-original-tower-2016': 'plasco_building',
        'berlin-original-whole-sbahn-network-alkis-envelopes-and-engineer-operator-2021':
          'berlin_nord_sud_tunnel',
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
    // Site members share the parent story corpus; changing the building title must
    // not change that corpus's ranking fingerprint or silently widen its scope.
    let inventoryEntry = entry;
    if (entry.parentModelIdentity) {
      const targets = structures?.filter((s) => s.id === entry.structureId);
      if (targets?.length !== 1 || currentReferences.modelIdentity !== entry.parentModelIdentity)
        return fail('site-member-parent-reference-scope-unbound');
      inventoryEntry = { ...entry, name: targets[0].name };
    }
    const inventory = suppliedInventory ?? collectReferences(qualla, structures, inventoryEntry);
    if (
      !inventory.candidates.length ||
      proof.quallaFirst?.inventoryHash !== referenceInventoryHash(inventory) ||
      proof.quallaFirst?.families !== inventory.candidates.length ||
      proof.quallaFirst?.questionableImageryAdopted !== false
    )
      return fail('qualla-search-stale');
    if (proof.case === 'datong-probable-exhibition-original-outline-explicit-estimates2024')
      return inspectDatongPrimaryFacts({ dir, proof, controls, frame });
    if (aeraAntennaCases[proof.case])
      return inspectAeraAntennaPrimaryFacts({ dir, proof, controls, frame });
    if (augerCampusCases[proof.case])
      return inspectAugerCampusPrimaryFacts({ dir, proof, controls, frame });
    if (augerEfmCases[proof.case])
      return inspectAugerEfmPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'auger-primary-AERAWS-CS110-serial1061-2023')
      return inspectAugerWeatherMeterPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'giant-magellan-planned-2024-designer-enclosure-seven-mirrors')
      return inspectGmtPlannedPrimaryFacts({ dir, proof, controls, frame });
    if (gmtSupportCases[proof.case])
      return inspectGmtSupportPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'auger-primary-whole-CRS40ft-container-and-known-roof-EFM-2023')
      return inspectAugerCrsPrimaryFacts({ dir, proof, controls, frame });
    if (litoralEstimatedHallCases[proof.case])
      return inspectLitoralEstimatedHallPrimaryFacts({ dir, proof, controls, frame });
    if (litoralMicrosoftEstimatedCases[proof.case])
      return inspectLitoralMicrosoftEstimatedPrimaryFacts({ dir, proof, controls, frame });
    if (litoralCases[proof.case])
      return inspectLitoralPrimaryFacts({ dir, proof, controls, frame });
    if (daiichiCases[proof.case])
      return inspectDaiichiPrimaryFacts({ dir, proof, controls, frame });
    if (tatesSupportCases[proof.case])
      return inspectTatesSupportPrimaryFacts({ dir, proof, controls, frame });
    if (tatesMainCases[proof.case])
      return inspectTatesMainPrimaryFacts({ dir, proof, controls, frame });
    if (augerTowerCases[proof.case])
      return inspectAugerTowerPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'auger-primary-whole-LIDAR-building-way120464910-2018')
      return inspectAugerLidarPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'auger-primary-whole-CLF40ft-replacement-container-2018')
      return inspectAugerClfPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'fray-bentos-primary-whole117m-concrete-chimney-native10263472316-2018')
      return inspectFrayChimneyPrimaryFacts({ dir, proof, controls, frame });
    if (olympicStackCases[proof.case])
      return inspectOlympicStackPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === olympicAipStackCase)
      return inspectOlympicAipStackPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'fondukistan-monastic-annex-written-functions-original-estimated700')
      return inspectFondukistanAnnexPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'fondukistan-central-sanctuary-written-DAFA-Carl-niches-estimated650')
      return inspectFondukistanPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'mubarak-mandi-whole-PinkHall-reported95x36ft40ft-fivearches-2012')
      return inspectMubarakPinkHallPrimaryFacts({ dir, proof, controls, frame });
    if (mubarakEasternEstimatedCases[proof.case])
      return inspectMubarakEasternEstimatedPrimaryFacts({ dir, proof, controls, frame });
    if (mubarakCourtCases[proof.case])
      return inspectMubarakCourtPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'mubarak-mandi-native-six-corner-northwestern-hall-2012')
      return inspectMubarakNorthwesternPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'mubarak-mandi-native-eight-corner-southwestern-outer-hall-2012')
      return inspectMubarakSouthwesternOuterPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'mubarak-mandi-native-four-corner-northern-hall-estimated2024')
      return inspectMubarakNorthernPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'mubarak-mandi-native-four-corner-post-office-estimated2023')
      return inspectMubarakPostOfficePrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'mubarak-mandi-native-six-corner-eastern-L-hall-height-estimated2023')
      return inspectMubarakEasternHallPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'mubarak-mandi-inferred-whole-southern-upper-link-deorhi-2012')
      return inspectMubarakUpperLinkPrimaryFacts({ dir, proof, controls, frame });
    if (augerHeatCases[proof.case])
      return inspectAugerHeatPrimaryFacts({ dir, proof, controls, frame });
    if (augerFdCases[proof.case])
      return inspectAugerFdPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'auger-primary-whole-surface-detector-operator-records-2018')
      return inspectAugerSurfacePrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'mro-primary-whole-ASKAP12m-paraboloid-equipment-36nativeinstances-2013')
      return inspectMroAskapPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'mro-primary-whole-MWA-PhaseI5m-tile-128originalSWinstances-2013')
      return inspectMroMwaPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'mro-primary-whole-EDGES-fourpoint-ASU-November2013')
      return inspectMroEdgesPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'mro-primary-whole-water-tank-way618004590-2013')
      return inspectMroWaterPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'mro-primary-whole-two-plinth-distribution-hub-written200m-2013')
      return inspectMroHubPrimaryFacts({ dir, proof, controls, frame });
    if (
      proof.case ===
      'mro-primary-whole-weather-tight-receiver-integrated-refrigeration-16inferred-instances-2013'
    )
      return inspectMroReceiverPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'mro-primary-whole-native-equipment-base-way632829123-2013-estimated')
      return inspectMroBasePrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'mro-primary-whole-independent-MWA-Donga-native629792391-2013')
      return inspectMroDongaPrimaryFacts({ dir, proof, controls, frame });
    if (mroSupportCases[proof.case])
      return inspectMroSupportPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'sere-original-whole-two-storey-hipped-house-basement-annex-link-1977')
      return inspectSerePrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'mro-primary-whole-independent-shielded-control-building-2013')
      return inspectMroControlPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'kaptai-primary-engineering-whole-dam-spillway-five-units-2018')
      return inspectKaptaiPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'tehri-operator-whole-StageI-dam-five-spillways-2014')
      return inspectTehriPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'las-raices-ministry-whole-existing-tunnel-2020')
      return inspectLasRaicesPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'quito-municipal-whole-church-sixchapels-solomonic-facade-2004')
      return inspectQuitoPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'plasco-primary-engineering-whole-independent-original-tower-2016')
      return inspectPlascoPrimaryFacts({ dir, proof, controls, frame });
    if (
      proof.case ===
      'berlin-original-whole-sbahn-network-alkis-envelopes-and-engineer-operator-2021'
    )
      return inspectBerlinPrimaryFacts({ dir, proof, controls, frame });
    if (proof.case === 'athens-owner-whole-sofokleous-sixstorey-office-and-ministry-entrance-2015')
      return inspectAthensPrimaryFacts({ dir, proof, controls, frame });
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
