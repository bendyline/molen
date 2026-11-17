import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const byewashValveCase = 'tai-tam-byewash-1904-mapped-valve-house';
export const byewashValveModel = 'tai_tam_byewash_reservoir_valve_house';
export const intermediateDamCase = 'tai-tam-intermediate-mapped-gravity-dam';
export const intermediateDamModel = 'tai_tam_intermediate_reservoir_dam';
export const intermediateValveCase = 'tai-tam-intermediate-gish-valve-house';
export const intermediateValveModel = 'tai_tam_intermediate_reservoir_valve_house';
export const tukDamCase = 'tai-tam-tuk-mapped-twelve-spillways';
export const tukDamModel = 'tai_tam_tuk_reservoir_dam';
export const tukChimneyCase = 'tai-tam-tuk-gish-chimney-and-flue';
export const tukChimneyModel = 'tai_tam_tuk_raw_water_pumping_station_chimney_shaft';
export const tukReservoirCases = {
  'tai-tam-tuk-rectangular-valve-house': 'tai_tam_tuk_reservoir_valve_house',
  'tai-tam-tuk-gish-memorial-stone': 'tai_tam_tuk_reservoir_memorial_stone',
};
const bridgeRoadWays = [97637286, 97637279, 328552505, 328552506];
export const tukMasonryBridgeCases = Object.fromEntries(
  bridgeRoadWays.map((_, index) => [
    `tai-tam-tuk-gish-masonry-bridge-${index + 1}`,
    `tai_tam_tuk_reservoir_masonry_bridge_${index + 1}`,
  ]),
);

const pumpingStationBuildings = {
  'tai-tam-tuk-mapped-engine-hall': {
    model: 'tai_tam_tuk_raw_water_pumping_station',
    registry: 897,
    way: 447991538,
    name: 'Tai Tam Tuk Raw Water Pumping Station',
    factualControl: 'red brick engine hall with Chinese tiled pitched roofs',
  },
  'tai-tam-tuk-mapped-senior-staff-quarters': {
    model: 'tai_tam_tuk_raw_water_pumping_station_senior_staff_quarters',
    registry: 898,
    way: 447991541,
    name: 'Tai Tam Tuk Raw Water Pumping Station Senior Staff Quarters',
    factualControl: 'two-storey main house and separate servants quarters',
  },
  'tai-tam-tuk-mapped-no-2-staff-quarters': {
    model: 'tai_tam_tuk_raw_water_pumping_station_no_2_staff_quarters',
    registry: 899,
    way: 447991540,
    name: 'Tai Tam Tuk Raw Water Pumping Station No. 2 Staff Quarters',
    factualControl: 'former pressure filter house with L plan and upper verandah',
  },
  'tai-tam-tuk-mapped-staff-quarters': {
    model: 'tai_tam_tuk_raw_water_pumping_station_staff_quarters',
    registry: 900,
    way: 447991539,
    name: 'Tai Tam Tuk Raw Water Pumping Station Staff Quarters',
    factualControl: 'long two-storey quarters with seaward verandahs and end stairs',
  },
};
export const tukPumpingStationCases = Object.fromEntries(
  Object.entries(pumpingStationBuildings).map(([key, value]) => [key, value.model]),
);
export const upperReservoirCases = {
  'tai-tam-upper-mapped-gravity-dam': 'tai_tam_upper_reservoir_dam',
  'tai-tam-upper-mapped-recorder-and-inlet':
    'tai_tam_upper_reservoir_recorder_house_and_tunnel_inlet',
  'tai-tam-upper-valve-house-on-mapped-platform': 'tai_tam_upper_reservoir_valve_house',
};

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
function pinned(dir, record, file) {
  const contents = readFileSync(path.join(dir, file));
  if (record.path !== file || record.sha256 !== hash(contents)) throw Error('Evidence differs');
  return JSON.parse(contents);
}

