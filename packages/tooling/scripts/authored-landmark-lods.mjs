import {
  buildAlamutRuntime,
  buildAlamutSkyline,
} from '../../worldgen/scripts/alamut-castle-model.mjs';
import {
  aljaferiaSurfaces,
  buildAljaferiaRuntime,
  buildAljaferiaSkyline,
} from '../../worldgen/scripts/aljaferia-palace-model.mjs';
import {
  arundelSurfaces,
  buildArundelRuntime,
  buildArundelSkyline,
} from '../../worldgen/scripts/arundel-castle-model.mjs';
import { buildBranRuntime, buildBranSkyline } from '../../worldgen/scripts/bran-castle-model.mjs';
import {
  buildBratislavaRuntime,
  buildBratislavaSkyline,
} from '../../worldgen/scripts/bratislava-castle-model.mjs';
import { buildBudaRuntime, buildBudaSkyline } from '../../worldgen/scripts/buda-castle-model.mjs';
import {
  buildDevinRuntime,
  buildDevinSkyline,
  devinSurfaces,
} from '../../worldgen/scripts/devin-castle-model.mjs';
import {
  buildDurhamRuntime,
  buildDurhamSkyline,
} from '../../worldgen/scripts/durham-castle-model.mjs';
import {
  buildEgeskovRuntime,
  buildEgeskovSkyline,
  egeskovSurfaces,
} from '../../worldgen/scripts/egeskov-castle-model.mjs';
import {
  buildGediminasRuntime,
  buildGediminasSkyline,
  gediminasSurfaces,
} from '../../worldgen/scripts/gediminas-tower-model.mjs';
import {
  buildHaapsaluRuntime,
  buildHaapsaluSkyline,
  haapsaluSurfaces,
} from '../../worldgen/scripts/haapsalu-castle-model.mjs';
import {
  buildHochosterwitzRuntime,
  buildHochosterwitzSkyline,
  hochosterwitzSurfaces,
} from '../../worldgen/scripts/hochosterwitz-castle-model.mjs';
import {
  buildHohenzollernRuntime,
  buildHohenzollernSkyline,
} from '../../worldgen/scripts/hohenzollern-castle-model.mjs';
import {
  buildKalmarRuntime,
  buildKalmarSkyline,
  kalmarSurfaces,
} from '../../worldgen/scripts/kalmar-castle-model.mjs';
import {
  buildKernaveRuntime,
  buildKernaveSkyline,
} from '../../worldgen/scripts/kernave-landscape-model.mjs';
import {
  buildKhotynRuntime,
  buildKhotynSkyline,
} from '../../worldgen/scripts/khotyn-fortress-model.mjs';
import {
  buildLeedsRuntime,
  buildLeedsSkyline,
  leedsSurfaces,
} from '../../worldgen/scripts/leeds-castle-model.mjs';
import {
  buildLiechtensteinRuntime,
  buildLiechtensteinSkyline,
  liechtensteinSurfaces,
} from '../../worldgen/scripts/liechtenstein-castle-model.mjs';
import {
  buildLjubljanaRuntime,
  buildLjubljanaSkyline,
  ljubljanaSurfaces,
} from '../../worldgen/scripts/ljubljana-castle-model.mjs';
import { buildMirRuntime, buildMirSkyline } from '../../worldgen/scripts/mir-castle-model.mjs';
import {
  buildNesvizhRuntime,
  buildNesvizhSkyline,
} from '../../worldgen/scripts/nesvizh-castle-model.mjs';
import {
  buildNurembergRuntime,
  buildNurembergSkyline,
  nurembergSurfaces,
} from '../../worldgen/scripts/nuremberg-castle-model.mjs';
import {
  buildPembrokeRuntime,
  buildPembrokeSkyline,
  pembrokeSurfaces,
} from '../../worldgen/scripts/pembroke-castle-model.mjs';
import {
  buildRumeliRuntime,
  buildRumeliSkyline,
  rumeliSurfaces,
} from '../../worldgen/scripts/rumeli-fortress-model.mjs';
import {
  buildSaintMichaelRuntime,
  buildSaintMichaelSkyline,
  saintMichaelSurfaces,
} from '../../worldgen/scripts/saint-michaels-castle-model.mjs';
import {
  buildSalahRuntime,
  buildSalahSkyline,
} from '../../worldgen/scripts/salah-citadel-model.mjs';
import {
  buildSanjoRuntime,
  buildSanjoSkyline,
  sanjoRuntimeSurfaces,
} from '../../worldgen/scripts/sanjo-ohashi-model.mjs';
import {
  buildSaoJorgeRuntime,
  buildSaoJorgeSkyline,
  saoJorgeSurfaces,
} from '../../worldgen/scripts/sao-jorge-castle-model.mjs';
import {
  buildSforzaRuntime,
  buildSforzaSkyline,
} from '../../worldgen/scripts/sforza-castle-model.mjs';
import {
  buildShanhaiRuntime,
  buildShanhaiSkyline,
} from '../../worldgen/scripts/shanhai-pass-model.mjs';
import {
  buildStirlingRuntime,
  buildStirlingSkyline,
} from '../../worldgen/scripts/stirling-castle-model.mjs';
import {
  buildTurkuRuntime,
  buildTurkuSkyline,
  turkuSurfaces,
} from '../../worldgen/scripts/turku-castle-model.mjs';
import {
  buildWarsawRuntime,
  buildWarsawSkyline,
} from '../../worldgen/scripts/warsaw-royal-castle-model.mjs';
import {
  buildWawelRuntime,
  buildWawelSkyline,
  wawelSurfaces,
} from '../../worldgen/scripts/wawel-castle-model.mjs';
/** Source-authored silhouettes for landmarks whose open crowns defeat automatic reduction. */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { NodeIO, VertexLayout } from '@gltf-transform/core';
import { prune, weld } from '@gltf-transform/functions';
import { encodeGlb, MeshBufferBuilder } from '../../worldgen/dist/kernel.mjs';
import {
  buildAcrocorinthRuntime,
  buildAcrocorinthSkyline,
} from '../../worldgen/scripts/acrocorinth-model.mjs';
import {
  buildAkershusRuntime,
  buildAkershusSkyline,
} from '../../worldgen/scripts/akershus-fortress-model.mjs';
import {
  cross,
  normalize,
  validateAuthoredMesh,
} from '../../worldgen/scripts/authored-structure-mesh.mjs';
import {
  buildBaroloRuntime,
  buildBaroloSkyline,
} from '../../worldgen/scripts/barolo-palace-model.mjs';
import {
  buildBeaumarisRuntime,
  buildBeaumarisSkyline,
} from '../../worldgen/scripts/beaumaris-castle-model.mjs';
import {
  buildCaernarfonRuntime,
  buildCaernarfonSkyline,
} from '../../worldgen/scripts/caernarfon-castle-model.mjs';
import {
  buildCastelNuovoRuntime,
  buildCastelNuovoSkyline,
} from '../../worldgen/scripts/castel-nuovo-model.mjs';
import { buildChinaWorldSkyline } from '../../worldgen/scripts/china-world-tower-model.mjs';
import {
  buildConwyRuntime,
  buildConwySkyline,
} from '../../worldgen/scripts/conwy-castle-model.mjs';
import {
  buildCorvinRuntime,
  buildCorvinSkyline,
} from '../../worldgen/scripts/corvin-castle-model.mjs';
import {
  buildDoverRuntime,
  buildDoverSkyline,
} from '../../worldgen/scripts/dover-castle-model.mjs';
import {
  buildDublinRuntime,
  buildDublinSkyline,
} from '../../worldgen/scripts/dublin-castle-model.mjs';
import {
  buildEdinburghRuntime,
  buildEdinburghSkyline,
} from '../../worldgen/scripts/edinburgh-castle-model.mjs';
import {
  buildElminaRuntime,
  buildElminaSkyline,
} from '../../worldgen/scripts/elmina-castle-model.mjs';
import { buildEltzRuntime, buildEltzSkyline } from '../../worldgen/scripts/eltz-castle-model.mjs';
import { buildGranTorreSkyline } from '../../worldgen/scripts/gran-torre-costanera-model.mjs';
import {
  buildGripsholmRuntime,
  buildGripsholmSkyline,
} from '../../worldgen/scripts/gripsholm-castle-model.mjs';
import {
  buildHeidelbergRuntime,
  buildHeidelbergSkyline,
} from '../../worldgen/scripts/heidelberg-castle-model.mjs';
import {
  buildHermannRuntime,
  buildHermannSkyline,
} from '../../worldgen/scripts/hermann-castle-model.mjs';
import {
  buildHofburgRuntime,
  buildHofburgSkyline,
} from '../../worldgen/scripts/hofburg-palace-model.mjs';
import {
  buildHohensalzburgRuntime,
  buildHohensalzburgSkyline,
} from '../../worldgen/scripts/hohensalzburg-fortress-model.mjs';
import {
  buildKamianetsRuntime,
  buildKamianetsSkyline,
} from '../../worldgen/scripts/kamianets-castle-model.mjs';
import {
  buildKarlstejnRuntime,
  buildKarlstejnSkyline,
} from '../../worldgen/scripts/karlstejn-castle-model.mjs';
import {
  buildKonopisteRuntime,
  buildKonopisteSkyline,
} from '../../worldgen/scripts/konopiste-castle-model.mjs';
import {
  buildKromerizRuntime,
  buildKromerizSkyline,
} from '../../worldgen/scripts/kromeriz-castle-model.mjs';
import {
  buildKronborgRuntime,
  buildKronborgSkyline,
} from '../../worldgen/scripts/kronborg-castle-model.mjs';
import {
  buildKsiazRuntime,
  buildKsiazSkyline,
} from '../../worldgen/scripts/ksiaz-castle-model.mjs';
import {
  buildKuressaareRuntime,
  buildKuressaareSkyline,
} from '../../worldgen/scripts/kuressaare-castle-model.mjs';
import {
  buildLubartRuntime,
  buildLubartSkyline,
} from '../../worldgen/scripts/lubart-castle-model.mjs';
import {
  buildMalborkRuntime,
  buildMalborkSkyline,
} from '../../worldgen/scripts/malbork-castle-model.mjs';
import {
  buildMillenniumRuntime,
  buildMillenniumSkyline,
} from '../../worldgen/scripts/millennium-tower-model.mjs';
import {
  buildMiramareRuntime,
  buildMiramareSkyline,
} from '../../worldgen/scripts/miramare-castle-model.mjs';
import {
  buildMontsoreauRuntime,
  buildMontsoreauSkyline,
} from '../../worldgen/scripts/montsoreau-castle-model.mjs';
import {
  buildNeuschwansteinRuntime,
  buildNeuschwansteinSkyline,
} from '../../worldgen/scripts/neuschwanstein-castle-model.mjs';
import { buildNinaSkyline } from '../../worldgen/scripts/nina-tower-model.mjs';
import {
  buildPragueRuntime,
  buildPragueSkyline,
} from '../../worldgen/scripts/prague-castle-model.mjs';
import { buildRigaRuntime, buildRigaSkyline } from '../../worldgen/scripts/riga-castle-model.mjs';
import { MATERIAL_REPEAT_METERS } from '../../worldgen/scripts/standard-materials.mjs';
import { writeIndex as writeFile } from '../../worldgen/scripts/structure-model-files.mjs';
import {
  buildSwallowsNestRuntime,
  buildSwallowsNestSkyline,
} from '../../worldgen/scripts/swallows-nest-model.mjs';
import {
  buildTakhtRuntime,
  buildTakhtSkyline,
} from '../../worldgen/scripts/takht-e-soleyman-model.mjs';
import {
  buildToompeaRuntime,
  buildToompeaSkyline,
} from '../../worldgen/scripts/toompea-castle-model.mjs';
import {
  buildTrakaiRuntime,
  buildTrakaiSkyline,
} from '../../worldgen/scripts/trakai-castle-model.mjs';
import {
  buildVaduzRuntime,
  buildVaduzSkyline,
} from '../../worldgen/scripts/vaduz-castle-model.mjs';
import {
  buildVincennesRuntime,
  buildVincennesSkyline,
} from '../../worldgen/scripts/vincennes-castle-model.mjs';
import {
  buildWartburgRuntime,
  buildWartburgSkyline,
} from '../../worldgen/scripts/wartburg-castle-model.mjs';
import {
  buildWarwickRuntime,
  buildWarwickSkyline,
} from '../../worldgen/scripts/warwick-castle-model.mjs';
import {
  buildWindsorRuntime,
  buildWindsorSkyline,
} from '../../worldgen/scripts/windsor-castle-model.mjs';
import { buildLandmarkLods } from './landmark-lods.mjs';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const text = async (path) =>
  (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n?/g, '\n');
