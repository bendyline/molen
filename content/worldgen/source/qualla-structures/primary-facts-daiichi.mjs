/** Written engineering dimensions and original numerical exterior envelopes; no source images. */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export const daiichiCases = {
  'daiichi-primary-whole-turbine-ventilation-stack-indexed120m-operator2019-nativequad2021':
    'daiichi_turbine_ventilation_exhaust_stack',
  'daiichi-primary-whole-Unit5-6-stack-indexed120m-operator2019-nativequad2021':
    'daiichi_units_5_6_exhaust_stack',
  'daiichi-primary-whole-Unit3-4-stack-operator2025-comparison2017-estimated-position2021':
    'daiichi_units_3_4_exhaust_stack',
  'daiichi-primary-whole-Unit3-4-west-turbine-wings-operator2011-native2019-2021':
    'daiichi_units_3_4_turbine_service_wings',
  'daiichi-primary-whole-Unit4-remaining-reactor-postdamage2012-native2021-estimated-plan':
    'daiichi_unit_4_reactor_lower_building',
  'daiichi-primary-whole-Unit3-remaining-reactor-postdamage2012-native2019':
    'daiichi_unit_3_reactor_lower_building',
  'daiichi-primary-whole-Unit4-steel-cover-operator2017-native2021':
    'daiichi_unit_4_fuel_removal_cover',
  'daiichi-primary-whole-Unit3-dome-cover-operator2013-native2019':
    'daiichi_unit_3_fuel_removal_cover',
  'daiichi-primary-whole-Unit2-turbine-operator2011-native2019': 'daiichi_unit_2_turbine_building',
  'daiichi-primary-whole-Unit2-reactor-west-access-operator2017-native2019':
    'daiichi_unit_2_reactor_building',
  'daiichi-primary-whole-Unit3-turbinehall-operator2011-native2019': 'daiichi_unit_3_turbine_hall',
  'daiichi-primary-whole-Unit4-turbinehall-operator2011-native2021': 'daiichi_unit_4_turbine_hall',
  'daiichi-primary-whole-Unit5-turbine-named-reactor-adjacency-operator2011-native2019':
    'daiichi_unit_5_turbine_building',
  'daiichi-primary-whole-Unit6-turbine-named-reactor-adjacency-operator2011-native2019':
    'daiichi_unit_6_turbine_building',
  'daiichi-primary-whole-Unit6-reactor-operator2011-native2021': 'daiichi_unit_6_reactor_building',
  'daiichi-primary-whole-Unit5-reactor-written-lower-upper-operator2011-native2021':
    'daiichi_unit_5_reactor_building',
};

export function inspectDaiichiPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  if (
    [
      'daiichi-primary-whole-Unit5-6-stack-indexed120m-operator2019-nativequad2021',
      'daiichi-primary-whole-turbine-ventilation-stack-indexed120m-operator2019-nativequad2021',
    ].includes(proof.case)
  )
    return inspectAncillaryStack({ dir, proof, P, f });
  if (
    proof.case ===
    'daiichi-primary-whole-Unit3-4-stack-operator2025-comparison2017-estimated-position2021'
  )
    return inspectSharedStack34({ dir, proof, P, f });
  if (
    proof.case === 'daiichi-primary-whole-Unit3-4-west-turbine-wings-operator2011-native2019-2021'
  )
    return inspectWestTurbineWings({ dir, proof, P, f });
  if (
    proof.case ===
    'daiichi-primary-whole-Unit4-remaining-reactor-postdamage2012-native2021-estimated-plan'
  )
    return inspectRemainingReactor4({ dir, proof, P, f });
  if (proof.case === 'daiichi-primary-whole-Unit3-remaining-reactor-postdamage2012-native2019')
    return inspectRemainingReactor3({ dir, proof, P, f });
  if (proof.case === 'daiichi-primary-whole-Unit4-steel-cover-operator2017-native2021')
    return inspectCover4({ dir, proof, P, f });
  if (proof.case === 'daiichi-primary-whole-Unit3-dome-cover-operator2013-native2019')
    return inspectCover3({ dir, proof, P, f });
  if (
    proof.case === 'daiichi-primary-whole-Unit5-reactor-written-lower-upper-operator2011-native2021'
  )
    return inspectReactor5({ dir, proof, P, f });
  if (proof.case === 'daiichi-primary-whole-Unit6-reactor-operator2011-native2021')
    return inspectReactor6({ dir, proof, P, f });
  if (
    [5, 6].some(
      (n) =>
        proof.case ===
        `daiichi-primary-whole-Unit${n}-turbine-named-reactor-adjacency-operator2011-native2019`,
    )
  )
    return inspectNorthernTurbine({ dir, proof, P, f });
  if (proof.case === 'daiichi-primary-whole-Unit2-reactor-west-access-operator2017-native2019')
    return inspectReactor({ dir, proof, P, f });
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const hall3 = proof.case === 'daiichi-primary-whole-Unit3-turbinehall-operator2011-native2019',
      hall4 = proof.case === 'daiichi-primary-whole-Unit4-turbinehall-operator2011-native2021',
      unit = hall4 ? '４' : hall3 ? '３' : '２',
      expectedCorners = hall4 ? 4 : hall3 ? 9 : 25,
      way = hall4 ? 'w915666706@1' : hall3 ? 'w103924987@6' : 'w103816840@11',
      expectedNS = hall4 ? 105.15 : hall3 ? 127.15 : 104.95;
    const sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s]));
    for (const s of [sources['operator-pdf'], sources['operator-text'], proof.nativeIdentity]) {
      if (
        typeof s?.path !== 'string' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..') ||
        hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256
      )
        return fail('daiichi-source-unbound');
    }
    const url = 'https://www.tepco.co.jp/cc/press/betu11_j/images/110818n.pdf';
    if (
      !['operator-pdf', 'operator-text'].every(
        (k) => sources[k].url === url && sources[k].use === 'factual-text-and-numerical-data-only',
      ) ||
      sources['operator-pdf'].sha256 !==
        'sha256:e91b834dcfa7c83fe9eb49b2c569750ebfa16c8655e233843f83c6d16e78824f'
    )
      return fail('daiichi-original-operator-report-unbound');
    const text = fs
      .readFileSync(path.join(dir, sources['operator-text'].path), 'utf8')
      .replace(/\s+/g, '');
    const start = text.indexOf(
      `３．${unit}福島第一原子力発電所${unit}号機タービン建屋３．${unit}．１`,
    );
    const section = text.slice(start, start + 1100);
    if (
      start < 0 ||
      ![
        `３．${unit}．１`,
        '地上３階、地下１階',
        '鉄筋コンクリート造',
        '鉄骨造（トラス構造）',
        String(expectedNS),
        '67.60',
        '37.35',
        '25.75',
        '構造的に分離',
      ].every((s) => section.includes(s))
    )
      return fail('daiichi-unit2-written-dimensions-missing');
    const j = JSON.parse(fs.readFileSync(path.join(dir, proof.nativeIdentity.path))),
      r = j.originalRecord,
      id = hall4
        ? '2416fa45-f3f7-4906-859c-6ad68cb95c98'
        : hall3
          ? 'a4ed892d-a661-412a-8cc4-ea0e304b8388'
          : '486377cd-af7f-4a27-b257-316742a67e4d',
      geo = j.geometry.coordinates[0].slice(0, -1),
      D = (6378137 * Math.PI) / 180,
      co = Math.cos((f.anchor[1] * Math.PI) / 180);
    if (
      r.id !== id ||
      (!hall4 && r.names.common.en !== (hall3 ? 'Third turbine hall' : 'Second turbine hall')) ||
      !r.sources.some((s) => s.dataset === 'OpenStreetMap' && s.record_id === way) ||
      proof.nativeIdentity.featureId !== 'overture/' + id ||
      geo.length !== expectedCorners ||
      f.heading !== 0 ||
      j.fullSnapshotSha256 !==
        'sha256:21bbe1ec8f0fd58410912455a1e4cf7033364eb67ed50872d59454690ce20606'
    )
      return fail('daiichi-original-native-identity-unbound');
    if (hall4) {
      const n = j.spatialIdentity?.northernNamedHall,
        nr = n?.originalRecord,
        ng = n?.geometry?.coordinates?.[0]?.slice(0, -1),
        core = ng?.filter((_, i) => [0, 1, 2, 3, 6, 7, 8].includes(i)),
        extent = (ps, k, op) => Math[op](...ps.map((p) => p[k]));
      if (
        nr?.id !== 'a4ed892d-a661-412a-8cc4-ea0e304b8388' ||
        nr.names?.common?.en !== 'Third turbine hall' ||
        !nr.sources.some((s) => s.record_id === 'w103924987@6') ||
        !core ||
        core.length !== 7 ||
        j.spatialIdentity.inferredIdentity !== true ||
        (extent(ng, 1, 'min') - extent(geo, 1, 'max')) * D < 0 ||
        (extent(ng, 1, 'min') - extent(geo, 1, 'max')) * D > 2.1 ||
        ['min', 'max'].some(
          (op) => Math.abs(extent(core, 0, op) - extent(geo, 0, op)) * D * co > 2,
        ) ||
        Math.abs(Math.hypot((geo[2][0] - geo[1][0]) * co, geo[2][1] - geo[1][1]) * D - 105.15) > 2
      )
        return fail('daiichi-inferred-unit4-native-sequence-unbound');
    }
    const ring = geo.map((p) => [(p[0] - f.anchor[0]) * D * co, -(p[1] - f.anchor[1]) * D]);
    if (
      P.model !== daiichiCases[proof.case] ||
      P.parentModelIdentity !== 'fukushima_daiichi_nuclear_power_plant' ||
      P.wholeScope !==
        (hall4
          ? 'whole-independent-native4corner-Unit4-turbine-hall-roofed-body'
          : hall3
            ? 'whole-independent-native9corner-Unit3-turbine-hall-roofed-body'
            : 'whole-independent-native25corner-Unit2-turbine-building') ||
      P.gersId !== id ||
      P.originalNativeWay !== way ||
      P.originalAboveGradeHeightMeters !== 25.75 ||
      P.originalFoundationToRoofHeightMeters !== 37.35 ||
      P.originalMainPlanNSMeters !== expectedNS ||
      P.originalMainPlanEWMeters !== 67.6 ||
      P.originalAboveGroundFloors !== 3 ||
      P.originalBelowGroundFloors !== 1 ||
      Math.abs(P.mainRoof - P.floor - 25.75) > 1e-8 ||
      P.lowerRoof !== 17.15 ||
      P.estimatedTierHeightUncertaintyMeters < 3 ||
      P.estimatedHorizontalUncertaintyMeters < 8 ||
      P.estimatedComponentUncertaintyMeters < 2 ||
      P.representedDate !== (hall4 ? '2021-03-11' : '2019-11-09') ||
      P.temporalContinuityVerified !== false ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(ring) ||
      JSON.stringify(f.geometry.polygons[0]) !== JSON.stringify(ring) ||
      JSON.stringify(P.mainRing) !==
        JSON.stringify(
          (hall4 ? [0, 1, 2, 3] : hall3 ? [0, 1, 2, 3, 6, 7, 8] : [3, 2, 15, 14]).map(
            (i) => ring[i],
          ),
        ) ||
      ((hall3 || hall4) &&
        (P.estimatedMainHeightUncertaintyMeters < 3 ||
          P.fullEngineeringBuildingCompleted !== false))
    )
      return fail('daiichi-whole-body-controls-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes: hall4
        ? 'Whole4corner originalhallroof, inferredUnit4identityfromimmediatesouthadjacency/alignedroofedges/numerical105.15mengineeringlength. Operator25.75mmaximumassignedwith3muncertainty. Fullwesternancillaryengineeringextentunmodeled; no explicitnativeUnit4nametag or surveyedroofheightclaimed. Finish/2021continuityestimated; every source image unused.'
        : hall3
          ? 'Original named Unit3 separatelymapped9corner turbinehallbody; operator full127.15x67.60m engineering extent has additional western ancillary scope, not claimedcomplete. Maximum25.75mheight assignedtohighhallwith3muncertainty. Nativepartpartition, lowerroof, finish and2019continuity estimated; every source image unused.'
          : 'Original named Unit2 turbine building, all25nativecorners and operator25.75m abovegradeheight/concreteandsteelconstruction. Mainhall tierpartition, lowerroof, finish, fine details and nominal2019continuity remain explicit estimates. Every source image unused; parent plant unfinished.',
    };
  } catch {
    return fail('daiichi-evidence-unreadable');
  }
}