function nativeOutlineMatches(way, nodes, frame) {
  if (way.nodes[0] !== way.nodes.at(-1)) return false;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const coordinates = way.nodes.slice(0, -1).map((id) => {
    const node = byId.get(id);
    return [node.lon, node.lat];
  });
  return outlineMatches(coordinates, frame);
}

function outlineMatches(coordinates, frame) {
  const outline = frame.geometry.outline;
  if (coordinates.length !== outline.length) return false;
  const [lon, lat] = frame.anchor;
  const rad = Math.PI / 180;
  const meters = 6378137 * rad;
  const longitudeScale = meters * Math.cos(lat * rad);
  const c = Math.cos(frame.heading);
  const s = Math.sin(frame.heading);
  return coordinates.every(([longitude, latitude], i) => {
    const dx = (longitude - lon) * longitudeScale;
    const dz = (lat - latitude) * meters;
    const [x, z] = outline[i];
    return Math.hypot(c * dx - s * dz - x, s * dx + c * dz - z) < 0.001;
  });
}

function candidatesMatch(excluded, inventory) {
  return (
    excluded.selectedImages === 0 &&
    excluded.candidates.length === inventory.candidates.length &&
    inventory.candidates.every((candidate, i) => {
      const saved = excluded.candidates[i];
      return (
        saved.path === candidate.path &&
        saved.sourceUrl === candidate.sourceUrl &&
        saved.license === candidate.license
      );
    })
  );
}

export function inspectByewashValveFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const map = pinned(dir, proof.nativeIdentity, 'native-map/valve-house-way.json');
    const record = pinned(dir, proof.primarySources, 'reference-rights/engineering-facts.json');
    const excluded = pinned(
      dir,
      proof.candidateExclusion,
      'reference-rights/story-image-exclusions.json',
    );
    const authority = record.sources.find(
      (source) =>
        source.url ===
        'https://www.aab.gov.hk/filemanager/aab/common/historicbuilding/en/1206_Appraisal_En.pdf',
    )?.facts;
    if (
      record.imageryUsed !== false ||
      authority?.plan !== 'rectangular' ||
      authority.wall !== 'rock-faced rusticated granite' ||
      authority.roof !== 'flat' ||
      authority.location !== 'midway along the subsidiary dam' ||
      !candidatesMatch(excluded, inventory)
    )
      return fail('tai-tam-byewash-valve-facts-or-image-exclusions-unbound');

    const way = map.building;
    const outline = frame.geometry.outline;
    if (
      way.id !== 448005770 ||
      way.tags['name:zh'] !== '大潭副水塘水掣房' ||
      way.tags.start_date !== '1904' ||
      way.nodes.length !== 5 ||
      way.nodes[0] !== way.nodes.at(-1) ||
      outline.length !== 4 ||
      JSON.stringify(controls.dimensions.outline) !== JSON.stringify(outline) ||
      frame.sourceHash !== proof.nativeIdentity.sha256
    )
      return fail('tai-tam-byewash-valve-native-identity-unbound');

    if (!nativeOutlineMatches(way, map.nodes, frame))
      return fail('tai-tam-byewash-valve-footprint-unbound');

    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'Named rectangle on the subsidiary dam, with rock-faced granite, flat roof and plain openings established by the heritage appraisal. Opening placement and heights are estimated.',
    };
  } catch {
    return fail('tai-tam-byewash-valve-primary-facts-invalid');
  }
}