const baseRecipeHash = hash(
  (await text('./landmark-lods.mjs')) + (await text('./landmark-hulls.mjs')),
);

import {
  buildKsiazEntrance,
  buildKsiazEntranceSkyline,
  ksiazEntranceSurfaces,
} from '../../../content/worldgen/source/places/u3/u35/ksiaz-entrances/models/ksiaz-entrance-models.mjs';

const entranceData = [
  '../../../content/worldgen/source/places/u3/u35/ksiaz_gatehouse/map-frame.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_north_officina/map-frame.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_south_officina/map-frame.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_zamkowy_hotel/map-frame.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_castle_and_park_complex/surface-means.json',
];

import {
  buildKsiazPark,
  buildKsiazParkSkyline,
  ksiazParkSurfaces,
} from '../../../content/worldgen/source/places/u3/u35/ksiaz-park-structures/models/ksiaz-park-models.mjs';

const parkData = [
  '../../../content/worldgen/source/places/u3/u35/ksiaz_hochberg_mausoleum/map-frame.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_forge/map-frame.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_hochberg_mausoleum/surface-means.json',
];

import {
  buildKsiazGate,
  buildKsiazGateSkyline,
  ksiazGateSurfaces,
} from '../../../content/worldgen/source/places/u3/u35/ksiaz-park-gates/models/ksiaz-gate-models.mjs';

const gateData = [
  '../../../content/worldgen/source/places/u3/u35/ksiaz_lion_gate/map-frame.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_lion_gate/surface-means.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_jezdziecka_park_gate/map-frame.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_hochberg_alley_gate/map-frame.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_hochberg_mausoleum/surface-means.json',
];

import {
  buildKsiazService,
  buildKsiazServiceSkyline,
  ksiazServiceSurfaces,
} from '../../../content/worldgen/source/places/u3/u35/ksiaz_forester_house/models/ksiaz-service-models.mjs';

const serviceData = [
  '../../../content/worldgen/source/places/u3/u35/ksiaz_forester_house/map-frame.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_forester_house/surface-means.json',
];

import {
  buildKsiazSwiss,
  buildKsiazSwissSkyline,
  ksiazSwissSurfaces,
} from '../../../content/worldgen/source/places/u3/u35/ksiaz-swiss-houses/models/ksiaz-swiss-models.mjs';

const swissData = [
  '../../../content/worldgen/source/places/u3/u35/ksiaz_swiss_house_i/map-frame.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_swiss_house_ii/map-frame.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_swiss_house_i/surface-means.json',
];

import {
  buildOldKsiaz,
  buildOldKsiazSkyline,
  oldKsiazSurfaces,
} from '../../../content/worldgen/source/places/u3/u35/old_ksiaz_ruins/models/old-ksiaz-model.mjs';

const oldKsiazData = [
  '../../../content/worldgen/source/places/u3/u35/old_ksiaz_ruins/map-frame.json',
  '../../../content/worldgen/source/places/u3/u35/old_ksiaz_ruins/surface-means.json',
];

import {
  buildKsiazStable,
  buildKsiazStableSkyline,
  ksiazStableSurfaces,
} from '../../../content/worldgen/source/places/u3/u35/ksiaz_stable_ensemble/models/ksiaz-stable-model.mjs';

const ksiazStableData = [
  '../../../content/worldgen/source/places/u3/u35/ksiaz_stable_ensemble/map-frame.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_stable_ensemble/surface-means.json',
];

import {
  buildKsiazPalm,
  buildKsiazPalmSkyline,
  ksiazPalmSurfaces,
} from '../../../content/worldgen/source/places/u3/u35/ksiaz_palm_house/models/ksiaz-palm-model.mjs';

const ksiazPalmData = [
  '../../../content/worldgen/source/places/u3/u35/ksiaz_palm_house/map-frame.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_palm_house/surface-means.json',
];

import {
  buildKsiazPalmService,
  buildKsiazPalmServiceSkyline,
  ksiazPalmServiceSurfaces,
} from '../../../content/worldgen/source/places/u3/u35/ksiaz-palm-services/models/ksiaz-palm-service-models.mjs';