function inspectAncillaryStack({ dir, proof, P, f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  const ventilation =
    proof.case ===
    'daiichi-primary-whole-turbine-ventilation-stack-indexed120m-operator2019-nativequad2021';
  const expectedWay = ventilation ? 743332934 : 743623813;
  try {
    const sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s]));
    for (const s of [...proof.primarySources, proof.nativeIdentity]) {
      if (
        typeof s?.path !== 'string' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..') ||
        hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256
      )
        return fail('daiichi-stack56-source-unbound');
    }
    const indexed = sources['indexed-facts'];
    if (
      indexed?.url !== 'https://www2.nra.go.jp/data/000452866.pdf' ||
      indexed.retrieval !== 'web-search-extracted-cache' ||
      indexed.originalPDFBinaryRetrieved !== false ||
      indexed.use !== 'factual-text-and-numerical-data-only'
    )
      return fail('daiichi-stack56-indexed-primary-facts-role-unbound');
    const facts = JSON.parse(fs.readFileSync(path.join(dir, indexed.path))),
      obs = facts.primaryObservations;
    if (
      facts.retrieval !== 'web-search-extracted-cache' ||
      facts.originalPDFBinaryRetrieved !== false ||
      obs.length !== 2 ||
      obs[0].url !== indexed.url ||
      obs[0].physicalHeightMeters !== 120 ||
      (ventilation
        ? obs[0].factRole !== 'physical120m-central-turbine-ventilation-stack-function' ||
          JSON.stringify(obs[0].servesTurbines) !== '[2,3,4]' ||
          obs[0].servesCentralWasteBuildingVentilation !== true ||
          obs[0].effectivePlumeHeightAdopted !== false
        : obs[0].factRole !== 'physical-stack-height-not-effective-plume-height' ||
          obs[0].effectivePlumeHeightMeters !== 65 ||
          obs[0].effectiveHeightNotAdopted !== true) ||
      obs[1].url !==
        'https://www.meti.go.jp/earthquake/nuclear/decommissioning/committee/osensuitaisakuteam/2019/02/3-2-6.pdf' ||
      JSON.stringify(obs[1].operatorNamesFourStacks) !==
        '["1/2","3/4","turbine-ventilation","5/6"]' ||
      (ventilation
        ? obs[1].centralVentilationSteelTower !== true ||
          obs[1].centralMaintenanceAccessDiscussed !== true ||
          obs[1].exactTowerWidthsHeightsBoreFootingsOrPlatformCountProven !== false
        : obs[1].unit56SteelTower !== true ||
          obs[1].unit56LacksUnit34StyleMaintenanceFootboards !== true ||
          obs[1].exactTowerWidthsHeightsBoreOrFootingsProven !== false)
    )
      return fail('daiichi-stack56-primary-height-type-and-estimate-roles-disagree');
    for (const key of ['family-pdf', 'family-text'])
      if (
        sources[key]?.url !==
          'https://www.tepco.co.jp/nu/fukushima-np/roadmap/2017/images2/d171221_15-j.pdf' ||
        sources[key].use !== 'factual-text-and-numerical-data-only'
      )
        return fail('daiichi-stack56-family-context-unbound');
    if (
      sources['family-pdf'].sha256 !==
      'sha256:a4f0e694891b5f4c7c7aacc94f5f3ffa9738ddbb40e4bce25d7bed62fd1213bb'
    )
      return fail('daiichi-stack56-original-family-pdf-unbound');
    const j = JSON.parse(fs.readFileSync(path.join(dir, proof.nativeIdentity.path))),
      w = j.originalWay;
    const nodes = new Map(j.originalNodes.map((n) => [n.id, n]));
    if (
      !j.sourceURL.startsWith('https://api.openstreetmap.org/api/0.6/map.json?bbox=') ||
      w.id !== expectedWay ||
      w.type !== 'way' ||
      w.tags?.man_made !== 'flare' ||
      w.tags?.['seamark:landmark:category'] !== 'tower' ||
      w.nodes.length !== 5 ||
      w.nodes[0] !== w.nodes.at(-1) ||
      j.originalFourTowerInventory.length !== 4 ||
      JSON.stringify(j.originalFourTowerInventory.map((r) => r.way.id).sort((a, b) => a - b)) !==
        '[743332918,743332931,743332934,743623813]' ||
      j.identityInferred !== true ||
      j.positionOrIdentitySurveyed !== false ||
      proof.nativeIdentity.featureId !== 'way/' + expectedWay ||
      proof.nativeIdentity.identityInferred !== true
    )
      return fail('daiichi-stack56-original-north-tower-inventory-unbound');
    const points = w.nodes.slice(0, -1).map((id) => {
      const n = nodes.get(id);
      return [n.lon, n.lat];
    });
    const anchor = [0, 1].map(
      (k) => (Math.min(...points.map((p) => p[k])) + Math.max(...points.map((p) => p[k]))) / 2,
    );
    if (
      j.originalFourTowerInventory.some(
        (r) =>
          r.way.id !== w.id &&
          (ventilation
            ? Math.min(...r.nodes.map((n) => n.lat)) < anchor[1]
            : Math.max(...r.nodes.map((n) => n.lat)) > anchor[1]),
      ) ||
      anchor.some((v, k) => Math.abs(v - f.anchor[k]) > 1e-12) ||
      f.heading !== 0
    )
      return fail('daiichi-stack56-northern-group-position-disagrees');
    const D = (6378137 * Math.PI) / 180,
      co = Math.cos((f.anchor[1] * Math.PI) / 180);
    const ring = points.map((p) => [(p[0] - f.anchor[0]) * D * co, -(p[1] - f.anchor[1]) * D]);
    const span = Math.max(
      ...[0, 1].map((k) => Math.max(...ring.map((p) => p[k])) - Math.min(...ring.map((p) => p[k]))),
    );
    const values = {
      originalPhysicalStackHeightMeters: 120,
      flueHeight: 120,
      towerHeight: 111,
      floor: 0.25,
      foundationBottom: -0.9,
      foundationTop: 0.25,
      towerWidthTop: ventilation ? 5.4 : 4.5,
      flueInnerRadius: ventilation ? 2.2 : 1.6,
      flueOuterRadius: ventilation ? 2.25 : 1.65,
      pierRadius: 2.3,
      centralPadRadius: ventilation ? 3.2 : 2.7,
    };
    if (
      P.model !== daiichiCases[proof.case] ||
      P.parentModelIdentity !== 'fukushima_daiichi_nuclear_power_plant' ||
      P.wholeScope !==
        (ventilation
          ? 'whole-independent-central-turbine-ventilation120m-stack-nativequad-estimated-frame'
          : 'whole-independent-Unit5-6-shared120m-stack-nativequad-estimated-frame') ||
      P.originalNativeWay !== expectedWay ||
      Object.entries(values).some(([k, v]) => P[k] !== v) ||
      P.baseReferenceSpan !== span ||
      P.towerWidthBase !== span ||
      (ventilation
        ? P.profileDimensionsExactForVentilation !== false
        : P.profileDimensionsExactForUnit56 !== false) ||
      P.estimatedTowerHeightUncertaintyMeters < 10 ||
      P.estimatedBaseLegRoleUncertaintyMeters < 4 ||
      P.estimatedTopSpanUncertaintyMeters < 3 ||
      P.estimatedBoreUncertaintyMeters < (ventilation ? 2 : 1) ||
      P.estimatedComponentUncertaintyMeters < 2 ||
      P.baseLegRoleVerified !== false ||
      P.identityInferred !== true ||
      (!ventilation && P.unit34StyleFootboardsAdded !== false) ||
      P.maintenancePlatformsIncluded !== ventilation ||
      P.ladderIncluded !== ventilation ||
      (ventilation &&
        (JSON.stringify(P.authorMaintenancePlatformLevels) !== '[80]' ||
          P.estimatedPlatformHeightUncertaintyMeters < 10 ||
          P.maintenancePlatformCountVerified !== false)) ||
      P.temporalContinuityVerified !== false ||
      P.representedDate !== '2021-03-11' ||
      JSON.stringify(P.baseLegCorners) !== JSON.stringify(ring) ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(ring) ||
      JSON.stringify(f.geometry.polygons[0]) !== JSON.stringify(ring) ||
      f.mappedIdentity.identityInferred !== true
    )
      return fail('daiichi-stack56-whole-height-native-envelope-and-profile-estimates-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes: ventilation
        ? 'Whole120m centralizedturbineventilationstack; original southernfour-cornertower context and indexedprimary height/function/four-stackcensus/maintenanceaccess bound. Systemrole/legrole inferred;111mframeheight10m/top3m/bore2m/details2m estimates. One80mplatform is an unverifiedauthorcensus/location choice with10mheightuncertainty. Indexedrecords are not originalPDFbytes;2021continuity/finish/grade approximate,allappearanceimagesunused.'
        : 'Whole120m northern5/6stack; originalfour-corner mappedtower context and indexedprimary physicalheight/steeltype/no3-4stylefootboards bound. Systemrole andlegcornerrole inferred.111mframeheight10m/top3m/bore1m/details2m estimates are not measured5/6dimensions. Originalindexedrecords are honestly labelled, not originalPDFbytes.2021continuity/finish/grade approximate; allappearanceimageryunused.',
    };
  } catch (error) {
    return fail('daiichi-stack56-source-error: ' + error.message);
  }
}