export function inspectUpperReservoirFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const map = pinned(dir, proof.nativeIdentity, 'native-map/upper-reservoir-way.json');
    const record = pinned(dir, proof.primarySources, 'reference-rights/engineering-facts.json');
    const excluded = pinned(
      dir,
      proof.candidateExclusion,
      'reference-rights/story-image-exclusions.json',
    );
    const appraisal = record.sources.find(
      (source) =>
        source.url ===
        'https://www.aab.gov.hk/filemanager/aab/common/historicbuilding/en/276_Appraisal_En.pdf',
    )?.facts;
    if (proof.case === 'tai-tam-upper-valve-house-on-mapped-platform') {
      if (
        record.imageryUsed !== false ||
        !candidatesMatch(excluded, inventory) ||
        appraisal?.position !== 'about one third along the top of the dam' ||
        appraisal.plan !== 'square' ||
        appraisal.roof !== 'flat with a projecting corbelled cornice' ||
        appraisal.rearBlockedWindows !== 2 ||
        frame.sourceHash !== proof.nativeIdentity.sha256 ||
        !valvePlatformMatches(map, controls, frame)
      )
        return fail('tai-tam-upper-valve-facts-or-platform-unbound');
      return {
        status: 'passed',
        method: 'primary-facts-only',
        imageryUsed: false,
        evidenceHash: hash(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
        notes:
          'The documented square valve house occupies the mapped upstream platform. Its width and foundation position are approximate.',
      };
    }
    const guide = record.sources.find(
      (source) =>
        source.url === 'https://www.wsd.gov.hk/filemanager/common/pdf/monuments/tai_tam.pdf',
    )?.facts;
    const dam = proof.case === 'tai-tam-upper-mapped-gravity-dam';
    const way = map.way;
    if (
      record.imageryUsed !== false ||
      !candidatesMatch(excluded, inventory) ||
      (dam
        ? appraisal?.type !== 'masonry faced concrete gravity dam' ||
          appraisal.overflowSeparate !== true ||
          appraisal.raisedYear !== 1897 ||
          guide?.lengthMeters !== 121.9 ||
          guide.heightMeters !== 30.5
        : appraisal?.walls !== 'coursed granite' ||
          appraisal.roof !== 'flat with a parapet coping' ||
          appraisal.grating !== 'iron' ||
          appraisal.plaqueDate !== '1883–8' ||
          guide?.recorderHouseYear !== 1917)
    )
      return fail('tai-tam-upper-reservoir-facts-or-image-exclusions-unbound');
    const reservoir = map.context.find((item) => item.id === 22498774);
    if (
      reservoir?.tags['name:en'] !== 'Tai Tam Upper Reservoir' ||
      (dam
        ? way.id !== 448005771 ||
          way.tags.waterway !== 'dam' ||
          way.nodes.filter((id) => reservoir.nodes.includes(id)).length < 6
        : way.id !== 448005769 ||
          way.tags.name !== '大潭上水塘記錄儀器房' ||
          way.tags.description !== '1917') ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      JSON.stringify(controls.dimensions.outline) !== JSON.stringify(frame.geometry.outline) ||
      !nativeOutlineMatches(way, map.nodes, frame)
    )
      return fail('tai-tam-upper-reservoir-native-outline-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes: dam
        ? 'Mapped primary dam and shared shore, with gravity profile, granite facing and inspection rails from the heritage records.'
        : 'Named 1917 recorder house and inlet, with coursed granite, roof parapet, iron grating and catwalks from heritage records.',
    };
  } catch {
    return fail('tai-tam-upper-reservoir-primary-facts-invalid');
  }
}

function valvePlatformMatches(map, controls, frame) {
  const dam = map.damFrame;
  const [x, z] = map.offsetWithinDam;
  const [lon, lat] = dam.anchor;
  const rad = Math.PI / 180;
  const meters = 6378137 * rad;
  const c = Math.cos(dam.heading);
  const s = Math.sin(dam.heading);
  const expected = [
    lon + (c * x + s * z) / (meters * Math.cos(lat * rad)),
    lat - (-s * x + c * z) / meters,
  ];
  const platform = dam.geometry.outline.slice(3, 7);
  const width = map.approximateSquareWidth;
  return (
    map.way.id === 448005771 &&
    map.way.tags.waterway === 'dam' &&
    map.reservoir.id === 22498774 &&
    map.way.nodes.slice(3, 7).every((id) => map.reservoir.nodes.includes(id)) &&
    width >= 3 &&
    width <= 6 &&
    expected.every((value, index) => Math.abs(value - frame.anchor[index]) < 1e-8) &&
    frame.heading === dam.heading &&
    x > platform[0][0] &&
    x < platform[3][0] &&
    z > Math.min(...platform.map((point) => point[1])) &&
    z < platform[0][1] &&
    JSON.stringify(controls.dimensions.outline) === JSON.stringify(frame.geometry.outline)
  );
}

