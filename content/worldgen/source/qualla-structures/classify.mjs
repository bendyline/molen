/**
 * Conservative, offline triage of Qualla stories for place-specific 3D structures.
 * Rules operate on the subject, then the summary/lead, then the narrative. A mention
 * in a story never by itself establishes a building at the story's coordinate.
 * These are discovery decisions, not editorial or geometry approvals.
 */
export const categories = [
  ['bridge', /\b(?:bridge|viaduct|aqueduct|pont|ponte|puente)\b/i],
  ['dam', /\b(?:dam|barrage|spillway)\b/i],
  ['lighthouse', /\b(?:lighthouse|light station|lightship|phare|faro)\b/i],
  [
    'religious',
    /\b(?:cathedral|church|chapel|basilica|abbey|monastery|mosque|masjid|temple|synagogue|pagoda|shrine|stupa|minaret|mandir|gurdwara|convent|baptistery|duomo|wat|vihara|jingu)\b/i,
  ],
  [
    'palace-castle-fort',
    /\b(?:palace|castle|fort|fortress|citadel|chateau|schloss|palazzo|alcazar|kremlin|kasbah)\b/i,
  ],
  ['tower', /\b(?:tower|skyscraper|campanile|belfry|space needle|high rise)\b/i],
  [
    'museum-library',
    /\b(?:museum|library|art gallery|kunsthalle|pinakothek|observatory|planetarium)\b/i,
  ],
  [
    'performance-sport',
    /\b(?:stadium|arena|theatre|theater|opera house|concert hall|auditorium|amphitheatre|amphitheater|colosseum|ballpark|hippodrome|velodrome|pavilion)\b/i,
  ],
  [
    'hotel-commercial',
    /\b(?:hotel|motel|inn|resort|casino|restaurant|department store|market hall|shopping mall|watergate|coffeehouse|tavern|pub|bazaar|stock exchange|bank building)\b/i,
  ],
  [
    'residence',
    /\b(?:house|mansion|villa|manor|residence|cottage|homestead|hacienda|chalet|townhouse)\b/i,
  ],
  [
    'civic-institutional',
    /\b(?:city hall|town hall|courthouse|capitol|parliament|municipal building|hospital|prison|penitentiary|jail|gaol|embassy|post office|fire station|schoolhouse|guildhall|headquarters|building|hall|college|university|school)\b/i,
  ],
  [
    'industrial',
    /\b(?:factory|mill|windmill|power station|power plant|refinery|warehouse|brewery|distillery|water tower|waterworks|gasometer|furnace|foundry|oil rig|radar|telescope)\b/i,
  ],
  [
    'transport',
    /\b(?:railway station|railroad station|train station|rail terminal|terminal|hangar|tunnel|pier|jetty|dock|lock|canal lock|airport|airfield|aerodrome)\b/i,
  ],
  [
    'monument',
    /\b(?:monument|memorial|statue|sculpture|obelisk|mausoleum|tomb|cenotaph|triumphal arch|gateway|gate|fountain|cross|standing stones|stone circle|dolmen|menhir|hollywood sign)\b/i,
  ],
  [
    'archaeological',
    /\b(?:pyramid|ziggurat|megalith|stonehenge|henge|ruins|acropolis|necropolis|barrow|tumulus|cairn|broch|nuraghe)\b/i,
  ],
];

export function normalize(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^(?:the|a|an) /, '');
}

export function categoryFor(text) {
  return categories.find(([, pattern]) => pattern.test(normalize(text)))?.[0];
}

export function storyText(article) {
  const content = article.content ?? {};
  return [
    article.summary,
    typeof content === 'string' ? content : content.intro,
    ...(content.sections ?? []).flatMap((section) => [section.title, section.body]),
    content.flightContext,
  ]
    .filter(Boolean)
    .join('\n');
}

const event =
  /\b(?:battle|siege|massacre|murder|assassination|attack|bombing|bombings|earthquake|eruption|tsunami|hurricane|cyclone|tornado|disaster|crash|shooting|killings|mutiny|rebellion|revolt|riot|pogrom|uprising|expedition|campaign|war|explosion|scandal|lynching|execution|sinking|shipwreck|flight \d+|fire|collapse|controversy|inaugural games)\b/i;
const natural =
  /\b(?:mountain|mount|volcano|lake|river|glacier|waterfall|falls|canyon|gorge|cave|cavern|island|islands|archipelago|beach|bay|fjord|forest|national park|nature reserve|wildlife refuge|desert|reef|atoll|peninsula|wetland|marsh|valley|geyser|hot springs|ice shelf|plateau)\b/i;
const settlement =
  /\b(?:city|town|village|municipality|province|district|suburb|neighborhood|neighbourhood|county|region|settlement|borough|capital city)\b/i;
const broad =
  /\b(?:campus|university|college|cemetery|graveyard|park|gardens|garden|zoo|botanical|archaeological site|historic district|old town|ruined city|port of|harbor|harbour|naval base|air base|railway|railroad|canal|wall|airport|airfield|aerodrome|battlefield|complex)\b/i;