function inspectSharedStack34({ dir, proof, P, f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s]));
    for (const s of [...proof.primarySources, proof.nativeIdentity]) {
      if (
        typeof s?.path !== 'string' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..') ||
        hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256
      )
        return fail('daiichi-stack34-source-unbound');
    }
    for (const key of ['operator-pdf', 'operator-text', 'comparison-pdf', 'comparison-text']) {
      const url = key.startsWith('operator')
        ? 'https://www.da.nra.go.jp/data/NRA100010825-002-002.pdf'
        : 'https://www.tepco.co.jp/nu/fukushima-np/roadmap/2017/images2/d171221_15-j.pdf';
      if (sources[key]?.url !== url || sources[key].use !== 'factual-text-and-numerical-data-only')
        return fail('daiichi-stack34-original-source-role-unbound');
    }
    if (
      sources['operator-pdf'].sha256 !==
        'sha256:59c544bb636e93c50dc291947d4a2826fadab88060e479240ea53d0472191f05' ||
      sources['comparison-pdf'].sha256 !==
        'sha256:a4f0e694891b5f4c7c7aacc94f5f3ffa9738ddbb40e4bce25d7bed62fd1213bb'
    )
      return fail('daiichi-stack34-original-pdf-identities-unbound');
    const text = fs
      .readFileSync(path.join(dir, sources['operator-text'].path), 'utf8')
      .replace(/\s+/g, '');
    const start = text.indexOf('４．3/4号機排気筒の構造'),
      section = text.slice(start, start + 1800);
    if (
      start < 0 ||
      ![
        '3/4号機排気筒は1/2号機排気筒とほぼ同じ構造である',
        '排気筒高さ：GL+120.00m',
        '総重量：約415t',
        '第5支持点（GL+111m）',
        '第4支持点（GL+94.2m）',
        '第3支持点（GL+76.4m）',
        '第2支持点（GL+54.8m）',
        '第1支持点（GL+30.000m）',
        'GL+86.16m',
        'GL+44.4m',
        'SGTS配管',
      ].every((v) => section.includes(v))
    )
      return fail('daiichi-stack34-written-structure-height-and-supports-unbound');
    const comparison = fs
      .readFileSync(path.join(dir, sources['comparison-text'].path), 'utf8')
      .replace(/\s+/g, '');
    if (!['120m', '111m', '22.0m', '5.4m', '3.2m', '4.6m'].every((v) => comparison.includes(v)))
      return fail('daiichi-stack34-comparison-dimensions-missing');
    const j = JSON.parse(fs.readFileSync(path.join(dir, proof.nativeIdentity.path)));
    const rs = j.originalRecords,
      gs = j.geometries.map((g) => g.coordinates[0].slice(0, -1));
    if (
      rs.length !== 2 ||
      rs[0].id !== '1a07336c-51b8-41a7-b3c5-dd22e664f80a' ||
      !rs[0].names?.primary?.includes('3 containment building') ||
      !rs[0].sources.some((s) => s.record_id === 'w743332913@1') ||
      rs[1].id !== 'dd782e95-18b3-4f13-bb1f-ceba91cb18a1' ||
      !rs[1].sources.some((s) => s.record_id === 'w915666707@1') ||
      gs[0].length !== 13 ||
      gs[1].length !== 14 ||
      j.fullSnapshotSha256 !==
        'sha256:21bbe1ec8f0fd58410912455a1e4cf7033364eb67ed50872d59454690ce20606'
    )
      return fail('daiichi-stack34-original-reactor-position-context-unbound');
    const ctx = [6, 4, 3, 7].map((i) => gs[0][i]);
    const centres = [
      [
        (Math.min(...ctx.map((p) => p[0])) + Math.max(...ctx.map((p) => p[0]))) / 2,
        (gs[0][6][1] + gs[0][10][1]) / 2,
      ],
      [(gs[1][2][0] + gs[1][11][0]) / 2, (gs[1][1][1] + gs[1][2][1]) / 2],
    ];
    const anchor = [0, 1].map((k) => (centres[0][k] + centres[1][k]) / 2);
    if (
      JSON.stringify(j.reactorBodyContextCentres) !== JSON.stringify(centres) ||
      JSON.stringify(j.estimatedStackAnchor) !== JSON.stringify(anchor) ||
      anchor.some((v, k) => Math.abs(v - f.anchor[k]) > 1e-12) ||
      f.heading !== 0 ||
      j.pointIdentityVerified !== false ||
      j.positionUncertaintyAllowanceMeters < 50 ||
      proof.nativeIdentity.nativeStackPointVerified !== false ||
      proof.nativeIdentity.featureId !== 'author-approximation/daiichi-units-3-4-exhaust-stack' ||
      f.mappedIdentity.nativePointVerified !== false ||
      !f.geometryLabel.includes('NOT native stack')
    )
      return fail('daiichi-stack34-author-point-estimate-not-honestly-bound');
    const values = {
      floor: 0.25,
      foundationBottom: -0.9,
      foundationTop: 0.25,
      flueHeight: 120,
      towerHeight: 111,
      towerWidthBase: 22,
      towerWidthTop: 5.4,
      flueInnerRadius: 1.6,
      flueOuterRadius: 1.65,
      pierRadius: 2.3,
      centralPadRadius: 2.7,
      originalApproxWeightTonnes: 415,
    };
    const ring = [
      [-13.3, -13.3],
      [13.3, -13.3],
      [13.3, 13.3],
      [-13.3, 13.3],
    ];
    if (
      P.model !== daiichiCases[proof.case] ||
      P.parentModelIdentity !== 'fukushima_daiichi_nuclear_power_plant' ||
      P.wholeScope !== 'whole-independent-Unit3-4-shared120m-stack-111m-support' ||
      Object.entries(values).some(([k, v]) => P[k] !== v) ||
      JSON.stringify(P.originalFlueSupportLevelsMeters) !== '[30,54.8,76.4,94.2,111]' ||
      JSON.stringify(P.originalIntermediatePlatformLevelsMeters) !== '[44.4,86.16]' ||
      P.comparisonDimensionsExactForUnit34 !== false ||
      P.estimatedComparisonSectionUncertaintyMeters < 3 ||
      P.estimatedComponentUncertaintyMeters < 2 ||
      P.horizontalUncertaintyMeters < 50 ||
      P.positionErrorBoundVerified !== false ||
      P.nativeStackPointVerified !== false ||
      P.temporalContinuityVerified !== false ||
      P.representedDate !== '2021-03-11' ||
      P.estimatedColorScheme !== 'red-white-author-visualization-not-image-derived' ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(ring) ||
      JSON.stringify(f.geometry.polygons[0]) !== JSON.stringify(ring)
    )
      return fail('daiichi-stack34-height-comparison-sections-and-estimate-roles-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole120m shared3/4stack with original111/94.2/76.4/54.8/30m support and44.4/86.16m platform levels. Widths/bore/piers are explicit3m comparison estimates, not exact3/4measurements. Geographic midpoint50m nominal allowance is an author visualization estimate, not verified native/surveyed accuracy. Finish,2021continuity and grade remain approximate; all appearance imagery unused.',
    };
  } catch (error) {
    return fail('daiichi-stack34-source-error: ' + error.message);
  }
}

function inspectWestTurbineWings({ dir, proof, P, f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s]));
    for (const s of [...proof.primarySources, proof.nativeIdentity]) {
      if (
        typeof s?.path !== 'string' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..') ||
        hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256
      )
        return fail('daiichi-west-wings-source-unbound');
    }
    const url = 'https://www.tepco.co.jp/cc/press/betu11_j/images/110818n.pdf';
    if (
      !['operator-pdf', 'operator-text'].every(
        (key) =>
          sources[key]?.url === url && sources[key].use === 'factual-text-and-numerical-data-only',
      ) ||
      sources['operator-pdf'].sha256 !==
        'sha256:e91b834dcfa7c83fe9eb49b2c569750ebfa16c8655e233843f83c6d16e78824f'
    )
      return fail('daiichi-west-wings-original-operator-unbound');
    const text = fs
      .readFileSync(path.join(dir, sources['operator-text'].path), 'utf8')
      .replace(/\s+/g, '');
    for (const [unit, length] of [
      ['３', '127.15'],
      ['４', '105.15'],
    ]) {
      const start = text.indexOf(
        `３．${unit}福島第一原子力発電所${unit}号機タービン建屋３．${unit}．１`,
      );
      const section = text.slice(start, start + 1100);
      if (
        start < 0 ||
        ![length, '67.60', '25.75', '構造的に分離'].every((v) => section.includes(v))
      )
        return fail('daiichi-west-wings-unit-specific-major-dimensions-missing');
    }
    const native = JSON.parse(fs.readFileSync(path.join(dir, proof.nativeIdentity.path)));
    const ids = ['a4ed892d-a661-412a-8cc4-ea0e304b8388', '2416fa45-f3f7-4906-859c-6ad68cb95c98'];
    const ways = ['w103924987@6', 'w915666706@1'];
    if (
      native.fullSnapshotSha256 !==
        'sha256:21bbe1ec8f0fd58410912455a1e4cf7033364eb67ed50872d59454690ce20606' ||
      native.units.length !== 2 ||
      JSON.stringify(proof.nativeIdentity.featureIds) !==
        JSON.stringify(ids.map((id) => 'overture/' + id))
    )
      return fail('daiichi-west-wings-native-inventory-unbound');
    const points = native.units.flatMap((u) => u.geometry.coordinates[0]);
    const anchor = [0, 1].map(
      (k) => (Math.min(...points.map((p) => p[k])) + Math.max(...points.map((p) => p[k]))) / 2,
    );
    if (anchor.some((v, k) => Math.abs(v - f.anchor[k]) > 1e-12) || f.heading !== 0)
      return fail('daiichi-west-wings-frame-unbound');
    const D = (6378137 * Math.PI) / 180,
      co = Math.cos((f.anchor[1] * Math.PI) / 180);
    const indices = [
        [8, 0, 7, 1],
        [1, 2, 0, 3],
      ],
      expected = [];
    for (let i = 0; i < 2; i++) {
      const u = native.units[i],
        r = u.originalRecord;
      if (
        u.unit !== i + 3 ||
        r.id !== ids[i] ||
        u.identityInferred !== (i === 1) ||
        !r.sources.some((s) => s.dataset === 'OpenStreetMap' && s.record_id === ways[i]) ||
        (i === 0 && r.names?.common?.en !== 'Third turbine hall') ||
        (i === 1 && r.names !== null) ||
        JSON.stringify(u.edgeIndicesWestNorthWestSouthEastNorthEastSouth) !==
          JSON.stringify(indices[i])
      )
        return fail('daiichi-west-wings-mainhall-identity-unbound');
      const ring = u.geometry.coordinates[0]
        .slice(0, -1)
        .map((p) => [(p[0] - f.anchor[0]) * D * co, -(p[1] - f.anchor[1]) * D]);
      if (ring.length !== [9, 4][i]) return fail('daiichi-west-wings-mainhall-controls-missing');
      const [wn, ws, en, es] = indices[i];
      expected.push([
        [ring[en][0] - 67.6, ring[wn][1]],
        ring[wn],
        ring[ws],
        [ring[es][0] - 67.6, ring[ws][1]],
      ]);
      if (Math.abs(ring[ws][1] - ring[wn][1] - [127.15, 105.15][i]) > 2)
        return fail('daiichi-west-wings-native-north-south-sequence-disagrees');
    }
    if (
      P.model !== daiichiCases[proof.case] ||
      P.parentModelIdentity !== 'fukushima_daiichi_nuclear_power_plant' ||
      P.wholeScope !== 'whole-estimated-Unit3-and-Unit4-western-turbine-service-wings' ||
      P.originalMajorBuildingEWMeters !== 67.6 ||
      JSON.stringify(P.originalMajorBuildingNSMeters) !== '[127.15,105.15]' ||
      P.originalHighRoofAboveGradeMeters !== 25.75 ||
      P.floor !== 0.25 ||
      P.foundationBottom !== -1.2 ||
      P.lowWingHeightEstimateMeters !== 16.9 ||
      P.mainRoof !== 17.15 ||
      P.representedDate !== '2021-03-11' ||
      P.temporalContinuityVerified !== false ||
      P.exactLowWingPlanVerified !== false ||
      P.exactLowWingHeightVerified !== false ||
      P.unit4IdentityInferred !== true ||
      P.acceptedMainhallGeometryOrQaChanged !== false ||
      P.estimatedPlanUncertaintyMeters < 8 ||
      P.estimatedHeightUncertaintyMeters < 6 ||
      P.estimatedComponentUncertaintyMeters < 2 ||
      JSON.stringify(P.wingRings) !== JSON.stringify(expected) ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(expected[0]) ||
      JSON.stringify(f.geometry.polygons) !== JSON.stringify(expected) ||
      !f.geometryLabel.includes('NOT source groundcorners')
    )
      return fail('daiichi-west-wings-estimated-width-height-and-whole-band-controls-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Two whole low western turbine service bands complete an approximate engineering width context. Original native mainhall west edges and operator major67.6m EW/127.15/105.15m NS dimensions are bound; added low-wing plan8m/height6m/details2m/2021continuity/grade remain explicit estimates. No original ground-corner or measured low-roof claim; existing accepted mainhalls remain separate.',
    };
  } catch (error) {
    return fail('daiichi-west-wings-source-error: ' + error.message);
  }
}