const ksiazPalmServiceData = [
  '../../../content/worldgen/source/places/u3/u35/ksiaz_palm_administration/map-frame.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_palm_administration/surface-means.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_palm_utility/map-frame.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_palm_utility/surface-means.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_palm_residence/map-frame.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_palm_residence/surface-means.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_palm_boiler_range/map-frame.json',
  '../../../content/worldgen/source/places/u3/u35/ksiaz_palm_boiler_range/surface-means.json',
];
const recipes = {
  'molen.worldgen.structure.sanjo_ohashi_bridge': {
    build: buildSanjoSkyline,
    levels: buildSanjoRuntime,
    surfaces: sanjoRuntimeSurfaces,
    source: '../../worldgen/scripts/sanjo-ohashi-runtime.mjs',
    data: '../../worldgen/scripts/bridge-pattern-materials.mjs',
    errorMeters: 0.8,
  },
  'molen.worldgen.structure.ksiaz_palm_administration': {
    build: (o) => buildKsiazPalmServiceSkyline(o, 'ksiaz_palm_administration'),
    levels: (o, level) => buildKsiazPalmService(o, 'ksiaz_palm_administration', level),
    source:
      '../../../content/worldgen/source/places/u3/u35/ksiaz-palm-services/models/ksiaz-palm-service-models.mjs',
    data: ksiazPalmServiceData,
    errorMeters: 1,
    surfaces: ksiazPalmServiceSurfaces,
  },
  'molen.worldgen.structure.ksiaz_palm_utility': {
    build: (o) => buildKsiazPalmServiceSkyline(o, 'ksiaz_palm_utility'),
    levels: (o, level) => buildKsiazPalmService(o, 'ksiaz_palm_utility', level),
    source:
      '../../../content/worldgen/source/places/u3/u35/ksiaz-palm-services/models/ksiaz-palm-service-models.mjs',
    data: ksiazPalmServiceData,
    errorMeters: 1,
    surfaces: ksiazPalmServiceSurfaces,
  },
  'molen.worldgen.structure.ksiaz_palm_residence': {
    build: (o) => buildKsiazPalmServiceSkyline(o, 'ksiaz_palm_residence'),
    levels: (o, level) => buildKsiazPalmService(o, 'ksiaz_palm_residence', level),
    source:
      '../../../content/worldgen/source/places/u3/u35/ksiaz-palm-services/models/ksiaz-palm-service-models.mjs',
    data: ksiazPalmServiceData,
    errorMeters: 1,
    surfaces: ksiazPalmServiceSurfaces,
  },
  'molen.worldgen.structure.ksiaz_palm_boiler_range': {
    build: (o) => buildKsiazPalmServiceSkyline(o, 'ksiaz_palm_boiler_range'),
    levels: (o, level) => buildKsiazPalmService(o, 'ksiaz_palm_boiler_range', level),
    source:
      '../../../content/worldgen/source/places/u3/u35/ksiaz-palm-services/models/ksiaz-palm-service-models.mjs',
    data: ksiazPalmServiceData,
    errorMeters: 1,
    surfaces: ksiazPalmServiceSurfaces,
  },
  'molen.worldgen.structure.ksiaz_palm_house': {
    build: (o) => buildKsiazPalmSkyline(o, 'ksiaz_palm_house'),
    levels: (o, level) => buildKsiazPalm(o, 'ksiaz_palm_house', level),
    source:
      '../../../content/worldgen/source/places/u3/u35/ksiaz_palm_house/models/ksiaz-palm-model.mjs',
    data: ksiazPalmData,
    errorMeters: 1,
    surfaces: ksiazPalmSurfaces,
  },
  'molen.worldgen.structure.ksiaz_stable_ensemble': {
    build: (o) => buildKsiazStableSkyline(o, 'ksiaz_stable_ensemble'),
    levels: (o, level) => buildKsiazStable(o, 'ksiaz_stable_ensemble', level),
    source:
      '../../../content/worldgen/source/places/u3/u35/ksiaz_stable_ensemble/models/ksiaz-stable-model.mjs',
    data: ksiazStableData,
    errorMeters: 1,
    surfaces: ksiazStableSurfaces,
  },
  'molen.worldgen.structure.old_ksiaz_ruins': {
    build: (o) => buildOldKsiazSkyline(o),
    levels: (o, level) => buildOldKsiaz(o, 'old_ksiaz_ruins', level),
    source:
      '../../../content/worldgen/source/places/u3/u35/old_ksiaz_ruins/models/old-ksiaz-model.mjs',
    data: oldKsiazData,
    errorMeters: 1,
    surfaces: oldKsiazSurfaces,
  },
  'molen.worldgen.structure.ksiaz_swiss_house_i': {
    build: (o) => buildKsiazSwissSkyline(o, 'ksiaz_swiss_house_i'),
    levels: (o, level) => buildKsiazSwiss(o, 'ksiaz_swiss_house_i', level),
    source:
      '../../../content/worldgen/source/places/u3/u35/ksiaz-swiss-houses/models/ksiaz-swiss-models.mjs',
    data: swissData,
    errorMeters: 1,
    surfaces: ksiazSwissSurfaces,
  },
  'molen.worldgen.structure.ksiaz_swiss_house_ii': {
    build: (o) => buildKsiazSwissSkyline(o, 'ksiaz_swiss_house_ii'),
    levels: (o, level) => buildKsiazSwiss(o, 'ksiaz_swiss_house_ii', level),
    source:
      '../../../content/worldgen/source/places/u3/u35/ksiaz-swiss-houses/models/ksiaz-swiss-models.mjs',
    data: swissData,
    errorMeters: 1,
    surfaces: ksiazSwissSurfaces,
  },
  'molen.worldgen.structure.ksiaz_forester_house': {
    build: (o) => buildKsiazServiceSkyline(o, 'ksiaz_forester_house'),
    levels: (o, level) => buildKsiazService(o, 'ksiaz_forester_house', level),
    source:
      '../../../content/worldgen/source/places/u3/u35/ksiaz_forester_house/models/ksiaz-service-models.mjs',
    data: serviceData,
    errorMeters: 1,
    surfaces: ksiazServiceSurfaces,
  },
  'molen.worldgen.structure.ksiaz_lion_gate': {
    build: (o) => buildKsiazGateSkyline(o, 'ksiaz_lion_gate'),
    levels: (o, level) => buildKsiazGate(o, 'ksiaz_lion_gate', level),
    source:
      '../../../content/worldgen/source/places/u3/u35/ksiaz-park-gates/models/ksiaz-gate-models.mjs',
    data: gateData,
    errorMeters: 1,
    surfaces: ksiazGateSurfaces,
  },
  'molen.worldgen.structure.ksiaz_jezdziecka_park_gate': {
    build: (o) => buildKsiazGateSkyline(o, 'ksiaz_jezdziecka_park_gate'),
    levels: (o, level) => buildKsiazGate(o, 'ksiaz_jezdziecka_park_gate', level),
    source:
      '../../../content/worldgen/source/places/u3/u35/ksiaz-park-gates/models/ksiaz-gate-models.mjs',
    data: gateData,
    errorMeters: 1,
    surfaces: ksiazGateSurfaces,
  },
  'molen.worldgen.structure.ksiaz_hochberg_alley_gate': {
    build: (o) => buildKsiazGateSkyline(o, 'ksiaz_hochberg_alley_gate'),
    levels: (o, level) => buildKsiazGate(o, 'ksiaz_hochberg_alley_gate', level),
    source:
      '../../../content/worldgen/source/places/u3/u35/ksiaz-park-gates/models/ksiaz-gate-models.mjs',
    data: gateData,
    errorMeters: 1,
    surfaces: ksiazGateSurfaces,
  },
  'molen.worldgen.structure.ksiaz_hochberg_mausoleum': {
    build: (o) => buildKsiazParkSkyline(o, 'ksiaz_hochberg_mausoleum'),
    levels: (o, level) => buildKsiazPark(o, 'ksiaz_hochberg_mausoleum', level),
    source:
      '../../../content/worldgen/source/places/u3/u35/ksiaz-park-structures/models/ksiaz-park-models.mjs',
    data: parkData,
    errorMeters: 1,
    surfaces: ksiazParkSurfaces,
  },
  'molen.worldgen.structure.ksiaz_forge': {
    build: (o) => buildKsiazParkSkyline(o, 'ksiaz_forge'),
    levels: (o, level) => buildKsiazPark(o, 'ksiaz_forge', level),
    source:
      '../../../content/worldgen/source/places/u3/u35/ksiaz-park-structures/models/ksiaz-park-models.mjs',
    data: parkData,
    errorMeters: 1,
    surfaces: ksiazParkSurfaces,
  },
  'molen.worldgen.structure.ksiaz_gatehouse': {
    build: (o) => buildKsiazEntranceSkyline(o, 'ksiaz_gatehouse'),
    levels: (o, level) => buildKsiazEntrance(o, 'ksiaz_gatehouse', level),
    source:
      '../../../content/worldgen/source/places/u3/u35/ksiaz-entrances/models/ksiaz-entrance-models.mjs',
    data: entranceData,
    errorMeters: 1,
    surfaces: ksiazEntranceSurfaces,
  },
  'molen.worldgen.structure.ksiaz_north_officina': {
    build: (o) => buildKsiazEntranceSkyline(o, 'ksiaz_north_officina'),
    levels: (o, level) => buildKsiazEntrance(o, 'ksiaz_north_officina', level),
    source:
      '../../../content/worldgen/source/places/u3/u35/ksiaz-entrances/models/ksiaz-entrance-models.mjs',
    data: entranceData,
    errorMeters: 1,
    surfaces: ksiazEntranceSurfaces,
  },
  'molen.worldgen.structure.ksiaz_south_officina': {
    build: (o) => buildKsiazEntranceSkyline(o, 'ksiaz_south_officina'),
    levels: (o, level) => buildKsiazEntrance(o, 'ksiaz_south_officina', level),
    source:
      '../../../content/worldgen/source/places/u3/u35/ksiaz-entrances/models/ksiaz-entrance-models.mjs',
    data: entranceData,
    errorMeters: 1,
    surfaces: ksiazEntranceSurfaces,
  },
  'molen.worldgen.structure.ksiaz_zamkowy_hotel': {
    build: (o) => buildKsiazEntranceSkyline(o, 'ksiaz_zamkowy_hotel'),
    levels: (o, level) => buildKsiazEntrance(o, 'ksiaz_zamkowy_hotel', level),
    source:
      '../../../content/worldgen/source/places/u3/u35/ksiaz-entrances/models/ksiaz-entrance-models.mjs',
    data: entranceData,
    errorMeters: 1,
    surfaces: ksiazEntranceSurfaces,
  },
  'molen.worldgen.structure.nuremberg_castle': {
    build: buildNurembergSkyline,
    levels: buildNurembergRuntime,
    source: '../../worldgen/scripts/nuremberg-castle-model.mjs',
    data: [
      '../../../content/worldgen/source/places/u0/u0z/nuremberg_castle/map-frame.json',
      '../../../content/worldgen/source/places/u0/u0z/nuremberg_castle/surface-means.json',
    ],
    errorMeters: 1,
    surfaces: nurembergSurfaces,
  },
  'molen.worldgen.structure.egeskov_castle': {
    build: buildEgeskovSkyline,
    levels: buildEgeskovRuntime,
    source: '../../worldgen/scripts/egeskov-castle-model.mjs',
    data: [
      '../../../content/worldgen/source/places/u1/u1z/egeskov_castle/map-frame.json',
      '../../../content/worldgen/source/places/u1/u1z/egeskov_castle/surface-means.json',
    ],
    errorMeters: 1,
    surfaces: egeskovSurfaces,
  },
  'molen.worldgen.structure.wawel_castle': {
    build: buildWawelSkyline,
    levels: buildWawelRuntime,
    source: '../../worldgen/scripts/wawel-castle-model.mjs',
    data: [
      '../../../content/worldgen/source/places/u2/u2y/wawel_castle/map-frame.json',
      '../../../content/worldgen/source/places/u2/u2y/wawel_castle/surface-means.json',
    ],
    errorMeters: 1,
    surfaces: wawelSurfaces,
  },
  'molen.worldgen.structure.saint_michaels_castle': {
    build: buildSaintMichaelSkyline,
    levels: buildSaintMichaelRuntime,
    source: '../../worldgen/scripts/saint-michaels-castle-model.mjs',
    data: [
      '../../../content/worldgen/source/places/ud/udt/saint_michaels_castle/map-frame.json',
      '../../../content/worldgen/source/places/ud/udt/saint_michaels_castle/surface-means.json',
    ],
    errorMeters: 6,
    surfaces: saintMichaelSurfaces,
  },
  'molen.worldgen.structure.hochosterwitz_castle': {
    build: buildHochosterwitzSkyline,
    levels: buildHochosterwitzRuntime,
    source: '../../worldgen/scripts/hochosterwitz-castle-model.mjs',
    data: [
      '../../../content/worldgen/source/places/u2/u26/hochosterwitz_castle/map-frame.json',
      '../../../content/worldgen/source/places/u2/u26/hochosterwitz_castle/surface-means.json',
      '../../../content/worldgen/source/places/u2/u26/hochosterwitz_castle/terrain-samples.json',
    ],
    errorMeters: 6,
    surfaces: hochosterwitzSurfaces,
  },
  'molen.worldgen.structure.liechtenstein_castle': {
    build: buildLiechtensteinSkyline,
    levels: buildLiechtensteinRuntime,
    source: '../../worldgen/scripts/liechtenstein-castle-model.mjs',
    data: [
      '../../../content/worldgen/source/places/u2/u2e/liechtenstein_castle/map-frame.json',
      '../../../content/worldgen/source/places/u2/u2e/liechtenstein_castle/surface-means.json',
    ],
    errorMeters: 2.5,
    surfaces: liechtensteinSurfaces,
  },
  'molen.worldgen.structure.arundel_castle': {
    build: buildArundelSkyline,
    levels: buildArundelRuntime,
    source: '../../worldgen/scripts/arundel-castle-model.mjs',
    data: [
      '../../../content/worldgen/source/places/gc/gcp/arundel_castle/map-frame.json',
      '../../../content/worldgen/source/places/gc/gcp/arundel_castle/surface-means.json',
    ],
    errorMeters: 5,
    surfaces: arundelSurfaces,
  },
  'molen.worldgen.structure.leeds_castle': {
    build: buildLeedsSkyline,
    levels: buildLeedsRuntime,
    source: '../../worldgen/scripts/leeds-castle-model.mjs',
    data: [
      '../../../content/worldgen/source/places/u1/u10/leeds_castle/map-frame.json',
      '../../../content/worldgen/source/places/u1/u10/leeds_castle/surface-means.json',
    ],
    errorMeters: 2,
    surfaces: leedsSurfaces,
  },
  'molen.worldgen.structure.turku_castle': {
    build: buildTurkuSkyline,
    levels: buildTurkuRuntime,
    source: '../../worldgen/scripts/turku-castle-model.mjs',
    data: [
      '../../../content/worldgen/source/places/u6/u6x/turku_castle/map-frame.json',
      '../../../content/worldgen/source/places/u6/u6x/turku_castle/surface-means.json',
    ],
    errorMeters: 2,
    surfaces: turkuSurfaces,
  },
  'molen.worldgen.structure.gediminas_tower': {
    build: buildGediminasSkyline,
    levels: buildGediminasRuntime,
    source: '../../worldgen/scripts/gediminas-tower-model.mjs',
    data: [
      '../../../content/worldgen/source/places/u9/u99/gediminas_tower/map-frame.json',
      '../../../content/worldgen/source/places/u9/u99/gediminas_tower/surface-means.json',
    ],
    errorMeters: 0.5,
    surfaces: gediminasSurfaces,
  },
  'molen.worldgen.structure.ljubljana_castle': {
    build: buildLjubljanaSkyline,
    levels: buildLjubljanaRuntime,
    source: '../../worldgen/scripts/ljubljana-castle-model.mjs',
    data: [
      '../../../content/worldgen/source/places/u2/u24/ljubljana_castle/map-frame.json',
      '../../../content/worldgen/source/places/u2/u24/ljubljana_castle/surface-means.json',
    ],
    errorMeters: 1,
    surfaces: ljubljanaSurfaces,
  },
  'molen.worldgen.structure.castle_of_saint_george': {
    build: buildSaoJorgeSkyline,
    levels: buildSaoJorgeRuntime,
    source: '../../worldgen/scripts/sao-jorge-castle-model.mjs',
    data: [
      '../../../content/worldgen/source/places/ey/eyc/castle_of_saint_george/map-frame.json',
      '../../../content/worldgen/source/places/ey/eyc/castle_of_saint_george/surface-means.json',
    ],
    errorMeters: 1,
    surfaces: saoJorgeSurfaces,
  },
  'molen.worldgen.structure.haapsalu_castle': {
    build: buildHaapsaluSkyline,
    levels: buildHaapsaluRuntime,
    source: '../../worldgen/scripts/haapsalu-castle-model.mjs',
    data: [
      '../../../content/worldgen/source/places/ud/ud2/haapsalu_castle/map-frame.json',
      '../../../content/worldgen/source/places/ud/ud2/haapsalu_castle/surface-means.json',
    ],
    errorMeters: 1,
    surfaces: haapsaluSurfaces,
  },
  'molen.worldgen.structure.kalmar_castle': {
    build: buildKalmarSkyline,
    levels: buildKalmarRuntime,
    source: '../../worldgen/scripts/kalmar-castle-model.mjs',
    data: [
      '../../../content/worldgen/source/places/u6/u65/kalmar_castle/map-frame.json',
      '../../../content/worldgen/source/places/u6/u65/kalmar_castle/surface-means.json',
    ],
    errorMeters: 1,
    surfaces: kalmarSurfaces,
  },
  'molen.worldgen.structure.pembroke_castle': {
    build: buildPembrokeSkyline,
    levels: buildPembrokeRuntime,
    source: '../../worldgen/scripts/pembroke-castle-model.mjs',
    data: [
      '../../../content/worldgen/source/places/gc/gch/pembroke_castle/map-frame.json',
      '../../../content/worldgen/source/places/gc/gch/pembroke_castle/relief-grid.json',
      '../../../content/worldgen/source/places/gc/gch/pembroke_castle/surface-means.json',
    ],
    errorMeters: 1,
    surfaces: pembrokeSurfaces,
  },
  'molen.worldgen.structure.aljaferia': {
    build: buildAljaferiaSkyline,
    levels: buildAljaferiaRuntime,
    source: '../../worldgen/scripts/aljaferia-palace-model.mjs',
    data: [
      '../../../content/worldgen/source/places/ez/ezr/aljaferia/map-frame.json',
      '../../../content/worldgen/source/places/ez/ezr/aljaferia/surface-means.json',
    ],
    errorMeters: 1,
    surfaces: aljaferiaSurfaces,
  },
  'molen.worldgen.structure.rumeli_hisar': {
    build: buildRumeliSkyline,
    levels: buildRumeliRuntime,
    source: '../../worldgen/scripts/rumeli-fortress-model.mjs',
    data: [
      '../../../content/worldgen/source/places/sx/sxk/rumeli_hisar/map-frame.json',
      '../../../content/worldgen/source/places/sx/sxk/rumeli_hisar/relief-grid.json',
      '../../../content/worldgen/source/places/sx/sxk/rumeli_hisar/surface-means.json',
      '../../worldgen/scripts/authored-wall-openings.mjs',
    ],
    errorMeters: 2,
    surfaces: rumeliSurfaces,
  },
  'molen.worldgen.structure.devin_castle': {
    build: buildDevinSkyline,
    levels: buildDevinRuntime,
    source: '../../worldgen/scripts/devin-castle-model.mjs',
    data: [
      '../../../content/worldgen/source/places/u2/u2s/devin_castle/map-frame.json',
      '../../../content/worldgen/source/places/u2/u2s/devin_castle/openings.json',
      '../../worldgen/scripts/authored-wall-openings.mjs',
      '../../../content/worldgen/source/places/u2/u2s/devin_castle/relief-grid.json',
      '../../../content/worldgen/source/places/u2/u2s/devin_castle/surface-means.json',
    ],
    errorMeters: 2,
    surfaces: devinSurfaces,
  },
  'molen.worldgen.structure.ksiaz_castle_and_park_complex': {
    build: buildKsiazSkyline,
    levels: buildKsiazRuntime,
    source: '../../worldgen/scripts/ksiaz-castle-model.mjs',
    data: [
      '../../../content/worldgen/source/places/u3/u35/ksiaz_castle_and_park_complex/map-frame.json',
      '../../../content/worldgen/source/places/u3/u35/ksiaz_castle_and_park_complex/surface-means.json',
    ],
    errorMeters: 1,
    surfaces: {
      sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.65, metallic: 0.7 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
    },
  },
  'molen.worldgen.structure.warwick_castle': {
    build: buildWarwickSkyline,
    levels: buildWarwickRuntime,
    source: '../../worldgen/scripts/warwick-castle-model.mjs',
    data: [
      '../../../content/worldgen/source/places/gc/gcq/warwick_castle/map-frame.json',
      '../../../content/worldgen/source/places/gc/gcq/warwick_castle/surface-means.json',
    ],
    errorMeters: 1,
    surfaces: {
      sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
      glass: { slot: 'window', roughness: 0.45, metallic: 0 },
    },
  },
  'molen.worldgen.structure.castel_nuovo': {
    build: buildCastelNuovoSkyline,
    levels: buildCastelNuovoRuntime,
    source: '../../worldgen/scripts/castel-nuovo-model.mjs',
    data: '../../../content/worldgen/source/places/sr/sr6/castel_nuovo/map-frame.json',
    errorMeters: 1,
    surfaces: {
      basalt: { slot: 'wall', graph: 'stone_basalt', roughness: 0.94, metallic: 0 },
      sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
      marble: { slot: 'wall', graph: 'stone_marble', roughness: 0.78, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
      glass: { slot: 'window', roughness: 0.45, metallic: 0 },
    },
  },
  'molen.worldgen.structure.konopiste_castle': {
    build: buildKonopisteSkyline,
    levels: buildKonopisteRuntime,
    source: '../../worldgen/scripts/konopiste-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u2/u2f/konopiste_castle/map-frame.json',
    errorMeters: 1,
    surfaces: {
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.86, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
      glass: { slot: 'window', roughness: 0.45, metallic: 0 },
    },
  },
  'molen.worldgen.structure.elmina_castle': {
    build: buildElminaSkyline,
    levels: buildElminaRuntime,
    source: '../../worldgen/scripts/elmina-castle-model.mjs',
    data: '../../../content/worldgen/source/places/eb/ebz/elmina_castle/map-frame.json',
    errorMeters: 1,
    surfaces: {
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.86, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
      glass: { slot: 'window', roughness: 0.45, metallic: 0 },
    },
  },
  'molen.worldgen.structure.kromeriz_castle': {
    build: buildKromerizSkyline,
    levels: buildKromerizRuntime,
    source: '../../worldgen/scripts/kromeriz-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u2/u2u/kromeriz_castle/map-frame.json',
    errorMeters: 1,
    surfaces: {
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      patina: { slot: 'roof', graph: 'metal_copper', roughness: 0.8, metallic: 0.05 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
      glass: { slot: 'window', roughness: 0.45, metallic: 0 },
    },
  },
  'molen.worldgen.structure.corvin_castle': {
    build: buildCorvinSkyline,
    levels: buildCorvinRuntime,
    source: '../../worldgen/scripts/corvin-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u8/u80/corvin_castle/map-frame.json',
    errorMeters: 1,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.86, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.86, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
      glass: { slot: 'window', roughness: 0.45, metallic: 0 },
    },
  },
  'molen.worldgen.structure.dover_castle': {
    build: buildDoverSkyline,
    levels: buildDoverRuntime,
    source: '../../worldgen/scripts/dover-castle-model.mjs',
    data: [
      '../../../content/worldgen/source/places/u1/u10/dover_castle/map-frame.json',
      '../../../content/worldgen/source/places/u1/u10/dover_castle/relief-grid.json',
    ],
    errorMeters: 3,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.85, metallic: 0 },
      stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.86, metallic: 0 },
      brick: { slot: 'foundation', graph: 'brick', roughness: 0.9, metallic: 0 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
      recess: { slot: 'window', roughness: 0.45, metallic: 0 },
    },
  },
  'molen.worldgen.structure.beaumaris_castle': {
    build: buildBeaumarisSkyline,
    levels: buildBeaumarisRuntime,
    source: '../../worldgen/scripts/beaumaris-castle-model.mjs',
    data: '../../../content/worldgen/source/places/gc/gcm/beaumaris_castle/map-frame.json',
    errorMeters: 1,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      weathered: {
        slot: 'foundation',
        graph: 'stone_limestone_weathered',
        roughness: 0.9,
        metallic: 0,
      },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
    },
  },
  'molen.worldgen.structure.akershus_fortress': {
    build: buildAkershusSkyline,
    levels: buildAkershusRuntime,
    source: '../../worldgen/scripts/akershus-fortress-model.mjs',
    data: '../../../content/worldgen/source/places/u4/u4x/akershus_fortress/map-frame.json',
    errorMeters: 2,
    surfaces: {
      brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
      stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.85, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      patina: { slot: 'roof', graph: 'metal_copper', roughness: 0.8, metallic: 0.05 },
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
    },
  },
  'molen.worldgen.structure.acrocorinth': {
    build: buildAcrocorinthSkyline,
    levels: buildAcrocorinthRuntime,
    source: '../../worldgen/scripts/acrocorinth-model.mjs',
    data: [
      '../../../content/worldgen/source/places/sw/sw8/acrocorinth/map-frame.json',
      '../../../content/worldgen/source/places/sw/sw8/acrocorinth/survey-lines.json',
      '../../../content/worldgen/source/places/sw/sw8/acrocorinth/relief-grid.json',
    ],
    errorMeters: 5,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      weathered: {
        slot: 'foundation',
        graph: 'stone_limestone_weathered',
        roughness: 0.9,
        metallic: 0,
      },
      aggregate: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },
  'molen.worldgen.structure.trakai_island_castle': {
    build: buildTrakaiSkyline,
    levels: buildTrakaiRuntime,
    source: '../../worldgen/scripts/trakai-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u9/u99/trakai_island_castle/map-frame.json',
    errorMeters: 1.5,
    surfaces: {
      brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
      stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.85, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
    },
  },
  'molen.worldgen.structure.gripsholm_castle': {
    build: buildGripsholmSkyline,
    levels: buildGripsholmRuntime,
    source: '../../worldgen/scripts/gripsholm-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u6/u6s/gripsholm_castle/map-frame.json',
    errorMeters: 1.5,
    surfaces: {
      brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
      stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.85, metallic: 0 },
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      patina: { slot: 'roof', graph: 'metal_copper', roughness: 0.8, metallic: 0.05 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
    },
  },
  'molen.worldgen.structure.kamianets_podilskyi_castle': {
    build: buildKamianetsSkyline,
    levels: buildKamianetsRuntime,
    source: '../../worldgen/scripts/kamianets-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u8/u8d/kamianets_podilskyi_castle/map-frame.json',
    errorMeters: 0.5,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      shingle: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.9, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
    },
  },
  'molen.worldgen.structure.lubarts_castle': {
    build: buildLubartSkyline,
    levels: buildLubartRuntime,
    source: '../../worldgen/scripts/lubart-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u9/u94/lubarts_castle/map-frame.json',
    errorMeters: 0.5,
    surfaces: {
      brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      shingle: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.9, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
    },
  },
  'molen.worldgen.structure.miramare_castle': {
    build: buildMiramareSkyline,
    levels: buildMiramareRuntime,
    source: '../../worldgen/scripts/miramare-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u2/u21/miramare_castle/map-frame.json',
    errorMeters: 0.3,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
    },
  },
  'molen.worldgen.structure.dublin_castle': {
    build: buildDublinSkyline,
    levels: buildDublinRuntime,
    source: '../../worldgen/scripts/dublin-castle-model.mjs',
    data: '../../../content/worldgen/source/places/gc/gc7/dublin_castle/map-frame.json',
    errorMeters: 0.7,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      patina: { slot: 'roof', graph: 'metal_copper', roughness: 0.8, metallic: 0.05 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
    },
  },
  'molen.worldgen.structure.hermann_castle': {
    build: buildHermannSkyline,
    levels: buildHermannRuntime,
    source: '../../worldgen/scripts/hermann-castle-model.mjs',
    data: '../../../content/worldgen/source/places/ud/uds/hermann_castle/map-frame.json',
    errorMeters: 0.7,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
    },
  },
  'molen.worldgen.structure.caernarfon_castle': {
    build: buildCaernarfonSkyline,
    levels: buildCaernarfonRuntime,
    source: '../../worldgen/scripts/caernarfon-castle-model.mjs',
    data: '../../../content/worldgen/source/places/gc/gck/caernarfon_castle/map-frame.json',
    errorMeters: 0.6,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
    },
  },
  'molen.worldgen.structure.kuressaare_castle': {
    build: buildKuressaareSkyline,
    levels: buildKuressaareRuntime,
    source: '../../worldgen/scripts/kuressaare-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u6/u6r/kuressaare_castle/map-frame.json',
    errorMeters: 0.3,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
    },
  },
  'molen.worldgen.structure.swallows_nest': {
    build: buildSwallowsNestSkyline,
    levels: buildSwallowsNestRuntime,
    source: '../../worldgen/scripts/swallows-nest-model.mjs',
    data: '../../../content/worldgen/source/places/sz/szb/swallows_nest/map-frame.json',
    errorMeters: 0.2,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
    },
  },
  'molen.worldgen.structure.conwy_castle': {
    build: buildConwySkyline,
    levels: buildConwyRuntime,
    source: '../../worldgen/scripts/conwy-castle-model.mjs',
    data: '../../../content/worldgen/source/places/gc/gcm/conwy_castle/map-frame.json',
    errorMeters: 0.8,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
    },
  },
  'molen.worldgen.structure.vaduz_castle': {
    build: buildVaduzSkyline,
    levels: buildVaduzRuntime,
    source: '../../worldgen/scripts/vaduz-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u0/u0q/vaduz_castle/map-frame.json',
    errorMeters: 0.6,
    surfaces: {
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
    },
  },
  'molen.worldgen.structure.hohensalzburg_fortress': {
    build: buildHohensalzburgSkyline,
    levels: buildHohensalzburgRuntime,
    source: '../../worldgen/scripts/hohensalzburg-fortress-model.mjs',
    data: '../../../content/worldgen/source/places/u2/u23/hohensalzburg_fortress/map-frame.json',
    errorMeters: 1.5,
    surfaces: {
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      patina: { slot: 'roof', graph: 'metal_copper', roughness: 0.8, metallic: 0.05 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
    },
  },
  'molen.worldgen.structure.heidelberg_castle': {
    build: buildHeidelbergSkyline,
    levels: buildHeidelbergRuntime,
    source: '../../worldgen/scripts/heidelberg-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u0/u0y/heidelberg_castle/map-frame.json',
    errorMeters: 1.5,
    surfaces: {
      sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
    },
  },
  'molen.worldgen.structure.eltz_castle': {
    build: buildEltzSkyline,
    levels: buildEltzRuntime,
    source: '../../worldgen/scripts/eltz-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u0/u0v/eltz_castle/map-frame.json',
    errorMeters: 0.7,
    surfaces: {
      sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
    },
  },
  'molen.worldgen.structure.chateau_de_vincennes': {
    build: buildVincennesSkyline,
    levels: buildVincennesRuntime,
    source: '../../worldgen/scripts/vincennes-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u0/u09/chateau_de_vincennes/map-frame.json',
    errorMeters: 2,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
    },
  },
  'molen.worldgen.structure.riga_castle': {
    build: buildRigaSkyline,
    levels: buildRigaRuntime,
    source: '../../worldgen/scripts/riga-castle-model.mjs',
    data: '../../../content/worldgen/source/places/ud/ud1/riga_castle/map-frame.json',
    errorMeters: 1.5,
    surfaces: {
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.85, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      patina: { slot: 'roof', graph: 'metal_copper', roughness: 0.8, metallic: 0.05 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
    },
  },
  'molen.worldgen.structure.toompea_castle': {
    build: buildToompeaSkyline,
    levels: buildToompeaRuntime,
    source: '../../worldgen/scripts/toompea-castle-model.mjs',
    data: '../../../content/worldgen/source/places/ud/ud9/toompea_castle/map-frame.json',
    errorMeters: 1.5,
    surfaces: {
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.85, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
    },
  },
  'molen.worldgen.structure.stirling_castle': {
    build: buildStirlingSkyline,
    levels: buildStirlingRuntime,
    source: '../../worldgen/scripts/stirling-castle-model.mjs',
    data: '../../../content/worldgen/source/places/gc/gcv/stirling_castle/map-frame.json',
    errorMeters: 1.5,
    surfaces: {
      sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
    },
  },
  'molen.worldgen.structure.royal_castle_in_warsaw': {
    build: buildWarsawSkyline,
    levels: buildWarsawRuntime,
    source: '../../worldgen/scripts/warsaw-royal-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u3/u3q/royal_castle_in_warsaw/map-frame.json',
    errorMeters: 1.5,
    surfaces: {
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.5, metallic: 0.85 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
    },
  },
  'molen.worldgen.structure.khotyn_fortress': {
    build: buildKhotynSkyline,
    levels: buildKhotynRuntime,
    source: '../../worldgen/scripts/khotyn-fortress-model.mjs',
    errorMeters: 1.2,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
      shingle: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.9, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },
  'molen.worldgen.structure.shanhai_pass': {
    build: buildShanhaiSkyline,
    levels: buildShanhaiRuntime,
    source: '../../worldgen/scripts/shanhai-pass-model.mjs',
    errorMeters: 0.8,
    surfaces: {
      brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },
  'molen.worldgen.structure.sforza_castle': {
    build: buildSforzaSkyline,
    levels: buildSforzaRuntime,
    source: '../../worldgen/scripts/sforza-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u0/u0n/sforza_castle/map-parts.json',
    errorMeters: 2,
    surfaces: {
      brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
      stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.85, metallic: 0 },
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.5, metallic: 0.85 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      aggregate: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },

  'molen.worldgen.structure.citadel_of_salah_ed_din': {
    build: buildSalahSkyline,
    levels: buildSalahRuntime,
    source: '../../worldgen/scripts/salah-citadel-model.mjs',
    data: '../../../content/worldgen/source/places/sy/sy3/citadel_of_salah_ed_din/map-parts.json',
    errorMeters: 3,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      weathered: {
        slot: 'foundation',
        graph: 'stone_limestone_weathered',
        roughness: 0.9,
        metallic: 0,
      },
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      aggregate: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },

  'molen.worldgen.structure.durham_castle': {
    build: buildDurhamSkyline,
    levels: buildDurhamRuntime,
    source: '../../worldgen/scripts/durham-castle-model.mjs',
    data: '../../../content/worldgen/source/places/gc/gcw/durham_castle/map-parts.json',
    errorMeters: 2,
    surfaces: {
      sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.88, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.85, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.65, metallic: 0.7 },
      aggregate: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },
  'molen.worldgen.structure.buda_castle': {
    build: buildBudaSkyline,
    levels: buildBudaRuntime,
    source: '../../worldgen/scripts/buda-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u2/u2m/buda_castle/map-parts.json',
    errorMeters: 2,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.88, metallic: 0 },
      copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.68, metallic: 0.6 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.85, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.65, metallic: 0.7 },
      aggregate: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },
  'molen.worldgen.structure.nesvizh_castle': {
    build: buildNesvizhSkyline,
    levels: buildNesvizhRuntime,
    source: '../../worldgen/scripts/nesvizh-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u9/u96/nesvizh_castle/map-parts.json',
    errorMeters: 2,
    surfaces: {
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.85, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.65, metallic: 0.7 },
      aggregate: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },
  'molen.worldgen.structure.bratislava_castle': {
    build: buildBratislavaSkyline,
    levels: buildBratislavaRuntime,
    source: '../../worldgen/scripts/bratislava-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u2/u2s/bratislava_castle/map-parts.json',
    errorMeters: 2,
    surfaces: {
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.85, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.65, metallic: 0.7 },
      aggregate: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },
  'molen.worldgen.structure.hohenzollern_castle': {
    build: buildHohenzollernSkyline,
    levels: buildHohenzollernRuntime,
    source: '../../worldgen/scripts/hohenzollern-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u0/u0w/hohenzollern_castle/map-parts.json',
    errorMeters: 2,
    surfaces: {
      sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.85, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
    },
  },

  'molen.worldgen.structure.kernave': {
    build: buildKernaveSkyline,
    levels: buildKernaveRuntime,
    source: '../../worldgen/scripts/kernave-landscape-model.mjs',
    data: '../../../content/worldgen/source/places/u9/u9c/kernave/map-parts.json',
    errorMeters: 12,
    surfaces: {
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
      wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.82, metallic: 0 },
      aggregate: { graph: 'gravel', slot: 'foundation', roughness: 0.98, metallic: 0 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },
  'molen.worldgen.structure.mir_castle_complex': {
    build: buildMirSkyline,
    levels: buildMirRuntime,
    source: '../../worldgen/scripts/mir-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u9/u9d/mir_castle_complex/map-parts.json',
    errorMeters: 2,
    surfaces: {
      brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.85, metallic: 0 },
      sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.85, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },
  'molen.worldgen.structure.alamut_castle': {
    build: buildAlamutSkyline,
    levels: buildAlamutRuntime,
    source: '../../worldgen/scripts/alamut-castle-model.mjs',
    data: '../../../content/worldgen/source/places/tn/tn7/alamut_castle/map-parts.json',
    errorMeters: 4,
    surfaces: {
      sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
      weathered: {
        slot: 'foundation',
        graph: 'stone_limestone_weathered',
        roughness: 0.9,
        metallic: 0,
      },
      brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },

  'molen.worldgen.structure.bran_castle': {
    build: buildBranSkyline,
    levels: buildBranRuntime,
    source: '../../worldgen/scripts/bran-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u8/u84/bran_castle/map-parts.json',
    errorMeters: 2,
    surfaces: {
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.85, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.85, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },
  'molen.worldgen.structure.karlstejn_castle': {
    build: buildKarlstejnSkyline,
    levels: buildKarlstejnRuntime,
    source: '../../worldgen/scripts/karlstejn-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u2/u2f/karlstejn_castle/map-parts.json',
    errorMeters: 5,
    surfaces: {
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.85, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },
  'molen.worldgen.structure.takht_e_soleyman': {
    build: buildTakhtSkyline,
    levels: buildTakhtRuntime,
    source: '../../worldgen/scripts/takht-e-soleyman-model.mjs',
    data: '../../../content/worldgen/source/places/tn/tn9/takht_e_soleyman/map-parts.json',
    errorMeters: 8,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      weathered: {
        slot: 'foundation',
        graph: 'stone_limestone_weathered',
        roughness: 0.9,
        metallic: 0,
      },
      travertine: { slot: 'wall', graph: 'stone_travertine', roughness: 0.82, metallic: 0 },
      brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
      sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },
  'molen.worldgen.structure.hofburg_palace': {
    build: buildHofburgSkyline,
    levels: buildHofburgRuntime,
    source: '../../worldgen/scripts/hofburg-palace-model.mjs',
    data: '../../../content/worldgen/source/places/u2/u2e/hofburg_palace/map-parts.json',
    errorMeters: 10,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.5, metallic: 0.85 },
      stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.85, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      gold: { slot: 'trim', graph: 'metal_stainless', roughness: 0.3, metallic: 1 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
    },
  },
  'molen.worldgen.structure.kronborg_castle': {
    build: buildKronborgSkyline,
    levels: buildKronborgRuntime,
    source: '../../worldgen/scripts/kronborg-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u3/u3b/kronborg_castle/map-parts.json',
    errorMeters: 5,
    surfaces: {
      sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.5, metallic: 0.85 },
      brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
      stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.85, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      gold: { slot: 'trim', graph: 'metal_stainless', roughness: 0.3, metallic: 1 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
    },
  },

  'molen.worldgen.structure.malbork_castle': {
    build: buildMalborkSkyline,
    levels: buildMalborkRuntime,
    source: '../../worldgen/scripts/malbork-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u3/u3t/malbork_castle/map-parts.json',
    errorMeters: 8,
    surfaces: {
      brick: { slot: 'wall', graph: 'brick', roughness: 0.87, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.86, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
    },
  },
  'molen.worldgen.structure.edinburgh_castle': {
    build: buildEdinburghSkyline,
    levels: buildEdinburghRuntime,
    source: '../../worldgen/scripts/edinburgh-castle-model.mjs',
    data: '../../../content/worldgen/source/places/gc/gcv/edinburgh_castle/map-parts.json',
    errorMeters: 5,
    surfaces: {
      sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      weathered: {
        slot: 'foundation',
        graph: 'stone_limestone_weathered',
        roughness: 0.9,
        metallic: 0,
      },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
    },
  },

  'molen.worldgen.structure.wartburg': {
    build: buildWartburgSkyline,
    levels: buildWartburgRuntime,
    source: '../../worldgen/scripts/wartburg-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u1/u1p/wartburg/map-parts.json',
    errorMeters: 3,
    surfaces: {
      sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.5, metallic: 0.85 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      gold: { slot: 'trim', graph: 'metal_stainless', roughness: 0.3, metallic: 1 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
    },
  },
  'molen.worldgen.structure.prague_castle': {
    build: buildPragueSkyline,
    levels: buildPragueRuntime,
    source: '../../worldgen/scripts/prague-castle-model.mjs',
    data: '../../../content/worldgen/source/places/u2/u2f/prague_castle/map-parts.json',
    errorMeters: 8,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
      tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.5, metallic: 0.85 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      cladding: { slot: 'wall', graph: 'stone_granite', roughness: 0.8, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
    },
  },
  'molen.worldgen.structure.windsor_castle': {
    build: buildWindsorSkyline,
    levels: buildWindsorRuntime,
    source: '../../worldgen/scripts/windsor-castle-model.mjs',
    data: '../../../content/worldgen/source/places/gc/gcp/windsor_castle/map-parts.json',
    errorMeters: 8,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      weathered: {
        slot: 'foundation',
        graph: 'stone_limestone_weathered',
        roughness: 0.9,
        metallic: 0,
      },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
    },
  },
  'molen.worldgen.structure.neuschwanstein_castle': {
    build: buildNeuschwansteinSkyline,
    source: '../../worldgen/scripts/neuschwanstein-castle-model.mjs',
    errorMeters: 4,
    levels: buildNeuschwansteinRuntime,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      weathered: {
        slot: 'foundation',
        graph: 'stone_limestone_weathered',
        roughness: 0.9,
        metallic: 0,
      },
      sandstone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.85, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.5, metallic: 0.85 },
      brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },
  'molen.worldgen.structure.chateau_de_montsoreau': {
    build: buildMontsoreauSkyline,
    source: '../../worldgen/scripts/montsoreau-castle-model.mjs',
    errorMeters: 3,
    levels: buildMontsoreauRuntime,
    surfaces: {
      limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
      carved: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.82, metallic: 0 },
      slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },
  'molen.worldgen.structure.millennium_tower': {
    build: buildMillenniumSkyline,
    source: '../../worldgen/scripts/millennium-tower-model.mjs',
    errorMeters: 4,
    levels: buildMillenniumRuntime,
    surfaces: {
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      stainless: { slot: 'trim', graph: 'metal_stainless', roughness: 0.3, metallic: 1 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      recess: { slot: 'wall', roughness: 0.88, metallic: 0 },
    },
  },
  'molen.worldgen.structure.barolo_palace': {
    build: buildBaroloSkyline,
    source: '../../worldgen/scripts/barolo-palace-model.mjs',
    errorMeters: 7,
    // Deliberate detail removal prevents disconnected trim from defeating mesh reduction.
    levels: buildBaroloRuntime,
    surfaces: {
      concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
      marble: { slot: 'wall', graph: 'stone_marble', roughness: 0.78, metallic: 0 },
      metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.48, metallic: 0.24 },
      glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
      clear_glass: { slot: 'window', roughness: 0.12, metallic: 0.05, opacity: 0.52 },
    },
  },
  'molen.worldgen.structure.china_world_trade_center_tower_iii': {
    build: buildChinaWorldSkyline,
    source: '../../worldgen/scripts/china-world-tower-model.mjs',
    errorMeters: 20,
  },
  'molen.worldgen.structure.gran_torre_costanera': {
    build: buildGranTorreSkyline,
    source: '../../worldgen/scripts/gran-torre-costanera-model.mjs',
    errorMeters: 20,
  },
  'molen.worldgen.structure.nina_tower': {
    build: buildNinaSkyline,
    source: '../../worldgen/scripts/nina-tower-model.mjs',
    // Conservative refinement allowance for omitted crown equipment and facade relief.
    errorMeters: 20,
  },
};
const common =
  (await text('./authored-landmark-lods.mjs')) +
  (await text('../../worldgen/scripts/authored-structure-mesh.mjs')) +
  (await text('../../worldgen/scripts/structure-mesh.mjs')) +
  (await text('../../worldgen/scripts/standard-materials.mjs'));
export async function landmarkLodRecipeHash(id) {
  return recipes[id]
    ? hash(
        baseRecipeHash +
          common +
          (await text(recipes[id].source)) +
          (recipes[id].data
            ? (await Promise.all([recipes[id].data].flat().map(text))).join('')
            : ''),
      )
    : baseRecipeHash;
}

/** Shared surfaces explicitly declared by a browser recipe, including geometry-to-texture patterns. */
export function authoredSurfaceRefs(id) {
  return [
    ...new Set(
      Object.values(recipes[id]?.surfaces ?? {}).flatMap((s) =>
        s.graph ? [`matgraph:molen.worldgen.material.${s.graph}`] : [],
      ),
    ),
  ];
}

export async function authoredSkyline(id) {
  const recipe = recipes[id];
  if (!recipe) return undefined;
  const builder = new MeshBufferBuilder();
  const mapped = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (_slot, _ref, ...args) => builder[name]('wall', 'palette:#ffffff', ...args),
    ]),
  );
  recipe.build(mapped);
  const mesh = builder.finalize();
  validateAuthoredMesh(mesh, `${id}/authored-skyline`);
  const triangles = mesh.indices.length / 3;
  if (triangles > 1000)
    throw new Error(`${id}: authored skyline exceeds 1000 triangles (${triangles})`);
  const io = new NodeIO().setVertexLayout(VertexLayout.SEPARATE);
  const document = await io.readBinary(
    encodeGlb(mesh, [{ name: 'authored-skyline', roughness: 0.85, metallic: 0 }], id),
  );
  await document.transform(weld({ tolerance: 0 }), prune({ keepAttributes: true }));
  const bytes = Buffer.from(await io.writeBinary(document));
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  const geometryBytes = gltf.bufferViews.reduce((n, v) => n + v.byteLength, 0);
  return { bytes, triangles, geometryBytes, errorMeters: recipe.errorMeters, drawCalls: 1 };
}