export function inspectIntermediateDamFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const map = pinned(dir, proof.nativeIdentity, 'native-map/intermediate-reservoir-way.json');
    const record = pinned(dir, proof.primarySources, 'reference-rights/engineering-facts.json');
    const excluded = pinned(
      dir,
      proof.candidateExclusion,
      'reference-rights/story-image-exclusions.json',
    );
    const appraisal = record.sources.find(
      (source) =>
        source.url ===
        'https://www.aab.gov.hk/filemanager/aab/common/138meeting/AAB138-14-B-eng.pdf',
    )?.facts;
    const { way, context: reservoir } = map;
    if (
      record.imageryUsed !== false ||
      !candidatesMatch(excluded, inventory) ||
      appraisal?.type !== 'masonry faced concrete gravity dam' ||
      appraisal.stillingPoolWalls !== 'concrete' ||
      appraisal.loweredSpillwayYear !== 1977 ||
      appraisal.loweredSection !== 'north' ||
      appraisal.loweredByFeet !== 9 ||
      reservoir.id !== 22506240 ||
      reservoir.tags['name:en'] !== 'Tai Tam Intermediate Reservoir' ||
      way.id !== 323624579 ||
      way.tags['description:en'] !== 'Tai Tam Intermediate Reservoir Dam' ||
      way.nodes.slice(0, -1).filter((id) => reservoir.nodes.includes(id)).length !== 6 ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      JSON.stringify(controls.dimensions.outline) !== JSON.stringify(frame.geometry.outline) ||
      !nativeOutlineMatches(way, map.nodes, frame)
    )
      return fail('tai-tam-intermediate-dam-native-outline-or-facts-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The mapped gravity dam shares six points with the reservoir. The approved heritage record supplies the lowered north spillway, masonry face, and concrete-walled stilling pool.',
    };
  } catch {
    return fail('tai-tam-intermediate-dam-primary-facts-invalid');
  }
}

export function inspectIntermediateValveFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const map = pinned(dir, proof.nativeIdentity, 'native-map/gish-geometry.json');
    const record = pinned(dir, proof.primarySources, 'reference-rights/engineering-facts.json');
    const excluded = pinned(
      dir,
      proof.candidateExclusion,
      'reference-rights/story-image-exclusions.json',
    );
    const appraisal = record.sources.find(
      (source) =>
        source.url ===
        'https://www.aab.gov.hk/filemanager/aab/common/138meeting/AAB138-14-B-eng.pdf',
    )?.facts;
    const { attributes, geometry } = map.gishFeature;
    const [ring] = geometry.rings;
    if (
      record.imageryUsed !== false ||
      !candidatesMatch(excluded, inventory) ||
      appraisal?.plan !== 'rectangular with curved corners' ||
      appraisal.access !== 'footbridge over the dam' ||
      appraisal.arches !== 'semicircular' ||
      appraisal.roof !== 'flat' ||
      map.gishSpatialReference.wkid !== 4326 ||
      attributes.sysid !== 892 ||
      attributes.ENG_NAME !== 'Tai Tam Intermediate Reservoir, Valve House' ||
      ring.length !== 13 ||
      ring[0].some((value, i) => value !== ring.at(-1)[i]) ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      JSON.stringify(controls.dimensions.outline) !== JSON.stringify(frame.geometry.outline) ||
      !outlineMatches(ring.slice(0, -1), frame)
    )
      return fail('tai-tam-intermediate-valve-native-outline-or-facts-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The named official footprint and written appraisal establish the rounded granite house, arched openings and footbridge. Bridge dimensions and height are estimated.',
    };
  } catch {
    return fail('tai-tam-intermediate-valve-primary-facts-invalid');
  }
}