function inspectReactor5({ dir, proof, P, f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s]));
    for (const s of [sources['operator-pdf'], sources['operator-text'], proof.nativeIdentity]) {
      if (
        typeof s?.path !== 'string' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..') ||
        hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256
      )
        return fail('daiichi-reactor5-source-unbound');
    }
    if (
      !['operator-pdf', 'operator-text'].every(
        (k) =>
          sources[k].url === 'https://www.tepco.co.jp/cc/press/betu11_j/images/110818h.pdf' &&
          sources[k].use === 'factual-text-and-numerical-data-only',
      ) ||
      sources['operator-pdf'].sha256 !==
        'sha256:0733a72e9c46107958879020f50c9ccb4b90b12e49435d18407e8fa5bc22e3bc'
    )
      return fail('daiichi-reactor5-original-report-unbound');
    const text = fs
        .readFileSync(path.join(dir, sources['operator-text'].path), 'utf8')
        .replace(/\s+/g, ''),
      start = text.indexOf('福島第一原子力発電所５号機原子炉建屋は'),
      section = text.slice(start, start + 1100);
    if (
      start < 0 ||
      ![
        '地上５階',
        '地下１階',
        '鉄筋コンクリート造',
        '鉄骨造（トラス構造）',
        '１、２階',
        '３、４、５階',
        '47.00',
        '35.20',
        '57.40',
        '62.11',
        '46.05',
        '構造的に分離',
      ].every((v) => section.includes(v)) ||
      !['59.05O.P.', '50.82O.P.', '42.92O.P.', '29.90O.P.', '13.20O.P.'].every((v) =>
        text.includes(v),
      )
    )
      return fail('daiichi-reactor5-whole-written-sections-missing');
    const j = JSON.parse(fs.readFileSync(path.join(dir, proof.nativeIdentity.path))),
      r = j.originalRecord,
      id = '6a8325a0-e4bc-4fa9-95ba-ca7c9394aa26',
      geo = j.geometry.coordinates[0].slice(0, -1),
      D = (6378137 * Math.PI) / 180,
      co = Math.cos((f.anchor[1] * Math.PI) / 180),
      observed = geo.map((p) => [(p[0] - f.anchor[0]) * D * co, -(p[1] - f.anchor[1]) * D]),
      lower = [
        [-17.6, -23.5],
        [29.4, -23.5],
        [29.4, 23.5],
        [-17.6, 23.5],
      ],
      upper = [
        [-17.6, -23.5],
        [17.6, -23.5],
        [17.6, 23.5],
        [-17.6, 23.5],
      ];
    if (
      r.id !== id ||
      r.names?.common?.en !== 'Unit 5' ||
      geo.length !== 4 ||
      !r.sources.some((s) => s.dataset === 'OpenStreetMap' && s.record_id === 'w103924989@16') ||
      proof.nativeIdentity.featureId !== 'overture/' + id ||
      j.fullSnapshotSha256 !==
        'sha256:a9e6721733b44d1cee9822f5ed632918b01aae9c8d7787b13ffd1e7bd72d9aeb' ||
      !f.geometryLabel.includes('NOTa native') ||
      f.heading !== 0 ||
      f.anchor.some(
        (v, k) =>
          Math.abs(
            v - (Math.min(...geo.map((p) => p[k])) + Math.max(...geo.map((p) => p[k]))) / 2,
          ) > 1e-9,
      ) ||
      JSON.stringify(P.originalUpperRoofObservation) !== JSON.stringify(observed) ||
      JSON.stringify(f.features[0].outline) !== JSON.stringify(observed)
    )
      return fail('daiichi-reactor5-original-upper-roof-registration-unbound');
    if (
      P.model !== daiichiCases[proof.case] ||
      P.parentModelIdentity !== 'fukushima_daiichi_nuclear_power_plant' ||
      P.wholeScope !== 'whole-independent-written47m-lower-35.2m-upper-Unit5-reactor-building' ||
      P.gersId !== id ||
      P.originalNativeWay !== 'w103924989@16' ||
      P.originalLowerNSMeters !== 47 ||
      P.originalLowerEWMeters !== 47 ||
      P.originalUpperNSMeters !== 47 ||
      P.originalUpperEWMeters !== 35.2 ||
      P.originalUndergroundNSMeters !== 47 ||
      P.originalUndergroundEWMeters !== 57.4 ||
      P.originalAboveGradeHeightMeters !== 46.05 ||
      P.originalFoundationToRoofHeightMeters !== 62.11 ||
      P.originalAboveGroundFloors !== 5 ||
      P.originalBelowGroundFloors !== 1 ||
      P.originalRoofOPMeters !== 59.05 ||
      P.originalFirstFloorOPMeters !== 13.2 ||
      P.originalGroundOPMeters !== 13 ||
      P.originalThirdFloorOPMeters !== 29.9 ||
      P.originalOperatingFloorOPMeters !== 42.92 ||
      P.originalCraneLevelOPMeters !== 50.82 ||
      P.originalFirstFloorToRoofHeightMeters !== 45.85 ||
      Math.abs(P.mainRoof - P.floor - 45.85) > 1e-8 ||
      Math.abs(P.lowerRoof - P.floor - 16.7) > 1e-8 ||
      Math.abs(P.concreteTop - P.floor - 37.62) > 1e-8 ||
      Math.abs(P.operatingFloorY - P.floor - 29.72) > 1e-8 ||
      P.estimatedHeightUncertaintyMeters < 3 ||
      P.estimatedHorizontalUncertaintyMeters < 8 ||
      P.estimatedComponentUncertaintyMeters < 2 ||
      P.representedDate !== '2021-05-09' ||
      P.temporalContinuityVerified !== false ||
      JSON.stringify(P.lowerRing) !== JSON.stringify(lower) ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(lower) ||
      JSON.stringify(f.geometry.polygons[0]) !== JSON.stringify(lower) ||
      JSON.stringify(P.upperRing) !== JSON.stringify(upper)
    )
      return fail('daiichi-reactor5-written-whole-body-controls-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'WholewrittenUnit5lower47x47m/upper35.2x47mreactor/46.05mabovegradeheight. Native4cornerupperroofonlyapproximateposition,notthecompletegroundfootprint. Eastterraceorientation/mapsegmentationownership/finish/2021continuityestimated;undergroundextentandinternalcontainmentomitted. Everyappearanceimageunused.',
    };
  } catch {
    return fail('daiichi-reactor5-evidence-unreadable');
  }
}

function inspectReactor6({ dir, proof, P, f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s]));
    for (const s of [sources['operator-pdf'], sources['operator-text'], proof.nativeIdentity]) {
      if (
        typeof s?.path !== 'string' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..') ||
        hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256
      )
        return fail('daiichi-reactor6-source-unbound');
    }
    if (
      !['operator-pdf', 'operator-text'].every(
        (k) =>
          sources[k].url === 'https://www.tepco.co.jp/cc/press/betu11_j/images/110818i.pdf' &&
          sources[k].use === 'factual-text-and-numerical-data-only',
      ) ||
      sources['operator-pdf'].sha256 !==
        'sha256:b33b9e00e86d502a5e24ef0b3ab6c4632e6fea6a606e440ba46b69c73cec6f6e'
    )
      return fail('daiichi-reactor6-original-report-unbound');
    const text = fs
        .readFileSync(path.join(dir, sources['operator-text'].path), 'utf8')
        .replace(/\s+/g, ''),
      start = text.indexOf('福島第一原子力発電所６号機原子炉建屋は'),
      section = text.slice(start, start + 1100);
    if (
      start < 0 ||
      ![
        '地上６階',
        '地下２階',
        '鉄筋コンクリート造',
        '鉄骨造（トラス構造）',
        '42.50',
        '45.50',
        '68.25',
        '68.50',
        '72.65',
        '55.65',
        '構造的に分離',
      ].every((v) => section.includes(v)) ||
      !['68.65O.P.', '62.00O.P.', '51.50O.P.', '13.20O.P.'].every((v) => text.includes(v))
    )
      return fail('daiichi-reactor6-whole-written-dimensions-missing');
    const j = JSON.parse(fs.readFileSync(path.join(dir, proof.nativeIdentity.path))),
      r = j.originalRecord,
      id = '7bd711f1-dd35-4b75-90f9-45b1080456bb',
      geo = j.geometry.coordinates[0].slice(0, -1),
      D = (6378137 * Math.PI) / 180,
      co = Math.cos((f.anchor[1] * Math.PI) / 180),
      ring = geo.map((p) => [(p[0] - f.anchor[0]) * D * co, -(p[1] - f.anchor[1]) * D]);
    if (
      r.id !== id ||
      r.names?.common?.en !== 'Unit 6' ||
      !r.sources.some((s) => s.dataset === 'OpenStreetMap' && s.record_id === 'w103924993@16') ||
      proof.nativeIdentity.featureId !== 'overture/' + id ||
      geo.length !== 8 ||
      j.fullSnapshotSha256 !==
        'sha256:a9e6721733b44d1cee9822f5ed632918b01aae9c8d7787b13ffd1e7bd72d9aeb' ||
      Math.abs(
        (Math.max(...geo.map((p) => p[0])) - Math.min(...geo.map((p) => p[0]))) * D * co - 45.5,
      ) > 3 ||
      Math.abs((Math.max(...geo.map((p) => p[1])) - Math.min(...geo.map((p) => p[1]))) * D - 42.5) >
        3
    )
      return fail('daiichi-reactor6-original-aboveground-identity-unbound');
    if (
      P.model !== daiichiCases[proof.case] ||
      P.parentModelIdentity !== 'fukushima_daiichi_nuclear_power_plant' ||
      P.wholeScope !== 'whole-independent-native8corner-Unit6-aboveground-reactor-building' ||
      P.gersId !== id ||
      P.originalNativeWay !== 'w103924993@16' ||
      f.heading !== 0 ||
      P.originalAboveGradeHeightMeters !== 55.65 ||
      P.originalFoundationToRoofHeightMeters !== 72.65 ||
      P.originalAboveGroundNSMeters !== 42.5 ||
      P.originalAboveGroundEWMeters !== 45.5 ||
      P.originalUndergroundNSMeters !== 68.25 ||
      P.originalUndergroundEWMeters !== 68.5 ||
      P.originalAboveGroundFloors !== 6 ||
      P.originalBelowGroundFloors !== 2 ||
      P.originalRoofOPMeters !== 68.65 ||
      P.originalFirstFloorOPMeters !== 13.2 ||
      P.originalGroundOPMeters !== 13 ||
      P.originalOperatingFloorOPMeters !== 51.5 ||
      P.originalCraneLevelOPMeters !== 62 ||
      P.originalFirstFloorToRoofHeightMeters !== 55.45 ||
      Math.abs(P.mainRoof - P.floor - 55.45) > 1e-8 ||
      Math.abs(P.concreteTop - P.floor - 48.8) > 1e-8 ||
      Math.abs(P.operatingFloorY - P.floor - 38.3) > 1e-8 ||
      P.estimatedHeightUncertaintyMeters < 3 ||
      P.estimatedHorizontalUncertaintyMeters < 8 ||
      P.estimatedComponentUncertaintyMeters < 2 ||
      P.representedDate !== '2021-05-09' ||
      P.temporalContinuityVerified !== false ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(ring) ||
      JSON.stringify(f.geometry.polygons[0]) !== JSON.stringify(ring)
    )
      return fail('daiichi-reactor6-whole-controls-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'WholeUnit6aboveground8cornernativebodyandoperator42.5x45.5m/55.65mheight/6aboveand2belowfloors. Largerundergroundextentnotextrudedaboveground, nointernalcontainmentproxy. Upperfacade/roofnotches/finish/2021continuityestimated;allappearanceimagesunused.',
    };
  } catch {
    return fail('daiichi-reactor6-evidence-unreadable');
  }
}