/** Material-preserving authored runtime levels; source masters are never modified. */
export async function authoredDetail(id, level) {
  const recipe = recipes[id];
  if (!recipe?.levels) return undefined;
  if (!['district', 'street', 'closeup'].includes(level))
    throw new Error(`Unknown authored level ${level}`);
  const builder = new MeshBufferBuilder(),
    used = new Map();
  const mapped = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (component, _ref, points, normal, _uv, color) => {
        const s = recipe.surfaces[component];
        if (!s) throw new Error(`Unmapped authored surface ${component}`);
        const ref = s.graph
          ? `matgraph:molen.worldgen.material.${s.graph}`
          : component === 'clear_glass'
            ? 'palette:#feffff'
            : 'palette:#ffffff';
        used.set(`${s.slot}:${ref}`, s);
        const n = normalize(normal),
          u = Math.abs(n[1]) < 0.98 ? normalize([n[2], 0, -n[0]]) : [1, 0, 0],
          v = normalize(cross(n, u));
        const repeat = s.graph ? MATERIAL_REPEAT_METERS[s.graph] : [1, 1];
        const uv = (p) => [
          p.reduce((sum, x, i) => sum + x * u[i], 0) / repeat[0],
          p.reduce((sum, x, i) => sum + x * v[i], 0) / repeat[1],
        ];
        builder[name](
          s.slot,
          ref,
          points,
          normal,
          name === 'addConvexPolygon' ? uv : points.map(uv),
          color,
        );
      },
    ]),
  );
  recipe.levels(mapped, level);
  const mesh = builder.finalize();
  validateAuthoredMesh(mesh, `${id}/${level}`);
  const io = new NodeIO().setVertexLayout(VertexLayout.SEPARATE);
  const document = await io.readBinary(
    encodeGlb(
      mesh,
      mesh.groups.map((group) => {
        const s = used.get(`${group.slot}:${group.materialRef}`);
        return {
          name: `${s.graph ?? group.materialRef}-${s.slot}`,
          roughness: s.roughness,
          metallic: s.metallic,
          ...(s.opacity
            ? { baseColorFactor: [1, 1, 1, s.opacity], alphaMode: 'BLEND', doubleSided: true }
            : {}),
          ...(s.graph
            ? { sharedSurface: { ref: group.materialRef, slot: s.slot, uv: 'repeats' } }
            : {}),
        };
      }),
      `${id}/${level}`,
    ),
  );
  await document.transform(weld({ tolerance: 0 }), prune({ keepAttributes: true }));
  const bytes = Buffer.from(await io.writeBinary(document));
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  return {
    bytes,
    triangles: mesh.indices.length / 3,
    geometryBytes: gltf.bufferViews.reduce((n, v) => n + v.byteLength, 0),
    errorMeters: { district: 1.5, street: 0.5, closeup: 0.15 }[level],
    drawCalls: mesh.groups.length,
  };
}