export function inspectTukDamFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const map = pinned(dir, proof.nativeIdentity, 'native-map/tuk-reservoir-way.json');
    const record = pinned(dir, proof.primarySources, 'reference-rights/engineering-facts.json');
    const excluded = pinned(
      dir,
      proof.candidateExclusion,
      'reference-rights/story-image-exclusions.json',
    );
    const appraisal = record.sources.find(
      (source) =>
        source.url ===
        'https://www.aab.gov.hk/filemanager/aab/common/138meeting/AAB138-14-B-eng.pdf',
    )?.facts;
    const { way, context: reservoir, crestRoad, downstreamFootbridge, governmentBoundary } = map;
    const axis = frame.features.find((feature) => feature.id === 'way/584423447')?.points;
    const registry = frame.features.find((feature) => feature.id === 'gish/893')?.points;
    const indexedNodes = new Map(map.nodes.map((node) => [node.id, node]));
    if (
      record.imageryUsed !== false ||
      !candidatesMatch(excluded, inventory) ||
      appraisal?.archedSpillways !== 12 ||
      appraisal.modifiedSiphons !== 10 ||
      appraisal.originalEndSpillways !== 2 ||
      appraisal.stillingPool !== true ||
      way.id !== 466402991 ||
      way.tags['name:en'] !== 'Tai Tam Tuk Reservoir Dam' ||
      reservoir.id !== 22507766 ||
      way.nodes.slice(0, -1).filter((id) => reservoir.nodes.includes(id)).length !== 10 ||
      crestRoad.id !== 584423447 ||
      !outlineMatches(
        crestRoad.nodes.map((id) => {
          const node = indexedNodes.get(id);
          return [node.lon, node.lat];
        }),
        { ...frame, geometry: { outline: axis } },
      ) ||
      downstreamFootbridge.id !== 328552509 ||
      governmentBoundary.attributes.sysid !== 893 ||
      !outlineMatches(governmentBoundary.geometry.rings[0].slice(0, -1), {
        ...frame,
        geometry: { outline: registry },
      }) ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      JSON.stringify(controls.dimensions.outline) !== JSON.stringify(frame.geometry.outline) ||
      JSON.stringify(controls.dimensions.roadAxis) !== JSON.stringify(axis) ||
      !nativeOutlineMatches(way, map.nodes, frame)
    )
      return fail('tai-tam-tuk-dam-native-geometry-or-facts-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The original dam outline, shared reservoir shoreline, mapped crest road and government boundary locate the structure. Engineering records establish twelve arched spillways and ten modified siphons.',
    };
  } catch {
    return fail('tai-tam-tuk-dam-primary-facts-invalid');
  }
}

export function inspectTukReservoirMemberFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const map = pinned(dir, proof.nativeIdentity, 'native-map/tuk-reservoir-member.json');
    const record = pinned(dir, proof.primarySources, 'reference-rights/engineering-facts.json');
    const excluded = pinned(
      dir,
      proof.candidateExclusion,
      'reference-rights/story-image-exclusions.json',
    );
    const appraisal = record.sources.find(
      (source) =>
        source.url ===
        'https://www.aab.gov.hk/filemanager/aab/common/138meeting/AAB138-14-B-eng.pdf',
    )?.facts;
    const valve = proof.case === 'tai-tam-tuk-rectangular-valve-house';
    const { attributes, geometry } = map.gishFeature;
    const ring = geometry.rings[0];
    const official = frame.features.find((feature) => feature.id === `gish/${attributes.sysid}`);
    if (
      record.imageryUsed !== false ||
      !candidatesMatch(excluded, inventory) ||
      map.gishSpatialReference.wkid !== 4326 ||
      attributes.sysid !== (valve ? 895 : 894) ||
      attributes.ENG_NAME !==
        `Tai Tam Tuk Reservoir, ${valve ? 'Valve House' : 'Memorial Stone'}` ||
      ring[0].some((value, i) => value !== ring.at(-1)[i]) ||
      !outlineMatches(ring.slice(0, -1), { ...frame, geometry: { outline: official.points } }) ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      JSON.stringify(controls.dimensions.outline) !== JSON.stringify(frame.geometry.outline) ||
      (valve
        ? appraisal?.plan !== 'rectangular' ||
          appraisal?.catwalks !== 'cantilevered steel' ||
          appraisal?.roadWindows !== 'blocked' ||
          map.way.id !== 448000887 ||
          !nativeOutlineMatches(map.way, map.nodes, frame)
        : appraisal?.panel !== 'recessed' ||
          appraisal?.top !== 'splayed' ||
          appraisal?.base !== 'moulded plinth' ||
          appraisal?.commemoration !== '1918-02-02' ||
          JSON.stringify(official.points) !== JSON.stringify(frame.geometry.outline))
    )
      return fail('tai-tam-tuk-member-native-identity-or-facts-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes: valve
        ? 'The named OSM outline and official boundary agree. The appraisal documents the catwalks, flat coping, arched openings and blocked road-side windows.'
        : 'The official roadside boundary locates the stone. The heritage appraisal records its moulded base, splayed cap and recessed inscription panel.',
    };
  } catch {
    return fail('tai-tam-tuk-member-primary-facts-invalid');
  }
}

export function inspectTukMasonryBridgeFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const map = pinned(dir, proof.nativeIdentity, 'native-map/tuk-masonry-bridge.json');
    const record = pinned(dir, proof.primarySources, 'reference-rights/engineering-facts.json');
    const excluded = pinned(
      dir,
      proof.candidateExclusion,
      'reference-rights/story-image-exclusions.json',
    );
    const index = Number(proof.case.at(-1)) - 1;
    const roadWay = bridgeRoadWays[index];
    const {
      gishFeature: { attributes, geometry },
      crestWay,
    } = map;
    const [ring] = geometry.rings;
    const road = frame.features.find((f) => f.id === `way/${roadWay}`)?.points;
    const indexedNodes = new Map(map.nodes.map(({ id, lon, lat }) => [id, [lon, lat]]));
    const appraisal = record.sources.find(
      (source) =>
        source.url ===
        'https://www.aab.gov.hk/filemanager/aab/common/138meeting/AAB138-14-B-eng.pdf',
    )?.facts;
    const construction = record.sources.find(
      (source) =>
        source.url ===
        'https://hkintexts.histsyn.com/series/histsyn-china-mail-engine/items/1906-06-16?p=1',
    )?.facts;
    if (
      record.imageryUsed !== false ||
      !candidatesMatch(excluded, inventory) ||
      appraisal?.crossings !== 4 ||
      appraisal?.archMasonry !== 'granite-faced' ||
      appraisal?.piers !== 'tapered' ||
      construction?.nominalHistoricalWidthFeet !== 15 ||
      map.gishSpatialReference.wkid !== 4326 ||
      attributes.sysid !== 945 + index ||
      attributes.ENG_NAME !== 'Tai Tam Tuk Reservoir, Masonry Bridge' ||
      ring[0].some((value, dimension) => value !== ring.at(-1)[dimension]) ||
      crestWay.id !== roadWay ||
      crestWay.tags.bridge !== 'yes' ||
      !outlineMatches(
        crestWay.nodes.map((id) => indexedNodes.get(id)),
        { ...frame, geometry: { outline: road } },
      ) ||
      !outlineMatches(ring.slice(0, -1), frame) ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      JSON.stringify(controls.dimensions.outline) !== JSON.stringify(frame.geometry.outline) ||
      JSON.stringify(controls.dimensions.roadAxis) !== JSON.stringify(road)
    )
      return fail('tai-tam-tuk-masonry-bridge-native-identity-or-facts-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The official heritage boundary and native road way independently locate the crossing. Written records establish its masonry arches, tapered supports and cornice. Local courses and heights are estimated.',
    };
  } catch {
    return fail('tai-tam-tuk-masonry-bridge-primary-facts-invalid');
  }
}