function inspectNorthernTurbine({ dir, proof, P, f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const six = proof.case.includes('Unit6-'),
      unit = six ? 6 : 5,
      numeral = six ? '６' : '５',
      expected = six
        ? {
            id: '080b7701-f13f-4cd3-9f2e-68ea27e872d2',
            way: 'w103924991@3',
            reactor: '7bd711f1-dd35-4b75-90f9-45b1080456bb',
            reactorWay: 'w103924993@16',
            corners: 11,
            main: [0, 1, 2, 3, 4, 5, 6],
            ns: 105.5,
            ew: 71,
            height: 32.3,
            mat: 46.1,
            thirdFloor: 33,
            lowRoof: 20.25,
          }
        : {
            id: 'ceeeb111-966e-460a-9d30-874198d3cbbd',
            way: 'w105829026@2',
            reactor: '6a8325a0-e4bc-4fa9-95ba-ca7c9394aa26',
            reactorWay: 'w103924989@16',
            corners: 13,
            main: [0, 1, 2, 3, 4, 7, 8, 9, 10, 11, 12],
            ns: 133.5,
            ew: 67.6,
            height: 25.75,
            mat: 37.35,
            thirdFloor: 29.9,
            lowRoof: 17.15,
          },
      sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s])),
      url = 'https://www.tepco.co.jp/cc/press/betu11_j/images/110818n.pdf';
    for (const s of [sources['operator-pdf'], sources['operator-text'], proof.nativeIdentity]) {
      if (
        typeof s?.path !== 'string' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..') ||
        hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256
      )
        return fail('daiichi-northern-source-unbound');
    }
    if (
      !['operator-pdf', 'operator-text'].every(
        (k) => sources[k].url === url && sources[k].use === 'factual-text-and-numerical-data-only',
      ) ||
      sources['operator-pdf'].sha256 !==
        'sha256:e91b834dcfa7c83fe9eb49b2c569750ebfa16c8655e233843f83c6d16e78824f'
    )
      return fail('daiichi-northern-original-report-unbound');
    const body = fs
        .readFileSync(path.join(dir, sources['operator-text'].path), 'utf8')
        .replace(/\s+/g, ''),
      start = body.indexOf(
        `３．${numeral}福島第一原子力発電所${numeral}号機タービン建屋３．${numeral}．１`,
      ),
      section = body.slice(start, start + 1100);
    if (
      start < 0 ||
      ![
        '地上３階、地下１階',
        '鉄筋コンクリート造',
        '鉄骨造（トラス構造）',
        expected.ns.toFixed(2),
        expected.ew.toFixed(2),
        expected.height.toFixed(2),
        expected.mat.toFixed(2),
        '構造的に分離',
      ].every((v) => section.includes(v))
    )
      return fail('daiichi-northern-unit-specific-dimensions-missing');
    const j = JSON.parse(fs.readFileSync(path.join(dir, proof.nativeIdentity.path))),
      r = j.originalRecord,
      geo = j.geometry.coordinates[0].slice(0, -1),
      adjacent = j.spatialIdentity?.reactor,
      rr = adjacent?.originalRecord,
      rg = adjacent?.geometry?.coordinates?.[0]?.slice(0, -1),
      D = (6378137 * Math.PI) / 180,
      co = Math.cos((f.anchor[1] * Math.PI) / 180),
      ring = geo.map((p) => [(p[0] - f.anchor[0]) * D * co, -(p[1] - f.anchor[1]) * D]);
    if (
      r.id !== expected.id ||
      !r.sources.some((s) => s.dataset === 'OpenStreetMap' && s.record_id === expected.way) ||
      proof.nativeIdentity.featureId !== 'overture/' + expected.id ||
      geo.length !== expected.corners ||
      j.fullSnapshotSha256 !==
        'sha256:a9e6721733b44d1cee9822f5ed632918b01aae9c8d7787b13ffd1e7bd72d9aeb' ||
      rr?.id !== expected.reactor ||
      rr.names?.common?.en !== 'Unit ' + unit ||
      !rr.sources.some((s) => s.record_id === expected.reactorWay) ||
      !rg ||
      geo.filter((p) => rg.some((v) => p[0] === v[0] && p[1] === v[1])).length < 2 ||
      j.spatialIdentity.inferredIdentity !== true ||
      f.mappedIdentity.inferredIdentity !== true
    )
      return fail('daiichi-northern-native-reactor-adjacency-unbound');
    if (
      P.model !== daiichiCases[proof.case] ||
      P.unit !== unit ||
      P.parentModelIdentity !== 'fukushima_daiichi_nuclear_power_plant' ||
      P.wholeScope !==
        `whole-independent-native-Unit${unit}-turbine-building-with-intrinsic-services` ||
      P.gersId !== expected.id ||
      P.originalNativeWay !== expected.way ||
      P.inferredIdentity !== true ||
      f.heading !== 0 ||
      P.originalAboveGradeHeightMeters !== expected.height ||
      P.originalFoundationToRoofHeightMeters !== expected.mat ||
      P.originalMainPlanNSMeters !== expected.ns ||
      P.originalMainPlanEWMeters !== expected.ew ||
      P.originalEngineeringThirdFloorOPMeters !== expected.thirdFloor ||
      P.originalEngineeringGroundOPMeters !== 13 ||
      P.lowerRoof !== expected.lowRoof ||
      Math.abs(P.mainRoof - P.floor - expected.height) > 1e-8 ||
      P.originalAboveGroundFloors !== 3 ||
      P.originalBelowGroundFloors !== 1 ||
      P.estimatedMainHeightUncertaintyMeters < 3 ||
      P.estimatedTierHeightUncertaintyMeters < 6 ||
      P.estimatedHorizontalUncertaintyMeters < 8 ||
      P.estimatedComponentUncertaintyMeters < 2 ||
      P.representedDate !== '2019-11-09' ||
      P.temporalContinuityVerified !== false ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(ring) ||
      JSON.stringify(f.geometry.polygons[0]) !== JSON.stringify(ring) ||
      JSON.stringify(P.mainIndices) !== JSON.stringify(expected.main) ||
      JSON.stringify(P.mainRing) !== JSON.stringify(expected.main.map((i) => ring[i]))
    )
      return fail('daiichi-northern-whole-building-controls-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes: `Whole${expected.corners}corner nativeUnit${unit}turbineenvelope, identityinferredfromexactsharedoriginalcornerswithnamedreactor/operatorunit-specificengineeringdimensions. Maximum${expected.height}mheightassignedwith3muncertainty; roofpartitions/lowservices6muncertainty, finish/2019continuityestimated. Every sourceimageunused;parentplantunfinished.`,
    };
  } catch {
    return fail('daiichi-northern-evidence-unreadable');
  }
}

function inspectReactor({ dir, proof, P, f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s]));
    for (const key of ['regulator', 'operator']) {
      const url =
        key === 'regulator'
          ? 'https://www.da.nra.go.jp/data/NRA039003856-002-002.pdf'
          : 'https://www.tepco.co.jp/press/release/2017/pdf1/170626j0202.pdf';
      for (const ext of ['pdf', 'txt']) {
        const s = sources[key + '-' + ext];
        if (
          typeof s?.path !== 'string' ||
          path.isAbsolute(s.path) ||
          s.path.split(/[\\/]/).includes('..') ||
          s.url !== url ||
          s.use !== 'factual-text-and-numerical-data-only' ||
          hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256
        )
          return fail('daiichi-reactor-primary-source-unbound');
      }
    }
    if (
      sources['regulator-pdf'].sha256 !==
        'sha256:cdb94becd4f5503aa603b188b7c258e6883a4b6e7a798ad918c96aaf2065333b' ||
      sources['operator-pdf'].sha256 !==
        'sha256:78a43646e4c50a7c7e5b247fdb91e2801c3b61baf6730dfe36145af6cd40bef4'
    )
      return fail('daiichi-reactor-original-report-unbound');
    const text = (k) =>
        fs.readFileSync(path.join(dir, sources[k + '-txt'].path), 'utf8').replace(/\s+/g, ''),
      regulator = text('regulator'),
      operator = text('operator');
    if (
      ![
        '第２号機原子炉建屋西側開口設置後',
        'O.P.55.72',
        'O.P.10.20',
        'O.P.39.92',
        'O.P.-6.06',
        '45.72',
        '61.78',
      ].every((v) => regulator.includes(v)) ||
      ![
        '第２号機原子炉建屋',
        '西側外壁の開口設置',
        '鉄骨造',
        '鋼製折板',
        '約10ｍ',
        '約16ｍ',
        '約22ｍ',
        '地上約30ｍ',
      ].every((v) => operator.includes(v))
    )
      return fail('daiichi-reactor-written-numerical-dimensions-missing');
    const source = proof.nativeIdentity;
    if (
      typeof source?.path !== 'string' ||
      path.isAbsolute(source.path) ||
      source.path.split(/[\\/]/).includes('..') ||
      hash(fs.readFileSync(path.join(dir, source.path))) !== source.sha256
    )
      return fail('daiichi-reactor-native-hash-unbound');
    const j = JSON.parse(fs.readFileSync(path.join(dir, source.path))),
      id = '42a6b356-072a-41a7-b867-0d26fd4348da',
      r = j.originalRecord,
      geo = j.geometry.coordinates[0].slice(0, -1),
      D = (6378137 * Math.PI) / 180,
      co = Math.cos((f.anchor[1] * Math.PI) / 180),
      ring = geo.map((p) => [(p[0] - f.anchor[0]) * D * co, -(p[1] - f.anchor[1]) * D]);
    if (
      r.id !== id ||
      r.names.common.en !== 'Fukushima-Daiichi Nuclear Power Station 2 containment building' ||
      !r.sources.some((s) => s.dataset === 'OpenStreetMap' && s.record_id === 'w743332917@1') ||
      source.featureId !== 'overture/' + id ||
      geo.length !== 14 ||
      f.heading !== 0 ||
      j.fullSnapshotSha256 !==
        'sha256:21bbe1ec8f0fd58410912455a1e4cf7033364eb67ed50872d59454690ce20606'
    )
      return fail('daiichi-reactor-native-identity-unbound');
    if (
      P.model !== daiichiCases[proof.case] ||
      P.parentModelIdentity !== 'fukushima_daiichi_nuclear_power_plant' ||
      P.wholeScope !== 'whole-independent-Unit2-exterior-reactor-with-intrinsic-west-access' ||
      P.gersId !== id ||
      P.originalNativeWay !== 'w743332917@1' ||
      P.originalRoofOPMeters !== 55.72 ||
      P.originalGroundOPMeters !== 10 ||
      P.originalFirstFloorOPMeters !== 10.2 ||
      P.originalOperatingFloorOPMeters !== 39.92 ||
      P.originalMatBottomOPMeters !== -6.06 ||
      P.originalAboveGradeHeightMeters !== 45.72 ||
      P.originalFirstFloorToRoofHeightMeters !== 45.52 ||
      Math.abs(P.mainRoof - P.floor - 45.52) > 1e-8 ||
      Math.abs(P.concreteTop - P.floor - 29.72) > 1e-8 ||
      P.chamberTop - P.chamberBottom !== 10 ||
      P.chamberBottom !== 30.25 ||
      P.originalChamberDimensionsMeters.height !== 10 ||
      P.originalChamberDimensionsMeters.eastWest !== 16 ||
      P.originalChamberDimensionsMeters.northSouth !== 22 ||
      P.estimatedLowServiceHeightUncertaintyMeters < 3 ||
      P.estimatedHorizontalUncertaintyMeters < 8 ||
      P.estimatedComponentUncertaintyMeters < 2 ||
      P.representedDate !== '2019-11-09' ||
      P.temporalContinuityVerified !== false ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(ring) ||
      JSON.stringify(f.geometry.polygons[0]) !== JSON.stringify(ring) ||
      JSON.stringify(P.mainRing) !== JSON.stringify([1, 0, 13, 12].map((i) => ring[i])) ||
      JSON.stringify(P.chamberRing) !==
        JSON.stringify([ring[2], ring[3], ring[4], [ring[2][0], ring[4][1]]]) ||
      JSON.stringify(P.serviceRing) !== JSON.stringify([7, 8, 9, 10].map((i) => ring[i]))
    )
      return fail('daiichi-reactor-whole-controls-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Unit2 exterior reactor,14nativeenvelopecorners, original regulator roof/operating-floor heights and operator suspendedsteelaccesschamber dimensions. Native section interpretation/gantry/stairs/finish/2019continuity estimated; no source images. Internal containment/wholeplant not substituted.',
    };
  } catch {
    return fail('daiichi-reactor-evidence-unreadable');
  }
}

