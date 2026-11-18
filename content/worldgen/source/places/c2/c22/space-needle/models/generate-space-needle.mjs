/**
 * Emit the Space Needle master from space-needle-model.mjs, with a hand-authored skyline level
 * (buildSpaceNeedleSkyline) that keeps the legs, waist, halo and spire at 1,000 triangles.
 */
import { emitPlaceMaster } from '../../../../../../../../packages/worldgen/scripts/place-master-emitter.mjs';
import { buildSpaceNeedle, smooth, surfaces } from './space-needle-model.mjs';

await emitPlaceMaster({
  generator: import.meta.url,
  planId: 'A01',
  assetKey: 'space_needle',
  title: 'Space Needle',
  wikidataId: 'Q5317',
  brief:
    "Seattle's 605 ft observation tower at Seattle Center: six white steel legs in three pairs that pinch to a plated hourglass waist at 373 ft and splay out under the top house; a dark six-sided core with gold elevator cabs; the three-winged SkyLine level at 100 ft and the 200 ft platform; the flying-saucer top house with its white sunburst underside, the Loupe's tilted glass at 500 ft, the downward-sloping bronze halo 138 ft across, the open 520 ft deck behind outward-tilted glass barriers, the white roof, pagoda and penthouse drum; the slender spire with its red beacon; and the glass pavilion wrapped round the base.",
  surfaces,
  smooth,
  build: buildSpaceNeedle,
  modules: ['space-needle-model.mjs'],
  runtimeLodOverlay: {
    module: 'space-needle-model.mjs',
    export: 'buildSpaceNeedleSkyline',
    errorMeters: 2,
  },
  dimensions: [
    {
      fact: 'Plan and heights of the mapped OSM building 35184384991964 and its parts: base 35184766343165 (0–6.1 m), SkyLine 35184766343319 with wings 35184766343316/317/318 (30.48–36.58 m), 200 ft platform 35184766343320 (60.96–64.0 m), core 35184766343166, underside 35184766343169 (149.96–152.4 m, r 16.7 m), restaurant/Loupe 35184766343167 (152.4–156.06 m, r 15.5 m), deck enclosure 35184766343168 (158.1–161.2 m, r 13.7 m), pagoda 35184766343164 (164.5–166.95 m) and roof 35184766343161; the SkyLine and platform corners give the leg-pair bearings (south, 60° and 300°)',
      source: 'footprint.json',
    },
    {
      fact: '605 ft (184.4 m) from the ground to the top of the red aircraft warning beacon',
      source: 'https://spaceneedle.com/facts-1',
    },
    {
      fact: 'Observation deck at 520 ft (158.5 m); restaurant level (now the Loupe revolving glass floor) at 500 ft; the top house is 138 ft (42 m) wide; SkyLine level added at 100 ft in 1982; first of three double-deck glass elevators installed in 2025',
      source: 'https://en.wikipedia.org/wiki/Space_Needle',
    },
    {
      fact: "Three pairs of slender steel legs curve inwards from a 102 ft diameter base to the 373 ft 'waist'; three cantilevered dining wings at the 100 ft level",
      source: 'https://www.docomomo-wewa.org/modern-places/the-space-needle/',
    },
    {
      fact: "Six columns in three pairs, each pair joined by a steel-plate 'shirtwaist' between 260 ft and 420 ft; tie beams to the core at 100 ft and 200 ft; ring girder segments from leg tip to leg tip with radiating fins (the 'sunburst'); a halo of downward-sloping steel outriggers around the saucer; a pagoda-like roof curving inward then outward; a six-sided core of three elevator trusses, each carrying an outward-facing elevator; a 50 ft spire to 605 ft",
      source:
        'https://asce.org/publications-and-news/civil-engineering-source/civil-engineering-magazine/issues/magazine-issue/article/2024/07/engineers-and-steel-took-seattles-space-needle-skyward',
    },
    {
      fact: '2018 Century Project: 11 x 7 ft structural glass barriers on the 520 ft open deck that tilt outward to match the angle of the building; floor-to-ceiling glass inside; revolving glass floor at 500 ft',
      source: 'https://www.spaceneedle.com/renovation',
    },
    {
      fact: 'Original colors: Astronaut White legs, Orbital Olive core, Re-entry Red halo, Galaxy Gold sunburst and roof; the roof was repainted from Galaxy Gold back to Astronaut White in May 2023',
      source:
        'https://www.fox13seattle.com/news/space-needle-being-repainted-from-galaxy-gold-back-to-astronaut-white',
    },
    {
      fact: '2000 pavilion: a glazed, two-storey building at the foot of the Needle that wraps around the base in a spiral form',
      source: 'https://pcad.lib.washington.edu/building/4565',
    },
  ],
  limitations: [
    'Leg curves, pair spacing (2.4 m off the centreline at the ground), section sizes (about 1.5 x 1.3 m) and the fork and tip geometry are fitted to the published base, waist and shirtwaist heights and to photographs; the legs are box sections rather than the real three-sided plated tubes.',
    'Top-house radii and heights blend the mapped parts with photographic proportions scaled to the 138 ft width; the mapped outer ring (r 18.9 m) is narrower than the published width, so the halo rim follows the published 42 m. The halo is a perforated cone with 48 ribs rather than individual slats; its bronze color is taken from photographs.',
    'The sunburst is 48 fins and three skirt rings; the core is a dark hexagonal shaft with storey bands instead of open trusswork and stairs; elevator cabs are boxes (two gold 1993 cabs, one 2025 glass cab) at arbitrary heights.',
    'The SkyLine wings follow the mapped outlines with a simplified sloped soffit and glass band; the 200 ft platform is a deck with a glass rail.',
    'The base pavilion is mapped only as the 20 ft drum 35184766343165; the model raises that drum to two storeys (8.5 m) and simplifies the spiral ramp and canopies to a circular glass ring (r 19 m, 4.55 m) under a flat roof, sized from aerial photographs; the real ring is a spiral and partly open.',
    'The spire is a solid tapering mast with a beacon instead of an open lattice; flagpoles, antennas, railings, benches and rooftop equipment are omitted.',
  ],
});
