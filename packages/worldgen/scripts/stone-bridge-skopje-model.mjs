/** Primary evidence for N0004; the exterior model records photo-scaled dimensions separately. */
export const skopjeResearch = {
  id: 'N0004',
  key: 'stone_bridge_in_skopje',
  wikidataId: 'Q1780883',
  title: 'Stone Bridge in Skopje',
  targetFidelity: 'maximum',
  status: 'source-geometry',
  modelProduced: true,
  nativeAxesProposal: {
    up: '+Y',
    longitudinal: '+X northeast',
    transverse: '+Z southeast (downstream)',
    origin:
      'Horizontal mapped-outline center; Y0 follows the JICA2009 channel-bottom reference241.5m ASL. Bridge heights are photo-scaled.',
  },
  sources: [
    {
      id: 'tourism',
      kind: 'national-tourism-publication',
      url: 'https://macedonia-timeless.com/eng/about/about/did-you-know/stone-bridge',
      accessed: '2026-09-27',
      observed: 'Original-form dimensions and construction description; not a current survey.',
    },
    {
      id: 'ibrahimgil-2012',
      kind: 'published-field-research',
      author: 'Mehmet Zeki İbrahimgil',
      title: 'Üsküp Fatih Sultan Mehmet Köprüsü-Taş Köprü/Vardar Köprüsü',
      publication: 'Motif Akademi Halkbilimi Dergisi, 2012, pages 46–54',
      url: 'https://dergipark.org.tr/en/download/article-file/288477',
      accessed: '2026-09-27',
      observed: 'Text inspected; dimensions on printed page 48 and field visit on page 49.',
    },
    {
      id: 'ozbey-2023',
      kind: 'published-field-research',
      author: 'Veysel Özbey',
      title: 'The Skopje Vardar Bridge and Conservation Works for the Bridge',
      publication: 'AİCUSBED 9(2), 2023, pages 301–316; DOI 10.31463/aicusbed.1340704',
      url: 'https://dergipark.org.tr/tr/download/article-file/3321195',
      accessed: '2026-09-27',
      observed:
        'Text and rendered printed pages 306, 307, 310, 311 inspected. Figures 2–3 are the author’s 2016 photographs.',
    },
    {
      id: 'haemus',
      kind: 'heritage-research-center',
      url: 'https://haemus.org.mk/stone-bridge/',
      accessed: '2026-09-27',
      observed: 'Construction description and bibliography inspected.',
    },
    {
      id: 'ukim',
      kind: 'university-research-center',
      url: 'https://ceipa.pmf.ukim.mk/en/node/126',
      accessed: '2026-09-27',
      observed: 'Historical reconstruction description; counts piers rather than arches.',
    },
    {
      id: 'wojtowicz-2013',
      kind: 'firsthand-photograph',
      author: 'Andrzej Wójtowicz',
      date: '2013-08-02',
      url: 'https://commons.wikimedia.org/wiki/File:Skopje_-_Kamen_Most_(9454032526).jpg',
      original: 'https://www.flickr.com/photos/andrezgorapl/9454032526',
      license: 'CC-BY-SA-2.0',
      observed:
        '1280 × 851 reference photograph visually inspected; not included in the asset pack.',
    },
  ],
  sourceFacts: [
    { property: 'historicalLengthMeters', value: 213.85, source: 'tourism' },
    { property: 'historicalDeckWidthMeters', value: 6.33, source: 'tourism' },
    { property: 'historicalArchCount', value: 13, source: 'tourism' },
    { property: 'masonryMaterial', value: 'travertine', source: 'tourism' },
    {
      property: 'publishedApproximateLengthMeters',
      value: 220,
      source: 'ibrahimgil-2012',
      page: 48,
    },
    { property: 'smallestReportedOpeningMeters', value: 4.05, source: 'ibrahimgil-2012', page: 48 },
    { property: 'largestReportedOpeningMeters', value: 13.48, source: 'ibrahimgil-2012', page: 48 },
    { property: 'reportedArchCount', value: 13, source: 'ibrahimgil-2012', page: 48 },
    { property: 'reportedBuriedOpeningsAtEachEnd', value: 2, source: 'ibrahimgil-2012', page: 48 },
    { property: 'reportedOpeningCountRange', value: [14, 15], source: 'ozbey-2023', page: 307 },
    { property: 'centralLargeOpeningCount', value: 4, source: 'ozbey-2023', page: 307 },
    {
      property: 'deckProfile',
      value:
        'Level across the four central spans, descending toward both ends; northeast break follows the prayer niche.',
      source: 'ozbey-2023',
      page: 307,
    },
    {
      property: 'northeastBrickArchCount',
      value: 4,
      source: 'ozbey-2023',
      page: 308,
    },
    {
      property: 'downstreamCutwaters',
      value:
        'Asymmetric restored forms; absent below the prayer niche; southwest transition pier has a taller projecting form.',
      source: 'ozbey-2023',
      page: 310,
    },
    {
      property: 'currentParapet',
      value: 'Stone parapets replaced the earlier metal railings during restoration.',
      source: 'ozbey-2023',
      page: 310,
    },
    { property: 'reportedPierCount', value: 13, source: 'ukim' },
    {
      property: 'decorativeFeatures',
      value: 'Central mihrab, opposite balcony on masonry consoles, and stone rosettes.',
      source: 'haemus',
    },
  ],
  visualObservations: [
    {
      source: 'wojtowicz-2013',
      observations: [
        'Large central stone arch rings, stepped pier bases, horizontal coping and a projecting prayer niche are visible.',
        'Smaller brick-faced northeast openings descend toward the bank.',
        'The oblique image does not show all openings or supply scale-controlled elevations.',
      ],
    },
    {
      source: 'ozbey-2023',
      figures: [2, 3],
      photoDate: '2016',
      observations: [
        'The southeast elevation confirms unequal pier projections and a tall flat prayer-niche pier.',
        'Individual arch intrados are not reliably determined by the generic semicircular description; measured profiles are needed.',
      ],
    },
  ],
  researchGaps: [
    {
      id: 'current-opening-inventory',
      required: 'Dated complete elevation identifying every visible, buried and filled opening.',
      reason:
        'Published counts 13 and 14–15 are not interchangeable with the count of visible current openings.',
    },
    {
      id: 'arch-stations-and-profiles',
      required:
        'Individual opening endpoints, spring levels, crown levels and intrados profiles in a measured local frame.',
      reason:
        'Only the overall dimensions and minimum/maximum span were found; equal spacing or equal semicircles would invent the bridge.',
    },
    {
      id: 'vertical-profile-and-datum',
      required:
        'Deck break stations, deck levels, foundations, river level reference and vertical datum.',
      reason:
        'A map outline gives no arch height or water clearance and cannot support terrain-draped activation.',
    },
    {
      id: 'pier-and-cutwater-survey',
      required:
        'Both elevations and plans of each pier, including restored flat and pyramidal caps.',
      reason:
        'The OSM outline contains only a subset of projections; mirrored repeated piers would contradict field photographs.',
    },
    {
      id: 'niche-parapet-and-masonry-detail',
      required:
        'Scaled mihrab, balcony, parapet sections, arch rings and masonry courses with dated close views.',
      reason:
        'The source photos establish morphology but not dimensions for maximum-fidelity close viewing.',
    },
    {
      id: 'current-shore-fit',
      required:
        'Both current abutments, bank heights and pedestrian approach connections fitted to the host map/terrain.',
      reason:
        'The mapped 218.9 m outline and published 213.85 m historical length have different extents; the 23.8 m outline width includes projections.',
    },
  ],
  qaCameras: [
    {
      name: 'southeast-whole-elevation',
      status: 'framing-proposal',
      position: [0, 32, 185],
      lookAt: [0, 7, 0],
      purpose:
        'Check full opening inventory, level center, sloping approaches and downstream pier asymmetry.',
    },
    {
      name: 'northwest-whole-elevation',
      status: 'framing-proposal',
      position: [0, 32, -185],
      lookAt: [0, 7, 0],
      purpose: 'Check upstream cutwater profiles and balcony.',
    },
    {
      name: 'niche-and-brick-transition',
      status: 'reframe-after-measured-elevation',
      position: [12, 18, 30],
      lookAt: [8, 10, 0],
      purpose: 'Check niche, parapet transitions and nearby arch-ring material changes.',
    },
  ],
  reviewRequirements: [
    'Separate published dimensions from photo-scaled reconstruction; record remaining survey gaps as limitations of the exterior asset.',
    'Any future generator must preserve an artist-edited master with a source.json SHA-256 guard before writing models/source.glb.',
    'A future mesh must pass winding/normal checks and all QA cameras before source/runtime hash-bound visual and maximum-fidelity reviews.',
    'Geographic activation additionally requires a reviewed placement hash, directed axis, vertical datum and shore fit.',
  ],
};
