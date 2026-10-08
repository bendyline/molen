// A coarse, editable geographic prior. Ecological regions are resolved independently.
// Country outlines only stop broad content envelopes leaking across unrelated neighboring areas.
const groups = {
  north_america: 'US CA GL BM',
  mexico: 'MX',
  caribbean: 'CU BB TT HT DO JM PR BS',
  colombia: 'CO VE GY SR',
  andes: 'PE BO EC',
  chile: 'CL',
  brazil: 'BR',
  britain: 'GB IM GG JE',
  ireland: 'IE',
  nordic: 'NO SE FI DK FO AX',
  iceland: 'IS',
  baltic: 'EE LV LT',
  france: 'FR MC',
  low_countries: 'NL BE LU',
  germany: 'DE',
  alps: 'CH AT LI',
  italy: 'IT SM VA',
  iberia: 'ES PT AD',
  greece: 'GR CY',
  eastern_europe: 'PL CZ RO UA BG RS SK HU BY MD XK AL MK',
  adriatic: 'HR BA SI ME',
  maghreb: 'MA TN DZ LY EH',
  anatolia: 'TR',
  caucasus: 'GE AM AZ',
  levant: 'LB PS JO IL',
  iran: 'IR',
  arabia: 'YE BH AE QA SA OM KW IQ SY',
  west_africa: 'ML NE GH SN NG BF BJ TG CI GN GW LR SL GM MR CV',
  east_africa: 'KE TZ UG ET SO SOL ER DJ RW BI SS',
  south_africa: 'ZA NA BW LS SZ ZW ZM MW MZ AO',
  madagascar: 'MG',
  south_asia: 'IN BD NP BT LK PK AF MV',
  china: 'CN',
  korea: 'KR KP',
  taiwan: 'TW',
  mainland_southeast_asia: 'TH VN KH LA MM',
  maritime_southeast_asia: 'MY SG ID BN TL',
  philippines: 'PH',
  australia: 'AU',
  new_zealand: 'NZ',
  fiji: 'FJ',
  pacific: 'TO CK PF WS AS NU TK',
  russia: 'RU',
  central_asia: 'KZ UZ TM KG TJ MN',
  nile: 'EG SD',
  central_africa: 'CD CG CM CF GA GQ TD ST',
  southern_south_america: 'AR UY PY',
  central_america: 'GT BZ HN SV NI CR PA',
  melanesia: 'PG SB VU NC',
};
const byCode = new Map(
  Object.entries(groups).flatMap(([id, codes]) =>
    codes.split(' ').map((code) => [code, `library.${id}`]),
  ),
);
byCode.set('JP', 'jp');
const subregions = {
  'Northern America': 'north_america',
  'Central America': 'central_america',
  Caribbean: 'caribbean',
  'South America': 'southern_south_america',
  'Northern Europe': 'nordic',
  'Western Europe': 'france',
  'Eastern Europe': 'eastern_europe',
  'Southern Europe': 'eastern_europe',
  'Northern Africa': 'maghreb',
  'Western Africa': 'west_africa',
  'Middle Africa': 'central_africa',
  'Eastern Africa': 'east_africa',
  'Southern Africa': 'south_africa',
  'Western Asia': 'arabia',
  'Central Asia': 'central_asia',
  'Eastern Asia': 'china',
  'Southern Asia': 'south_asia',
  'South-Eastern Asia': 'mainland_southeast_asia',
  'Australia and New Zealand': 'australia',
  Melanesia: 'melanesia',
  Micronesia: 'pacific',
  Polynesia: 'pacific',
  'Seven seas (open ocean)': 'remote_islands',
};
export const additionalArchitectureRegions = [
  ['russia', 'Russian regional envelope'],
  ['central_asia', 'Central Asian regional envelope'],
  ['nile', 'Nile regional envelope'],
  ['central_africa', 'Central African regional envelope'],
  ['southern_south_america', 'Southern South American regional envelope'],
  ['central_america', 'Central American regional envelope'],
  ['melanesia', 'Melanesian regional envelope'],
  ['remote_islands', 'Remote island fallback'],
];
export function architectureRegionForCountry(country) {
  const id =
    byCode.get(country.code) ??
    (subregions[country.subregion] ? `library.${subregions[country.subregion]}` : undefined);
  if (!id)
    throw new Error(`Unassigned architectural geography: ${country.code} / ${country.subregion}`);
  return id;
}