export function inspectTukChimneyFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const map = pinned(dir, proof.nativeIdentity, 'native-map/tuk-pumping-site-feature.json');
    const record = pinned(dir, proof.primarySources, 'reference-rights/engineering-facts.json');
    const excluded = pinned(
      dir,
      proof.candidateExclusion,
      'reference-rights/story-image-exclusions.json',
    );
    const appraisal = record.sources.find(
      (source) =>
        source.url ===
        'https://www.aab.gov.hk/filemanager/aab/common/138meeting/AAB138-14-B-eng.pdf',
    )?.facts;
    const survey = record.sources.find(
      (source) =>
        source.url ===
        'https://www.heritage.gov.hk/filemanager/heritage/tc/content_225/TTT_Resource_Kit_Chi.pdf',
    )?.facts;
    const { attributes, geometry } = map.gishFeature;
    const [ring] = geometry.rings;
    if (
      record.imageryUsed !== false ||
      !candidatesMatch(excluded, inventory) ||
      appraisal?.material !== 'red brick' ||
      appraisal?.plan !== 'square' ||
      appraisal?.flue !== 'smoke tunnel connected to the engine hall' ||
      survey?.heightMillimeters !== 19304 ||
      controls.dimensions.height !== 19.304 ||
      attributes.sysid !== 896 ||
      map.gishSpatialReference.wkid !== 4326 ||
      attributes.ENG_NAME !==
        'Chimney Shaft and its Flue of Tai Tam Tuk Raw Water Pumping Station' ||
      ring[0].some((value, i) => value !== ring.at(-1)[i]) ||
      !outlineMatches(ring.slice(0, -1), frame) ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      JSON.stringify(controls.dimensions.outline) !== JSON.stringify(frame.geometry.outline)
    )
      return fail('tai-tam-tuk-chimney-native-identity-or-facts-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The official boundary locates the square chimney base and flue. The heritage appraisal and survey establish its brickwork and 19.304 m height.',
    };
  } catch {
    return fail('tai-tam-tuk-chimney-primary-facts-invalid');
  }
}

export function inspectTukPumpingStationFacts({ dir, proof, controls, frame, inventory }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const map = pinned(dir, proof.nativeIdentity, 'native-map/tuk-pumping-site-feature.json');
    const record = pinned(dir, proof.primarySources, 'reference-rights/engineering-facts.json');
    const excluded = pinned(
      dir,
      proof.candidateExclusion,
      'reference-rights/story-image-exclusions.json',
    );
    const expected = pumpingStationBuildings[proof.case];
    const { attributes, geometry } = map.gishFeature;
    const [ring] = geometry.rings;
    const boundary = frame.features.find((feature) => feature.id === `gish/${expected.registry}`);
    const factual = record.sources.find(
      (source) =>
        source.url ===
        'https://www.heritage.gov.hk/filemanager/heritage/en/content_225/TTT_Resource_Kit-Eng_R1.pdf',
    )?.facts;
    if (
      record.imageryUsed !== false ||
      !candidatesMatch(excluded, inventory) ||
      factual?.architecturalControl !== expected.factualControl ||
      map.way.id !== expected.way ||
      attributes.sysid !== expected.registry ||
      attributes.ENG_NAME !== expected.name ||
      map.gishSpatialReference.wkid !== 4326 ||
      ring[0].some((value, i) => value !== ring.at(-1)[i]) ||
      !outlineMatches(ring.slice(0, -1), { ...frame, geometry: { outline: boundary.points } }) ||
      !nativeOutlineMatches(map.way, map.nodes, frame) ||
      frame.sourceHash !== proof.nativeIdentity.sha256 ||
      JSON.stringify(controls.dimensions.outline) !== JSON.stringify(frame.geometry.outline)
    )
      return fail('tai-tam-tuk-pumping-site-native-identity-or-facts-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(readFileSync(path.join(dir, 'primary-facts-reconstruction.json'))),
      notes:
        'The heritage record and mapped building establish the site. The published survey and heritage description establish the exterior forms. Local openings and roof details may be estimated.',
    };
  } catch {
    return fail('tai-tam-tuk-pumping-site-primary-facts-invalid');
  }
}
