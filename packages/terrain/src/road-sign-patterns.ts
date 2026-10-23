/** Global sign patterns and their detection cues; regional profiles supply appearance and inference defaults. */
export type TerrainRoadSignPatternId =
  | 'highway-overhead'
  | 'highway-exit'
  | 'all-way-stop'
  | 'minor-stop'
  | 'street-speed'
  | 'freeway-speed'
  | 'yield'
  | 'attraction'
  | 'route-guide'
  | 'route-marker';

export interface TerrainRoadSignPattern {
  id: TerrainRoadSignPatternId;
  title: string;
  family: 'highway' | 'junction' | 'speed';
  cues: readonly string[];
  placement: string;
  fallback: string;
}

/** Data cues describe supported inputs, not a guarantee that a PMTiles archive retains them. */
export const TERRAIN_ROAD_SIGN_PATTERNS: readonly TerrainRoadSignPattern[] = [
  {
    id: 'route-marker',
    title: 'State route marker',
    family: 'highway',
    cues: ['network', 'shield_text', 'ref', 'state geography'],
    placement: 'A repeated numbered marker on the driving side of the road.',
    fallback:
      'Requires a supported network and literal route number. Local SR/SH references also require known state geography. Unsupported county, federal, toll and business networks are omitted.',
  },
  {
    id: 'highway-overhead',
    title: 'Highway overhead',
    family: 'highway',
    cues: [
      'motorway_link',
      'destination',
      'destination:ref',
      'junction:ref',
      'motorway_junction ref / exit_to',
    ],
    placement: 'Gantry before a connected exit ramp, facing approaching traffic.',
    fallback:
      'A connected departure can use the regional exit label where configured. Names and exit numbers require mapped values.',
  },
  {
    id: 'highway-exit',
    title: 'Highway side exit',
    family: 'highway',
    cues: ['motorway_link', 'destination', 'junction:ref', 'motorway_junction ref / exit_to'],
    placement: 'Two posts on the driving side of the departing ramp.',
    fallback:
      'A connected departure can use the regional exit label where configured. An on-ramp alone does not qualify.',
  },
  {
    id: 'all-way-stop',
    title: 'Four-way / all-way stop',
    family: 'junction',
    cues: ['highway=stop', 'stop=all', 'local road topology'],
    placement:
      'An octagonal STOP on each incoming approach, with a regional all-way plaque where used.',
    fallback:
      'Profiles may infer local crossroads stops when no mapped control exists. Mapped traffic signals take priority.',
  },
  {
    id: 'minor-stop',
    title: 'Side-street stop',
    family: 'junction',
    cues: ['highway=stop', 'minor street meeting an arterial'],
    placement: 'STOP on the controlled approach; through traffic keeps priority.',
    fallback: 'Where the profile permits inference, stop only minor approaches to an arterial.',
  },
  {
    id: 'street-speed',
    title: 'Street speed limit',
    family: 'speed',
    cues: ['maxspeed'],
    placement: 'A compact regulatory panel beside each direction of street travel.',
    fallback: 'Omit when no literal numeric limit exists. Never guess a limit from road class.',
  },
  {
    id: 'freeway-speed',
    title: 'Freeway speed limit',
    family: 'speed',
    cues: ['highway=motorway', 'maxspeed'],
    placement: 'A larger regulatory panel outside the freeway shoulder.',
    fallback: 'Omit when the posted limit is unknown. Unitless OSM limits mean km/h.',
  },
  {
    id: 'yield',
    title: 'Yield',
    family: 'junction',
    cues: ['highway=give_way'],
    placement: 'An inverted triangle facing the mapped incoming approach.',
    fallback:
      'Requires an explicit give-way cue. A ramp or roundabout alone does not generate a yield sign.',
  },
  {
    id: 'attraction',
    title: 'Attractions & recreation',
    family: 'highway',
    cues: ['destination', 'destination:colour=brown', 'junction:ref (optional)'],
    placement: 'A separate brown destination board before the connected exit, or beside its ramp.',
    fallback:
      'Requires a mapped brown destination. Nearby POIs alone do not establish an exit or driving distance.',
  },
  {
    id: 'route-guide',
    title: 'Highway route guide',
    family: 'highway',
    cues: ['ref / shield_text', 'name', 'destination'],
    placement: 'A repeated overhead route and destination board on the mainline.',
    fallback:
      'Omit if the route and destination are unknown. Route numbers are never treated as exit numbers.',
  },
];