export async function buildModelLandmarkLods(sidecarPath, options = {}) {
  const before = JSON.parse(await readFile(sidecarPath, 'utf8'));
  if (!recipes[before.id]) return buildLandmarkLods(sidecarPath, options);
  const directory = dirname(sidecarPath),
    recipeHash = await landmarkLodRecipeHash(before.id);
  if (hash(await readFile(join(directory, before.files.main))) !== before.hash)
    throw new Error(`${before.id}: stale master import`);
  if (
    !options.force &&
    before.runtimeLods?.recipeHash === recipeHash &&
    before.runtimeLods.masterHash === before.hash &&
    before.runtimeLods.levels.length === 4
  ) {
    const current = await Promise.all(
      before.runtimeLods.levels.map(async (level) => {
        try {
          return hash(await readFile(join(directory, level.file))) === level.hash;
        } catch (error) {
          if (error.code === 'ENOENT') return false;
          throw error;
        }
      }),
    );
    if (current.every(Boolean)) return before.runtimeLods;
  }
  if (!recipes[before.id].levels) await buildLandmarkLods(sidecarPath, options);
  const sidecar = JSON.parse(await readFile(sidecarPath, 'utf8'));
  sidecar.runtimeLods ??= { recipe: 1, masterHash: sidecar.hash, levels: [] };
  sidecar.runtimeLods.masterHash = sidecar.hash;
  if (recipes[sidecar.id].levels) sidecar.runtimeLods.levels = [];
  const names = recipes[sidecar.id].levels
    ? ['skyline', 'district', 'street', 'closeup']
    : ['skyline'];
  for (const [index, name] of names.entries()) {
    const output =
        name === 'skyline'
          ? await authoredSkyline(sidecar.id)
          : await authoredDetail(sidecar.id, name),
      file = `model.${name}.glb`;
    await writeFile(join(directory, file), output.bytes);
    sidecar.files.variants ??= {};
    sidecar.files.variants[name] = file;
    sidecar.runtimeLods.levels[index] = {
      name,
      file,
      hash: hash(output.bytes),
      bytes: output.bytes.length,
      gzipBytes: gzipSync(output.bytes, { level: 6 }).length,
      triangles: output.triangles,
      cpuBytes: output.geometryBytes,
      gpuBytes: output.geometryBytes,
      errorMeters: output.errorMeters,
      drawCalls: output.drawCalls,
    };
  }
  sidecar.runtimeLods.recipeHash = recipeHash;
  await writeFile(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`);
  return sidecar.runtimeLods;
}