function inspectCover3({ dir, proof, P, f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s]));
    for (const s of [...proof.primarySources, proof.nativeIdentity]) {
      if (
        typeof s?.path !== 'string' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..') ||
        hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256
      )
        return fail('daiichi-cover-original-source-unbound');
    }
    for (const key of ['structure-pdf', 'structure-text', 'operation-pdf', 'operation-text']) {
      const id = key.startsWith('structure') ? 'NRA022011428-002-013' : 'NRA039003611-002-002';
      if (
        sources[key]?.url !== 'https://www.da.nra.go.jp/data/' + id + '.pdf' ||
        sources[key].use !== 'factual-text-and-numerical-data-only'
      )
        return fail('daiichi-cover-original-public-archive-unbound');
    }
    if (
      sources['structure-pdf'].sha256 !==
        'sha256:cfb005529f920f5f30c893d900024a539fffd89330471dc07f5b28532d6b4c1b' ||
      sources['operation-pdf'].sha256 !==
        'sha256:4c87e70aec49410d7fc161e6cc749016edcf7c1e29bed4f64eb03d6005ed4397'
    )
      return fail('daiichi-cover-original-pdf-identity-unbound');
    const t = fs
      .readFileSync(path.join(dir, sources['structure-text'].path), 'utf8')
      .replace(/\s+/g, '');
    if (
      ![
        '東西約57.0m、南北約22.8m、高さ53.5m',
        '鉄骨構造物',
        '折板',
        '軽量の鉄骨トラス構造',
        '建屋１、３階部にコンクリート造',
        'ドーム屋根',
        '軒高さ（47.60m）',
        '最高高さ（53.50m）',
        '36.0m17.5m',
        'O.P.10,500',
        'O.P.26,900',
        'O.P.46,000',
        '63.50',
      ].every((v) => t.includes(v))
    )
      return fail('daiichi-cover-written-whole-sections-missing');
    const operation = fs
      .readFileSync(path.join(dir, sources['operation-text'].path), 'utf8')
      .replace(/\s+/g, '');
    if (
      !['3号機燃料取出し用カバー排気設備', '２０１８年３月８日', '運用開始'].every((v) =>
        operation.includes(v),
      )
    )
      return fail('daiichi-cover-operation-era-unbound');
    const j = JSON.parse(fs.readFileSync(path.join(dir, proof.nativeIdentity.path))),
      r = j.originalRecord,
      geo = j.geometry.coordinates[0].slice(0, -1),
      id = '1a07336c-51b8-41a7-b3c5-dd22e664f80a',
      indices = [8, 9, 10, 2, 7],
      context = indices.map((i) => geo[i]),
      anchor = [0, 1].map(
        (k) => (Math.min(...context.map((p) => p[k])) + Math.max(...context.map((p) => p[k]))) / 2,
      ),
      D = (6378137 * Math.PI) / 180,
      co = Math.cos((f.anchor[1] * Math.PI) / 180),
      observed = geo.map((p) => [(p[0] - f.anchor[0]) * D * co, -(p[1] - f.anchor[1]) * D]),
      ring = [
        [-28.5, -11.4],
        [28.5, -11.4],
        [28.5, 11.4],
        [-28.5, 11.4],
      ];
    if (
      r.id !== id ||
      !r.names.primary.includes('3 containment building') ||
      !r.sources.some((s) => s.dataset === 'OpenStreetMap' && s.record_id === 'w743332913@1') ||
      geo.length !== 13 ||
      proof.nativeIdentity.featureId !== 'overture/' + id ||
      j.fullSnapshotSha256 !==
        'sha256:21bbe1ec8f0fd58410912455a1e4cf7033364eb67ed50872d59454690ce20606' ||
      JSON.stringify(j.registrationContextIndices) !== JSON.stringify(indices) ||
      JSON.stringify(j.registrationContext) !== JSON.stringify(context) ||
      anchor.some((v, k) => Math.abs(v - f.anchor[k]) > 1e-12) ||
      f.heading !== 0 ||
      !f.geometryLabel.includes('NOT native')
    )
      return fail('daiichi-cover-native-context-registration-unbound');
    const values = {
      originalPlanEWMeters: 57,
      originalPlanNSMeters: 22.8,
      originalAboveGradeHeightMeters: 53.5,
      originalEaveHeightMeters: 47.6,
      originalWorkFloorHeightMeters: 36,
      originalWestBearingOPMeters: 10.5,
      originalEastBearingOPMeters: 26.9,
      originalCrownOPMeters: 63.5,
      inferredGroundOPMeters: 10,
      floor: 0.5,
      foundationBottom: -1.2,
      westBearingTop: 0.5,
      eastBearingBottom: 16.3,
      eastBearingTop: 16.9,
      workFloor: 36,
      eave: 47.6,
      mainRoof: 53.5,
      roofThickness: 0.16,
      halfLength: 28.5,
      halfWidth: 11.4,
      towerX: 26.6,
      towerZ: 9.25,
      towerHalfSection: 0.75,
      towerChord: 0.24,
      girderDepth: 1.4,
    };
    if (
      Object.entries(values).some(([k, v]) => P[k] !== v) ||
      Math.abs(P.roofRadius - (11.4 * 11.4 + 5.9 * 5.9) / (2 * 5.9)) > 1e-9 ||
      P.model !== daiichiCases[proof.case] ||
      P.parentModelIdentity !== 'fukushima_daiichi_nuclear_power_plant' ||
      P.wholeScope !== 'whole-independent-Unit3-fuel-removal-cover-and-portal-frame' ||
      P.gersId !== id ||
      P.originalNativeWay !== 'w743332913@1' ||
      P.representedDate !== '2019-11-08' ||
      P.temporalContinuityVerified !== false ||
      P.underlyingReactorCompleted !== false ||
      P.estimatedBearingSideAssignment !== true ||
      P.estimatedHorizontalUncertaintyMeters < 8 ||
      P.estimatedComponentUncertaintyMeters < 2 ||
      P.estimatedHeightUncertaintyMeters < 3 ||
      JSON.stringify(P.coverRing) !== JSON.stringify(ring) ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(ring) ||
      JSON.stringify(f.geometry.polygons[0]) !== JSON.stringify(ring) ||
      JSON.stringify(P.originalUnit3EnvelopeObservation) !== JSON.stringify(observed)
    )
      return fail('daiichi-cover-whole-written-controls-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Original archived operator written whole57x22.8m/53.5m steel-truss dome cover,47.6m eaves/36m workfloor and numeric bearing levels bound. Native Unit3 envelope registers cover approximately, not exact cover corners. Circular roof interpolation/bearing-side assignment/fine finish/2019continuity estimated. Underlying damaged reactor and whole plant remain unfinished.',
    };
  } catch (error) {
    return fail('daiichi-cover-source-error: ' + error.message);
  }
}

function inspectCover4({ dir, proof, P, f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s]));
    for (const s of [...proof.primarySources, proof.nativeIdentity]) {
      if (
        typeof s?.path !== 'string' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..') ||
        hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256
      )
        return fail('daiichi-cover4-original-source-unbound');
    }
    for (const key of ['dimensions-pdf', 'dimensions-text', 'comparison-pdf', 'comparison-text']) {
      const url = key.startsWith('dimensions')
        ? 'https://www.tepco.co.jp/press/release/2017/pdf1/170626j0202.pdf'
        : 'https://www.da.nra.go.jp/data/NRA022011428-002-013.pdf';
      if (sources[key]?.url !== url || sources[key].use !== 'factual-text-and-numerical-data-only')
        return fail('daiichi-cover4-primary-source-role-unbound');
    }
    if (
      sources['dimensions-pdf'].sha256 !==
        'sha256:78a43646e4c50a7c7e5b247fdb91e2801c3b61baf6730dfe36145af6cd40bef4' ||
      sources['comparison-pdf'].sha256 !==
        'sha256:cfb005529f920f5f30c893d900024a539fffd89330471dc07f5b28532d6b4c1b'
    )
      return fail('daiichi-cover4-original-pdf-identity-unbound');
    const t = fs
        .readFileSync(path.join(dir, sources['dimensions-text'].path), 'utf8')
        .replace(/\s+/g, ''),
      start = t.indexOf('（４号機）a.燃料取り出し用カバー'),
      section = t.slice(start, start + 550);
    if (
      start < 0 ||
      ![
        '鉄骨造',
        '約69m（南北）×約31m（東西）×約53m（地上高）',
        '約55m（南北）×約31m（東西）×約23m',
        'オペレーティングフロア上部高さ',
      ].every((v) => section.includes(v))
    )
      return fail('daiichi-cover4-written-whole-enclosure-dimensions-missing');
    const comparison = fs
      .readFileSync(path.join(dir, sources['comparison-text'].path), 'utf8')
      .replace(/\s+/g, '');
    if (
      ![
        '大型の鉄骨柱・梁構造物とし、建屋と分離設置',
        '地盤改良等による独立基礎で支持',
        '３号機４号機',
      ].every((v) => comparison.includes(v))
    )
      return fail('daiichi-cover4-independent-ground-frame-unbound');
    const j = JSON.parse(fs.readFileSync(path.join(dir, proof.nativeIdentity.path))),
      r = j.originalRecord,
      geo = j.geometry.coordinates[0].slice(0, -1),
      id = 'dd782e95-18b3-4f13-bb1f-ceba91cb18a1',
      indices = [3, 4, 5, 6, 7, 8, 9, 10, 11],
      context = indices.map((i) => geo[i]),
      anchor = [0, 1].map(
        (k) => (Math.min(...context.map((p) => p[k])) + Math.max(...context.map((p) => p[k]))) / 2,
      ),
      D = (6378137 * Math.PI) / 180,
      co = Math.cos((f.anchor[1] * Math.PI) / 180),
      observed = geo.map((p) => [(p[0] - f.anchor[0]) * D * co, -(p[1] - f.anchor[1]) * D]),
      ring = [
        [-15.5, -34.5],
        [15.5, -34.5],
        [15.5, 34.5],
        [-15.5, 34.5],
      ],
      working = [
        [-15.5, -27.5],
        [15.5, -27.5],
        [15.5, 27.5],
        [-15.5, 27.5],
      ],
      north = j.spatialIdentity?.northernNamedUnit3,
      east = j.spatialIdentity?.easternUnit4Turbine;
    if (
      r.id !== id ||
      r.names !== null ||
      !r.sources.some((s) => s.dataset === 'OpenStreetMap' && s.record_id === 'w915666707@1') ||
      geo.length !== 14 ||
      proof.nativeIdentity.featureId !== 'overture/' + id ||
      j.fullSnapshotSha256 !==
        'sha256:21bbe1ec8f0fd58410912455a1e4cf7033364eb67ed50872d59454690ce20606' ||
      JSON.stringify(j.registrationContextIndices) !== JSON.stringify(indices) ||
      JSON.stringify(j.registrationContext) !== JSON.stringify(context) ||
      anchor.some((v, k) => Math.abs(v - f.anchor[k]) > 1e-12) ||
      f.heading !== 0 ||
      !f.geometryLabel.includes('NOT native') ||
      j.spatialIdentity.inferredIdentity !== true ||
      j.spatialIdentity.unit4TurbineIdentityAlsoInferred !== true ||
      north?.id !== '1a07336c-51b8-41a7-b3c5-dd22e664f80a' ||
      !north.names.primary.includes('3 containment building') ||
      east?.id !== '2416fa45-f3f7-4906-859c-6ad68cb95c98' ||
      r.bbox.xmax >= east.bbox.xmin ||
      r.bbox.ymax >= north.bbox.ymin
    )
      return fail('daiichi-cover4-inferred-native-sequence-context-unbound');
    const values = {
      originalPlanNSMeters: 69,
      originalPlanEWMeters: 31,
      originalAboveGradeHeightMeters: 53,
      originalWorkingNSMeters: 55,
      originalWorkingEWMeters: 31,
      originalWorkingAboveOperatingHeightMeters: 23,
      inferredOperatingFloorAboveGradeMeters: 30,
      floor: 0.25,
      foundationBottom: -1.2,
      workFloor: 30,
      mainRoof: 53,
      roofThickness: 0.25,
      halfWidth: 15.5,
      halfLength: 34.5,
      workingHalfLength: 27.5,
      columnX: 14.25,
      columnWidth: 0.65,
      columnDepth: 0.8,
      flangeThickness: 0.065,
      webThickness: 0.055,
    };
    if (
      Object.entries(values).some(([k, v]) => P[k] !== v) ||
      P.model !== daiichiCases[proof.case] ||
      P.parentModelIdentity !== 'fukushima_daiichi_nuclear_power_plant' ||
      P.wholeScope !== 'whole-independent-Unit4-fuel-removal-cover-and-ground-frame' ||
      P.gersId !== id ||
      P.originalNativeWay !== 'w915666707@1' ||
      P.representedDate !== '2021-03-11' ||
      P.temporalContinuityVerified !== false ||
      P.underlyingReactorCompleted !== false ||
      P.nativeIdentityInferred !== true ||
      P.estimatedHorizontalUncertaintyMeters < 8 ||
      P.estimatedComponentUncertaintyMeters < 2 ||
      P.estimatedHeightUncertaintyMeters < 3 ||
      P.estimatedEnclosureLongitudinalUncertaintyMeters < 7 ||
      JSON.stringify(P.columnStations) !== JSON.stringify([-33.2, -11.1, 11.1, 33.2]) ||
      JSON.stringify(P.beamLevels) !== JSON.stringify([15, 30, 41.5, 52.75]) ||
      JSON.stringify(P.frameRing) !== JSON.stringify(ring) ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(ring) ||
      JSON.stringify(f.geometry.polygons[0]) !== JSON.stringify(ring) ||
      JSON.stringify(P.workingRing) !== JSON.stringify(working) ||
      JSON.stringify(P.originalUnit4EnvelopeObservation) !== JSON.stringify(observed)
    )
      return fail('daiichi-cover4-whole-written-controls-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Original written69NSx31EWx53m steel ground frame/55NSx31EWx23m working enclosure bound; operating floor30m inferred. Native Unit4 identity and southern part registration inferred from source sequence, not exact cover ground corners. Enclosure longitudinal placement7m/sections-finish2m estimated; underlying reactor and whole parent remain unfinished.',
    };
  } catch (error) {
    return fail('daiichi-cover4-source-error: ' + error.message);
  }
}