const destroyed =
  /\b(?:demolished|razed|no longer (?:stands|exists)|destroyed in|burned down|burnt down|lost building|former building|submerged|reconstruction|reconstructed|ruins|ruined)\b/i;
const institution =
  /\b(?:museum|library|gallery|college|university|school|hospital|headquarters)\b/i;

export function classify(article, sourceTitle) {
  const title = sourceTitle || article.title.split(/:\s| — | – /)[0];
  const names = [title, article.id.replace(/-w[pk]$/, '').replaceAll('-', ' ')];
  const subject = names.join(' | ');
  const text = storyText(article);
  const lead = `${article.summary ?? ''}\n${typeof article.content === 'object' ? (article.content.intro ?? '') : ''}`;
  const category = categoryFor(subject);
  const tags = (article.categories ?? []).join(' ').replaceAll('-', ' ');
  const flags = [];
  if (destroyed.test(lead)) flags.push('verify-survival-and-era');
  if (institution.test(subject)) flags.push('verify-specific-building-not-institution');
  const result = (disposition, reason, kind = category) => ({
    disposition,
    reason,
    ...(kind ? { category: kind } : {}),
    ...(flags.length ? { flags } : {}),
  });
  if (
    ['tower', 'monument', 'archaeological', 'residence', 'industrial'].includes(category) &&
    /\b(?:geological formation|rock formation|volcanic|butte|natural arch|strait|sea stack|igneous|basalt column|monolith)\b/i.test(
      article.summary ?? '',
    ) &&
    !/\b(?:built|constructed|man.made|carved|erected|museum)\b/i.test(article.summary ?? '')
  ) {
    return result('review', 'natural-name-or-setting-needs-review');
  }
  if (
    /\b(?:proposed|unbuilt|never built|never completed|cancelled|canceled|project)\b/i.test(
      `${subject}\n${lead.slice(0, 500)}`,
    )
  ) {
    return result('review', 'verify-built-not-proposed');
  }
  // Memorials about events have their own physical identity; events do not acquire
  // a structure merely because the narrative mentions a nearby museum or memorial.
  if (event.test(subject) && !/\b(?:memorial|monument|museum|cemetery)\b/i.test(subject)) {
    return category || categoryFor(article.summary ?? '')
      ? result('review', 'event-with-possible-structure-subject')
      : result('no-structure', 'event-not-a-structure');
  }
  if (/^(?:uss|hms|hmhs|ss|rms|mv|ms|usrc|uscgc|hmcs)\s/i.test(normalize(title))) {
    return /museum|preserved|moored|floating museum/i.test(lead)
      ? result('review', 'preserved-vessel-needs-scope-decision', 'museum-library')
      : result('no-structure', 'vessel-not-a-fixed-structure');
  }
  // Fort Worth, Castle Rock and similar place names are not fort/castle models.
  if (
    category &&
    (/(?:^|\s)(?:city|cities|town|towns|village|villages|municipality|municipalities)(?:\s|$)/i.test(
      tags,
    ) ||
      /\b(?:is|was) (?:a|an|the) (?:\w+ ){0,3}(?:city|town|village|municipality|suburb)\b/i.test(
        lead.slice(0, 500),
      ))
  ) {
    return result('review', 'settlement-name-resembles-structure');
  }
  // Monument Valley and Pyramid Lake are landscapes, despite their first words.
  if (
    /\b(?:valley|lake|island|islands|mountain|national monument|nature reserve)\b(?:\s*\([^)]*\))?$/i.test(
      title,
    ) &&
    natural.test(subject)
  ) {
    return categoryFor(article.summary ?? '') && !/\bnational monument\b/i.test(title)
      ? result('review', 'natural-site-with-building-potential')
      : result('no-structure', 'natural-feature-subject');
  }
  if (category && !broad.test(subject)) {
    if (!categoryFor(title) && !categoryFor(article.title.split(/:\s| — | – /)[0])) {
      return result('review', 'structure-name-only-in-id');
    }
    return flags.includes('verify-survival-and-era')
      ? result('review', 'structure-era-or-survival-needs-review')
      : result('structure', 'named-structure-subject');
  }
  if (broad.test(subject)) return result('review', 'site-or-complex-needs-specific-structures');
  if (natural.test(subject) && !category) {
    return categoryFor(article.summary ?? '')
      ? result('review', 'natural-site-with-building-potential')
      : result('no-structure', 'natural-feature-subject');
  }
  // A building can have a proper name with no building word (e.g. Fallingwater).
  // Require the summary to name a physical form, not just the flight-context text.
  const leadCategory = categoryFor(article.summary ?? '');
  if (leadCategory && !settlement.test(article.summary ?? '') && !event.test(title)) {
    return result('review', 'structure-in-summary-confirm-identity', leadCategory);
  }
  if (event.test(tags) && !categoryFor(subject)) {
    return result('no-structure', 'event-category-without-structure-subject');
  }
  if (categoryFor(text) || /architecture|historic site|heritage|archaeology/.test(tags)) {
    return result('review', 'narrative-may-contain-structure-targets', categoryFor(text));
  }
  return result('review', 'no-confident-automatic-decision');
}