function inspectRemainingReactor3({ dir, proof, P, f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s]));
    for (const s of [...proof.primarySources, proof.nativeIdentity]) {
      if (
        typeof s?.path !== 'string' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..') ||
        hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256
      )
        return fail('daiichi-remaining3-source-unbound');
    }
    for (const key of [
      'dimensions-extracted',
      'damage-pdf',
      'damage-text',
      'remaining-pdf',
      'remaining-text',
    ]) {
      const url =
        key === 'dimensions-extracted'
          ? 'https://www.tepco.co.jp/nu/f1-np/press_f1/2010/pdfdata/bi0508-j.pdf'
          : key.startsWith('damage')
            ? 'https://www.pref.fukushima.lg.jp/uploaded/attachment/41642.pdf'
            : 'https://www.da.nra.go.jp/data/NRA022011428-002-013.pdf';
      if (
        sources[key]?.url !== url ||
        sources[key].use !== 'factual-text-and-numerical-data-only' ||
        sources[key].originalPDFBinaryRetrieved !== (key !== 'dimensions-extracted')
      )
        return fail('daiichi-remaining3-primary-role-unbound');
    }
    if (
      sources['damage-pdf'].sha256 !==
        'sha256:e4efbe3ef5168fc81eb34a773d0a45158379da34abca0f42a27aa7d0523d8e2c' ||
      sources['remaining-pdf'].sha256 !==
        'sha256:cfb005529f920f5f30c893d900024a539fffd89330471dc07f5b28532d6b4c1b' ||
      sources['dimensions-extracted'].sha256 !==
        'sha256:d16509543f2fde1ff1fcd17f6d4066d8b550eb7c16a2b023cb26f33ce1b21df4' ||
      sources['dimensions-extracted'].retrieval !== 'web-search-extracted-cache'
    )
      return fail('daiichi-remaining3-original-and-extracted-record-identities-unbound');
    const dims = JSON.parse(fs.readFileSync(path.join(dir, sources['dimensions-extracted'].path))),
      v = dims.facts,
      expected = {
        unit: 3,
        lowerPlanNSMeters: 47,
        lowerPlanEWMeters: 47,
        upperPlanNSMeters: 47,
        upperPlanEWMeters: 35.2,
        undergroundPlanNSMeters: 47,
        undergroundPlanEWMeters: 57.4,
        preaccidentAboveGradeHeightMeters: 45.72,
        preaccidentFoundationToRoofHeightMeters: 61.78,
        aboveGroundFloors: 5,
        belowGroundFloors: 1,
      };
    if (
      dims.sourceUrl !== sources['dimensions-extracted'].url ||
      dims.additionalSourceUrl !== 'https://www.tepco.co.jp/nu/material/files/ka10061701.pdf' ||
      dims.retrieval !== 'web-search-extracted-cache' ||
      dims.originalPDFBinaryRetrieved !== false ||
      Object.entries(expected).some(([k, n]) => v[k] !== n) ||
      JSON.stringify(v.lowerFloors) !== '[1,2]' ||
      JSON.stringify(v.upperFloors) !== '[3,4,5]' ||
      v.wallOuterFaceDimensions !== true
    )
      return fail('daiichi-remaining3-cached-written-dimensions-disagree');
    const damage = fs
        .readFileSync(path.join(dir, sources['damage-text'].path), 'utf8')
        .replace(/\s+/g, ''),
      start = damage.indexOf('３号機原子炉建屋の耐震安全性評価～概要～'),
      section = damage.slice(start, start + 1100);
    if (
      start < 0 ||
      ![
        '39.92',
        '32.30',
        '26.90',
        '18.70',
        '10.20',
        '５階の北西部の床が損傷',
        '４階の壁のかなりの部分が損傷',
        '５階のオペレーティングフロアより上部が破損',
      ].every((s) => section.includes(s))
    )
      return fail('daiichi-remaining3-original-postdamage-condition-unbound');
    const remaining = fs
      .readFileSync(path.join(dir, sources['remaining-text'].path), 'utf8')
      .replace(/\s+/g, '');
    if (
      !['原子炉建屋5階質点（O.P.39.92m）', '39.9232.3026.9018.7010.20'].every((s) =>
        remaining.includes(s),
      )
    )
      return fail('daiichi-remaining3-original-remaining-floor-levels-unbound');
    const j = JSON.parse(fs.readFileSync(path.join(dir, proof.nativeIdentity.path))),
      r = j.originalRecord,
      geo = j.geometry.coordinates[0].slice(0, -1),
      id = '1a07336c-51b8-41a7-b3c5-dd22e664f80a',
      indices = [6, 4, 3, 7],
      ctx = indices.map((i) => geo[i]),
      anchor = [
        (Math.min(...ctx.map((p) => p[0])) + Math.max(...ctx.map((p) => p[0]))) / 2,
        (geo[6][1] + geo[10][1]) / 2,
      ],
      D = (6378137 * Math.PI) / 180,
      co = Math.cos((f.anchor[1] * Math.PI) / 180),
      observed = geo.map((p) => [(p[0] - f.anchor[0]) * D * co, -(p[1] - f.anchor[1]) * D]),
      lower = [
        [-17.6, -23.5],
        [29.4, -23.5],
        [29.4, 23.5],
        [-17.6, 23.5],
      ],
      upper = [
        [-17.6, -23.5],
        [17.6, -23.5],
        [17.6, 23.5],
        [-17.6, 23.5],
      ],
      deck = [
        [-8.6, -23.5],
        [17.6, -23.5],
        [17.6, 23.5],
        [-17.6, 23.5],
        [-17.6, -15.5],
        [-8.6, -15.5],
      ];
    if (
      r.id !== id ||
      !r.names.primary.includes('3 containment building') ||
      !r.sources.some((s) => s.dataset === 'OpenStreetMap' && s.record_id === 'w743332913@1') ||
      geo.length !== 13 ||
      proof.nativeIdentity.featureId !== 'overture/' + id ||
      j.fullSnapshotSha256 !==
        'sha256:21bbe1ec8f0fd58410912455a1e4cf7033364eb67ed50872d59454690ce20606' ||
      JSON.stringify(j.upperContextIndices) !== JSON.stringify(indices) ||
      JSON.stringify(j.upperContext) !== JSON.stringify(ctx) ||
      JSON.stringify(j.fullBodyNorthSouthContextIndices) !== '[6,10]' ||
      anchor.some((v, k) => Math.abs(v - f.anchor[k]) > 1e-12) ||
      f.heading !== 0 ||
      !f.geometryLabel.includes('NOT native')
    )
      return fail('daiichi-remaining3-original-native-registration-unbound');
    const controls = {
      originalLowerNSMeters: 47,
      originalLowerEWMeters: 47,
      originalUpperNSMeters: 47,
      originalUpperEWMeters: 35.2,
      originalUndergroundNSMeters: 47,
      originalUndergroundEWMeters: 57.4,
      originalPreaccidentAboveGradeHeightMeters: 45.72,
      originalPreaccidentFoundationToRoofMeters: 61.78,
      originalFirstFloorOPMeters: 10.2,
      originalSecondFloorOPMeters: 18.7,
      originalThirdFloorOPMeters: 26.9,
      originalFourthFloorOPMeters: 32.3,
      originalOperatingFloorOPMeters: 39.92,
      inferredGroundOPMeters: 10,
      floor: 0.25,
      foundationBottom: -1.2,
      lowerRoof: 16.95,
      fourthFloor: 22.35,
      mainRoof: 29.97,
      deckThickness: 0.4,
      remainingWallThickness: 0.4,
      upperColumnWidth: 0.65,
    };
    if (
      Object.entries(controls).some(([k, n]) => P[k] !== n) ||
      P.model !== daiichiCases[proof.case] ||
      P.parentModelIdentity !== 'fukushima_daiichi_nuclear_power_plant' ||
      P.wholeScope !== 'whole-remaining-postexplosion-Unit3-concrete-reactor-building' ||
      P.gersId !== id ||
      P.originalNativeWay !== 'w743332913@1' ||
      P.representedDate !== '2019-11-08' ||
      P.temporalContinuityVerified !== false ||
      P.preaccidentRoofRestored !== false ||
      P.separateCoverIncluded !== false ||
      P.exactDamageScarsVerified !== false ||
      P.estimatedDamageEnvelopeUncertaintyMeters < 10 ||
      P.estimatedHorizontalUncertaintyMeters < 8 ||
      P.estimatedHeightUncertaintyMeters < 3 ||
      P.estimatedComponentUncertaintyMeters < 2 ||
      JSON.stringify(P.estimatedNorthwestDeckNotchMeters) !== '[9,8]' ||
      JSON.stringify(P.lowerRing) !== JSON.stringify(lower) ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(lower) ||
      JSON.stringify(f.geometry.polygons[0]) !== JSON.stringify(lower) ||
      JSON.stringify(P.upperRing) !== JSON.stringify(upper) ||
      JSON.stringify(P.damagedDeckRing) !== JSON.stringify(deck) ||
      JSON.stringify(P.originalEnvelopeObservation) !== JSON.stringify(observed) ||
      JSON.stringify(P.residualWalls) !==
        JSON.stringify([
          { x0: 17.2, x1: 17.6, z0: -23.5, z1: -17.5 },
          { x0: 17.2, x1: 17.6, z0: 17.5, z1: 23.5 },
          { x0: -8.6, x1: -2.6, z0: -23.5, z1: -23.1 },
          { x0: -17.6, x1: -10.6, z0: 23.1, z1: 23.5 },
        ])
    )
      return fail('daiichi-remaining3-whole-body-and-postdamage-controls-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole remaining concrete reactor body with written47m lower/35.2m upper widths and original postdamage floor/condition text bound. Horizontal dimensions honestly labelled indexed primary-text cache, not originalPDFbytes. Open4Fframe/NWdeckloss/residualwalls10m uncertainty; no original intact roof, internal containment or separate-cover duplicate. Native registration/2019continuity estimated.',
    };
  } catch (error) {
    return fail('daiichi-remaining3-source-error: ' + error.message);
  }
}

function inspectRemainingReactor4({ dir, proof, P, f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s]));
    for (const s of [...proof.primarySources, proof.nativeIdentity]) {
      if (
        typeof s?.path !== 'string' ||
        path.isAbsolute(s.path) ||
        s.path.split(/[\\/]/).includes('..') ||
        hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256
      )
        return fail('daiichi-remaining4-source-unbound');
    }
    const context = sources['unit4-context-extracted'];
    if (
      context?.url !== 'https://www.tepco.co.jp/cc/press/betu12_j/images/120625j0201.pdf' ||
      context.retrieval !== 'web-search-extracted-cache' ||
      context.originalPDFBinaryRetrieved !== false ||
      context.use !== 'factual-text-and-numerical-data-only'
    )
      return fail('daiichi-remaining4-extracted-context-role-unbound');
    for (const key of ['damage-pdf', 'damage-text']) {
      if (
        sources[key]?.url !== 'https://www.pref.fukushima.lg.jp/uploaded/attachment/41642.pdf' ||
        sources[key].use !== 'factual-text-and-numerical-data-only' ||
        sources[key].originalPDFBinaryRetrieved !== true
      )
        return fail('daiichi-remaining4-original-damage-source-role-unbound');
    }
    if (
      sources['damage-pdf'].sha256 !==
      'sha256:e4efbe3ef5168fc81eb34a773d0a45158379da34abca0f42a27aa7d0523d8e2c'
    )
      return fail('daiichi-remaining4-original-damage-pdf-unbound');
    const facts = JSON.parse(fs.readFileSync(path.join(dir, context.path))),
      obs = facts.primaryObservations,
      choices = facts.chosenAbovegroundEstimates;
    if (
      facts.retrieval !== 'web-search-extracted-cache' ||
      facts.originalPDFBinaryRetrieved !== false ||
      obs.length !== 2 ||
      obs[0].url !== context.url ||
      obs[0].factRole !== 'foundation-shape-only' ||
      obs[0].foundationNSMeters !== 49 ||
      obs[0].foundationEWMeters !== 57.4 ||
      obs[0].abovegroundDimensionsProven !== false ||
      obs[1].url !== 'https://www.nra.go.jp/data/000325406.pdf' ||
      obs[1].factRole !== 'approximate-exterior-width-reasonableness-only' ||
      obs[1].approximateUnit2To4ExteriorWidthMeters !== 46 ||
      obs[1].exactLowerOrUpperFootprintProven !== false ||
      obs[1].heightLabelsAdopted !== false ||
      JSON.stringify([
        choices.lowerNSMeters,
        choices.lowerEWMeters,
        choices.upperNSMeters,
        choices.upperEWMeters,
        choices.planUncertaintyMeters,
      ]) !== '[49,47,49,38,8]'
    )
      return fail('daiichi-remaining4-foundation-versus-estimated-aboveground-role-disagrees');
    const text = fs
        .readFileSync(path.join(dir, sources['damage-text'].path), 'utf8')
        .replace(/\s+/g, ''),
      start = text.indexOf('４号機原子炉建屋の耐震安全性評価～概要～'),
      section = text.slice(start, start + 1100);
    if (
      start < 0 ||
      ![
        '56.05',
        '39.92',
        '32.30',
        '26.90',
        '18.70',
        '10.20',
        '現在５階以上は撤去済み',
        '４階の壁の大部分と、３階の一部の壁が破損',
      ].every((s) => section.includes(s)) ||
      !/[1１]～[2２]階の外壁は損傷していません/.test(text)
    )
      return fail('daiichi-remaining4-original-postdamage-condition-and-floor-levels-unbound');
    const j = JSON.parse(fs.readFileSync(path.join(dir, proof.nativeIdentity.path))),
      r = j.originalRecord,
      geo = j.geometry.coordinates[0].slice(0, -1),
      id = 'dd782e95-18b3-4f13-bb1f-ceba91cb18a1',
      anchor = [(geo[2][0] + geo[11][0]) / 2, (geo[1][1] + geo[2][1]) / 2],
      D = (6378137 * Math.PI) / 180,
      co = Math.cos((f.anchor[1] * Math.PI) / 180),
      observed = geo.map((p) => [(p[0] - f.anchor[0]) * D * co, -(p[1] - f.anchor[1]) * D]),
      lower = [
        [-19, -24.5],
        [28, -24.5],
        [28, 24.5],
        [-19, 24.5],
      ],
      upper = [
        [-19, -24.5],
        [19, -24.5],
        [19, 24.5],
        [-19, 24.5],
      ],
      bay = [
        [-19, -24.5],
        [19, -24.5],
        [19, 24.5],
        [-19, 24.5],
        [-19, 10],
        [-10, 10],
        [-10, -10],
        [-19, -10],
      ],
      north = j.spatialIdentity?.northernNamedUnit3,
      east = j.spatialIdentity?.easternUnit4Turbine;
    if (
      r.id !== id ||
      r.names !== null ||
      !r.sources.some((s) => s.dataset === 'OpenStreetMap' && s.record_id === 'w915666707@1') ||
      geo.length !== 14 ||
      proof.nativeIdentity.featureId !== 'overture/' + id ||
      j.fullSnapshotSha256 !==
        'sha256:21bbe1ec8f0fd58410912455a1e4cf7033364eb67ed50872d59454690ce20606' ||
      JSON.stringify(j.bodyUpperWidthContextIndices) !== '[2,11]' ||
      JSON.stringify(j.bodyNorthSouthContextIndices) !== '[1,2]' ||
      Math.abs(j.bodyUpperWidthObservationMeters - (geo[11][0] - geo[2][0]) * D * co) > 1e-8 ||
      Math.abs(j.bodyNorthSouthObservationMeters - (geo[1][1] - geo[2][1]) * D) > 1e-8 ||
      anchor.some((v, k) => Math.abs(v - f.anchor[k]) > 1e-12) ||
      f.heading !== 0 ||
      !f.geometryLabel.includes('NOT nativegroundcorners') ||
      j.spatialIdentity.inferredIdentity !== true ||
      j.spatialIdentity.unit4TurbineIdentityAlsoInferred !== true ||
      north?.id !== '1a07336c-51b8-41a7-b3c5-dd22e664f80a' ||
      !north.names.primary.includes('3 containment building') ||
      east?.id !== '2416fa45-f3f7-4906-859c-6ad68cb95c98' ||
      r.bbox.xmax >= east.bbox.xmin ||
      r.bbox.ymax >= north.bbox.ymin
    )
      return fail('daiichi-remaining4-original-inferred-native-context-unbound');
    const controls = {
      originalFoundationNSMeters: 49,
      originalFoundationEWMeters: 57.4,
      regulatorApproxExteriorWidthMeters: 46,
      estimatedLowerNSMeters: 49,
      estimatedLowerEWMeters: 47,
      estimatedUpperNSMeters: 49,
      estimatedUpperEWMeters: 38,
      originalFirstFloorOPMeters: 10.2,
      originalSecondFloorOPMeters: 18.7,
      originalThirdFloorOPMeters: 26.9,
      originalFourthFloorOPMeters: 32.3,
      originalOperatingFloorOPMeters: 39.92,
      originalRemovedRoofOPMeters: 56.05,
      inferredGroundOPMeters: 10,
      floor: 0.25,
      foundationBottom: -1.2,
      lowerRoof: 16.95,
      fourthFloor: 22.35,
      mainRoof: 29.97,
      deckThickness: 0.4,
      remainingWallThickness: 0.4,
      upperColumnWidth: 0.65,
    };
    if (
      Object.entries(controls).some(([k, n]) => P[k] !== n) ||
      P.model !== daiichiCases[proof.case] ||
      P.parentModelIdentity !== 'fukushima_daiichi_nuclear_power_plant' ||
      P.wholeScope !== 'whole-remaining-postexplosion-Unit4-concrete-reactor-building' ||
      P.gersId !== id ||
      P.originalNativeWay !== 'w915666707@1' ||
      P.representedDate !== '2021-03-11' ||
      P.nativeIdentityInferred !== true ||
      P.temporalContinuityVerified !== false ||
      P.preaccidentRoofRestored !== false ||
      P.separateCoverIncluded !== false ||
      P.exactDamageScarsVerified !== false ||
      P.estimatedPlanUncertaintyMeters < 8 ||
      P.estimatedDamageEnvelopeUncertaintyMeters < 10 ||
      P.estimatedHorizontalUncertaintyMeters < 8 ||
      P.estimatedHeightUncertaintyMeters < 3 ||
      P.estimatedComponentUncertaintyMeters < 2 ||
      JSON.stringify(P.estimatedWestThirdFloorBayMeters) !== '[9,20]' ||
      JSON.stringify(P.lowerRing) !== JSON.stringify(lower) ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(lower) ||
      JSON.stringify(f.geometry.polygons[0]) !== JSON.stringify(lower) ||
      JSON.stringify(P.upperRing) !== JSON.stringify(upper) ||
      JSON.stringify(P.upperThirdFloorRing) !== JSON.stringify(bay) ||
      JSON.stringify(P.operatingDeckRing) !== JSON.stringify(upper) ||
      JSON.stringify(P.originalEnvelopeObservation) !== JSON.stringify(observed) ||
      JSON.stringify(P.residualWalls) !==
        JSON.stringify([
          { x0: 18.6, x1: 19, z0: -24.5, z1: -18.5 },
          { x0: 18.6, x1: 19, z0: 18.5, z1: 24.5 },
          { x0: -19, x1: -13, z0: -24.5, z1: -24.1 },
          { x0: -19, x1: -13, z0: 24.1, z1: 24.5 },
        ])
    )
      return fail('daiichi-remaining4-whole-body-plan-estimates-and-postdamage-controls-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole remainingUnit4reactorbody with original operatorfloor/damagefacts bound. Foundation49x57.4m isnot abovegroundplan; selected49x47m lower/49x38m upper areexplicit8m estimates fromunit-specificnumeric/nativecontext. 3Fbay/4Fframe/wallfragments10muncertainty. No Daini/Unit3dimension substitution,intactroof,internalcontainment or separate-cover duplicate. Nativeidentity/registration/2021continuity estimated.',
    };
  } catch (error) {
    return fail('daiichi-remaining4-source-error: ' + error.message);
  }
}
