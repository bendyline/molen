# Livery gallery

Compare every vehicle’s photo-based liveries side by side, then follow the photograph links to inspect the real-world colors and markings. Read each comparison from left to right, four choices to a row; its labels give the selection ids.

[Aircraft](#aircraft) · [Cars, trucks and RVs](#cars-trucks-and-rvs) · [Cycles](#cycles) · [Transit](#transit) · [Watercraft](#watercraft)

## Evidence and scope

All 560 choices across 202 vehicle types have linked real-world photographs. Every aircraft has 4 to 7 choices, each a real operator's scheme; every other vehicle has 2. Military liveries carry real national insignia, codes, serials and unit art redrawn as original vector art; civil liveries follow the operator's colors and layout without its name or logo, with fictional registrations. Colors and visible layout were compared with the photographs and the rendered models. These are **photo-based adaptations** (`inspired` provenance), not exact historical or factory replicas.

Paint values are visual estimates, not measured paint codes. Camouflage uses approximate masks; complex emblems and small stencils may be omitted. Generic Bendy bodies adapt finishes from the photographed real vehicles. Each entry explains its scope. Source photos are linked for inspection and attribution; they are not shipped as textures.

The Danish F-16B uses photographs of ET-612 at Oulu in 2014: roundels aft of the canopy, the serial behind them, and small flags high on the fin. Both sides were checked. The old permanent model-name label is removed.

The [complete catalog](livery-catalog.md) has a text-only inventory and full [source attribution index](livery-catalog.md#source-index). See [vehicle liveries](liveries.md) for the paint-slot and surface-marking system.

## Use a choice

Copy a type and livery id from an entry and set `livery.selected`:

```json
{
  "id": "aircraft",
  "type": "molen.entities.aircraft.f_16b",
  "components": { "livery": { "selected": "danish-et-612" } }
}
```

## Aircraft

### Airbus A220-300

Type: `molen.entities.aircraft.a220_300`.

[![Airbus A220-300 livery comparison: White with lime sweep and tail, White over navy belly, navy tail, White with navy belly and streamer tail, White with black belly band and tail, Sky blue over silver](https://molen.dev/guide-media/liveries/a220_300.png)](https://molen.dev/guide-media/liveries/a220_300.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `white-lime-sweep` | White with lime sweep and tail | [Photo](https://commons.wikimedia.org/wiki/File:Frankfurt_Airport_airBaltic_Airbus_A220-300_YL-ABL_(DSC09548).jpg) |
| `white-navy-belly-navy-tail` | White over navy belly, navy tail | [Photo](https://commons.wikimedia.org/wiki/File:Delta_Air_Lines_Airbus_A220-300_N307DU_departing_Boston_November_2025_1.jpg) |
| `navy-belly-streamer-tail` | White with navy belly and streamer tail | [Photo](https://commons.wikimedia.org/wiki/File:JetBlue_Airbus_A220-300_N3112J_MD1.jpg) |
| `white-black-belly-black-tail` | White with black belly band and tail | [Photo](https://commons.wikimedia.org/wiki/File:Air_Canada_A220-300_C-GUAC_%40YYZ.jpg) |
| `sky-blue-over-silver` | Sky blue over silver | [Photo 1](https://commons.wikimedia.org/wiki/File:Korean_Air_A220-300_(HL8312)_at_Narita_International_Airport.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:Korean_Air_Airbus_A220-300_HL8314_(48946393983).jpg) |

**White with lime sweep and tail.** airBaltic scheme from the referenced photograph: white fuselage with the lime sweep over the lower rear fuselage up into the fin, white tail cone, lime fin, engines and winglets; registration with the Latvian and EU flags below the aft windows. Titles are omitted. No operator titles, logos or emblems; the registration is fictional, in the national format.

**White over navy belly, navy tail.** Delta Air Lines 2007 scheme from the referenced photograph: white over the navy belly from the radome to the rear door, navy fin carried forward over the tail cone, navy engines and winglets, US flag and registration above the aft windows, ship number on the fin tip. The red tail widget is Delta's logo and is omitted, leaving the fin navy; titles are omitted. No operator titles, logos or emblems; the registration is fictional, in the national format.

**White with navy belly and streamer tail.** JetBlue scheme from the referenced photograph: white over a narrow navy belly band, navy engines and winglets, the fin in diagonal navy, blue and light-blue streamer bands (redrawn as straight-sided, gently bowed bands with the stepped leading-edge column), registration and US flag above the aft windows. The fin wordmark and titles are omitted. No operator titles, logos or emblems; the registration is fictional, in the national format.

**White with black belly band and tail.** Air Canada scheme (2017) from the referenced photograph: white over a black belly band, black fin, engines and winglets, Canadian flag and registration above the aft windows, fleet number on the fin tip. The maple-leaf roundel is the operator's logo and is omitted, leaving the fin plain black; titles are omitted. No operator titles, logos or emblems; the registration is fictional, in the national format.

**Sky blue over silver.** Korean Air scheme from the referenced photographs: sky blue upper fuselage, fin and tailplanes over a silver belly behind a fine white line, white engines, registration on the fin and a small national flag at its tip. The taegeuk emblem on the fin and engines is the operator's logo and is omitted; titles are omitted. No operator titles, logos or emblems; the registration is fictional, in the national format.

### Airbus A320neo

Type: `molen.entities.aircraft.airbus_a320neo`.

[![Airbus A320neo livery comparison: White with orange swoosh and tail, All-over yellow, White, magenta and purple, White with deep blue tail, Red with white band stripes, German Air Force VIP transport](https://molen.dev/guide-media/liveries/airbus_a320neo.png)](https://molen.dev/guide-media/liveries/airbus_a320neo.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `white-orange-tail` | White with orange swoosh and tail | [Photo](https://commons.wikimedia.org/wiki/File:EasyJet_A320neo_at_MAN.jpg) |
| `all-over-yellow` | All-over yellow | [Photo](https://commons.wikimedia.org/wiki/File:Spirit_Airbus_A320neo_N974NK_BWI_MD2.jpg) |
| `white-magenta-purple` | White, magenta and purple | [Photo](https://commons.wikimedia.org/wiki/File:9H-WBY_A320neo%2C_Wizz_Air%2C_Luton_05-27-26.jpg) |
| `white-deep-blue-tail` | White with deep blue tail | [Photo](https://commons.wikimedia.org/wiki/File:D-AINP_Lufthansa_A320neo_FRA_(48736398922).jpg) |
| `red-white-band-stripes` | Red with white band stripes | [Photo](https://commons.wikimedia.org/wiki/File:D-ANCX_A320neo%2C_Condor%2C_Palma_de_Mallorca_09-04-26.jpg) |
| `luftwaffe-flugbereitschaft` | German Air Force VIP transport | [Photo](https://commons.wikimedia.org/wiki/File:Airbus_A321-231_(cn_1214%2C_15%2B04)_2024-02-16_Andre_Gerwing_Collection_ID_017797.jpg) |

**White with orange swoosh and tail.** easyJet scheme (2015) from the referenced photograph: white fuselage with the orange swoosh from the cockpit down to the belly behind the wing, orange rear fuselage and fin, orange engines and sharklets, white registration aft of the rear door. That aircraft also wears a promotional "NEO" decal, which is not reproduced; titles are omitted. No operator titles, logos or emblems; the registration is fictional, in the national format.

**All-over yellow.** Spirit Airlines scheme from the referenced photograph: all-over bright yellow fuselage, fin, engines, pylons and sharklets, grey tailplanes; registration, small US flag and fleet number aft of the rear door. The black titles are omitted. No operator titles, logos or emblems; the registration is fictional, in the national format.

**White, magenta and purple.** Wizz Air scheme (2015) from the referenced photograph: white forward fuselage, magenta from a slanted line over the wing, deep purple-blue over the lower rear fuselage and tail cone, purple fin with a magenta upper leading edge, magenta engines and sharklets; white registration with the national flag on the tail cone (Hungarian here; the photographed aircraft is Maltese-registered). Titles and the type lettering are omitted. No operator titles, logos or emblems; the registration is fictional, in the national format.

**White with deep blue tail.** Lufthansa scheme (2018) from the referenced photograph: white fuselage and engines, deep blue fin with a white leading-edge line and the blue carried over the tail cone, registration and German flag below the aft windows. The crane emblem, titles and aircraft name are omitted, leaving the fin plain blue; sharklet colour is assumed white. No operator titles, logos or emblems; the registration is fictional, in the national format.

**Red with white band stripes.** Condor "Passion" scheme (2022) from the referenced photograph: red and white bands round the fuselage with a red nose and tail cone, white fin with red bands parallel to the leading edge and a small German flag, white engines and sharklets, registration on a white band. The band count follows the photograph; titles, the bird emblem and "est. 1956" are omitted. No operator titles, logos or emblems; the registration is fictional, in the national format.

**German Air Force VIP transport.** German Air Force special air mission (Flugbereitschaft) scheme from the referenced photograph of A321 15+04, applied to the A320neo model: white overall with the black-red-gold cheatline from the nose to the tail cone, BUNDESREPUBLIK DEUTSCHLAND titles, serial 15+04 with the national cross, German flag and LUFTWAFFE on the fin, national crosses on the upper wing surfaces (the right wing's is not visible in the photograph). The titles' serif face is approximated with a sans and the federal coat of arms by the nose is omitted.

### Airbus A400M Atlas

Type: `molen.entities.aircraft.a400m`.

[![Airbus A400M Atlas livery comparison: Luftwaffe LTG 62, 54+28, RAF Atlas C1 ZM404, Spanish Air Force Ala 31, T.23-01, Turkish Air Force 13-0009, French Air and Space Force, ET 4/61 Béarn](https://molen.dev/guide-media/liveries/a400m.png)](https://molen.dev/guide-media/liveries/a400m.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `luftwaffe-ltg-62` | Luftwaffe LTG 62, 54+28 | [Photo 1](https://commons.wikimedia.org/wiki/File:A400M_Luftwaffe_54%2B28_at_RIAT_2019.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:German_Air_Force_Airbus_A400M_-_54%2B18.jpg) |
| `raf-atlas-c1-zm404` | RAF Atlas C1 ZM404 | [Photo](https://commons.wikimedia.org/wiki/File:Airbus_A400M_Atlas_C1_-_Royal_Air_Force_-_ZM404_404_(48990266088).jpg) |
| `spanish-ala-31-t23-01` | Spanish Air Force Ala 31, T.23-01 | [Photo](https://commons.wikimedia.org/wiki/File:Fuerza_A%C3%A9rea_Espa%C3%B1ola_(Spanish_Air_Force)_Airbus_A400M-180_(T.23-01).jpg) |
| `turkish-air-force-221-filo` | Turkish Air Force 13-0009 | [Photo](https://commons.wikimedia.org/wiki/File:13-0009_A400M_TURKISH_AIR_FORCE_(53330076748).jpg) |
| `french-et-4-61-bearn` | French Air and Space Force, ET 4/61 Béarn | [Photo](https://commons.wikimedia.org/wiki/File:A400M_Arm%C3%A9e_de_l'Air_et_de_l'Espace_-_Escadron_de_Transport_164,_le_B%C3%A9arn.jpg) |

**Luftwaffe LTG 62, 54+28.** Luftwaffe A400M 54+28 of Lufttransportgeschwader 62 (Wunstorf) from the referenced photographs: gray overall, LUFTWAFFE title above the crew door, Balkenkreuz and 54+28 on the rear fuselage, German flag on the fin, yellow propeller line. The red rescue markings and the wing emblem by the nose are omitted. Approximate colors.

**RAF Atlas C1 ZM404.** Royal Air Force Atlas C1 ZM404 (Brize Norton) from the referenced photograph: gray overall, ROYAL AIR FORCE title, 404 on the nose, the Union flag by the crew door, red and blue roundel with ZM404 on the rear fuselage, red and blue fin flash, yellow propeller line. Union flag simplified (centred red saltire). Approximate colors.

**Spanish Air Force Ala 31, T.23-01.** Spanish Air Force A400M T.23-01 of Ala 31 (Zaragoza) from the referenced photograph: gray overall, EJÉRCITO DEL AIRE title, code 31-21 either side of the red and yellow roundel on the rear fuselage, T.23-01 on the fin, yellow propeller line. Approximate colors.

**Turkish Air Force 13-0009.** Turkish Air Force A400M 13-0009 (221 Filo, Kayseri) from the referenced photograph: gray overall, TÜRK HAVA KUVVETLERİ title, Turkish flag, 13-0009 and TURKISH AIR FORCE on the fin, roundel on the rear fuselage, yellow propeller line. The squadron badge under the fin lettering is omitted. Approximate colors.

**French Air and Space Force, ET 4/61 Béarn.** French Air and Space Force A400M F-RBAO of Escadron de Transport 4/61 Béarn from the referenced photograph: darker gray, 4/61 BÉARN in yellow and red along the fin's leading edge, tricolor fin flash, roundel with F-RBAO on the rear fuselage, yellow propeller line. The red fuselage art of that photograph is omitted. Approximate colors.

### Airbus H125

Type: `molen.entities.aircraft.airbus_h125`.

[![Airbus H125 livery comparison: Swiss mountain rescue red, Gendarmerie nationale, South African Police Service, Alaska glacier tours red and silver, Alpine charter anthracite](https://molen.dev/guide-media/liveries/airbus_h125.png)](https://molen.dev/guide-media/liveries/airbus_h125.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `swiss-red-star-swoosh` | Swiss mountain rescue red | [Photo](https://commons.wikimedia.org/wiki/File:H125_Astar_Air_Zermatt_HB-ZPB_(41350562515).jpg) |
| `gendarmerie-nationale` | Gendarmerie nationale | [Photo 1](https://commons.wikimedia.org/wiki/File:AS350b_Ecureuil_F-MJCV-IMG_5138.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:Helicopter_rescue_sancy_takeoff.jpg) |
| `south-african-police` | South African Police Service | [Photo](https://commons.wikimedia.org/wiki/File:South_African_Police_AS350_B3_ZS-RPL_(6918351305).jpg) |
| `alaska-glacier-tours` | Alaska glacier tours red and silver | [Photo](https://commons.wikimedia.org/wiki/File:Helicopter,_Mendenhall_Glacier,_Alaska.jpg) |
| `swiss-charter-anthracite` | Alpine charter anthracite | [Photo](https://commons.wikimedia.org/wiki/File:%C3%89vacuation_m%C3%A9dicale_-_Airbus_Helicopters_H125_-_Val_d%27Is%C3%A8re.jpg) |

**Swiss mountain rescue red.** Swiss mountain rescue and utility H125 from the referenced photograph of HB-ZPB: deep red overall with a broad white swoosh leaning forward across the rear cabin and cowling, red stars inside it and white stars trailing onto the boom (an original scatter, not the operator's star placement), a white lower fin, the registration in white on the boom and the Swiss cross on the fin. The registration is fictional (HB-ZKV); the operator's name and all sponsor logos are omitted. Colors are approximate.

**Gendarmerie nationale.** French Gendarmerie nationale Écureuil from the referenced photograph: dark navy blue overall with a white cheatline under the upper windows that rises behind the rear door and runs forward along the cowling, a thin white line along the boom, a white fin with a navy stripe, the GENDARMERIE title on the rear door, the French roundel behind it and the last three letters of the registration on the cowling. The code is fictional (JBQ; the photographed aircraft is F-MJCV); the unit badge and stencils are omitted. Colors and line widths are approximate.

**South African Police Service.** South African Police Service AS350 B3 from the referenced photograph: white cabin, blue cowling, boom, fin and belly with the blue sweeping up from the belly into the boom behind the rear doors, the South African flag on the cowling and the registration in white on the boom. The registration is fictional (ZS-RQM; the photographed aircraft is ZS-RPL) and the service star badge on the doors is omitted. Colors are approximate.

**Alaska glacier tours red and silver.** Juneau glacier-tour AS350 from the referenced photograph on the Mendenhall Glacier: red lower cabin, boom, fin and skids, white upper cabin and cowling front, and a metallic silver nose cap, with the registration in white on the boom. The registration is fictional (N6127T; the photographed aircraft is N6094E) and the operator title on the cowling is omitted. Colors and the split lines are approximate.

**Alpine charter anthracite.** Swiss alpine charter and medevac H125 from the referenced Val d'Isère photograph of HB-ZSL: anthracite grey overall with a red flash rising from the front door to the cowling (and a thinner one behind it), a thin red line along the boom, the registration in white italic capitals on the boom and the Swiss cross on the fin. The registration is fictional (HB-ZRN); the operator's fin emblem and the cowling target logo are omitted. Colors are approximate.

### Airbus H145 D3

Type: `molen.entities.aircraft.airbus_h145`.

[![Airbus H145 D3 livery comparison: German state police blue and silver, German air rescue red and white, German air rescue yellow, Luftwaffe H145M LUH SAR 77+04, US Army UH-72B Lakota](https://molen.dev/guide-media/liveries/airbus_h145.png)](https://molen.dev/guide-media/liveries/airbus_h145.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `polizei-blue-silver` | German state police blue and silver | [Photo](https://commons.wikimedia.org/wiki/File:Airbus_H145_BK_117_D-2_(cn_20144,_D-HNWW)_2018-09-03_Andre_Gerwing_Collection_ID_010823.jpg) |
| `german-air-rescue-red` | German air rescue red and white | [Photo](https://commons.wikimedia.org/wiki/File:H145_Christoph_27_als_D-HXFI.jpg) |
| `german-air-rescue-yellow` | German air rescue yellow | [Photo](https://commons.wikimedia.org/wiki/File:Airbus_H145_BK_117_D-3_(cn_21042,_D-HYAS)_2023-07-01_Andre_Gerwing_Collection_ID_010834.jpg) |
| `luftwaffe-h145m-sar` | Luftwaffe H145M LUH SAR 77+04 | [Photo](https://commons.wikimedia.org/wiki/File:Airbus_H145M_LUH_(cn_20315,_77%2B04)_2024-06-09_Andre_Gerwing_Collection_ID_020103.jpg) |
| `us-army-uh-72b` | US Army UH-72B Lakota | [Photo](https://commons.wikimedia.org/wiki/File:Arrival_of_first_UH-72_Bravo_Lakota_Helicopter_to_South_Carolina_Army_National_Guard_(52677095500)_(cropped).jpg) |

**German state police blue and silver.** German state police H145 from the referenced photograph of D-HNWW: metallic silver upper body and boom, police blue lower cabin up to the window sills sweeping down behind the aft door, a line of small white and blue checks along the top of the blue, POLIZEI in white on the doors, blue cowling crowns, boom-top line, Fenestron shroud and endplates, and a white band at the top of the shroud with the registration and the German flag. The registration is fictional (D-HPMS) and the state emblem and manufacturer titles are omitted. Colors are approximate.

**German air rescue red and white.** German air rescue H145 D3 from the referenced photograph of D-HXFI: red upper body, cowlings, boom and Fenestron, white lower cabin behind a diagonal from the sliding door's foot and white rear cabin, white shroud cap and ventral fin, NOTARZT (emergency doctor) in white on the boom and the registration with the German flag on the cowling. The registration is fictional (D-HDTQ); the operator's name and logos are omitted. Colors and the split line are approximate.

**German air rescue yellow.** German automobile-club air rescue H145 D3 from the referenced photograph of D-HYAS: signal yellow overall with a blue Fenestron cap, NOTARZT (emergency doctor) in black on the boom and the registration in black with the German flag on the cowling. The registration is fictional (D-HYMK); the operator's large name on the rear cabin, its logos and the emergency-number emblem on the fin are omitted. Colors are approximate.

**Luftwaffe H145M LUH SAR 77+04.** German Air Force H145M LUH SAR 77+04 from the referenced photograph: bronze-olive green with dayglo orange-red on the roof, cowlings and crew-door area and on the lip under the Fenestron, SAR in blue on the sliding door, the serial 77+04 with the Balkenkreuz on the boom and the German flag on the fin. The H145M is shown on the civil D3 airframe (no weapons or sensor fit); colors are approximate.

**US Army UH-72B Lakota.** US Army National Guard UH-72B Lakota 72478 from the referenced photograph (the UH-72B is the military H145 D3): olive drab overall with matt finish, the serial in black on the Fenestron cap and U.S. ARMY in black on the boom. Unit patches and stencils are omitted; colors are approximate.

### Antonov An-124-100 Ruslan

Type: `molen.entities.aircraft.an_124`.

[![Antonov An-124-100 Ruslan livery comparison: Russian Air Force RF-82011, Heavy-lift cargo, blue band and swept tail stripe, Heavy-lift cargo, blue belly and tail, Soviet era, white and gray with blue cheatline, Ukrainian design bureau, cyan tail](https://molen.dev/guide-media/liveries/an_124.png)](https://molen.dev/guide-media/liveries/an_124.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `russian-air-force-rf-82011` | Russian Air Force RF-82011 | [Photo](https://commons.wikimedia.org/wiki/File:Russian_Air_Force,_RF-82011,_Antonov_An-124_(42713037752).jpg) |
| `cargo-white-blue-swept-tail` | Heavy-lift cargo, blue band and swept tail stripe | [Photo](https://commons.wikimedia.org/wiki/File:Volga-Dnepr_Airlines_Antonov_An-124-100_RA-82077.jpg) |
| `cargo-blue-belly` | Heavy-lift cargo, blue belly and tail | [Photo](https://commons.wikimedia.org/wiki/File:Polet_Airlines_An-124_RA-82075_in_flight_28-Jul-2011.jpg) |
| `soviet-era-1988` | Soviet era, white and gray with blue cheatline | [Photo](https://commons.wikimedia.org/wiki/File:Antonov_An-124-100_Ruslan_CCCP-82007_Aeroflot,_Farnborough_UK,_September_1988._(5589235899).jpg) |
| `design-bureau-cyan-tail` | Ukrainian design bureau, cyan tail | [Photo](https://commons.wikimedia.org/wiki/File:Antonov_An-124-100_Ruslan,_Antonov_Airlines_JP295359.jpg) |

**Russian Air Force RF-82011.** Russian Air Force An-124-100 RF-82011 from the referenced photograph: white upper fuselage, light gray belly, dark blue cheatline with a thin line under it rising with the tail, red star in its white and blue border on the fin, ВВС РОССИИ on the fin root, RF-82011 aft and АН-124-100 on the nose, red wing and stabilizer tips. The aircraft name in red script is omitted. Approximate colors.

**Heavy-lift cargo, blue band and swept tail stripe.** Civil heavy-lift cargo scheme in the real colors and layout of Volga-Dnepr's An-124s (referenced photograph), without operator names or logos: white, a wide dark blue cheatline between pinstripes, blue nacelle bands, and the wide and narrow stripes that sweep from the rear fuselage up the fin, Russian flag on the fin tip, АН-124-100 on the nose. Registration RA-82099 is fictional. Approximate colors.

**Heavy-lift cargo, blue belly and tail.** Civil heavy-lift cargo scheme in the real colors and layout of Polet's An-124s (referenced photograph), without operator names or logos: white upper fuselage over a dark blue belly with three white slanted stripes ahead of the wing, blue nacelles, blue fin and rudder with two white stripes, Russian flag by the cockpit, АН-124-100 on the nose. Registration RA-82098 is fictional. Approximate colors and stripe geometry.

**Soviet era, white and gray with blue cheatline.** Soviet-era An-124 scheme of the late 1980s (referenced Farnborough 1988 photograph) without the airline title: white upper fuselage, gray belly and nacelles, a blue cheatline rising with the tail and the red state flag on the fin (original simplified drawing). Registration CCCP-82097 is fictional. Approximate colors.

**Ukrainian design bureau, cyan tail.** Antonov Design Bureau An-124-100 scheme of the 2000s (referenced photograph) without its titles: white with a thin dark blue cheatline and light gray belly, cyan fin and rudder, Ukrainian flag by the cockpit, АН-124-100 on the nose. Registration UR-82096 is fictional. Approximate colors.

### ATR 72-600

Type: `molen.entities.aircraft.atr_72_600`.

[![ATR 72-600 livery comparison: Turkish Navy ATR 72-600 TMPA, Italian Air Force P-72A, 41° Stormo, White freighter, purple tail, White with green and lime sweep, White over navy, blue pinline](https://molen.dev/guide-media/liveries/atr_72_600.png)](https://molen.dev/guide-media/liveries/atr_72_600.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `turkish-navy-tmpa` | Turkish Navy ATR 72-600 TMPA | [Photo 1](https://commons.wikimedia.org/wiki/File:ATR_C-72-600TMPA_TurkishNavy_Teknofest2021_(1).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:ATR_C-72-600TMPA_TurkishNavy_Teknofest2021_(2).jpg) |
| `italian-air-force-p72a` | Italian Air Force P-72A, 41° Stormo | [Photo](https://commons.wikimedia.org/wiki/File:EGLF_-_ATR_72_MPA_-_Aeronautica_Militare_-_41-02_(44058760001).jpg) |
| `white-purple-tail-freighter` | White freighter, purple tail | [Photo](https://commons.wikimedia.org/wiki/File:Hannover_Airport_ASL_Airlines_Ireland_FedEx_Feeder_ATR_72-600F_EI-HAF_(DSC08928).jpg) |
| `white-green-lime-sweep` | White with green and lime sweep | [Photo](https://commons.wikimedia.org/wiki/File:Binter_Canarias_ATR_72-600_(EC-MXQ)_@_TFS,_Jan_2019.jpg) |
| `white-over-navy-pinline` | White over navy, blue pinline | [Photo](https://commons.wikimedia.org/wiki/File:Azul_ATR_72%E2%80%93600_MGF_11_2016_3561.jpg) |

**Turkish Navy ATR 72-600 TMPA.** Turkish Naval Forces maritime patrol ATR 72-600 (TMPA) as photographed at Teknofest 2021: blue-grey overall, black TÜRK DENİZ KUVVETLERİ titles over the main gear, the naval anchor emblem and side number 752 on the nose, red-white-red roundels under the wings, yellow propeller tips and the red propeller danger line (original vector drawings). Upper wing roundels are assumed; the mission radome, sensor turret, observation bubbles and the red nose panel outline are not modelled. Colours are approximate.

**Italian Air Force P-72A, 41° Stormo.** Aeronautica Militare P-72A maritime patrol aircraft 41-02 of the 41st Wing as photographed at Farnborough: dark grey overall with the 41-02 code in light grey on the nose, low-visibility AERONAUTICA MILITARE titles aft of the wing and yellow propeller tips (original vector lettering). National insignia are not visible in the reference and are left off; the wing badge, mission sensors and stencils are omitted. Colours are approximate.

**White freighter, purple tail.** FedEx Feeder scheme as photographed on ATR 72-600F EI-HAF: white fuselage, wings and nacelles; purple fin, rudder, tailplane and rear body behind a curve from the belly aft of the wing up to the fin leading edge, white registration on the purple. The FedEx and Feeder titles, the Irish flag and the freighter cargo door outline are left off; registration EI-HQK is fictional. The curve is approximated by straight cuts.

**White with green and lime sweep.** Binter Canarias scheme as photographed on EC-MXQ: white with a dark green band under the windows, a blue pinline and a lime lower body sweeping up the tail cone and across the fin, a lime stripe at the fin top, a dark green keel line forward, dark green sponsons and a lime crescent on the nose. Titles, the web address, the aircraft name and the flags are left off; registration EC-NZQ is fictional. Curves are redrawn and approximate.

**White over navy, blue pinline.** Azul scheme as photographed at Maringá: white over a navy lower body behind a bright blue pinline that sweeps down under the nose, navy fin, dorsal, tailplane, nacelles and sponsons, white registration on the navy aft. The Azul titles, the dotted tail emblem, nacelle titles and aircraft name are left off; registration PR-ATQ is fictional. The break height is estimated from an oblique photograph.

### Beechcraft Baron G58

Type: `molen.entities.aircraft.baron_g58`.

[![Beechcraft Baron G58 livery comparison: White with navy and black sweep (N458BG), Factory white, black and red (N583GB), White, black and bronze (VH-BZQ), Indonesian Navy gray, as delivered](https://molen.dev/guide-media/liveries/baron_g58.png)](https://molen.dev/guide-media/liveries/baron_g58.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `white-navy-sweep` | White with navy and black sweep (N458BG) | [Photo](https://commons.wikimedia.org/wiki/File:Beechcraft_G58_Baron_(N67WM,_cn_TH-2485)_(1-12-2023).jpg) |
| `factory-white-black-red` | Factory white, black and red (N583GB) | [Photo](https://commons.wikimedia.org/wiki/File:Beechcraft_G58_Baron_(N538BB,_cn_TH-2538)_(7-29-2023).jpg) |
| `white-black-bronze` | White, black and bronze (VH-BZQ) | [Photo](https://commons.wikimedia.org/wiki/File:Paced_Investments_(VH-TWZ)_Beechcraft_G58_Baron_at_Wagga_Wagga_Airport.jpg) |
| `indonesian-navy-delivery` | Indonesian Navy gray, as delivered | [Photo](https://commons.wikimedia.org/wiki/File:Newly_Arrived_Beechcraft_Baron_G58_of_Indonesian_Navy.jpg) |

**White with navy and black sweep (N458BG).** Private G58 in the white scheme of the referenced N67WM: navy and black cheatlines under the cabin sweeping up the fin and rudder as three diagonal bands, a navy flash over each nacelle. Fictional registration N458BG on the rear fuselage and under the left wing; no names or logos. Stripe widths and angles approximate.

**Factory white, black and red (N583GB).** G58 in the factory scheme of the referenced N538BB: white with a black upper fin and rudder over a red sweep, black nacelle tops edged in red, and red pinstripes along the cabin and tail cone. Fictional registration N583GB; manufacturer script and logos omitted. Colors and sweep angles approximate.

**White, black and bronze (VH-BZQ).** Australian G58 in the scheme of the referenced VH-TWZ: white with a black upper fin and rudder, bronze and black pinstripes along the fuselage and a black nacelle flash. Fictional Australian registration VH-BZQ; owner monogram and names omitted. Colors approximate.

**Indonesian Navy gray, as delivered.** One of the Indonesian Navy (TNI-AL) G58 trainers on its delivery day: overall medium gray with a black fin leading edge and unpainted spinners; national and service markings were not yet applied, as in the photograph. Gray shade approximate.

### Beechcraft Bonanza G36

Type: `molen.entities.aircraft.bonanza_g36`.

[![Beechcraft Bonanza G36 livery comparison: 75th-anniversary edition, 2022, Factory white and navy, 2015, Factory navy belly, 2007, A36 factory cream and charcoal, 1987, Stars and stripes owner scheme, Indonesian Navy G36 trainer](https://molen.dev/guide-media/liveries/bonanza_g36.png)](https://molen.dev/guide-media/liveries/bonanza_g36.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `g36-75th-anniversary` | 75th-anniversary edition, 2022 | [Photo](https://commons.wikimedia.org/wiki/File:Beechcraft_G36_Bonanza_(N152BZ,_cn_E-4152)_(7-29-2023).jpg) |
| `g36-factory-2015` | Factory white and navy, 2015 | [Photo](https://commons.wikimedia.org/wiki/File:N850KS_2015_Beechcraft_G36_Bonanza_s_n_E-4065_(48806945087).jpg) |
| `g36-factory-2007-navy` | Factory navy belly, 2007 | [Photo](https://commons.wikimedia.org/wiki/File:N6980B_2007_Beechcraft_G36_Bonanza_s_n_E-3780_(53607431363).jpg) |
| `a36-factory-1987` | A36 factory cream and charcoal, 1987 | [Photo](https://commons.wikimedia.org/wiki/File:N3050K_1987_Beech_A36_Bonanza_36_C-N_E-2364_(7757064500).jpg) |
| `stars-and-stripes-custom` | Stars and stripes owner scheme | [Photo](https://commons.wikimedia.org/wiki/File:N49EL_Beech_G36_Bonanza_s_n_E-4158_(54387449351).jpg) |
| `indonesian-navy` | Indonesian Navy G36 trainer | [Photo](https://commons.wikimedia.org/wiki/File:Beechcraft_Bonanza_G36_Indonesian_Navy.jpg) |

**75th-anniversary edition, 2022.** The 2022 Bonanza 75th-anniversary paint from the referenced photograph: metallic burgundy cowling and upper fuselage over white, the split sweeping up to the fin root with navy and gray pinstripes, a burgundy and white checker flag behind the cowling and burgundy and navy bands at the fin tip. The Beechcraft and Bonanza logos and the large fin B are omitted; registration N175BZ is fictional. Shapes and colors are approximations.

**Factory white and navy, 2015.** Beechcraft’s mid-2010s G36 factory paint from the referenced photograph: white with a navy upper cowling running back as a blade under the windshield, navy and gray pinstripes from the cowling to the stabilizer, a navy blade along the lower tail cone, a navy fin cap and a large navy registration (N836GB, fictional). Logos omitted; approximate shapes.

**Factory navy belly, 2007.** The 2007 Hawker Beechcraft G36 scheme from the referenced photograph: white over a navy lower fuselage and cowling, gray and navy pinstripes along the split, the navy hooking up toward the fin root, navy bands at the fin tip and a navy registration (N6236B, fictional). Logos omitted; approximate colors.

**A36 factory cream and charcoal, 1987.** Beech’s late-1980s A36 Bonanza paint from the referenced photograph, applied to the G36 model: cream with a charcoal cheatline and wine pinstripe from the spinner to the tail, a charcoal lower tail cone and fin cap, and a very large italic charcoal registration (N3617K, fictional). Approximate colors.

**Stars and stripes owner scheme.** A private owner’s flag scheme after the referenced photograph: a navy nose with white stars back to the windshield posts, red and cream stripes slanting down and aft over the cabin and tail cone, level stripes across the fin and a red registration with a cream edge and navy shadow (N47SB, fictional). Star count, stripe spacing and the wing treatment are approximations; the stripes are side projections and do not wrap over the fuselage top.

**Indonesian Navy G36 trainer.** Indonesian Navy (TNI Angkatan Laut) G36 T-2502 from the referenced photograph: light gray overall, TNI ANGKATAN LAUT under the rear windows, the serial T-2502 on the fin and the red-and-white national flag at the fin tip (original vector art). The naval aviation badge on the cowling is omitted; approximate colors.

### Beechcraft King Air 350i

Type: `molen.entities.aircraft.king_air_350i`.

[![Beechcraft King Air 350i livery comparison: Silver and red (N835GK), Factory 350i white and champagne (N731KB), White with navy cheatlines (N426RA), RAAF 32 Squadron King Air 350 A32-351, US Navy UC-12F 163556](https://molen.dev/guide-media/liveries/king_air_350i.png)](https://molen.dev/guide-media/liveries/king_air_350i.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `silver-and-red` | Silver and red (N835GK) | [Photo](https://commons.wikimedia.org/wiki/File:N350FC_1998_Raytheon_Aircraft_Company_B300-350_C-N_FL-214_(6445379427).jpg) |
| `factory-350i-champagne` | Factory 350i white and champagne (N731KB) | [Photo](https://commons.wikimedia.org/wiki/File:N8141T_Beechcraft_B300_King_Air_350i_(6485875281).jpg) |
| `white-and-navy` | White with navy cheatlines (N426RA) | [Photo](https://commons.wikimedia.org/wiki/File:N1SC_-_1990_King_Air_350.jpg) |
| `raaf-32-squadron` | RAAF 32 Squadron King Air 350 A32-351 | [Photo](https://commons.wikimedia.org/wiki/File:RAAF_Beechcraft_B300_King_Air_350_(A32-351)_at_YSWG.jpg) |
| `us-navy-uc-12f` | US Navy UC-12F 163556 | [Photo](https://commons.wikimedia.org/wiki/File:UC-12F_static_display._(7995813990).jpg) |

**Silver and red (N835GK).** Corporate King Air 350 in the scheme of the referenced N350FC: metallic silver upper fuselage and wings over a red lower fuselage and nacelle bellies, split by a black pinstripe, with a red fin cap and tailplane leading edge. Fictional registration N835GK in black on the red; manufacturer script omitted. Colors approximate.

**Factory 350i white and champagne (N731KB).** King Air 350i in the factory scheme of the referenced demonstrator N8141T: white fuselage with black and champagne cheatlines sweeping back under the windows, a champagne fin and rudder crossed by a thin red pinstripe, champagne nacelle tops. Fictional registration N731KB; the large monogram and the model wordmark on the fin are omitted. Colors approximate.

**White with navy cheatlines (N426RA).** King Air 350 in the 1990s white scheme of the referenced N1SC: white overall with twin navy cheatlines from the nose to the tail cone, navy nacelle tops and a navy fin stripe. Fictional registration N426RA; owner names omitted. Colors approximate.

**RAAF 32 Squadron King Air 350 A32-351.** King Air 350 A32-351 of the Royal Australian Air Force: white with navy pinstripes and a gold sweep along the fuselage and up the fin root, ROYAL AUSTRALIAN AIR FORCE above the cabin windows, the serial on the rear fuselage, the kangaroo roundel on the fin and wings. Colors approximate.

**US Navy UC-12F 163556.** UC-12F 163556 of the US Navy, Japan: gloss white with a navy cheatline over a tan stripe from the nose to the tail cone, navy nacelle stripes, the type and bureau number small on the rear fuselage. National insignia were not visible on this example and are omitted; colors approximate.

### Beechcraft Model 18

Type: `molen.entities.aircraft.beech_18`.

[![Beechcraft Model 18 livery comparison: US Navy SNB-1 Kansan C-55, Royal Canadian Navy Expeditor 2312, USAAF C-45F olive drab, Executive D18S white and yellow (N7618B)](https://molen.dev/guide-media/liveries/beech_18.png)](https://molen.dev/guide-media/liveries/beech_18.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `us-navy-snb-1` | US Navy SNB-1 Kansan C-55 | [Photo](https://commons.wikimedia.org/wiki/File:N145SC_(Bu51025)_Beech_SNB-1_Kansan_(US_Navy)_PAE_02AUG13_(9424635997).jpg) |
| `royal-canadian-navy-expeditor` | Royal Canadian Navy Expeditor 2312 | [Photo](https://commons.wikimedia.org/wiki/File:CF-SEB_RCAF_2312_Beech_3NM_Expeditor_Shearwater_Aviation_Museum_NS_18.6.25_(54626170478).jpg) |
| `usaaf-c-45f-olive-drab` | USAAF C-45F olive drab | [Photo](https://commons.wikimedia.org/wiki/File:Barksdale_Global_Power_Museum_September_2015_18_(Beechcraft_C-45F_Expeditor).jpg) |
| `executive-white-and-yellow` | Executive D18S white and yellow (N7618B) | [Photo](https://commons.wikimedia.org/wiki/File:Beechcraft_D18S_Twin_Beech_-_DPLA_-_90ef321242ce1c6d7ab221d9774b3412_(page_18).jpg) |

**US Navy SNB-1 Kansan C-55.** SNB-1 Kansan Bu 51025 in 1942-43 Navy trainer markings as preserved: aluminum lacquer overall, the star-in-disc insignia on the rear fuselage, upper left and lower right wing, U.S. NAVY aft and the C-55 station code ahead of it, SNB-1 and 51025 high on the fins. Colors approximate.

**Royal Canadian Navy Expeditor 2312.** Expeditor 3NM 2312 of the Royal Canadian Navy, Shearwater, as preserved: natural metal, ROYAL CANADIAN NAVY above the cabin windows, the maple-leaf roundel on the rear fuselage and wings, a blue-white-red fin flash with the serial above it on both fins. Colors approximate; small stencils omitted.

**USAAF C-45F olive drab.** C-45F Expeditor in the USAAF olive drab over neutral gray of the referenced museum aircraft, the demarcation low on the fuselage and nacelles, with 1943 star-and-bar insignia on the rear fuselage, upper left and lower right wing. Serial and unit markings not visible in the photograph are omitted; colors approximate.

**Executive D18S white and yellow (N7618B).** D18S executive transport in the colors of the referenced Smithsonian aircraft: white upper fuselage, fins and tailplane over pale yellow wings, nacelles and cowlings, with a teal cheatline along the cabin. Fictional registration N7618B on the rear fuselage; operator names and badges omitted. Colors approximate.

### Bell 206B JetRanger

Type: `molen.entities.aircraft.bell_206b`.

[![Bell 206B JetRanger livery comparison: US Navy TH-57C Sea Ranger, US city police navy and silver, Swedish police POLIS, Polish police aviation red and black, Canadian Forces CH-139 trainer](https://molen.dev/guide-media/liveries/bell_206b.png)](https://molen.dev/guide-media/liveries/bell_206b.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `us-navy-th-57c` | US Navy TH-57C Sea Ranger | [Photo 1](https://commons.wikimedia.org/wiki/File:Naeapaxr_TH-57C.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:TH57C_boat_ops.jpg) |
| `city-police-navy-silver` | US city police navy and silver | [Photo](https://commons.wikimedia.org/wiki/File:LAPD_Bell_206_Jetranger.jpg) |
| `swedish-police-polis` | Swedish police POLIS | [Photo](https://commons.wikimedia.org/wiki/File:Bell_206B,_Stockholm_(P1090624).jpg) |
| `polish-police-red-black` | Polish police aviation red and black | [Photo](https://commons.wikimedia.org/wiki/File:Bell_206B-3_Jet_Ranger_%27SN-17XP%27_Policja.jpg) |
| `canadian-forces-ch-139` | Canadian Forces CH-139 trainer | [Photo](https://commons.wikimedia.org/wiki/File:Bell_CH-139_Jet_Ranger_139303_3CFFTS_Portage_1982.png) |

**US Navy TH-57C Sea Ranger.** US Navy TH-57C Sea Ranger 162016 from the referenced photographs (the TH-57 is the Navy's 206B-3 trainer): white with international orange cabin sides edged in black, an orange upper boom and fin leading edge, a black nose cone, the national insignia behind the rear door, NAVY on the boom and the type and Bureau Number on the fin. The squadron badge and stencils are omitted; colors are approximate.

**US city police navy and silver.** US city police JetRanger from the referenced Los Angeles photograph: metallic silver upper fuselage over a navy lower body that sweeps up behind the cabin into an all-navy boom and fin, two white pinstripes along the top of the navy, white stripes across the fin, the registration in white on the boom and the US flag on the fin. The registration is fictional (N417CK; the photographed aircraft is N211LA); the department initials and badge are omitted. Colors are approximate.

**Swedish police POLIS.** Swedish police JetRanger from the referenced photograph of the preserved SE-HPB: white with a black door panel ending in a raked edge behind the rear door, POLIS in large white capitals across the doors, a maroon engine deck and roof, and the registration in black on the boom. The registration is fictional (SE-HPK); the police coat of arms and museum markings are omitted. Colors are approximate.

**Polish police aviation red and black.** Polish police aviation JetRanger from the referenced photograph of SN-17XP: bright red with a black sweep from the nose, low along the cabin and up into the lower half of the boom and the ventral fin, gold pinstripes on both edges, red skids and the registration in white on the boom. The registration is fictional (SN-31XP); small model titles and stencils are omitted. Colors are approximate.

**Canadian Forces CH-139 trainer.** Canadian Forces CH-139 JetRanger 139303 of 3 Canadian Forces Flying Training School from the referenced 1982 photograph: trainer yellow with a dark belly, nose cone and engine deck, a dark tail boom broken by a yellow band, the roundel with the bilingual CANADIAN FORCES titles and the code 303 on the rear cabin, and the Canadian flag on the fin. Colors are approximate.

### Bell 407GX

Type: `molen.entities.aircraft.bell_407`.

[![Bell 407GX livery comparison: Iraqi Army Aviation YI-140, US state police black and gold, Polish police silver and blue, Air medical yellow and black, Corporate red and silver](https://molen.dev/guide-media/liveries/bell_407.png)](https://molen.dev/guide-media/liveries/bell_407.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `iraqi-army-aviation` | Iraqi Army Aviation YI-140 | [Photo 1](https://commons.wikimedia.org/wiki/File:Iraqi_Bell_407_YI-140.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:Two_Iraqi_Bell_407s.jpg) |
| `state-police-black-gold` | US state police black and gold | [Photo](https://commons.wikimedia.org/wiki/File:Bell_407_N876ST_Pennsylvania_State_Police_FDK_MD1.jpg) |
| `polish-police-silver-blue` | Polish police silver and blue | [Photo](https://commons.wikimedia.org/wiki/File:Bell-407-warsaw-poland-police-sn-80xp-right.jpg) |
| `air-medical-yellow` | Air medical yellow and black | [Photo](https://commons.wikimedia.org/wiki/File:Bell_407_(N462P).jpg) |
| `corporate-red-silver` | Corporate red and silver | [Photo](https://commons.wikimedia.org/wiki/File:Bell_407_-N23986.jpg) |

**Iraqi Army Aviation YI-140.** Iraqi Army Aviation Bell 407 YI-140 from the referenced US Air Force photographs: two-tone desert camouflage (sand with earth-brown blotches; the pattern is generated, not the aircraft's own), IRAQI ARMY AVIATION in black on the boom, the Iraqi flag on the rear cabin and fin and the serial on the fin. The flag's green inscription is represented by a simplified blocky mark rather than lettering; unit badges and stencils are omitted. Colors are approximate.

**US state police black and gold.** US state police Bell 407 from the referenced Pennsylvania photograph: gloss black upper body, boom and fin, a white lower body under a tan band with a black pinstripe that rises to the boom, STATE POLICE in tan above the doors, TROOPERS in black on the lower doors, the registration in tan on the boom and the fleet number in white on the stabilizer endplates. The registration is fictional (N452PS; the photographed aircraft is N876ST) and the state name, badge and seal are omitted. Colors are approximate.

**Polish police silver and blue.** Polish police Bell 407GXi from the referenced photographs of SN-80XP: light silver overall with a blue band at window-top level that drops onto the middle of the boom, POLICJA in blue on the front door, the fleet code on the rear cabin, the registration in white on the blue boom band and the Polish flag on the doghouse. The registration and code are fictional (SN-86XP, A-107); the police star badge is omitted. Colors are approximate.

**Air medical yellow and black.** US air-medical Bell 407 from the referenced photograph of N462P: signal yellow cabin and doghouse with a broad black swoosh from the lower front door up into the boom and a thinner one from the roof edge, a black boom, fin and stabilizer, black skids, the registration in large black capitals on the lower door and the Star of Life (an original drawing of the generic emergency-medical symbol) on the fin. The registration is fictional (N438P); the operator's name and logo are omitted. Colors and the swoosh curves are approximate.

**Corporate red and silver.** Privately operated Bell 407 from the referenced photograph of N23986: bright red upper body, doghouse, boom and fin over a metallic silver lower body and nose, split by a gold beltline pinstripe, with the registration in white on the boom. The registration is fictional (N24107); colors are approximate.

### Bell 412EP

Type: `molen.entities.aircraft.bell_412ep`.

[![Bell 412EP livery comparison: RCAF CH-146 Griffon, 417 Combat Support Squadron, RCAF CH-146 Griffon, tactical camouflage, Royal Norwegian Air Force 412SP, Japanese prefectural police, Australian rescue operator, red and white](https://molen.dev/guide-media/liveries/bell_412ep.png)](https://molen.dev/guide-media/liveries/bell_412ep.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `rcaf-ch146-sar` | RCAF CH-146 Griffon, 417 Combat Support Squadron | [Photo](https://commons.wikimedia.org/wiki/File:417_Sqdn_CH-146_Griffon_(2982559499).jpg) |
| `rcaf-ch146-camouflage` | RCAF CH-146 Griffon, tactical camouflage | [Photo 1](https://commons.wikimedia.org/wiki/File:Bell_CH-146_Griffin%2C_403_Sqn.JPG) · [Photo 2](https://commons.wikimedia.org/wiki/File:CH-146_Griffon_Helicopter.jpg) |
| `rnoaf-412sp` | Royal Norwegian Air Force 412SP | [Photo 1](https://commons.wikimedia.org/wiki/File:Bell_412SP_%E2%80%98148%E2%80%99_(49518597807).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:Bell_412SP_%E2%80%98162%E2%80%99_-_2009.jpg) |
| `japan-police` | Japanese prefectural police | [Photo](https://commons.wikimedia.org/wiki/File:Fukuoka_Police-Bell_412EP-JA01FP-Fukuoka_airport-20081212-152838.JPG) |
| `australia-rescue` | Australian rescue operator, red and white | [Photo](https://commons.wikimedia.org/wiki/File:CHC_Helicopter_Australia_(VH-EPH)_Bell_412EP_at_Wagga_Wagga_Airport.jpg) |

**RCAF CH-146 Griffon, 417 Combat Support Squadron.** CH-146 Griffon 146417 in the RCAF search-and-rescue scheme of 417 Combat Support Squadron, Cold Lake: SAR yellow with a red engine deck and a red band sweeping down across the cabin door, black anti-glare panel, RCAF roundel on the boom, Canadian flag and serial on the fin, 417 on the nose and RESCUE / SAUVETAGE on the cabin door, all redrawn. The Government of Canada wordmark is omitted. Approximate colors and band geometry.

**RCAF CH-146 Griffon, tactical camouflage.** CH-146 Griffon 146474 (403 Squadron) in the two-tone CF green tactical camouflage, matched against the 430 Squadron photograph: a generated two-green pattern (not the exact pattern), low-visibility roundel on the boom, 474 on the crew door and the serial on the fin. The Government of Canada wordmark is omitted. Approximate colors.

**Royal Norwegian Air Force 412SP.** Royal Norwegian Air Force Bell 412SP '148' (339 / 720 Squadron era): dark olive grey overall, the Norwegian roundel on the boom root and light grey 148 on the nose and fin, redrawn. The squadron badge is omitted; the 412EP model stands in for the 412SP. Approximate colors.

**Japanese prefectural police.** Japanese prefectural police colors and layout from the referenced Fukuoka photograph: light metallic blue over silver with a navy cheatline and white pinstripe rising along the boom, an orange band behind the crew door, a yellow boom band, the Japanese flag on the engine cowling and the registration on a white fin band. Police titles, nickname and badge are omitted; the registration JA21RP is fictional.

**Australian rescue operator, red and white.** Australian rescue Bell 412EP colors and layout from the referenced VH-EPH photograph: white with a red cockpit section ahead of the cabin door, red-framed cabin windows, a red boom edged in black pinstripes to a white fin, fleet number on the cowling and the registration in white on the boom. Operator names and logos are omitted; fleet number 106 and registration VH-ZRH are fictional.

### Bell Boeing MV-22B Osprey

Type: `molen.entities.aircraft.mv_22b`.

[![Bell Boeing MV-22B Osprey livery comparison: VMM-162 Golden Eagles YS-02, HMX-1 Nighthawks, green, USAF CV-22B 11-0058, 352nd SOW, JGSDF V-22 91716](https://molen.dev/guide-media/liveries/mv_22b.png)](https://molen.dev/guide-media/liveries/mv_22b.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `vmm-162-golden-eagles` | VMM-162 Golden Eagles YS-02 | [Photo 1](https://commons.wikimedia.org/wiki/File:US_Navy_100124-N-7456N-034_An_MV-22_Osprey_assigned_to_the_Golden_Eagles_of_Marine_Medium_Tiltrotor_Squadron_(VMM)_162,_is_on_the_tarmac_at_Naval_Station_Guantanamo_Bay.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:VMM-162_Osprey_on_the_tarmac_in_Iraq_on_April_1-2008.JPG) |
| `hmx-1-green` | HMX-1 Nighthawks, green | [Photo](https://commons.wikimedia.org/wiki/File:Bell-Boeing_MV-22B_168339_HMX-1_FDK_MD4.jpg) |
| `usaf-cv-22b-7-sos` | USAF CV-22B 11-0058, 352nd SOW | [Photo 1](https://commons.wikimedia.org/wiki/File:USAF_CV-22B_Osprey_11-0058_RIAT_2023_04.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:USAF_CV-22B_10-0050_ILA-2018.jpg) |
| `jgsdf-v-22-91716` | JGSDF V-22 91716 | [Photo](https://commons.wikimedia.org/wiki/File:Japanese_V-22_Ospreys_arrive_at_MCAS_Futenma_for_Resolute_Dragon_26_(9785388).jpg) |

**VMM-162 Golden Eagles YS-02.** Marine Medium Tiltrotor Squadron 162 MV-22B from the referenced photographs: light gray overall with low-visibility markings, the squadron eagle (original drawing), BuNo 6688, the staggered YS tail code and modex 02 on the outer fin faces, 02 on the fuselage, MARINES and VMM-162 on the tail boom, low-visibility national insignia. Approximate colors.

**HMX-1 Nighthawks, green.** Marine Helicopter Squadron One MV-22B 168339 from the referenced photograph: gloss dark green overall with the white double pinstripe along the fuselage, UNITED STATES MARINE CORPS on the aft fuselage (set in a sans face; the original is a serif) and the US flag on the fins. Approximate colors.

**USAF CV-22B 11-0058, 352nd SOW.** Air Force Special Operations Command CV-22B 11-0058 (352nd Special Operations Wing, Mildenhall) from the referenced photographs, on the MV-22B airframe: FS 36118 gunship gray, USAF and 0058 on the outer fin faces and low-visibility national insignia in light gray, red bands at the top of the nacelles. The CV-22 nose radome and refuelling probe are not modelled; unit emblems are omitted. Approximate colors.

**JGSDF V-22 91716.** Japan Ground Self-Defense Force V-22 91716 from the referenced photograph: light gray, hinomaru with its white border on the aft fuselage, 91716 on the forward fuselage and the fins. The 陸上自衛隊 title is omitted (no Japanese lettering face). Approximate colors.

### Bell UH-1H Huey

Type: `molen.entities.aircraft.uh_1h`.

[![Bell UH-1H Huey livery comparison: US Army, Vietnam era, US Army Dustoff medevac, Vietnam era, RAAF No. 9 Squadron, 1971, JGSDF three-tone camouflage, Fire service Super Huey (CAL FIRE colors)](https://molen.dev/guide-media/liveries/uh_1h.png)](https://molen.dev/guide-media/liveries/uh_1h.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `us-army-vietnam` | US Army, Vietnam era | [Photo 1](https://commons.wikimedia.org/wiki/File:Bell_UH-1H_Huey_6343_(64-13643)_(9988333016).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:U.S._Army_UH-1H_Hueys_insert_ARVN_troops_at_Kh%C3%A2m_%C4%90%E1%BB%A9c%2C_Vietnam%2C_12_July_1970_(79431435).jpg) |
| `us-army-dustoff` | US Army Dustoff medevac, Vietnam era | [Photo 1](https://commons.wikimedia.org/wiki/File:Bell_UH-1_Iroquois_%22Huey%22_Medevac_(medical_evacuation).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:7RAR_soldier_stands_guard_for_a_U.S._dustoff_UH-1.jpg) |
| `raaf-9-squadron` | RAAF No. 9 Squadron, 1971 | [Photo 1](https://commons.wikimedia.org/wiki/File:Bell_UH-1H_A2-484_RAAF_LAV_18.04.71_edited-2.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:No._9_Squadron_RAAF_crewmen_prepare_to_board_their_UH-1_at_Vung_Tau_Air_Base.jpg) |
| `jgsdf-camouflage` | JGSDF three-tone camouflage | [Photo 1](https://commons.wikimedia.org/wiki/File:JGSDF_UH-1H(41659)_right_side_view_at_Camp_Uji_November_23%2C_2018.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:JGSDF_UH-1H(41659)_left_rear_view_at_Camp_Uji_November_23%2C_2018.jpg) |
| `cal-fire-super-huey` | Fire service Super Huey (CAL FIRE colors) | [Photo](https://commons.wikimedia.org/wiki/File:CAL_FIRE_Super_Huey-N488DF.jpg) |

**US Army, Vietnam era.** Vietnam-era US Army UH-1H after the 64-13643 restoration: FS 34087 olive drab overall, black UNITED STATES ARMY on the boom, the last five digits of the serial on the fin and the company triangle (yellow edged white) ahead of the elevator, redrawn as vector art. The restoration’s unit nose badge and black nose are omitted. Approximate colors and letter sizes.

**US Army Dustoff medevac, Vietnam era.** Vietnam-era US Army air ambulance (Dustoff): olive drab with red crosses on white squares on the nose, both aft cabin flanks and the belly, black UNITED STATES ARMY on the boom and a fin serial (15209, illustrative). Approximate colors and cross sizes.

**RAAF No. 9 Squadron, 1971.** RAAF UH-1H A2-484 as photographed at Laverton in 1971: olive drab, the RAAF roundel (blue ring, white disc, red kangaroo) and white RAAF title on the boom, white 484 on the aft cabin and 84 on the nose, and a red-white-blue fin flash. Roundel, kangaroo and lettering redrawn; sizes and the fin flash position are approximations.

**JGSDF three-tone camouflage.** Japan Ground Self-Defense Force UH-1H 41659 (Camp Uji): tan, olive green and dark green camouflage (a generated pattern in those colors, not the exact pattern), hinomaru on the boom, 41659 on the crew door and JG-1659 on the fin. The kanji unit title is omitted. Approximate colors.

**Fire service Super Huey (CAL FIRE colors).** CAL FIRE UH-1H Super Huey colors and layout from the referenced photograph: white overall, red nose cap, three black-edged red bands rising aft across the cabin and cowling, a black boom spine over a red pinstripe and a red band and star on the fin. The agency name, seals and lettering are omitted; the fleet number 309 and registration N4093F are fictional.

### Bendy Small Airliner

Type: `molen.entities.aircraft.airliner`.

[![Bendy Small Airliner livery comparison: Bendy house colours, Polished metal, blue hockey-stick stripe, All-over orange, 1965, White with blue and red tail stripes](https://molen.dev/guide-media/liveries/airliner.png)](https://molen.dev/guide-media/liveries/airliner.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `bendy-house` | Bendy house colours | [Photo](https://commons.wikimedia.org/wiki/File:Boeing_727-235%2C_Pan_Am_JP6008059.jpg) |
| `metal-blue-hockey-stick` | Polished metal, blue hockey-stick stripe | [Photo](https://commons.wikimedia.org/wiki/File:McDonnell_Douglas_DC-9-31%2C_Eastern_Air_Lines_JP5952972.jpg) |
| `all-over-orange-1965` | All-over orange, 1965 | [Photo](https://commons.wikimedia.org/wiki/File:Braniff_International_Airways_BAC_111-203AE_One-Eleven_N1552.jpg) |
| `white-blue-red-tail-stripes` | White with blue and red tail stripes | [Photo](https://commons.wikimedia.org/wiki/File:F-GFKM_Air_France_(4236790891).jpg) |

**Bendy house colours.** Bendy's own house scheme for its invented airliner (not an operator's), in a classic white-and-blue cheatline style: white, the blue cheatline sweeping down round the nose, blue fin, grey belly and the BENDY title on the forward fuselage (moved from the model's geometry into the livery so other schemes carry no title). The referenced photograph shows the white-and-blue cheatline style it follows; nothing of that operator's markings is used. The registration is fictional.

**Polished metal, blue hockey-stick stripe.** Eastern Air Lines "hockey stick" scheme (1970s) from the referenced photograph: polished-metal fuselage, light blue window band over a navy band, navy nose cap with the fleet number, the two bands turning up the fin's leading edge, US flag above the forward windows. The bands' bend over the tail cone is simplified; the falcon emblem and titles are omitted. Adapted to this invented twinjet. No operator titles, logos or emblems; the registration is fictional, in the national format.

**All-over orange, 1965.** Braniff International "Flying Colors" scheme (1965, Alexander Girard) from the referenced photograph: the fuselage in one bold solid colour (orange), white fin, tailplanes and engines, US flag high on the fin. The BI emblem and titles are omitted. Adapted to this invented twinjet. No operator titles, logos or emblems; the registration is fictional, in the national format.

**White with blue and red tail stripes.** Air France scheme (2009) from the referenced photograph: white fuselage over a light grey belly, white engines, the fin's navy, navy and red stripes across its aft part. Titles and the logo dash are omitted. Adapted to this invented twinjet. No operator titles, logos or emblems; the registration is fictional, in the national format.

### Boeing 737-800

Type: `molen.entities.aircraft.boeing_737_800`.

[![Boeing 737-800 livery comparison: Bold blue with red and yellow tail sweep, White over navy belly, gold cheatline, Sky blue upper body, white fin, Silver with flag-stripe tail, White over navy belly, navy tail, US Navy P-8A Poseidon grey](https://molen.dev/guide-media/liveries/boeing_737_800.png)](https://molen.dev/guide-media/liveries/boeing_737_800.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `bold-blue-heart-sweep` | Bold blue with red and yellow tail sweep | [Photo](https://commons.wikimedia.org/wiki/File:Southwest_Boeing_737-800_N8523W_BWI_MD1.jpg) |
| `white-navy-belly-gold-line` | White over navy belly, gold cheatline | [Photo](https://commons.wikimedia.org/wiki/File:Ryanair_-_Boeing_737-800_-_EI-EKV_-_Orio_al_Serio_International_Airport-7872.jpg) |
| `sky-blue-upper-white-fin` | Sky blue upper body, white fin | [Photo](https://commons.wikimedia.org/wiki/File:KLM_Boeing_737-800_PH-BXI_at_Schiphol_03-03-2022.jpg) |
| `silver-flag-stripe-tail` | Silver with flag-stripe tail | [Photo](https://commons.wikimedia.org/wiki/File:American_Boeing_737-800_N923NN_DCA_VA1.jpg) |
| `white-navy-belly-navy-tail` | White over navy belly, navy tail | [Photo](https://commons.wikimedia.org/wiki/File:Delta_Air_Lines_Boeing_737-800_N377DA_departing_Boston_June_2025.jpg) |
| `us-navy-p8a` | US Navy P-8A Poseidon grey | [Photo](https://commons.wikimedia.org/wiki/File:P-8A_Poseidon_VX-20_Squadron.jpg) |

**Bold blue with red and yellow tail sweep.** Southwest Airlines "Heart" scheme (2014) from the referenced photograph: Bold Blue fuselage, engines and pylons; the sunrise-yellow and warm-red sweep over the rear fuselage and up the fin with fine white lines between the colours and a blue tail cone; blue, red and yellow winglets; US flag and registration on the yellow. The belly heart and titles are omitted. No operator titles, logos or emblems; the registration is fictional, in the national format.

**White over navy belly, gold cheatline.** Ryanair scheme from the referenced photograph: white over the dark blue belly behind a gold cheatline that runs from the radome to the tail cone and carries round the engine cowls; dark blue fin and winglets; Irish flag and registration above the aft windows. The harp emblem, titles and winglet lettering are omitted. No operator titles, logos or emblems; the registration is fictional, in the national format.

**Sky blue upper body, white fin.** KLM scheme from the referenced photograph: KLM blue over the top of the fuselage and nose, the fine dark blue line sweeping down to the radome, light grey belly, white fin, grey engines, blue winglets; EU and Dutch flags with a white registration above the aft windows. The crown logo, titles and the bird name are omitted. No operator titles, logos or emblems; the registration is fictional, in the national format.

**Silver with flag-stripe tail.** American Airlines 2013 scheme from the referenced photograph: silver mica fuselage, engines and winglets; the stylised flag on the fin, blue and white stripes forward and red and white aft over a red root band, with a red band over the tail cone; registration, fleet number and US flag below the aft windows. The Flight Symbol and titles are omitted; the stripes' metallic shading is flat. No operator titles, logos or emblems; the registration is fictional, in the national format.

**White over navy belly, navy tail.** Delta Air Lines 2007 scheme from the referenced photograph: white over the navy belly from the radome to the rear door, navy fin carried forward over the tail cone, navy engines and winglets; US flag and registration above the aft windows, ship number on the fin tip. The red tail widget is Delta's logo and is omitted, leaving the fin navy; titles are omitted. No operator titles, logos or emblems; the registration is fictional, in the national format.

**US Navy P-8A Poseidon grey.** US Navy P-8A Poseidon (a 737-800 derivative) from the referenced US Navy photograph of VX-20's aircraft 951: light grey overall with most cabin windows faired over, NAVY title and full-colour national insignia aft of the wing, modex 951 on the fin and nose. Applied to the airliner model: the P-8A's raked wingtips, sensor fairings and antennas are not modelled, and the grey is an approximation.

### Boeing C-17A Globemaster III

Type: `molen.entities.aircraft.c_17a`.

[![Boeing C-17A Globemaster III livery comparison: USAF 62nd AW McChord, 03-3291, RAF 99 Squadron ZZ175, RAAF 36 Squadron A41-206, RCAF 429 Squadron CC-177 177703](https://molen.dev/guide-media/liveries/c_17a.png)](https://molen.dev/guide-media/liveries/c_17a.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `mcchord-62-aw` | USAF 62nd AW McChord, 03-3291 | [Photo](https://commons.wikimedia.org/wiki/File:C-17_Mt_Rainier.jpg) |
| `raf-99-sqn-zz175` | RAF 99 Squadron ZZ175 | [Photo](https://commons.wikimedia.org/wiki/File:Royal_Air_Force_C-17_Globemaster_III,_ZZ175_(16709935995).jpg) |
| `raaf-36-sqn-a41-206` | RAAF 36 Squadron A41-206 | [Photo](https://commons.wikimedia.org/wiki/File:A41-206_Boeing_C-17A_Globemaster_III_RAAF_(9637304265).jpg) |
| `rcaf-429-sqn-177703` | RCAF 429 Squadron CC-177 177703 | [Photo](https://commons.wikimedia.org/wiki/File:Royal_Canadian_Air_Force,_177703,_Boeing_CC-177_Globemaster_III_(52958690048).jpg) |

**USAF 62nd AW McChord, 03-3291.** US Air Force C-17A 03-3291 of the 62nd Airlift Wing and the associate 446th (McChord) from the referenced photograph: FS 36173 gray, U.S. AIR FORCE title, 3291 with both wing designations on the nose, US flag, AMC, the green McCHORD tail band with Mount Rainier's silhouette rising from it, tail number 33291 and full-color national insignia aft. Approximate colors; the wing's small unit emblems by the nose are omitted.

**RAF 99 Squadron ZZ175.** Royal Air Force C-17A ZZ175 of No. 99 Squadron (Brize Norton) from the referenced photograph: gray, ROYAL AIR FORCE title, the Union flag on the nose, red and blue roundel and ZZ175 aft, red and blue fin flash. Union flag simplified (centred red saltire); roundel and flash placement approximate.

**RAAF 36 Squadron A41-206.** Royal Australian Air Force C-17A A41-206 of No. 36 Squadron (Amberley) from the referenced photograph: gray, full-color kangaroo roundel on the rear fuselage behind the paratroop door, ROYAL AUSTRALIAN AIR FORCE title, A41-206 on the fin with a fin roundel. Fin layout follows RAAF transport practice; approximate.

**RCAF 429 Squadron CC-177 177703.** Royal Canadian Air Force CC-177 177703 of 429 Transport Squadron (Trenton) from the referenced photograph: gray, the Canada wordmark with its small flag, Canadian flag, the squadron bison and 177703 on the fin, RCAF roundel ARC on the rear fuselage. The wordmark is set in a sans face; the bison is an original silhouette. Approximate.

### Boeing CH-47F Chinook

Type: `molen.entities.aircraft.ch_47f`.

[![Boeing CH-47F Chinook livery comparison: US Army, RAF Chinook HC6, Australian Army, 5th Aviation Regiment, Royal Netherlands Air Force, 298 Squadron, RCAF CH-147F, 450 Squadron, JGSDF CH-47JA, 1st Helicopter Brigade](https://molen.dev/guide-media/liveries/ch_47f.png)](https://molen.dev/guide-media/liveries/ch_47f.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `us-army` | US Army | [Photo](https://commons.wikimedia.org/wiki/File:Boeing-Vertol_CH-47F_Chinook_'06-08021'_(13201175683).jpg) |
| `raf-hc6` | RAF Chinook HC6 | [Photo 1](https://commons.wikimedia.org/wiki/File:ZK558_Boeing_Chinook_HC.6_RAF_Corris_Corner_2018_01.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:RAF_Chinook_Helicopters_MOD_45157572.jpg) |
| `australian-army` | Australian Army, 5th Aviation Regiment | [Photo 1](https://commons.wikimedia.org/wiki/File:A15-302_during_Talisman_Sabre_2021.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:Australian_Army_CH-47F_Chinook_being_loaded_on_a_USAF_C-5_Galaxy_at_Dover_Air_Force_Base.jpg) |
| `rnlaf-298-squadron` | Royal Netherlands Air Force, 298 Squadron | [Photo](https://commons.wikimedia.org/wiki/File:Boeing-Vertol_CH-47F_Chinook_%E2%80%98D-890%E2%80%99_(35756133671).jpg) |
| `rcaf-ch147f` | RCAF CH-147F, 450 Squadron | [Photo](https://commons.wikimedia.org/wiki/File:2017%2C_147304%2C_Canada%2C_CH-147F_Chinook%2C_Fairford_-_4210_(53949049947).jpg) |
| `jgsdf-ch47ja` | JGSDF CH-47JA, 1st Helicopter Brigade | [Photo 1](https://commons.wikimedia.org/wiki/File:JGSDF_CH-47JA_20120108-02.JPG) · [Photo 2](https://commons.wikimedia.org/wiki/File:CH-47JA_20090822_Yokota_AFB-01.JPG) |

**US Army.** US Army CH-47F 06-08021: FS 34031 aircraft green overall, black UNITED STATES ARMY on both sponsons and the serial on the aft pylon, as photographed; no national insignia, per current Army practice. Approximate colors and letter sizes.

**RAF Chinook HC6.** RAF Chinook HC6 ZK558 (2018): dark green-grey overall, low-visibility pale blue and pink roundels on the forward cabin, the matching fin flash on the aft pylon and the serial ZK558, redrawn. The HC6 is the RAF CH-47F; approximate colors and marking sizes.

**Australian Army, 5th Aviation Regiment.** Australian Army CH-47F A15-302 (Talisman Sabre 2021): aircraft green, black ARMY on the sponsons, A15-302 and the white squadron letter V on the aft pylon and the low-visibility kangaroo roundel on the aft cabin, all redrawn. Approximate colors and sizes.

**Royal Netherlands Air Force, 298 Squadron.** RNLAF CH-47F D-890 of 298 Squadron (RIAT 2016): medium grey overall, low-visibility grey roundels on the sponsons and the serial on the aft pylon. The squadron badge is omitted. Approximate colors.

**RCAF CH-147F, 450 Squadron.** RCAF CH-147F 147304 (Fairford 2017): three-tone CF green camouflage (a generated pattern in those colors, not the exact pattern), the Canadian flag and serial on the aft pylon, low-visibility roundels on the sponsons and 304 on the nose. The Government of Canada wordmark is omitted. Approximate colors.

**JGSDF CH-47JA, 1st Helicopter Brigade.** JGSDF CH-47JA (Narashino 2012): brown, green and dark green camouflage (a generated pattern in those colors, not the exact pattern), large hinomaru on the sponsons, 52950 on the nose and the HGP III unit code beside the cockpit, redrawn. The kanji service title is omitted; the CH-47F model stands in for the CH-47JA. Approximate colors.

### Cessna 172S Skyhawk

Type: `molen.entities.aircraft.cessna_172s`.

[![Cessna 172S Skyhawk livery comparison: Skyhawk SP factory scheme, 1998, Flight school white and navy, 2020s, USAF Academy T-41D Mescalero, 2000s, Republic of Korea Air Force T-41B, 1970s, Iraqi Air Force 172S, 2000s](https://molen.dev/guide-media/liveries/cessna_172s.png)](https://molen.dev/guide-media/liveries/cessna_172s.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `skyhawk-sp-1998` | Skyhawk SP factory scheme, 1998 | [Photo](https://commons.wikimedia.org/wiki/File:Cessna_172S_Skyhawk_SP_(N745SP,_cn_172S8677)_(4-13-2024).jpg) |
| `flight-school-2020` | Flight school white and navy, 2020s | [Photo](https://commons.wikimedia.org/wiki/File:Cessna_172S_Skyhawk_SP_(N24221,_cn_172S13131)_(4-9-2024).jpg) |
| `usaf-academy-t-41d` | USAF Academy T-41D Mescalero, 2000s | [Photo 1](https://commons.wikimedia.org/wiki/File:USAFA_Flying_Team_T-41D.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:Cessna_T-41_Mescalero.jpg) |
| `rokaf-t-41b` | Republic of Korea Air Force T-41B, 1970s | [Photo](https://commons.wikimedia.org/wiki/File:15054-T-054_Cessna_T-41B_Mescalero_(7597148054).jpg) |
| `iraqi-air-force` | Iraqi Air Force 172S, 2000s | [Photo](https://commons.wikimedia.org/wiki/File:Cessna_172S_Skyhawk_of_the_Iraqi_Air_Force.jpg) |

**Skyhawk SP factory scheme, 1998.** Cessna’s late-1990s Skyhawk SP paint from the referenced photograph: white overall with a navy and royal blue double swoosh breaking over the forward fuselage, the royal stripe and a gold stripe running aft to the registration, and a royal and gold swoosh across the fin. The Skyhawk SP fin logo and wheel-fairing swooshes are omitted; registration N417SP is fictional. Swoosh curves and colors are approximations.

**Flight school white and navy, 2020s.** A 2020s flight-academy scheme after the referenced photograph: white with a navy fin that wraps down into the lower tail cone, red and navy blades crossing along the forward fuselage, a red and white striped band across the fin and a large navy registration. The school’s name and logo are omitted; registration N2172A is fictional. Blade shapes are approximations.

**USAF Academy T-41D Mescalero, 2000s.** US Air Force Academy T-41D scheme from the referenced USAF photographs, applied to the 172S model: academy blue lower fuselage, fin and wing upper surfaces over white, red pinstripes along the split and the fin root, the white slab-serif AF and a row of checks on the fin, the national insignia on the rear fuselage and U.S.A.F. ACADEMY on the cowling (all original vector art). The door crest and small serial are omitted; colors and sizes are approximations.

**Republic of Korea Air Force T-41B, 1970s.** ROKAF T-41B 15054 from the referenced museum photograph, applied to the 172S model: natural metal overall with red fin, wing and stabilizer tips, a black anti-glare panel, the taegeuk national insignia with its side bars, T-054 on the forward fuselage and 15054 on the fin (original vector art). The Hangul air force title is omitted; colors are approximations.

**Iraqi Air Force 172S, 2000s.** Iraqi Air Force Cessna 172S trainer from the referenced USAF photograph: light gray overall, IRAQI AIR FORCE on the rear fuselage, serial YI-137 ahead of the fin and the national flag at the top of the fin (original vector art; the flag’s green takbir is drawn as simplified strokes). Colors and sizes are approximations.

### Cessna 182T Skylane

Type: `molen.entities.aircraft.cessna_182t`.

[![Cessna 182T Skylane livery comparison: Skylane factory black and orange, 2009, Skylane factory black and olive, Slovakia, Civil Air Patrol, 2010s, Skylane factory navy, Australia 2013](https://molen.dev/guide-media/liveries/cessna_182t.png)](https://molen.dev/guide-media/liveries/cessna_182t.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `skylane-2009-black-orange` | Skylane factory black and orange, 2009 | [Photo](https://commons.wikimedia.org/wiki/File:Cessna_182T_Skylane_(N2152K,_cn_18281908)_(4-13-2024).jpg) |
| `skylane-2009-black-olive` | Skylane factory black and olive, Slovakia | [Photo](https://commons.wikimedia.org/wiki/File:Cessna_182T_Skylane_OM-AKC_(9818038013).jpg) |
| `civil-air-patrol` | Civil Air Patrol, 2010s | [Photo 1](https://commons.wikimedia.org/wiki/File:Civil_Air_Patrol_Cessna_182T_at_DuPage_Airport_01.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:Cessna_182T_Skylane_(N956CP,_cn_18282409)_(8-23-2024).jpg) |
| `skylane-2013-navy` | Skylane factory navy, Australia 2013 | [Photo](https://commons.wikimedia.org/wiki/File:VH-ULW_Cessna_182T_Skylane_(11357623763).jpg) |

**Skylane factory black and orange, 2009.** Cessna’s late-2000s 182T factory paint from the referenced photograph: white with a black upper cowling and windshield blade, a long orange stripe and black blades sweeping down across the cabin, a black and orange swoosh on the fin and black wingtips. The Skylane fin logo is omitted; registration N1823S is fictional. Blade shapes are approximations.

**Skylane factory black and olive, Slovakia.** The same late-2000s factory layout in its black and olive color option, after the referenced Slovak-registered aircraft, with the registration on the rear fuselage and in large letters under the left wing (European practice). The registration OM-BKL is fictional; the camera turret and operator badge are omitted. Approximate colors.

**Civil Air Patrol, 2010s.** Civil Air Patrol corporate scheme from the referenced photographs: navy lower fuselage below a white and red pinstripe, navy climbing to the fin root, a red fin and rudder over a white pinstripe and a large white registration on the navy. Under the civil-operator rule the CIVIL AIR PATROL fin titles and the emblem are omitted; registration N488CP is fictional. Approximate colors.

**Skylane factory navy, Australia 2013.** Cessna’s 2013 182T factory scheme from the referenced Avalon photograph: white over a navy lower fuselage that tapers to a point aft, a white spear and a long graphite blade above it, navy and graphite stripes at the fin root and navy wingtips, with an Australian registration (VH-SKQ, fictional). The Skylane fin logo is omitted; shapes and colors are approximations.

### Cessna 208B Grand Caravan EX

Type: `molen.entities.aircraft.cessna_208b`.

[![Cessna 208B Grand Caravan EX livery comparison: Grand Caravan EX factory scheme, 2023, Iraqi Air Force C-208B, 2009, Iraqi Air Force AC-208 Combat Caravan, Honduran Air Force Grand Caravan EX](https://molen.dev/guide-media/liveries/cessna_208b.png)](https://molen.dev/guide-media/liveries/cessna_208b.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `textron-ex-2023` | Grand Caravan EX factory scheme, 2023 | [Photo](https://commons.wikimedia.org/wiki/File:Cessna_208B_Grand_Caravan_EX_(N727EX,_cn_208B5727)_(7-29-2023).jpg) |
| `iraqi-air-force-c-208b` | Iraqi Air Force C-208B, 2009 | [Photo](https://commons.wikimedia.org/wiki/File:Iraqi_Air_Force_C-208.jpg) |
| `iraqi-ac-208` | Iraqi Air Force AC-208 Combat Caravan | [Photo](https://commons.wikimedia.org/wiki/File:Iraqi_Cessna_AC-208.jpg) |
| `honduran-air-force` | Honduran Air Force Grand Caravan EX | [Photo](https://commons.wikimedia.org/wiki/File:Honduras_Air_Force_(FAH-021)_Cessna_208B_Grand_Caravan_EX_at_Toncont%C3%ADn_International_Airport.jpg) |

**Grand Caravan EX factory scheme, 2023.** Textron Aviation’s Grand Caravan EX demonstrator scheme from the referenced photograph: white over a near-black brown lower fuselage and cargo pod, fine brown and silver pinstripes along the split, a black fin and rudder with white pinstripes at the root and a large black registration. The Grand Caravan EX fin logo is omitted; registration N563EX is fictional. Approximate colors.

**Iraqi Air Force C-208B, 2009.** Iraqi Air Force C-208B trainer from the referenced USAF photograph: light blue-gray overall with black de-ice boots on the wing, stabilizer and fin leading edges, IRAQI AIR FORCE on the rear cabin, serial YI-116 ahead of the fin and the national flag near the fin tip (original vector art; the flag’s green takbir is simplified). Approximate colors and sizes.

**Iraqi Air Force AC-208 Combat Caravan.** Iraqi Air Force AC-208 from the referenced USAF photograph: dark gunship gray overall with black de-ice boots, a low-contrast IRAQI AIR FORCE title under the cabin windows, serial YI-112 in light gray on the fin and the national flag near the fin tip (original vector art; the flag’s takbir is simplified). The sensor turret and weapon rails are not modeled. Approximate colors.

**Honduran Air Force Grand Caravan EX.** Fuerza Aérea Hondureña Grand Caravan EX FAH 021 from the referenced photograph: medium gray overall with FUERZA AEREA HONDUREÑA along the cabin, the blue and white roundel with its star on the rear fuselage, the national flag and FAH 021 on the fin (original vector art). Approximate colors and sizes.

### Cessna Citation CJ4

Type: `molen.entities.aircraft.citation_cj4`.

[![Cessna Citation CJ4 livery comparison: White, champagne and black, White with red and navy pinstripes, Factory swooshes, red and black, Factory swooshes, green](https://molen.dev/guide-media/liveries/citation_cj4.png)](https://molen.dev/guide-media/liveries/citation_cj4.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `champagne-black-tail` | White, champagne and black | [Photo](https://commons.wikimedia.org/wiki/File:N812NE_Citation_CJ4,_Scottsdale_05-05-26_(55252338595).jpg) |
| `red-navy-pinstripes` | White with red and navy pinstripes | [Photo](https://commons.wikimedia.org/wiki/File:Cessna_Citation_CJ4_525C_N194ME_FDK_MD1.jpg) |
| `factory-red-black` | Factory swooshes, red and black | [Photo](https://commons.wikimedia.org/wiki/File:N22UB_Cessna_Citation_CJ4_(24468199463).jpg) |
| `factory-green` | Factory swooshes, green | [Photo](https://commons.wikimedia.org/wiki/File:M-FLYI_Cessna_Citation_CJ4_(23595286172).jpg) |

**White, champagne and black.** Factory scheme as photographed on N812NE: white upper body over a metallic champagne lower body behind a black pinline; the rear body, fin, tip fairing and tailplane gloss black, with the registration in white on the fin. The manufacturer's titles on the engines are left off; registration N418TX is fictional. Line positions and colours are approximate.

**White with red and navy pinstripes.** Private scheme as photographed on N194ME: white overall with a red and a navy pinstripe from the nose to the tail cone, the red climbing the rudder root; a red band under a navy cap and navy tip fairing on the fin; navy registration on the fin. Registration N412MK is fictional. Stripe heights are approximate.

**Factory swooshes, red and black.** Factory swoosh scheme as photographed on N22UB: white with a long red line from under the cockpit to the engine, tapered black spears under the cockpit and the cabin, a grey line above, black lines up the fin root and a red wedge over the rudder root; registration on the engine nacelles. Registration N27QW is fictional. Line shapes are redrawn and approximate.

**Factory swooshes, green.** The same factory swoosh design in greens, as photographed on Isle of Man registered M-FLYI: white with green and dark green lines along the body and up the fin root, registration on the engine nacelles. The operator's tail logo and titles are left off; registration M-ARQZ is fictional. Line shapes are approximate.

### Cirrus SR22T G6

Type: `molen.entities.aircraft.cirrus_sr22t`.

[![Cirrus SR22T G6 livery comparison: Private owner, crimson over silver, Private owner, G7 blue and white, Carbon edition, gunmetal, US Air Force Academy T-53A Kadet II, Spanish owner, orange and silver](https://molen.dev/guide-media/liveries/cirrus_sr22t.png)](https://molen.dev/guide-media/liveries/cirrus_sr22t.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `factory-crimson-silver` | Private owner, crimson over silver | [Photo](https://commons.wikimedia.org/wiki/File:Cirrus_SR22T_N671MV_FDK_MD1.jpg) |
| `factory-g7-blue-white` | Private owner, G7 blue and white | [Photo](https://commons.wikimedia.org/wiki/File:Cirrus_SR22T_G7_GTS_(N410AS,_cn_9822)_(4-9-2024).jpg) |
| `carbon-edition` | Carbon edition, gunmetal | [Photo](https://commons.wikimedia.org/wiki/File:Cirrus_SR22T_G6_GTS_Carbon_(N993MS,_cn_9207)_(4-13-2024).jpg) |
| `usaf-academy-t53a` | US Air Force Academy T-53A Kadet II | [Photo](https://commons.wikimedia.org/wiki/File:Cirrus_T-53A_Kadet_ll_10-0101_AF_306th_Flying_Training_Group_(52489922079).jpg) |
| `spain-orange-silver` | Spanish owner, orange and silver | [Photo](https://commons.wikimedia.org/wiki/File:EC-ONS_Cirrus_SR22T_SCQ_01.jpg) |

**Private owner, crimson over silver.** Cirrus G6 factory layout in crimson from the referenced photograph of N671MV: crimson over the nose, cabin top, dorsal and the whole fin and rudder, silver lower fuselage and wings, a black pinstripe on the paint line, crimson wheel fairings and a large black registration on the aft fuselage. The registration N728CR is fictional; the owner's fin emblem and the manufacturer titles are omitted. The paint line is straight segments.

**Private owner, G7 blue and white.** Cirrus G7 factory layout in blue from the referenced photograph of N410AS: blue over the nose, cabin top and dorsal down to the belt, white lower fuselage, wings and fin, a black swoosh from the spinner into the paint line and a black-edged blue arrow on the lower rear fuselage, blue wheel fairings and a navy registration. The registration N4417G is fictional; the fin's dark stripes are simplified and the swoosh curves are redrawn freehand from the photograph.

**Carbon edition, gunmetal.** Cirrus G6 Carbon edition from the referenced photograph of N993MS: gunmetal metallic overall with charcoal swooshes from the cowl along the fuselage side and a black registration on the rear fuselage. The registration N93KC is fictional; the edition title on the fin and the carbon-weave texture are omitted.

**US Air Force Academy T-53A Kadet II.** T-53A Kadet II 10-0101 of the 306th Flying Training Group (US Air Force Academy) from the referenced photograph, applied to the SR22T model (the T-53A is an SR20): white overall, a dark blue band along the fuselage with a red pinstripe above it and U.S. AIR FORCE in white on the band, the national insignia on the rear fuselage, AF, 306 FTG and the tail number on the fin under a blue-checked fin cap, all redrawn as original vector art. The pilot names under the windows are omitted; sizes are estimates.

**Spanish owner, orange and silver.** Paint layout of the referenced photograph of EC-ONS: orange over the nose and cabin, running aft as a band along the lower rear fuselage under a silver upper rear fuselage and fin, black stripes on its edges, orange wheel fairings, the Spanish flag on the fin and a black registration on the orange band. The registration EC-MZR is fictional; curves are straight-line approximations.

### Dassault Rafale C

Type: `molen.entities.aircraft.rafale_c`.

[![Dassault Rafale C livery comparison: EC 2/30 Normandie-Niemen (30-GT), EC 1/7 Provence, Tiger Meet 2014 (113-GU), Rafale Solo Display, 2025, Qatar Emiri Air Force (QA219), Hellenic Air Force, 332 Mira (412)](https://molen.dev/guide-media/liveries/rafale_c.png)](https://molen.dev/guide-media/liveries/rafale_c.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `ec-2-30-normandie-niemen` | EC 2/30 Normandie-Niemen (30-GT) | [Photo](https://commons.wikimedia.org/wiki/File:Dassault_Rafale_C_%E2%80%98141_30-GT%E2%80%99_(49358510998).jpg) |
| `tiger-meet-2014-113-gu` | EC 1/7 Provence, Tiger Meet 2014 (113-GU) | [Photo](https://commons.wikimedia.org/wiki/File:Dassault_Rafale_C_%27142_-_113-GU%27_(14608203075).jpg) |
| `solo-display-2025` | Rafale Solo Display, 2025 | [Photo](https://commons.wikimedia.org/wiki/File:Rafale_Solo_Display_2025_Bricy_(Denoised).jpg) |
| `qatar-qa219` | Qatar Emiri Air Force (QA219) | [Photo](https://commons.wikimedia.org/wiki/File:QA219_Rafale_EQ_Qatar_Emiri_Air_Force_Andravida_17.4.24_(53696949762).jpg) |
| `hellenic-332-mira-412` | Hellenic Air Force, 332 Mira (412) | [Photo](https://commons.wikimedia.org/wiki/File:Dassault_Rafale_EG_%E2%80%98412%E2%80%99_(54017141290).jpg) |

**EC 2/30 Normandie-Niemen (30-GT).** Rafale C 141 of Escadron de Chasse 2/30 Normandie-Niemen from the referenced photograph: overall Rafale gray, French roundels on the fuselage shoulders and above and below both wings, 30-GT on the nose, the squadron badge on the fin (simplified two-leopard shield in low-visibility grays), ARMÉE DE L’AIR on the lower fin and 141 at the fin top. Stencils are omitted.

**EC 1/7 Provence, Tiger Meet 2014 (113-GU).** Rafale C 142 in the NATO Tiger Meet 2014 scheme from the referenced photograph: red fin with sweeping black tiger stripes and a white zigzag, black tiger stripes on the rear fuselage over an orange band, 113-GU in orange on the nose and French roundels. The photographic tiger face on the fin, the event titles and the painted drop tanks are not reproduced; stripes are original vector art.

**Rafale Solo Display, 2025.** The 2025 Rafale Solo Display scheme from the referenced photograph: white upper surfaces, a dark navy underside with a red band along the lower rear fuselage (slats and elevons stay white), and blue, white and red bands parallel to the fin leading edge with ARMÉE DE L’AIR & DE L’ESPACE in white. Band widths and the underside pattern are approximations.

**Qatar Emiri Air Force (QA219).** Rafale EQ QA219 from the referenced 2024 photograph: the QEAF two-gray camouflage (a blotch pattern, not the exact patch outlines), the Qatari roundel (maroon, gold and white) on the fuselage and wings, the flag of Qatar near the fin top (hoist forward on both sides), the black Al-Adiyat horse emblem on the fin (original simplified drawing) and QA219 on the nose.

**Hellenic Air Force, 332 Mira (412).** Rafale EG 412 of 332 Mira from the referenced photograph: overall gray, Greek roundels (blue, white, blue) on the fuselage and wings, the flag of Greece on the fin with the serial 412 beneath it.

### De Havilland Canada Dash 8-400

Type: `molen.entities.aircraft.dash_8_q400`.

[![De Havilland Canada Dash 8-400 livery comparison: Sécurité Civile Q400MR tanker, 2013, Purple with orange and red bands, White with teal and blue tail, White with navy tail](https://molen.dev/guide-media/liveries/dash_8_q400.png)](https://molen.dev/guide-media/liveries/dash_8_q400.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `securite-civile-2013` | Sécurité Civile Q400MR tanker, 2013 | [Photo](https://commons.wikimedia.org/wiki/File:F-ZBMD(74)_Dash_8Q-402MR_Securite_Civile_TLS_25SEP13_(9946654405).jpg) |
| `purple-orange-red-bands` | Purple with orange and red bands | [Photo](https://commons.wikimedia.org/wiki/File:G-JECM_-_Bombardier_Dash_8_Q400_-_Flybe_(28328880961).jpg) |
| `white-teal-blue-tail` | White with teal and blue tail | [Photo](https://commons.wikimedia.org/wiki/File:C-FWEP_Westjet_Encore_Dash_8-Q400.jpg) |
| `white-navy-tail` | White with navy tail | [Photo](https://commons.wikimedia.org/wiki/File:Porter_Airlines_Bombardier_Q400_C-GKQB_departing_Boston_June_2025.jpg) |

**Sécurité Civile Q400MR tanker, 2013.** French Sécurité Civile Q400MR water/retardant bomber as photographed in 2013: white overall with red, black and red cheatlines under the windows that open into a red chin and a red tail cone, red fin cap over a black stripe, tanker number on the fin, SECURITE CIVILE titles, the French roundel aft and the civil defence sign behind the flight deck (original vector drawings). Registration F-ZBQV and tanker number 79 are fictional; the belly tank, the FIREGUARD and danger stencils are omitted. Line heights and colours are approximate.

**Purple with orange and red bands.** Flybe's 2018 scheme as photographed on G-JECM: purple fuselage, wing root fairing and nacelles, an orange and a red band slanting back across the tail cone, white tail cone, fin and tailplane. The flybe wordmark and dots on the fin, the fuselage titles and the slogan are left off. Registration G-JEQZ is fictional. Band positions and colours are approximate.

**White with teal and blue tail.** WestJet Encore scheme as photographed on C-FWEP: white overall; the fin teal above a white band, below it a white diagonal dividing a blue forward panel from a teal aft panel, white fleet number near the tip. The fuselage and nacelle titles and the flag are left off; registration C-GWQZ and fleet number 447 are fictional. Fin proportions are approximate.

**White with navy tail.** Porter Airlines' current scheme as photographed on C-GKQB: white fuselage, nacelles and wing root, navy fin, rudder, fin tip and tailplane, navy registration and fleet number on the tail cone. The repeated wordmark pattern on the fin and the fuselage titles are left off; registration C-GKQZ and fleet number 829 are fictional.

### De Havilland Canada DHC-2 Beaver

Type: `molen.entities.aircraft.dhc_2`.

[![De Havilland Canada DHC-2 Beaver livery comparison: Seattle floatplane operator, white and gold, US Army L-20A, 1950s, Army Air Corps Beaver AL.1 XP820, RNZAF Antarctic Flight NZ6001, 1957](https://molen.dev/guide-media/liveries/dhc_2.png)](https://molen.dev/guide-media/liveries/dhc_2.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `seattle-floatplane-gold` | Seattle floatplane operator, white and gold | [Photo](https://commons.wikimedia.org/wiki/File:Kenmore_Air_DHC-2_Beaver_floatplane_N900KA_on_Lake_Union_-_03.jpg) |
| `us-army-l20a-1950s` | US Army L-20A, 1950s | [Photo 1](https://commons.wikimedia.org/wiki/File:DeHavillandCanada_L-20A_51-16856_(6791095726).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:DeHavilland_U-6A,_Beaver_in_US_Army_livery.jpg) |
| `army-air-corps-al1-xp820` | Army Air Corps Beaver AL.1 XP820 | [Photo](https://commons.wikimedia.org/wiki/File:De_Havilland_Canada_Beaver_AL.1_%E2%80%98XP820%E2%80%99_(G-CICP)_(51754015170).jpg) |
| `rnzaf-antarctic-nz6001` | RNZAF Antarctic Flight NZ6001, 1957 | [Photo](https://commons.wikimedia.org/wiki/File:RNZAFTransantarcticDHCBeaver.jpg) |

**Seattle floatplane operator, white and gold.** Colors and stripe layout of a Seattle floatplane operator's Beavers from the referenced photograph: white airframe, gold band under the windows with a black pinstripe, sweeping aft into a gold fin and rudder behind a black diagonal, gold cowl ring, navy registration on the aft fuselage. The operator's name and logo are omitted and the registration N417KB is fictional. Shown on the wheeled model; band edges are straight-line approximations of the painted curves.

**US Army L-20A, 1950s.** US Army L-20A 51-16856 from the referenced photograph: olive drab overall (FS 34087), U.S. ARMY over the serial 116856 across the fin and rudder, the national insignia on the aft fuselage and upper left / lower right wing, U.S. ARMY under the left wing, all redrawn as original vector art. The photograph is black and white: the light lettering is shown white and the olive drab follows the referenced U-6A museum aircraft; marking sizes are estimates.

**Army Air Corps Beaver AL.1 XP820.** British Army Air Corps Beaver AL.1 XP820 as flown by the Army Historic Aircraft Flight, from the referenced photograph: disruptive dark green and black camouflage laid out on the fuselage and fin after the photograph (dark cabin, a dark band across the rear fuselage and fin), with a generated pattern in the same colors on the wings and tail surfaces, black cowling and gear legs, the serial XP820, ARMY and the type D roundel on the aft fuselage, roundels above and below the wings, all redrawn as original vector art. Approximate colors and sizes.

**RNZAF Antarctic Flight NZ6001, 1957.** RNZAF Beaver NZ6001 of the Commonwealth Trans-Antarctic Expedition from the referenced museum photograph: high-visibility orange overall, black cowling and a black cheatline at the window sills, RNZAF type D roundels on the aft fuselage and wings and the serial NZ6001, redrawn as original vector art. The expedition title on the cowling and the small aircraft name are omitted; the cheatline's aft end and marking sizes are estimates.

### De Havilland Canada DHC-6 Twin Otter 400

Type: `molen.entities.aircraft.dhc_6`.

[![De Havilland Canada DHC-6 Twin Otter 400 livery comparison: USAF Academy UV-18B, 1980, Far East regional airline, navy and white (RA-67293), South Pacific red and white (A3-KLQ), RCAF CC-138 Twin Otter 13803, Arctic 2018](https://molen.dev/guide-media/liveries/dhc_6.png)](https://molen.dev/guide-media/liveries/dhc_6.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `usaf-academy-uv-18b` | USAF Academy UV-18B, 1980 | [Photo](https://commons.wikimedia.org/wiki/File:UV-18B_USAF_academy_parachute_training_1980.JPEG) |
| `navy-tail-arcs` | Far East regional airline, navy and white (RA-67293) | [Photo](https://commons.wikimedia.org/wiki/File:Viking_Air_DHC-6_Twin_Otter_Series_400_of_Avropa_(30127684035).jpg) |
| `pacific-red-and-white` | South Pacific red and white (A3-KLQ) | [Photo](https://commons.wikimedia.org/wiki/File:Lulutai_Airlines_(A3-KLT)_Viking_Air_DHC-6_Twin_Otter_Series_400,_ex_Reignwood_Air_(B-10GE),_taxiing_at_Wagga_Wagga_Airport.jpg) |
| `rcaf-cc-138-arctic` | RCAF CC-138 Twin Otter 13803, Arctic 2018 | [Photo](https://commons.wikimedia.org/wiki/File:Royal_Canadian_Air_Force_CC-138_Twin_Otter_in_the_arctic_on_5_March_2018_(180305-N-SV928-130).JPG) |

**USAF Academy UV-18B, 1980.** UV-18B 77-0465 of the US Air Force Academy parachute team, 1980: white upper fuselage, fin and wings over a pale blue lower fuselage split by a dark blue pinstripe, U.S. AIR FORCE in dark blue on the forward fuselage, national insignia on the rear fuselage, upper left and lower right wing, the serial and a small badge (redrawn as a plain shield) on the fin. Colors approximate.

**Far East regional airline, navy and white (RA-67293).** Series 400 in the colors of the referenced Aurora RA-67284: white with a navy lower fuselage, navy fin, nacelles and tail arcs sweeping up the rear fuselage and fin, orange fin cap, and the Russian flag on the fin. Fictional registration RA-67293; airline title and emblem omitted. Arc count and spacing approximate.

**South Pacific red and white (A3-KLQ).** Series 400 in the colors of the referenced Lulutai Airlines A3-KLT: white upper fuselage over a red belly with twin red pinstripes, a red fin and rudder, a tapa-cloth style band ahead of the fin (simplified original pattern) and the Tongan flag behind the cockpit. Fictional Tongan registration A3-KLQ; airline title and bird emblem omitted. Colors approximate.

**RCAF CC-138 Twin Otter 13803, Arctic 2018.** CC-138 13803 of 440 Transport Squadron, Royal Canadian Air Force, on Arctic sea ice in 2018: overall search-and-rescue yellow with a gray cheatline and red pinstripe along the windows, RCAF and ARC titles either side of the maple-leaf roundel on the rear fuselage, the red rear panel, the Canadian flag and serial on the fin, 803 on the nose and a black radome. Colors approximate; skis are not modelled.

### Diamond DA42-VI

Type: `molen.entities.aircraft.diamond_da42`.

[![Diamond DA42-VI livery comparison: Private owner, Diamond factory stripes (Sweden), Swiss Air Force R-711, Airline flight school, white and navy, University flight school, blue swooshes, MPP sensor demonstrator, white and red](https://molen.dev/guide-media/liveries/diamond_da42.png)](https://molen.dev/guide-media/liveries/diamond_da42.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `factory-stripes-sweden` | Private owner, Diamond factory stripes (Sweden) | [Photo](https://commons.wikimedia.org/wiki/File:SE-MLR_Diamond_DA42_VBY_01.jpg) |
| `swiss-air-force-r-711` | Swiss Air Force R-711 | [Photo](https://commons.wikimedia.org/wiki/File:R-711_Swiss_Air_Force.jpg) |
| `airline-school-navy` | Airline flight school, white and navy | [Photo](https://commons.wikimedia.org/wiki/File:Diamond_DA42_NG_(c-n_42N379,_D-GFRA)_2025-06-28_Andre_Gerwing_Collection_ID_024221.jpg) |
| `university-trainer-blue` | University flight school, blue swooshes | [Photo](https://commons.wikimedia.org/wiki/File:Diamond_DA42-VI_Twin_Star_(N309ER,_cn_42.N211)_(1-12-2023).jpg) |
| `mpp-sensor-demonstrator` | MPP sensor demonstrator, white and red | [Photo](https://commons.wikimedia.org/wiki/File:Diamond_DA42MPP-NG_Twin_Star%E2%80%98OE-FMV%E2%80%99_(16913916756).jpg) |

**Private owner, Diamond factory stripes (Sweden).** Diamond DA42-VI factory scheme from the referenced photograph of SE-MLR: white with navy, blue and teal stripes from the nose along the cabin and boom sweeping up the fin, the same three on the nacelles, the Swedish flag on the fin, the registration on the boom and large under the left wing (Swedish practice). The registration SE-MKV is fictional; type titles are omitted and the stripe curves are redrawn freehand.

**Swiss Air Force R-711.** Swiss Air Force DA42 R-711 from the referenced photograph: white with a red flame under the cockpit and red swooshes on the nacelles, red fin and rudder with the Swiss marking, red winglets carrying the Swiss marking, and the serial R-711 on the tail boom, redrawn as original vector art. The photograph is distant: the white swirl inside the red fin is simplified away, and the swoosh shapes and serial position are estimates.

**Airline flight school, white and navy.** Colors of an airline's flight school trainers from the referenced photograph of D-GFRA: white overall with a navy fin, rudder and tail cone behind a line from the boom to the fin tip, the German flag at the top of the fin and a grey registration on the boom. The airline's emblem and titles are omitted; the registration D-GLTQ is fictional.

**University flight school, blue swooshes.** Colors of a US university's DA42 trainers from the referenced photograph of N309ER: white with navy and light blue swooshes along the cabin and on the nacelles and a navy italic registration on the boom. The university's titles and the gold fin emblem are omitted; the registration N727DT is fictional and the swooshes are redrawn freehand.

**MPP sensor demonstrator, white and red.** Paint of the referenced photograph of the DA42 MPP demonstrator OE-FMV: white with raked red dashes along the nose and nacelles, a red chevron under the cabin, red and white rudder bars, red winglets and main gear doors and a red registration on the boom. The sensor company titles are omitted, the registration OE-FXK is fictional and the sensor turret is not modelled.

### Douglas DC-3

Type: `molen.entities.aircraft.dc_3`.

[![Douglas DC-3 livery comparison: USAAF C-47A 442nd TCG, D-Day 1944, RAF Dakota III, 233 Squadron, Normandy 1944, Scandinavian airline 1950s, natural metal (OY-DMZ), US local service airline 1950s (N58217)](https://molen.dev/guide-media/liveries/dc_3.png)](https://molen.dev/guide-media/liveries/dc_3.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `usaaf-c-47a-d-day` | USAAF C-47A 442nd TCG, D-Day 1944 | [Photo](https://commons.wikimedia.org/wiki/File:442d_Troop_Carrier_Group_Douglas_C-47A-15-DK_Skytrain_42-92879.jpg) |
| `raf-dakota-233-squadron` | RAF Dakota III, 233 Squadron, Normandy 1944 | [Photo](https://commons.wikimedia.org/wiki/File:Dakota_C.III_233_Sqn_RAF_returning_from_Normandy_1944.JPG) |
| `scandinavian-1950s` | Scandinavian airline 1950s, natural metal (OY-DMZ) | [Photo](https://commons.wikimedia.org/wiki/File:SAS_DC-3_Sven_Viking_OY-DDA,_on_the_ground,_at_the_airport.jpg) |
| `local-service-1950s` | US local service airline 1950s (N58217) | [Photo](https://commons.wikimedia.org/wiki/File:A_Piedmont_Airlines_plane_and_seen_at_an_airport,_1950s_PhC_180_19_001.jpg) |

**USAAF C-47A 442nd TCG, D-Day 1944.** C-47A 42-92879 of the 442nd Troop Carrier Group, June 1944: olive drab over neutral gray, five 24-inch invasion stripes round the rear fuselage and the outer wings, the 1943 star-and-bar on the stripes and on the upper left and lower right wing, the white call letter T behind the cockpit and on the fin, and the serial 292879 in yellow. The DC-3 model keeps its airliner door and windows; colors and stripe stations approximate.

**RAF Dakota III, 233 Squadron, Normandy 1944.** Dakota III of No. 233 Squadron RAF returning from Normandy in 1944: olive drab over neutral gray as delivered, invasion stripes round the rear fuselage and outer wings, the type C roundel over the fuselage stripes, type B roundels on the upper wings, the fin flash, and the UK code with the plain name KWICHERBICHEN behind the cockpit. Serial omitted (not legible in the photograph); colors approximate.

**Scandinavian airline 1950s, natural metal (OY-DMZ).** DC-3 in the 1950s colors of the referenced SAS OY-DDA: natural metal with a white cabin roof, a dark blue window cheatline from nose to tail, and a white fin with a slanted dark blue band. Fictional Danish registration OY-DMZ on the fin; airline titles, flags and emblem omitted. Colors approximate.

**US local service airline 1950s (N58217).** DC-3 in the 1950s colors of the referenced Piedmont Airlines aircraft: white cabin roof and fin, natural metal lower fuselage and wings, a dark blue window cheatline with a thin pinstripe below it, and two dark blue pinstripes across the fin. Fictional registration N58217 on the fin; airline titles and the emblem omitted. Colors approximate (the photograph is black and white).

### Embraer E175

Type: `molen.entities.aircraft.embraer_e175`.

[![Embraer E175 livery comparison: White, grey belly, blue tail, White over navy belly, navy tail, Silver with flag-stripe tail, Sky blue upper body, white fin, Navy tail with aurora lines](https://molen.dev/guide-media/liveries/embraer_e175.png)](https://molen.dev/guide-media/liveries/embraer_e175.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `white-grey-belly-blue-tail` | White, grey belly, blue tail | [Photo 1](https://commons.wikimedia.org/wiki/File:United_Boeing_737-800_N37267_BWI_MD1.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:08-JUL-2022_-_UA5546_LGA-ORD_(E175_-_N89349)_(01).jpg) |
| `white-navy-belly-navy-tail` | White over navy belly, navy tail | [Photo](https://commons.wikimedia.org/wiki/File:DeltaConnection(Compass)E175N605CZ_YYJDecember2018.jpg) |
| `silver-flag-stripe-tail` | Silver with flag-stripe tail | [Photo](https://commons.wikimedia.org/wiki/File:American_Eagle_(Compass_Airlines)_Embraer_E175_N215NN_at_SFO_April_2017.jpg) |
| `sky-blue-upper-white-fin` | Sky blue upper body, white fin | [Photo](https://commons.wikimedia.org/wiki/File:PH-EXH_KLM_Cityhopper_E175_FRA_(37996624366).jpg) |
| `navy-tail-aurora-lines` | Navy tail with aurora lines | [Photo 1](https://commons.wikimedia.org/wiki/File:N638QX_%40_LAX%2C_2023-11-05.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:Alaska_Airlines_E175_departing_Fairbanks_(Quintin_Soloviev).jpg) |

**White, grey belly, blue tail.** United's 2019 scheme as now applied to United Express jets, from the referenced United photograph (the scheme) and United Express E175 (the type's marking positions; that aircraft still wears the 2010 scheme): white over a light grey belly behind a fine navy line that sweeps down to the radome, blue fin, engines and winglets, registration and US flag above the aft windows. The globe emblem is United's logo and is omitted, leaving the fin plain blue; titles are omitted. No operator titles, logos or emblems; the registration is fictional, in the national format.

**White over navy belly, navy tail.** Delta Connection scheme from the referenced photograph: white over the navy belly from the radome to the rear door, navy fin carried forward over the tail cone, navy engines and winglets, US flag and registration above the aft windows. The red tail widget is Delta's logo and is omitted, leaving the fin navy; titles are omitted. No operator titles, logos or emblems; the registration is fictional, in the national format.

**Silver with flag-stripe tail.** American Eagle scheme (American Airlines 2013) from the referenced photograph: silver fuselage, engines and winglets, the stylised flag on the fin (blue and white forward, red and white aft, red root band) with a red band over the tail cone, registration and US flag below the aft windows. The Flight Symbol and titles are omitted. No operator titles, logos or emblems; the registration is fictional, in the national format.

**Sky blue upper body, white fin.** KLM Cityhopper scheme from the referenced photograph: KLM blue over the top of the fuselage and nose, the fine dark blue line sweeping down to the radome, light grey belly, white fin, grey engines, blue winglets, EU and Dutch flags with a white registration above the aft windows. The crown logo and titles are omitted. No operator titles, logos or emblems; the registration is fictional, in the national format.

**Navy tail with aurora lines.** Alaska Airlines scheme (2016) on Horizon's E175s, from the referenced photographs: white fuselage, the green, light-blue and teal aurora lines sweeping up the rear fuselage into the fin, navy lower rear fuselage and fin, aurora bands on the fin tip and winglets, registration and US flag above the aft windows. The face on the fin is the operator's emblem and is omitted; titles are omitted. The fin's curved aurora lines are straightened. No operator titles, logos or emblems; the registration is fictional, in the national format.

### Eurofighter Typhoon

Type: `molen.entities.aircraft.typhoon`.

[![Eurofighter Typhoon livery comparison: RAF No. 41 Squadron (EB-G), RAF No. 3(F) Squadron centenary, 2012 (QO-C), Luftwaffe (30+46), Luftwaffe TaktLwG 74 "Ghost Tiger", 2018, Aeronautica Militare, 4° Stormo (4-7), Austrian Air Force (7L-WD)](https://molen.dev/guide-media/liveries/typhoon.png)](https://molen.dev/guide-media/liveries/typhoon.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `raf-41-squadron-eb-g` | RAF No. 41 Squadron (EB-G) | [Photo](https://commons.wikimedia.org/wiki/File:Eurofighter_Typhoon_FGR4_%27ZJ914_-_EB-G%27_(19806048123).jpg) |
| `raf-3-squadron-centenary-qo-c` | RAF No. 3(F) Squadron centenary, 2012 (QO-C) | [Photo](https://commons.wikimedia.org/wiki/File:Royal_Air_Force_(RAF)_Typhoon_FGR4_ZJ936_'QO-C'_of_No._3_Squadron_RAF,_with_a_commemorative_100th_anniversary_custom_paint_scheme_on_its_tail_fin,_on_static_display_at_RAF_Waddington_during_the_2012_Waddington_Int._Airshow_(8581632937).jpg) |
| `luftwaffe-30-46` | Luftwaffe (30+46) | [Photo](https://commons.wikimedia.org/wiki/File:Eurofighter_Typhoon_Germany_30%2B46_Neubrandenburg_(9965132925).jpg) |
| `luftwaffe-ghost-tiger-2018` | Luftwaffe TaktLwG 74 "Ghost Tiger", 2018 | [Photo](https://commons.wikimedia.org/wiki/File:Eurofighter_%22Ghost_Tiger%22_2018_Taktisches_Luftwaffengeschwader_74.jpg) |
| `aeronautica-militare-4-stormo` | Aeronautica Militare, 4° Stormo (4-7) | [Photo](https://commons.wikimedia.org/wiki/File:Eurofighter_Typhoon_Aeronautica_Militare_2009_04.jpg) |
| `austria-7l-wd` | Austrian Air Force (7L-WD) | [Photo](https://commons.wikimedia.org/wiki/File:AUSTRIAN_AIR_FORCE_EUROFIGHTER_EF.2000_7L-WD,7L-WI_(52247472319).jpg) |

**RAF No. 41 Squadron (EB-G).** Typhoon FGR4 ZJ914 of No. 41 Squadron from the referenced photograph: overall medium gray, the low-visibility roundel between white bars with a red stripe on the forward fuselage, the double-armed red cross under a gold crown on the fin (simplified), EB-G in white at the fin top, the low-visibility fin flash and ZJ914 on the rear fuselage, low-visibility roundels above the wings. Stencils are omitted.

**RAF No. 3(F) Squadron centenary, 2012 (QO-C).** Typhoon FGR4 ZJ936 in the 3(F) Squadron 100th anniversary scheme from the referenced photograph: green fin with the red and yellow band, the squadron badge (blue disc and white ring under a crown with a simplified cockatrice), 100 in yellow and QO-C, green and yellow bars around the low-visibility roundel and ZJ936 on the rear fuselage. The green and yellow spine stripe, the motto and LARKHILL 1912 lettering are omitted.

**Luftwaffe (30+46).** Eurofighter 30+46 from the referenced photograph: Luftwaffe blue-gray, 30 + Bundeswehr cross + 46 in black on the fuselage side (the thin white edging of the digits is omitted), the German flag at the fin top and the wing badge on the fin (simplified to a quartered blue and white shield), Bundeswehr crosses above and below the wings.

**Luftwaffe TaktLwG 74 "Ghost Tiger", 2018.** The Taktisches Luftwaffengeschwader 74 NATO Tiger Meet 2018 "Ghost Tiger" scheme from the referenced photograph: dark gray center and rear fuselage with neon green tiger stripes (the wings are left gray; they are not visible in the reference), a green fin with dark stripes and GHOST TIGER NTM 2018 in white, 31 + 00 in white with a low-visibility cross, the nose in standard gray. The painted tiger face is not reproduced; stripes are original vector art.

**Aeronautica Militare, 4° Stormo (4-7).** Eurofighter 4-7 of the 4° Stormo from the referenced 2009 photograph: overall gray, the Italian roundel on the fuselage side ahead of the code 4-7 in gray, roundels above and below the wings. The 4° Stormo fin badge and the fin lettering are omitted.

**Austrian Air Force (7L-WD).** Eurofighter 7L-WD from the referenced 2022 photograph: overall gray, 7L + roundel + WD in black on the fuselage side, Austrian roundels (red disc with the white triangle) above and below the wings. Stencils and the CALL 121.5 tank lettering are omitted.

### General Dynamics F-16B Fighting Falcon

Type: `molen.entities.aircraft.f_16b`.

[![General Dynamics F-16B Fighting Falcon livery comparison: USAF 80th FS Juvats WP 89-172, Kunsan, USAF 480th FS SP 91-481, Spangdahlem 2010, USAF 31st FW AV 89-178, Aviano, USAF 56th TFW MC 79-418, MacDill 1980s, Royal Danish Air Force ET-612, 2014, Israeli Air Force F-16B Netz 989, US Navy NSAWC adversary 07, Fallon](https://molen.dev/guide-media/liveries/f16.png)](https://molen.dev/guide-media/liveries/f16.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `usaf-wp-80fs` | USAF 80th FS Juvats WP 89-172, Kunsan | [Photo](https://commons.wikimedia.org/wiki/File:80th_Fighter_Squadron_F-16D_in_training_exercise.jpg) |
| `usaf-sp-480fs` | USAF 480th FS SP 91-481, Spangdahlem 2010 | [Photo](https://commons.wikimedia.org/wiki/File:F-16D_480th_FS_taking_off_Bulgaria_2010.jpg) |
| `usaf-av-31fw` | USAF 31st FW AV 89-178, Aviano | [Photo](https://commons.wikimedia.org/wiki/File:General_Dynamics_F-16DM_%E2%80%9889-178_-_AV%E2%80%99_(28264486733).jpg) |
| `usaf-mc-gray` | USAF 56th TFW MC 79-418, MacDill 1980s | [Photo](https://commons.wikimedia.org/wiki/File:General_Dynamics_F-16B-10_(SN_79-0418)_060905-F-1234S-041.jpg) |
| `danish-et-612` | Royal Danish Air Force ET-612, 2014 | [Photo 1](https://commons.wikimedia.org/wiki/File:F-16B_Denmark_(ET_612)_Tour_de_Sky_2014-08-10_02.JPG) · [Photo 2](https://commons.wikimedia.org/wiki/File:F-16B_Denmark_(ET_612)_Tour_de_Sky_2014-08-09_01.JPG) |
| `iaf-netz-989` | Israeli Air Force F-16B Netz 989 | [Photo 1](https://commons.wikimedia.org/wiki/File:Israeli_Air_Force_General_Dynamics_F-16B_Netz_(401)_Lofting-1.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:IAF_F-16B_Netz_017_CIAF_2004-2.jpg) |
| `nsawc-07-blue-camouflage` | US Navy NSAWC adversary 07, Fallon | [Photo](https://commons.wikimedia.org/wiki/File:920461_07_F-16B_NSAWC_(3143354959).jpg) |

**USAF 80th FS Juvats WP 89-172, Kunsan.** 8th Fighter Wing "Wolf Pack" F-16D 89-0172 of the 80th Fighter Squadron at Kunsan, applied to the two-seat F-16B model: FS 36270 medium gray with FS 36118 gunship gray along the spine, yellow fin cap, black WP tail code over the AF 89 172 serial block, the wolf head redrawn as original art, low-visibility national insignia on the aft fuselage, upper left and lower right wings. The wing shield above the wolf is omitted. Colors are approximations of the FS shades; stencils, crew names and small unit badges are omitted.

**USAF 480th FS SP 91-481, Spangdahlem 2010.** 52nd Fighter Wing F-16D 91-0481 of the 480th Fighter Squadron from Spangdahlem, photographed taking off in Bulgaria in 2010, applied to the two-seat F-16B model: FS 36270/36118 grays, a blue fin-tip band, dark SP tail code over the AF 91 481 serial block and low-visibility insignia. The white script in the band is omitted. Colors are approximations of the FS shades; stencils, crew names and small unit badges are omitted.

**USAF 31st FW AV 89-178, Aviano.** 31st Fighter Wing F-16D 89-0178 from Aviano, applied to the two-seat F-16B model: FS 36270/36118 grays, the squadron band below the fin tip in purple edged with black, black AV tail code over the AF 89 178 serial block and low-visibility insignia. The lettering inside the band and the wing badge on the fin are omitted. Colors are approximations of the FS shades; stencils, crew names and small unit badges are omitted.

**USAF 56th TFW MC 79-418, MacDill 1980s.** F-16B-10 79-0418 of the 56th Tactical Fighter Wing at MacDill in the early gray scheme: FS 36270 medium gray fuselage and upper surfaces, FS 36375 light compass gray under the wings, tailplanes and gear doors, and a light radome (the gunship gray spine is not shown); yellow fin-tip band over a black pinstripe, black MC tail code over the AF 79 418 serial block, low-visibility insignia. The Tactical Air Command badge on the fin is omitted. Colors are approximations; stencils are omitted.

**Royal Danish Air Force ET-612, 2014.** Danish F-16B ET-612 at Tour de Sky, Oulu 2014. Both side photographs establish the small red and white roundels behind the canopy, the pale ET 612 serial immediately aft of them and the swallow-tailed state flags on the fin, hoist forward on both sides; FS 36270 medium gray overall. The small US serial under the flag, stencils and wing markings (not visible in the photographs) are omitted. Colors are approximations.

**Israeli Air Force F-16B Netz 989.** Israeli Air Force F-16B Netz 989 in the desert scheme: tan, brown and pale green upper surfaces (a procedural blotch pattern standing in for the painted one), light blue-gray undersides, dark gray radome, black 989 on the fin and intake, the squadron phoenix redrawn as original art spanning fin and rudder, Star of David roundels on the upper right and lower left wings (which wings carry them is approximated). Colors are approximations; stencils and the fin-top badge are omitted.

**US Navy NSAWC adversary 07, Fallon.** Naval Strike and Air Warfare Center adversary F-16B 920461 "07" at Fallon: three-blue angular camouflage (a procedural splinter pattern standing in for the painted one) over light blue-gray undersides, white radome, black 07 on the intakes, a small 07 on the fin cap, a dark lightning bolt on the fin, NSAWC on the ventral fins and low-visibility insignia. The badge on the bolt is omitted. Colors are approximations.

### Grumman F-14D Super Tomcat

Type: `molen.entities.aircraft.f_14d`.

[![Grumman F-14D Super Tomcat livery comparison: VF-103 Jolly Rogers, 2002, VF-84 Jolly Rogers, 1986, VF-2 Bounty Hunters CAG, 2002, VF-213 Black Lions, 2003](https://molen.dev/guide-media/liveries/f_14d.png)](https://molen.dev/guide-media/liveries/f_14d.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `vf-103-jolly-rogers` | VF-103 Jolly Rogers, 2002 | [Photo](https://commons.wikimedia.org/wiki/File:US_Navy_021029-N-1955P-116_A_U.S._Navy_F-14B_Tomcat_assigned_to_the_%22Jolly_Rogers%22_of_Fighter_Squadron_One_Zero_Three_(VF-103)_flies_over_the_Croat_coastline_near_Pula.jpg) |
| `vf-84-jolly-rogers` | VF-84 Jolly Rogers, 1986 | [Photo](https://commons.wikimedia.org/wiki/File:F-14A_Tomcat_of_VF-84_in_flight_in_1986.jpg) |
| `vf-2-bounty-hunters` | VF-2 Bounty Hunters CAG, 2002 | [Photo](https://commons.wikimedia.org/wiki/File:F-14D_VF-2_Bounty_Hunters_in_flight_2002.JPG) |
| `vf-213-black-lions` | VF-213 Black Lions, 2003 | [Photo](https://commons.wikimedia.org/wiki/File:US_Navy_030226-N-4965F-507_An_F-14D_%22Tomcat%22_assigned_to_the_%22Black_Lions%22_of_Fighter_Squadron_Two_One_Three_(VF-213).jpg) |

**VF-103 Jolly Rogers, 2002.** VF-103 F-14B scheme from the referenced US Navy photograph, applied to the F-14D model: FS 36375 light ghost gray airframe, gloss black fins and rudders with a yellow cap, the white skull and crossbones redrawn as original vector art and centred on fin and rudder, white 03 under the cap, the black sash with yellow edges across the forward fuselage carrying the full-color national insignia, NAVY titles and modex 103. The ship name on the fin, the VF-103 ventral titles and the striped tanks are omitted. Colors and marking sizes are approximations.

**VF-84 Jolly Rogers, 1986.** VF-84 F-14A tactical paint scheme from the referenced 1986 US Navy photograph, applied to the F-14D model: FS 36320/36375 ghost grays, the skull and crossbones in dark low-visibility gray (original vector art) with the AJ tail code above it, modex 205, low-visibility national insignia and NAVY titles. The VF-84 lettering and the ship name are omitted. Approximate colors and sizes.

**VF-2 Bounty Hunters CAG, 2002.** VF-2 F-14D commander's aircraft from the referenced 2002 US Navy photograph: ghost gray airframe, orange fin cap, and the band of blue, white and red that fans across fins and rudders from the leading-edge root to the trailing edge, with white stars in the blue and red, the black italic NE tail code and the squadron skull (original vector art) at its forward end; maroon 00 under the cap, the blue-white-red sash with the full-color national insignia under the front cockpit, modex 100 and NAVY titles. The orange ventral fins and the striped tanks are omitted. Approximate colors; band edges measured from the photograph.

**VF-213 Black Lions, 2003.** VF-213 F-14D tactical scheme from the referenced 2003 US Navy photograph: FS 36375 light ghost gray overall, AJ tail code in a darker gray, modex 111, low-visibility national insignia and NAVY titles. The squadron's lion emblem is omitted. Approximate colors.

### Gulfstream G650ER

Type: `molen.entities.aircraft.gulfstream_g650er`.

[![Gulfstream G650ER livery comparison: Zambia Air Force AF001, U.S. Air Force C-37B scheme, White with black accents, White with navy and red pinstripes](https://molen.dev/guide-media/liveries/gulfstream_g650er.png)](https://molen.dev/guide-media/liveries/gulfstream_g650er.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `zambia-air-force` | Zambia Air Force AF001 | [Photo](https://commons.wikimedia.org/wiki/File:Gulfstream_Aerospace_G-VI_(G650)-_AF001_-_Zambia_Air_Force.jpg) |
| `usaf-c-37b` | U.S. Air Force C-37B scheme | [Photo](https://commons.wikimedia.org/wiki/File:U.S._Air_Force,_09-0525,_Gulfstream_Aerospace_C-37B_(27878765353).jpg) |
| `white-black-accents` | White with black accents | [Photo](https://commons.wikimedia.org/wiki/File:Gulfstream_G650ER_N780RW_BWI_MD1.jpg) |
| `navy-red-pinstripes` | White with navy and red pinstripes | [Photo](https://commons.wikimedia.org/wiki/File:Gulfstream_G650ER_-_N1895T_-_Serial_6346_-_VGHS.jpg) |

**Zambia Air Force AF001.** Zambia Air Force VIP G650 AF001 as photographed, applied to the G650ER model: silver overall, a dark navy sweep under the nose that thins into a pinline along the windows and runs on under the engines, dark rear fin and rudder, ZAMBIA AIR FORCE titles, the flag of Zambia behind the flight deck and as a fin flash, AF001 on the engines and fin (original vector drawings; the flag eagle is simplified). The small fuselage roundel is not resolvable in the reference and is omitted. Colours are approximate.

**U.S. Air Force C-37B scheme.** The 89th Airlift Wing VIP scheme as photographed on C-37B 09-0525, applied to the G650ER model (the C-37B is the G550): white over medium blue behind a dark blue pinline under the windows, the break running down to the nose tip and up the tail cone, UNITED STATES OF AMERICA titles, the flag and serial 90525 on the fin and the national insignia on the engines (original vector drawings; the titles are set in a sans serif rather than the serif face). Colours and line heights are approximate.

**White with black accents.** Private scheme as photographed on N780RW: white with a navy pinline along the windows curving down to the nose tip, a black crescent at the wing root, gloss black engines, pylons, lower tail cone, fin cap, fin-top fairing and tailplane, a black crescent along the fin's root and white registration on the engines. Registration N651QT is fictional; curve shapes are approximate and the black surround of the flight deck windows is left off.

**White with navy and red pinstripes.** Private scheme as photographed on N1895T: white with a navy stripe, a red stripe and a navy pinline under the windows from the nose to the tail cone, and navy and red bands across the fin; navy registration on the engines. Registration N2286M is fictional; stripe heights are approximate.

### Leonardo AW139

Type: `molen.entities.aircraft.aw139`.

[![Leonardo AW139 livery comparison: USAF MH-139A Grey Wolf, Italian Coast Guard, Guardia di Finanza GF-402, Ontario air ambulance orange, US state police black and gold](https://molen.dev/guide-media/liveries/aw139.png)](https://molen.dev/guide-media/liveries/aw139.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `usaf-mh-139a` | USAF MH-139A Grey Wolf | [Photo 1](https://commons.wikimedia.org/wiki/File:MH-139,_Eglin_Air_Force_Base,_Florida,_2019_(cropped).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:MH-139A_Grey_Wolf.jpg) |
| `guardia-costiera` | Italian Coast Guard | [Photo](https://commons.wikimedia.org/wiki/File:Guardia_Costiera_AW139.jpg) |
| `guardia-di-finanza` | Guardia di Finanza GF-402 | [Photo](https://commons.wikimedia.org/wiki/File:AgustaWestland_AW139_(c-n_31301,_s-n_MM81750,_GF-402)_2017-09-23_Andre_Gerwing_Collection_ID_000349.jpg) |
| `ontario-air-ambulance` | Ontario air ambulance orange | [Photo](https://commons.wikimedia.org/wiki/File:Ornge_C-GYNP.jpg) |
| `state-police-black-gold` | US state police black and gold | [Photo](https://commons.wikimedia.org/wiki/File:MSP_Trooper_1_AW139_N384MD_MD1.jpg) |

**USAF MH-139A Grey Wolf.** US Air Force MH-139A Grey Wolf (the military AW139) from the referenced photographs: dark gunship grey overall in a matt finish with the low-visibility national insignia outlined in black on the rear fuselage and the serial and U.S. AIR FORCE in dark grey on the fin. The serial shown (AF 21-001) is illustrative; the MH-139A mission fit (sensor turret, hoist) is not modelled. Colors are approximate.

**Italian Coast Guard.** Italian Coast Guard (Guardia Costiera) AW139 11-01 from the referenced photograph: white overall with a red belly and sponsons, a broad red band round the rear cabin and over the cowling, red upper fin, black anti-glare panel on the nose, GUARDIA COSTIERA in red under the cabin windows, the anchor badge on the red band (an original simplified drawing) and the code 11-01 with the Italian roundel on the boom. The Navy coat of arms on the cowling is omitted. Colors are approximate.

**Guardia di Finanza GF-402.** Italian Guardia di Finanza AW139 GF-402 (MM81750) from the referenced photograph: light grey overall with a green and yellow double cheatline running from the nose under the doors, up the boom and the fin's leading edge, GUARDIA DI FINANZA in black on the boom, the code on the forward door and the serial on the fin. The corps' coat of arms on the fin is omitted. Colors are approximate.

**Ontario air ambulance orange.** Ontario air ambulance AW139 from the referenced photograph of C-GYNP: bright orange overall with a white cheatline sweeping from the nose under the doors and up the tail boom, and the registration in white on the boom. The registration is fictional (C-GXLB); the operator's name, wings logo and base titles are omitted. Colors are approximate.

**US state police black and gold.** US state police AW139 from the referenced photograph of a Maryland State Police aircraft: gloss black with an olive-gold roof and cowling, a gold cheatline along the lower fuselage, STATE TROOPER in gold on the boom, the Maryland state flag as a leaning banner on the rear fuselage (an original drawing of the flag), the US flag on the cowling and the registration in gold on the cowling. The registration is fictional (N618TP; the photographed aircraft is N384MD); the agency name, badge and seal are omitted. Colors are approximate.

### Lockheed Martin C-130J Super Hercules

Type: `molen.entities.aircraft.c_130j`.

[![Lockheed Martin C-130J Super Hercules livery comparison: Kentucky ANG 123rd AW, 2024, 53rd WRS Hurricane Hunters WC-130J, US Coast Guard HC-130J 2015, RAF Hercules C5 ZH889, 47 Sqn, RAAF 37 Squadron A97-448](https://molen.dev/guide-media/liveries/c_130j.png)](https://molen.dev/guide-media/liveries/c_130j.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `kentucky-ang-123aw` | Kentucky ANG 123rd AW, 2024 | [Photo](https://commons.wikimedia.org/wiki/File:Lockheed_C-130J,_ILA_2024,_Schoenefeld_(ILA43898).jpg) |
| `wc-130j-hurricane-hunters` | 53rd WRS Hurricane Hunters WC-130J | [Photo 1](https://commons.wikimedia.org/wiki/File:98-5307_WC-130J_HURRICANE_HUNTERS_(28865254758).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:WC-130J_Hercules_of_the_53rd_Weather_Reconnaissance_Squadron.jpg) |
| `uscg-hc-130j` | US Coast Guard HC-130J 2015 | [Photo 1](https://commons.wikimedia.org/wiki/File:Coast_Guard_HC-130J.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:HC-130J_sits_on_the_tarmac_at_Air_Station_Barbers_Point.jpg) |
| `raf-47-sqn-hercules-c5` | RAF Hercules C5 ZH889, 47 Sqn | [Photo 1](https://commons.wikimedia.org/wiki/File:EGVN_-_Lockheed_C-130J_Hercules_C5_-_Royal_Air_Force_-_ZH889_(33295282688).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:EGVN_-_Lockheed_C-130J_Hercules_C5_-_Royal_Air_Force_-_ZH887_(46246445655).jpg) |
| `raaf-37-sqn` | RAAF 37 Squadron A97-448 | [Photo](https://commons.wikimedia.org/wiki/File:Royal_Australian_Air_Force_(A97-448)_Lockheed_Martin_C-130J_Hercules_at_Wagga_Wagga_Airport.jpg) |

**Kentucky ANG 123rd AW, 2024.** Kentucky Air National Guard C-130J-30 19-5945 from the referenced ILA 2024 photograph, laid out on the short C-130J: FS 36173 neutral gray, U.S. AIR FORCE title, US flag, ANG, the blue KENTUCKY tail band with its star and tail number 95945 on the fin, full-color national insignia aft, nose number and unit code, USAF and the national insignia on the wings. The ANG shield under the tail number and the KENTUCKY AIR GUARD sponson title are omitted. Approximate colors.

**53rd WRS Hurricane Hunters WC-130J.** Air Force Reserve WC-130J 98-5307 of the 53rd Weather Reconnaissance Squadron (403rd Wing, Keesler) from the referenced photographs: gray overall, U.S. AIR FORCE title, US flag, AFRC, the black Hurricane Hunters tail band with the red storm symbol and tail number 85307, dark low-visibility national insignia, nose number and 403 WG. The WC-130J's pylon fuel tanks are not modelled. Approximate colors; the band's script lettering is set in an italic sans.

**US Coast Guard HC-130J 2015.** US Coast Guard HC-130J 2015 (Air Station Elizabeth City) from the referenced photographs: Coast Guard white with the red-orange and blue racing stripe and service emblem (redrawn), black radome is the model default, number 2015 on the nose, U.S. COAST GUARD title, red-orange fin panel and base band around the full-color national insignia, diagonal stabilizer bands and red-orange outer wings, USCG and the insignia under the wings. Approximate stripe geometry and colors.

**RAF Hercules C5 ZH889, 47 Sqn.** Royal Air Force Hercules C5 ZH889 (Brize Norton) from the referenced photographs: overall dark tactical green-gray, low-visibility red and blue roundels aft and fin flash, small ROYAL AIR FORCE title, 889 on the nose and the ZH889 serial on the tail cone. Approximate colors; the white and red propeller tip rings are not painted (blades are a separate material).

**RAAF 37 Squadron A97-448.** Royal Australian Air Force C-130J-30 A97-448 (No. 37 Squadron, Richmond) from the referenced photograph, laid out on the short C-130J: light gray, ROYAL AUSTRALIAN AIR FORCE title and A97-448 in darker gray, low-visibility kangaroo roundels aft and on the fin, 448 on the nose, dark fin-root fairing. Yellow primer patches are omitted. Approximate colors.

### Lockheed Martin C-5M Super Galaxy

Type: `molen.entities.aircraft.c_5m`.

[![Lockheed Martin C-5M Super Galaxy livery comparison: USAF 436th AW Dover, C-5M 86-0017, AFRC 439th AW Westover, 87-0031, AFRC 433rd AW Lackland, 69-0016, European One camouflage, 1980s](https://molen.dev/guide-media/liveries/c_5m.png)](https://molen.dev/guide-media/liveries/c_5m.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `dover-436-aw-super-galaxy` | USAF 436th AW Dover, C-5M 86-0017 | [Photo](https://commons.wikimedia.org/wiki/File:C-5_Galaxy_taking_off_from_Travis_AFB.jpg) |
| `westover-439-aw` | AFRC 439th AW Westover, 87-0031 | [Photo 1](https://commons.wikimedia.org/wiki/File:Lockheed_C-5_Galaxy_USAF_(87-0031)_Westover_AFB_(6784226411).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:C-5_Galaxy_at_Westover_Air_Reserve_Base.jpg) |
| `lackland-433-aw` | AFRC 433rd AW Lackland, 69-0016 | [Photo](https://commons.wikimedia.org/wiki/File:433d_AW_C-5_Kelly_Annex_TX.jpg) |
| `european-one-1980s` | European One camouflage, 1980s | [Photo 1](https://commons.wikimedia.org/wiki/File:C-5_Galaxy.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:C-5M_Super_Galaxy_-_20-21_juin_1987_-_Chi%C3%A8vres_AB2.JPG) |

**USAF 436th AW Dover, C-5M 86-0017.** Air Mobility Command C-5M 86-0017 of the 436th Airlift Wing (Dover) from the referenced photograph: gray, U.S. AIR FORCE title, US flag, AMC, the sky-blue Dover tail band with the base name in a yellow lozenge and an eagle head at its front (original drawing), tail number 60017 and Super Galaxy script, full-color national insignia aft. Approximate colors and band art.

**AFRC 439th AW Westover, 87-0031.** Air Force Reserve C-5B 87-0031 of the 439th Airlift Wing (Westover) from the referenced photographs, applied to the C-5M model: gray, U.S. AIR FORCE title, US flag, AFRC, the red WESTOVER tail band with its forward-pointing white arrow, tail number 70031 and national insignia aft. Approximate colors.

**AFRC 433rd AW Lackland, 69-0016.** Air Force Reserve C-5A 69-0016 of the 433rd Airlift Wing (Lackland, Kelly Field Annex) from the referenced photograph, applied to the C-5M model: gray, U.S. AIR FORCE title, US flag, AFRC, the Lone Star tail band (blue field with a white star ahead of white and red bars), tail number 90016 and national insignia aft. Approximate colors.

**European One camouflage, 1980s.** Military Airlift Command C-5A in the 1980s European One camouflage from the referenced photographs, applied to the C-5M model: dark green, medium green and gray patches overall (deterministic pattern, not the aircraft-specific layout), small black U.S. AIR FORCE title and black national insignia. Serials and command markings are not legible in the photographs and are omitted.

### Lockheed Martin F-22A Raptor

Type: `molen.entities.aircraft.f_22a`.

[![Lockheed Martin F-22A Raptor livery comparison: 95th FS flagship, Tyndall (TY), 19th FS, Hickam (HH), 3rd Wing, Elmendorf (AK), 1st Fighter Wing, Langley (FF), 422nd TES, 53rd Wing, Nellis (OT)](https://molen.dev/guide-media/liveries/f_22a.png)](https://molen.dev/guide-media/liveries/f_22a.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `ty-95fs-tyndall` | 95th FS flagship, Tyndall (TY) | [Photo 1](https://commons.wikimedia.org/wiki/File:Lockheed_Martin_F-22A_Raptor_%E2%80%9895FS_TY%E2%80%99_-05-4095-_(30873278036).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:Lockheed_Martin_F-22A_Raptor_%E2%80%9908-152_-_FF%E2%80%99_(29102586122).jpg) |
| `hh-19fs-hickam` | 19th FS, Hickam (HH) | [Photo 1](https://commons.wikimedia.org/wiki/File:19th_Fighter_Squadron_-_Lockheed_Martin_F-22A_LRIP_Lot_3_Block_20_Raptor_03-4045.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:F-22_Raptor_edit1.jpg) |
| `ak-3rd-wing-elmendorf` | 3rd Wing, Elmendorf (AK) | [Photo 1](https://commons.wikimedia.org/wiki/File:06-4108-AK_Lockheed_Martin_F-22A-30-LM_Raptor_USAF_(6943757704).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:F-22_Raptor_edit1.jpg) |
| `ff-1st-fighter-wing` | 1st Fighter Wing, Langley (FF) | [Photo 1](https://commons.wikimedia.org/wiki/File:Lockheed_Martin_F-22A_Raptor_%E2%80%9908-152_-_FF%E2%80%99_(28587915994).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:Lockheed_Martin_F-22A_Raptor_%E2%80%9908-152_-_FF%E2%80%99_(29102586122).jpg) |
| `ot-422-tes-nellis` | 422nd TES, 53rd Wing, Nellis (OT) | [Photo 1](https://commons.wikimedia.org/wiki/File:Lockheed_Martin_F-22_Raptor_%E2%80%9904-066_-_OT%E2%80%99_(27498673043).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:F-22_Raptor_edit1.jpg) |

**95th FS flagship, Tyndall (TY).** F-22A 05-4095, the 95th Fighter Squadron's flagship at Tyndall, from the referenced photograph: Have Glass light gray with the darker wing box, stabilator centres and fin patch, irregular darker patches on the fuselage (a blotch pattern, not the exact patch outlines), low-visibility national insignia upper left and lower right wing. The fin carries TY over 95 FS in low-visibility light gray with the 325th Fighter Wing badge above (simplified to a shield with a lightning bolt, not the heraldry).

**19th FS, Hickam (HH).** F-22A 03-4045 of the 19th Fighter Squadron (15th Wing, flown with the Hawaii ANG 199th Fighter Squadron) from the referenced photograph: Have Glass light gray with the darker wing box, stabilator centres and fin patch, irregular darker patches on the fuselage (a blotch pattern, not the exact patch outlines), low-visibility national insignia upper left and lower right wing. The fin carries HH and AF 03 045 in low-visibility light gray with the wing badge above (simplified to a shield with a star).

**3rd Wing, Elmendorf (AK).** F-22A 06-4108 of the 3rd Wing, Joint Base Elmendorf-Richardson, from the referenced photograph: Have Glass light gray with the darker wing box, stabilator centres and fin patch, irregular darker patches on the fuselage (a blotch pattern, not the exact patch outlines), low-visibility national insignia upper left and lower right wing. The fin carries AK and AF 06 108 in low-visibility light gray with the wing badge above (simplified to a shield with a mountain peak).

**1st Fighter Wing, Langley (FF).** F-22A 08-4152 of the 1st Fighter Wing, Joint Base Langley-Eustis, from the referenced photographs: Have Glass light gray with the darker wing box, stabilator centres and fin patch, irregular darker patches on the fuselage (a blotch pattern, not the exact patch outlines), low-visibility national insignia upper left and lower right wing. The fin carries FF and AF 08 152 in low-visibility light gray with the wing badge above (simplified to a shield with a chevron).

**422nd TES, 53rd Wing, Nellis (OT).** F-22A 04-4066 of the 422nd Test and Evaluation Squadron, 53rd Wing, Nellis, from the referenced photograph: Have Glass light gray with the darker wing box, stabilator centres and fin patch, irregular darker patches on the fuselage (a blotch pattern, not the exact patch outlines), low-visibility national insignia upper left and lower right wing. The fin carries OT and AF 04 066 in low-visibility light gray with the 53rd Wing badge above (simplified to a shield with bars).

### Lockheed Martin F-35A Lightning II

Type: `molen.entities.aircraft.f_35a`.

[![Lockheed Martin F-35A Lightning II livery comparison: Royal Australian Air Force, A35-032, Royal Netherlands Air Force, F-001 (OT), USAF 56th Fighter Wing, Luke (LF), Royal Norwegian Air Force, 5288, JASDF 302 Squadron, Misawa (710), Israeli Air Force, 140 Squadron (905)](https://molen.dev/guide-media/liveries/f_35a.png)](https://molen.dev/guide-media/liveries/f_35a.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `raaf-a35-032` | Royal Australian Air Force, A35-032 | [Photo](https://commons.wikimedia.org/wiki/File:Royal_Australian_Air_Force_(A35-032)_Lockheed_Martin_F-35A_Lightning_II_on_display_at_the_2025_Australian_International_Airshow.jpg) |
| `rnlaf-f-001-ot` | Royal Netherlands Air Force, F-001 (OT) | [Photo](https://commons.wikimedia.org/wiki/File:Royal_Netherlands_Air_Force_Lockheed_Martin_F-35A_Lightning_II_(F-001_-_OT)_(31080065885).jpg) |
| `usaf-56fw-luke-lf` | USAF 56th Fighter Wing, Luke (LF) | [Photo 1](https://commons.wikimedia.org/wiki/File:Raptor_%26_Lightning_(F-22A_09-191_-_FF_%26_F-35A_12-5052_-_LF)_(28201197585)_(2).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:F-35A_Lightning_II_at_Hill_Air_Force_Base,_Utah.jpg) |
| `rnoaf-5288` | Royal Norwegian Air Force, 5288 | [Photo 1](https://commons.wikimedia.org/wiki/File:Norwegian_Lockheed-Martin_F-35A_Lightning_II_at_Ramstein_Air_Base,_Germany,_6_June_2024_(240606-F-TC518-2308).JPG) · [Photo 2](https://commons.wikimedia.org/wiki/File:Lockheed_Martin_F-35A_Lightning_II_Royal_Norwegian_Air_Force_5208_5D4_2380_(53921025875).jpg) |
| `jasdf-302-squadron-710` | JASDF 302 Squadron, Misawa (710) | [Photo](https://commons.wikimedia.org/wiki/File:Japan_air_self_defense_force_Lockheed_Martin_F-35A_302SQ_RJSM.jpg) |
| `iaf-140-squadron-905` | Israeli Air Force, 140 Squadron (905) | [Photo](https://commons.wikimedia.org/wiki/File:F-35I-Adir-0296.jpg) |

**Royal Australian Air Force, A35-032.** RAAF F-35A A35-032 from the referenced 2025 photograph: radar-absorbent dark gray with the lighter edge treatment on leading edges, control-surface edges and rudders; the low-visibility kangaroo roundel on the forward fuselage and both wings, A35-032 on the aft fuselage, and on the fins the number 32, the light gray double chevron ending in the squadron badge (simplified to a disc and shield) and the low-visibility flag at the tip. Stencils and the formation-light strip are omitted.

**Royal Netherlands Air Force, F-001 (OT).** RNLAF F-35A F-001 during operational test with the OT code, from the referenced photograph: radar-absorbent dark gray with the lighter edge treatment on leading edges, control-surface edges and rudders; the low-visibility Dutch roundel (three-tone disc with a dark centre, as photographed) on the forward fuselage and wings, OT over F-001 in light gray on the fins with the RNLAF badge above (simplified crown and shield).

**USAF 56th Fighter Wing, Luke (LF).** F-35A 12-5052 of the 56th Fighter Wing, Luke, from the referenced photograph: radar-absorbent dark gray with the lighter edge treatment on leading edges, control-surface edges and rudders; on the fins LF in low-visibility light gray with the wing badge high and forward (simplified shield and star) and AF 12 5052 low and aft; the squadron badge disc on the intake trunk (simplified); low-visibility national insignia upper left and lower right wing (none on the fuselage).

**Royal Norwegian Air Force, 5288.** RNoAF F-35A 5288 from the referenced photographs: radar-absorbent dark gray with the lighter edge treatment on leading edges, control-surface edges and rudders; the Norwegian F-35 low-visibility roundel (light gray ring with the split arrowhead, pointing aft on both sides as photographed) on the forward fuselage and wings, and on the fins the arrowhead emblem (simplified to three converging stripes) above the serial 5288.

**JASDF 302 Squadron, Misawa (710).** JASDF F-35A 710 of 302 Squadron from the referenced photograph: radar-absorbent dark gray with the lighter edge treatment on leading edges, control-surface edges and rudders; the low-visibility hinomaru (gray disc) on the forward fuselage and wings, the squadron's white-tailed eagle on the fins in light gray (original angular drawing, flying forward on both sides) and 710 on the nose.

**Israeli Air Force, 140 Squadron (905).** F-35I Adir 905 of 140 Squadron from the referenced photograph, applied to the F-35A model: radar-absorbent dark gray with the lighter edge treatment on leading edges, control-surface edges and rudders; the full-color Israeli marking (blue Star of David on a white disc) on the forward fuselage and wings, 905 in white under the windscreen and on the fins, and the squadron's golden-eagle head as white line art on the fins (original drawing). The F-35I's small differences in shape are not modelled.

### McDonnell Douglas AV-8B Harrier II Plus

Type: `molen.entities.aircraft.av_8b`.

[![McDonnell Douglas AV-8B Harrier II Plus livery comparison: USMC VMA-542 Tigers WH-02, 2007, USMC VMA-214 Black Sheep WE-04, USMC VMA-513 wraparound camouflage, 1980s, Spanish Navy 9a Escuadrilla 01-916, Italian Navy GRUPAER 1-03](https://molen.dev/guide-media/liveries/av_8b.png)](https://molen.dev/guide-media/liveries/av_8b.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `vma-542-wh-02` | USMC VMA-542 Tigers WH-02, 2007 | [Photo](https://commons.wikimedia.org/wiki/File:AV-8B_VMA-542_HMS_Illustrious_2007.jpg) |
| `vma-214-we-04` | USMC VMA-214 Black Sheep WE-04 | [Photo 1](https://commons.wikimedia.org/wiki/File:Marine_Attack_Squadron_214_(VMA-214)_AV-8B_Harrier_ll_(V-STOL)_BuNo165573_WE-04_Black_Sheep_(15465096665).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:US_Navy_051111-N-1467K-004_An_AV-8B_Harrier,_assigned_to_the_Black_Sheep_of_Marine_Attack_Squadron_Two_One_Four_(VMA-214),_prepares_to_launch.jpg) |
| `vma-513-camouflage` | USMC VMA-513 wraparound camouflage, 1980s | [Photo](https://commons.wikimedia.org/wiki/File:AV-8B_Harrier_formation_VMA-513.JPG) |
| `armada-01-916` | Spanish Navy 9a Escuadrilla 01-916 | [Photo 1](https://commons.wikimedia.org/wiki/File:McDonnell_Douglas_EAV-8B%2B_Harrier_II_(VA.1B-26_01-916)._Detalle_de_la_cola_(35062900096).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:Cuatro_McDonnell_Douglas_EAV-8B%2B_Harrier_II_(VA.1B-26_01-916)_de_la_9%C2%AA_Escuadrilla_en_la_cubierta_de_vuelo_del_L-61_(34292830733).jpg) |
| `marina-1-03` | Italian Navy GRUPAER 1-03 | [Photo](https://commons.wikimedia.org/wiki/File:Marina_Militare_AV-8B_Harrier_II%2B.jpg) |

**USMC VMA-542 Tigers WH-02, 2007.** VMA-542 AV-8B+ WH-02 from the referenced 2007 photograph: light ghost gray overall, the yellow-and-black sawtooth along the fin leading edge, black WH code, BuNo 164554 and MARINES on the fin, 02 on the nose and fin tip, MARINES on the upper right wing, VMA-542 on the boom and full-color national insignia on the nozzle fairings and wings (original vector art). The tiger-head badge and stencils are omitted; colors approximate.

**USMC VMA-214 Black Sheep WE-04.** VMA-214 AV-8B+ WE-04 from the referenced photographs: dark tactical gray overall with light gray low-visibility markings: the stacked WE code among small stars, BuNo 165573 and MARINES on the fin, 04 on the nose and fin tip, VMA-214 BLACKSHEEP on the boom and outline national insignia on the nozzle fairings and wings (original vector art). The squadron badge and stencils are omitted; colors approximate.

**USMC VMA-513 wraparound camouflage, 1980s.** Early VMA-513 AV-8B from the referenced formation photograph: wraparound dark green and dark gray camouflage on all surfaces (procedural patches standing in for the painted pattern), black low-visibility national insignia on the nozzle fairings and wings, the WF squadron code and MARINES on the fin and a nose number. The code and number are the squadron's period markings and are not legible in the photograph; colors approximate, stencils omitted.

**Spanish Navy 9a Escuadrilla 01-916.** Spanish Navy EAV-8B+ VA.1B-26 / 01-916 of the 9a Escuadrilla from the referenced photographs: medium gray overall, red-yellow-red roundels on the nozzle fairings and both wing surfaces, light gray ARMADA on the fin and nose, 01-916 under it, 16 on the fin and the black VA.1B-26 serial on the boom (original vector art). The naval aviation badge on the fin and stencils are omitted; colors approximate.

**Italian Navy GRUPAER 1-03.** Marina Militare AV-8B+ M.M.7199 / 1-03 from the referenced photograph: gray overall with a dark rudder and radome, white MARINA on the fin, 1-03 and M.M.7199 on the boom behind a small roundel, 03 on the nose, the anchor badge on the nozzle fairings and roundels on both wing surfaces (original vector art). Squadron nicknames on stores and the stencils are omitted; colors approximate.

### McDonnell Douglas F-15C Eagle

Type: `molen.entities.aircraft.f_15c`.

[![McDonnell Douglas F-15C Eagle livery comparison: 67th FS Fighting Cocks, Kadena, 2008, 493rd FS heritage, Lakenheath, 2019, 65th Aggressor Squadron, Nellis, 2012, Israeli Air Force 106 Sqn Baz 818, 2019, JASDF F-15J 72-8880](https://molen.dev/guide-media/liveries/f_15c.png)](https://molen.dev/guide-media/liveries/f_15c.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `zz-67fs-kadena` | 67th FS Fighting Cocks, Kadena, 2008 | [Photo 1](https://commons.wikimedia.org/wiki/File:F-15C_67th_Fighter_Squadron_2008.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:83-0039-ZZ_McDonnell_Douglas_F-15C_Eagle_USAF_(9536493920).jpg) |
| `ln-493fs-heritage` | 493rd FS heritage, Lakenheath, 2019 | [Photo 1](https://commons.wikimedia.org/wiki/File:493rd_Fighter_Squadron_Heritage_F-15C_Eagle_(5253577).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:493rd_Grim_Reapers_Heritage_F-15C_(5260166).jpg) |
| `wa-65agrs-aggressor` | 65th Aggressor Squadron, Nellis, 2012 | [Photo](https://commons.wikimedia.org/wiki/File:F-15C_65th_Aggressor_Squadron_(8189062831).jpg) |
| `iaf-baz-818` | Israeli Air Force 106 Sqn Baz 818, 2019 | [Photo](https://commons.wikimedia.org/wiki/File:McDonnell_Douglas_F-15C-28-MC_Eagle_(Baz)_%E2%80%98818%E2%80%99_(48644505872).jpg) |
| `jasdf-f15j-880` | JASDF F-15J 72-8880 | [Photo](https://commons.wikimedia.org/wiki/File:McDonnell_Douglas_(Mitsubishi)_F-15J_Eagle,_Japan_-_Air_Force_AN2322615.jpg) |

**67th FS Fighting Cocks, Kadena, 2008.** F-15C 85-0115 of the 18th Wing’s 67th Fighter Squadron from the referenced 2008 USAF photograph: Mod Eagle camouflage of FS 36251 with FS 36176 patches (procedural on the airframe, the photographed patch drawn on the fins), the light ZZ code and AF 85 115 serial on the fin patch, the squadron’s red fin-tip band, and low-visibility national insignia on the intakes and wings. The wing badge, crew names and small stencils are omitted; camouflage boundaries and colors are approximations.

**493rd FS heritage, Lakenheath, 2019.** 48th Fighter Wing heritage F-15C of the 493rd Fighter Squadron from the referenced USAF photographs: dark gray overall, the red-and-white checkerboard nose band behind the radome, black-and-white D-Day invasion stripes across both wings and the belly, blue fin leading edges, caps and rudders, the black LN code and AF 86 156 serial, and the wing’s green Statue of Liberty redrawn as an original silhouette. The serial is representative, the wing and squadron badges are omitted, and the check size and stripe widths are approximations.

**65th Aggressor Squadron, Nellis, 2012.** 65th Aggressor Squadron F-15C from the referenced Nellis photograph: light gray forward fuselage and a blue-gray splinter camouflage aft (procedural, approximating the photographed shard pattern), yellow-and-black checked fin tips, the white WA tail code outlined in dark blue, aggressor number 94 on the intakes, 494 on the nose and low-visibility national insignia. The squadron and command badges and crew names are omitted.

**Israeli Air Force 106 Sqn Baz 818, 2019.** Israeli Air Force F-15C Baz 818 of 106 (Spearhead) Squadron, Tel Nof, from the referenced 2019 photograph (Cobra Warrior, RAF Waddington): light gray overall with a darker radome, the blue Star of David roundel on the intake sides and wings, 818 in blue on the nose and large in black on the fins, the squadron’s eagle badge redrawn as an original diving-eagle silhouette and the red star on the fin. The red inner-fin flash, kill markings and stencils are omitted; wing roundel positions and colors are approximations.

**JASDF F-15J 72-8880.** Japan Air Self-Defense Force F-15J 72-8880 (the licence-built F-15C) from the referenced photograph: light gray overall with a gray radome, the hinomaru on the intake sides and above and below both wings, the black 880 nose number (its thin white edge omitted) and the 72-8880 fin serial. This jet wore a special squadron fin and tank design that is omitted (standard markings only), as are the small stencils and the yellow rescue arrows. Colors are approximations.

### McDonnell Douglas F/A-18C Hornet

Type: `molen.entities.aircraft.fa_18c`.

[![McDonnell Douglas F/A-18C Hornet livery comparison: VFA-192 Golden Dragons CAG, Blue Angels No. 1, 2014, VMFA-232 Red Devils, 2024, Finnish Air Force HN-442, 2025, Swiss Air Force J-5004](https://molen.dev/guide-media/liveries/fa_18c.png)](https://molen.dev/guide-media/liveries/fa_18c.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `vfa-192-golden-dragons` | VFA-192 Golden Dragons CAG | [Photo](https://commons.wikimedia.org/wiki/File:An_F-A-18C_Hornet_launches_from_the_flight_deck_of_the_conventionally_powered_aircraft_carrier.jpg) |
| `blue-angels-1` | Blue Angels No. 1, 2014 | [Photo](https://commons.wikimedia.org/wiki/File:McDonnell_Douglas_FA-18C_Hornet_BuNo_163498_Blue_Angels_1_LSide_Dawn_SNF_04April2014_(14584524464).jpg) |
| `vmfa-232-red-devils` | VMFA-232 Red Devils, 2024 | [Photo](https://commons.wikimedia.org/wiki/File:VMFA-232_FA-18C_taxis_at_Tinian_during_Cope_North_24.jpg) |
| `finnish-hn-442` | Finnish Air Force HN-442, 2025 | [Photo](https://commons.wikimedia.org/wiki/File:Finnish_Air_Force_McDonnell_Douglas_FA-18C_Hornet_HN-442_Royal_International_Air_Tattoo_2025_03.jpg) |
| `swiss-j-5004` | Swiss Air Force J-5004 | [Photo](https://commons.wikimedia.org/wiki/File:McDonnell_Douglas_F-A-18C_Hornet_%E2%80%98J-5004_-_004%E2%80%99_(31704782592).jpg) |

**VFA-192 Golden Dragons CAG.** VFA-192 commander's (CAG) F/A-18C 300 from the referenced US Navy photograph: tactical ghost grays, dark blue fins carrying the squadron's gold dragon head at the tip and a gold sweep at the root (original drawings, not the squadron's artwork), the white NF code of Carrier Air Wing 5, modex 300 and low-visibility national insignia. The yellow inner fin faces, crew names and stencils are omitted; the dragon is a simplified interpretation.

**Blue Angels No. 1, 2014.** US Navy Flight Demonstration Squadron F/A-18C BuNo 163498, No. 1, from the referenced 2014 photograph: Blue Angels blue (FS 15050) overall with FS 13538 yellow on the fin leading edges and tips and along the LEX edges, the yellow 1 on the fins, U.S. NAVY on the nacelles, the Blue Angels title under the cockpit set in plain italic type, and the serial on the tail. The team crest, the script logotype and crew names are omitted; trim widths are approximations.

**VMFA-232 Red Devils, 2024.** US Marine Corps VMFA-232 F/A-18C from the referenced 2024 photograph: tactical ghost grays, red fin tips and leading edges with the white modex 23 on the tips, the WT tail code and 23 on the nose in insignia gray, MARINES on the nacelles and low-visibility national insignia. The squadron’s devil emblem and stencils are omitted; the MARINES title placement follows standard Marine Hornet practice rather than this photograph.

**Finnish Air Force HN-442, 2025.** Finnish Air Force F/A-18C HN-442 from the referenced 2025 photograph: two-tone gray, the small blue-and-white roundel and black HN-442 on the forward fuselage below the LEX, 42 at the fin tips, and roundels above and below both wings. The unit badge on the fin and stencils are omitted; wing roundel size is an approximation.

**Swiss Air Force J-5004.** Swiss Air Force F/A-18C J-5004 from the referenced photograph: light gray overall, the red-and-white Swiss marking on the outer fins and above and below both wings, the black J-5004 serial low on the fins and 004 on the nose. Stencils are omitted; the wing marking size is an approximation.

### Mikoyan MiG-29A

Type: `molen.entities.aircraft.mig_29a`.

[![Mikoyan MiG-29A livery comparison: Polish Air Force 105, 1.ELT, 2016, Polish Air Force 89, 1.ELT, 2011, Luftwaffe JG 73 29+08, 2003, Soviet Air Force blue 10, Farnborough 1988, Ukrainian Air Force 05, digital camouflage, 2018](https://molen.dev/guide-media/liveries/mig_29a.png)](https://molen.dev/guide-media/liveries/mig_29a.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `polish-105-1-elt` | Polish Air Force 105, 1.ELT, 2016 | [Photo](https://commons.wikimedia.org/wiki/File:105_Polish_Air_Force_MiG-29A_Fulcrum_ILA_Berlin_2016_01.jpg) |
| `polish-89-camouflage` | Polish Air Force 89, 1.ELT, 2011 | [Photo](https://commons.wikimedia.org/wiki/File:89_Mig-29A_Fulcrum_1.elt_Poland,_Minsk-Mazowiecki_2011_IMG_7358_(50435607716).jpg) |
| `luftwaffe-jg73-29-08` | Luftwaffe JG 73 29+08, 2003 | [Photo 1](https://commons.wikimedia.org/wiki/File:Two_German_Fuftwaffe_Mikoyan-Gurevitch_MiG-29G_in_flight_over_the_Gulf_of_Mexico_with_a_USAF_McDonnell_Douglas_F-15C_Eagle,_10_June_2003_(6645969).jpeg) · [Photo 2](https://commons.wikimedia.org/wiki/File:Mikoyan-Gurevich_MiG-29G_(c-n_29605_25800,_29%2B14)_1994-05-31_Andre_Gerwing_Collection_ID_030799.jpg) |
| `soviet-blue-10-1988` | Soviet Air Force blue 10, Farnborough 1988 | [Photo 1](https://commons.wikimedia.org/wiki/File:Mikoyan-Gurevich_MiG-29_%22blue_10%22_Russian_Air_Force,_Farnborough_UK,_September_1988._(5589824688).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:Mikoyan-Gurevich_MiG-29_%22blue_10%22_Russian_Air_Force,_Farnborough_UK,_September_1988._(5589226135).jpg) · [Photo 3](https://commons.wikimedia.org/wiki/File:MiG-29_fuselage.jpg) |
| `ukraine-05-digital` | Ukrainian Air Force 05, digital camouflage, 2018 | [Photo 1](https://commons.wikimedia.org/wiki/File:181009-Z-VM449-513_(cropped).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:CLEAR_SKY_2018_(4805844).jpg) |

**Polish Air Force 105, 1.ELT, 2016.** Polish Air Force MiG-29A 105 from the referenced ILA 2016 photograph: dark blue-gray upper surfaces and fins, light gray undersides climbing to the canopy sill on the nose, light gray radome, red bort number 105 on the intakes and the red-and-white checkerboard on the outer fins and both wing surfaces (original vector art). The portrait on the inner fin and all stencils are omitted; colors and the color boundary are approximations.

**Polish Air Force 89, 1.ELT, 2011.** Polish Air Force MiG-29A 89 of 1.ELT from the referenced 2011 photograph: three-gray disruptive camouflage on the upper surfaces and fins (procedural patches standing in for the painted pattern), light gray undersides, gray radome, red 89 on the intakes and checkerboards on the outer fins and wings (original vector art). Stencils omitted; colors approximate.

**Luftwaffe JG 73 29+08, 2003.** Luftwaffe MiG-29G 29+08 of Jagdgeschwader 73 from the referenced 2003 photograph: two-tone light gray upper camouflage (procedural patches), medium gray undersides and intakes, dark radome, the serial 29+08 with its Balkenkreuz on the intakes, small German flags high on the outer fins and crosses on both wing surfaces (original vector art). The JG 73 badge on the fins and the stencils are omitted; colors approximate.

**Soviet Air Force blue 10, Farnborough 1988.** The Soviet MiG-29 "blue 10" shown at Farnborough in 1988, from the referenced photographs: light gray and blue-gray upper camouflage (procedural patches), light undersides, dark radome, red stars with white and red borders on the outer fins and both wing surfaces, and the small blue 10 high on the fins (original vector art). Stencils omitted; colors and patch layout approximate.

**Ukrainian Air Force 05, digital camouflage, 2018.** Ukrainian Air Force MiG-29 05 from the referenced Clear Sky 2018 photographs, applied to the MiG-29A model: three-tone gray digital (pixel) camouflage on the upper surfaces and fins, medium gray undersides, white outlined 05 on the intakes and fin tops, and the blue shield with the gold trident on the outer fins (original vector drawing, simplified). Wing markings are not shown in the photographs and are omitted, as are stencils; the pixel pattern is procedural and colors are approximate.

### North American Rockwell OV-10A Bronco

Type: `molen.entities.aircraft.ov_10`.

[![North American Rockwell OV-10A Bronco livery comparison: USAF Southeast Asia camouflage, Venezuelan Air Force desert camouflage, USAF 601st TASW European One, 1982, USMC VMO-4 tactical gray, 1990, Luftwaffe OV-10B target tug 99+18, Colombian Air Force shark mouth, FAC 2223](https://molen.dev/guide-media/liveries/ov_10.png)](https://molen.dev/guide-media/liveries/ov_10.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `usaf-sea-camouflage` | USAF Southeast Asia camouflage | [Photo 1](https://commons.wikimedia.org/wiki/File:OV-10A_USAF_over_Mekong_delta.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:OV-10A_RThaiAF_1987.JPEG) |
| `venezuelan-desert-camouflage` | Venezuelan Air Force desert camouflage | [Photo](https://commons.wikimedia.org/wiki/File:2641_Rockwell_OV-10E_Bronco_Venezuela_Airforce_(7453147600).jpg) |
| `usaf-601st-tasw-european-one` | USAF 601st TASW European One, 1982 | [Photo](https://commons.wikimedia.org/wiki/File:OV-10As_601st_TASW_over_Germany_1982.JPEG) |
| `usmc-vmo-4-gray` | USMC VMO-4 tactical gray, 1990 | [Photo](https://commons.wikimedia.org/wiki/File:OV-10As_VMO-4_1990.JPEG) |
| `luftwaffe-target-tug` | Luftwaffe OV-10B target tug 99+18 | [Photo](https://commons.wikimedia.org/wiki/File:North_American_Rockwell_OV-10B_Bronco_Luftwaffe_99%2B18,_pic1.JPG) |
| `colombian-shark-gray` | Colombian Air Force shark mouth, FAC 2223 | [Photo](https://commons.wikimedia.org/wiki/File:FAC2223_North_American_OV-10A_Bronco_Colombian_Air_Force_(7501643166).jpg) |

**USAF Southeast Asia camouflage.** USAF OV-10A in the T.O. 1-1-4 Southeast Asia scheme: FS 30219 tan, FS 34102 medium green and FS 34079 dark green over FS 36622 light gray, the pattern generated as organic patches rather than the factory pattern drawing. Pattern and underside split follow the SEA-camouflaged Thai OV-10C photograph; USAF and the serial on the fins and the national insignia on the pod and wings (upper left, lower right) follow the USAF Mekong photograph of 67-14650, which shows that aircraft in its earlier gray. Red PROPELLER stripes, ejection-seat triangles and NO STEP stencils. Colors and the patch pattern are approximations.

**Venezuelan Air Force desert camouflage.** OV-10E 2641 of the Venezuelan Air Force as preserved: sand-pink and gray-green wraparound camouflage (generated patches), the serial on the fins, the unit pennant redrawn as a plain original triangle, Venezuelan flag on the booms and roundels on the wings. Faded colors are approximated; small stencils are omitted.

**USAF 601st TASW European One, 1982.** OV-10A of the 601st Tactical Air Support Wing over Germany in 1982: wraparound European One camouflage (FS 34092 and FS 34102 greens, FS 36081 gunship gray) as generated patches, black USAF and serial on the fins, subdued black national insignia, PROPELLER and ejection-seat stencils. Pattern and colors are approximations.

**USMC VMO-4 tactical gray, 1990.** USMC OV-10A of VMO-4 in 1990: overall tactical gray (about FS 36320), MARINES on the booms, the MU tail code and serial on the fins in darker gray, low-visibility national insignia, PROPELLER and ejection-seat stencils. Serial chosen from the squadron range; colors approximate.

**Luftwaffe OV-10B target tug 99+18.** OV-10B 99+18 in Luftwaffe target-towing colors as restored: olive drab with Day-Glo orange nose panel and nacelle fronts, Balkenkreuz on the booms and wings, 99+18 on the booms, 18 on the nose, German flag on the fins. Colors and panel shapes are approximations.

**Colombian Air Force shark mouth, FAC 2223.** OV-10A FAC 2223 of the Colombian Air Force as preserved: overall dark gray with a shark mouth and eyes on the nose (original drawing), FAC 2223 and the national flag on the fins, the yellow BRONCO fin band, the Air Force roundel on the booms and wings, 2223 under the nose, PROPELLER stripes and ejection-seat triangles. The squadron badge is omitted; colors approximate.

### OH-6

Type: `molen.entities.aircraft.oh6`.

[![OH-6 livery comparison: US Army, 1966, US Army air cavalry scout, Vietnam era, JGSDF two-tone camouflage, Royal Danish Army Hughes 500M, Civil OH-6A, blue and white, Civil Hughes 500, lime green](https://molen.dev/guide-media/liveries/oh6.png)](https://molen.dev/guide-media/liveries/oh6.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `us-army-1966` | US Army, 1966 | [Photo 1](https://commons.wikimedia.org/wiki/File:US_Army_OH-6A_Cayuse.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:67-16506_Hughes_OH-6A_Cayuse_(369A)_(cn_0891)_US_Army._(10880999226).jpg) |
| `us-army-air-cavalry` | US Army air cavalry scout, Vietnam era | [Photo 1](https://commons.wikimedia.org/wiki/File:2019_Royal_International_Air_Tattoo_EGVA_-_Hughes_OH-6A_Cayuse_-_G-OHGA_69-16011_(48372649516).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:US_Army_OH-6A_Cayuse.jpg) |
| `jgsdf-camouflage` | JGSDF two-tone camouflage | [Photo](https://commons.wikimedia.org/wiki/File:JGSDF_Kawasaki_Hughes_OH-6D_(JG-1312_31312)_(5412266743).jpg) |
| `danish-army-500m` | Royal Danish Army Hughes 500M | [Photo](https://commons.wikimedia.org/wiki/File:Danish_OH-6.JPEG) |
| `civil-blue-white` | Civil OH-6A, blue and white | [Photo](https://commons.wikimedia.org/wiki/File:67-16066_Hughes_369_OH-6A_Cayuse_U.S._Army_(7516183628).jpg) |
| `civil-lime-500` | Civil Hughes 500, lime green | [Photo](https://commons.wikimedia.org/wiki/File:Hughes_500_N369FC_FDK_MD1.jpg) |

**US Army, 1966.** US Army OH-6A 12931 as photographed in flight around 1966: FS 34087 olive drab, black UNITED STATES ARMY along the boom and the serial on the transmission fairing, redrawn. Approximate colors and letter sizes.

**US Army air cavalry scout, Vietnam era.** Vietnam-era air cavalry scout ("Loach") as restored on OH-6A 69-16011: olive drab, an orange fin top with black bands and orange stabilizer and strut, a red-white-blue band round the boom, the yellow troop disc and 011 on the transmission fairing, yellow skid toes and black UNITED STATES ARMY on the boom, all redrawn. The nose badge and the minigun are omitted; approximate colors and band positions.

**JGSDF two-tone camouflage.** Japan Ground Self-Defense Force OH-6 after OH-6D 31312: dark green and olive brown camouflage (a generated pattern in those colors, not the exact pattern), hinomaru on the boom and the serial on the transmission fairing. The kanji service title and unit badge are omitted; the OH-6D’s T-tail is not modelled (the OH-6A airframe stands in, as for the JGSDF OH-6J). Approximate colors.

**Royal Danish Army Hughes 500M.** Royal Danish Army Hughes 500M H-203: very dark green overall, the Danish roundel on the aft cabin, the low-visibility code H-203 on the boom, a small Danish flag and the yellow warning band near the tail. The OH-6A airframe stands in for the closely related 500M; approximate colors.

**Civil OH-6A, blue and white.** Civil-operated OH-6A colors and layout from the referenced 2012 photograph: white over a blue belly that sweeps up round the windshield frame, blue transmission fairing and boom spine, blue fin and white lower struts. The door emblem and the aircraft’s Army serial are omitted; registration N4367C is fictional.

**Civil Hughes 500, lime green.** Civil Hughes 500 colors and layout from the referenced photograph: lime green with a navy swoosh from the nose’s lower edge up across the aft cabin and along the boom, navy fin and the registration in large navy italics on the transmission fairing. Operator logos are omitted and N5172F is fictional; the OH-6A airframe stands in for the civil 369.

### P-51D Mustang

Type: `molen.entities.aircraft.p51d`.

[![P-51D Mustang livery comparison: 332nd FG Red Tails, 100th FS 7 Bunnie, 1945, 357th FG C5-T Hurry Home Honey, 1944, 4th FG 334th FS QP-F Sweet Revenge, RAAF 77 Squadron A68-809, 1950, Swedish Air Force J 26, F 16 A](https://molen.dev/guide-media/liveries/p51d.png)](https://molen.dev/guide-media/liveries/p51d.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `332nd-fg-bunnie` | 332nd FG Red Tails, 100th FS 7 Bunnie, 1945 | [Photo 1](https://commons.wikimedia.org/wiki/File:Tuskegee_P-51.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:Full-size_Mock-up_P-51D_Mustang_%E2%80%987_-_569%E2%80%99%E2%80%9CBunnie%E2%80%9D_(50901572238).jpg) |
| `357th-fg-hurry-home-honey` | 357th FG C5-T Hurry Home Honey, 1944 | [Photo 1](https://commons.wikimedia.org/wiki/File:Hurry_Home_Honey_P-51_inflight.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:Two_P-51_Mustangs_of_the_357th_Fighter_Group.jpg) |
| `4th-fg-334th-fs-qp-f` | 4th FG 334th FS QP-F Sweet Revenge | [Photo](https://commons.wikimedia.org/wiki/File:North_American_P-51D-20-NA_Mustang_%E2%80%98QP-F_-_422051%E2%80%99_%E2%80%9CSweet_Revenge%E2%80%9D_(NL68JR)_(31947465468).jpg) |
| `raaf-77-squadron-a68-809` | RAAF 77 Squadron A68-809, 1950 | [Photo](https://commons.wikimedia.org/wiki/File:No._77_Squadron_Mustang_A68-809.jpg) |
| `swedish-air-force-j26` | Swedish Air Force J 26, F 16 A | [Photo](https://commons.wikimedia.org/wiki/File:North_American_Aviation_J_26_(c-n_122-31718,_s-n_26020,_16-A)_2013-08-31_Andre_Gerwing_Collection_ID_012811.jpg) |

**332nd FG Red Tails, 100th FS 7 Bunnie, 1945.** P-51D 44-15569 of the 100th Fighter Squadron, 332nd Fighter Group (Tuskegee Airmen), Italy 1945: natural metal with the group's red tail surfaces and spinner, the red nose ring drawn back to a point along the cowling, yellow wing bands, black 7 and 569, the plain name BUNNIE, 1943 star-and-bar insignia on the fuselage, upper left and lower right wing. Colors and the arrowhead outline are approximations.

**357th FG C5-T Hurry Home Honey, 1944.** P-51D 44-14868 'Hurry Home Honey', C5-T of the 362nd Fighter Squadron, 357th Fighter Group, late 1944: natural metal, the group's red and yellow nose checks and spinner, invasion stripes kept on the lower fuselage and under the wings, C5 and T codes, 414868 on the fin, the plain name on the cowling and 1943 insignia. Check rows and stripe stations follow the group's standard; colors approximate.

**4th FG 334th FS QP-F Sweet Revenge.** P-51D 44-22051 'Sweet Revenge', QP-F of the 334th Fighter Squadron, 4th Fighter Group, as restored: polished natural metal, red spinner and red and white nose checks, the 334th's red rudder, QP and F codes in black outlined red, 422051 on the fin, invasion stripes kept under the fuselage and wings, the plain name on the cowling and 1943 insignia. Kill marks and the pin-up figure are omitted; colors approximate.

**RAAF 77 Squadron A68-809, 1950.** P-51D A68-809 of No. 77 Squadron RAAF, Japan 1950: natural metal with the red, white and blue roundel on the fuselage and wings, the fin flash and the serial A68-809 on the rear fuselage, olive anti-glare panel and dark spinner. Colors approximate.

**Swedish Air Force J 26, F 16 A.** J 26 (P-51D) 26020 of Upplands flygflottilj F 16 as preserved at the Swedish Air Force Museum: natural metal with the three-crown roundels on the fuselage and wings, the yellow wing number 16 on the fuselage and the large blue individual letter A on the fin, yellow spinner. Colors approximate.

### Pilatus PC-12 NGX

Type: `molen.entities.aircraft.pilatus_pc12`.

[![Pilatus PC-12 NGX livery comparison: Pilatus NGX factory scheme, US Air Force U-28A Draco, Finnish Air Force PI-02, Flying doctor air ambulance, red, white and blue, Swiss operator, silver and graphite](https://molen.dev/guide-media/liveries/pilatus_pc12.png)](https://molen.dev/guide-media/liveries/pilatus_pc12.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `factory-ngx-white-red` | Pilatus NGX factory scheme | [Photo](https://commons.wikimedia.org/wiki/File:Pilatus_PC-12-47E_NGX_(N49GX,_cn_2149)_(10-20-2022).jpg) |
| `usaf-u-28a-draco` | US Air Force U-28A Draco | [Photo 1](https://commons.wikimedia.org/wiki/File:U-28_Draco.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:A_U-28A_Draco_at_Hurlburt_Field,_Florida,_September_2,_2022.jpg) |
| `finnish-air-force-pi-02` | Finnish Air Force PI-02 | [Photo](https://commons.wikimedia.org/wiki/File:Pilatus_PC-12_PI-02_Turku_Airshow_2015_01.JPG) |
| `flying-doctor-red-white-blue` | Flying doctor air ambulance, red, white and blue | [Photo](https://commons.wikimedia.org/wiki/File:Royal_Flying_Doctor_Service_of_Australia_(VH-OWR)_Pilatus_PC-12_NG_at_Esperance_Airport.jpg) |
| `swiss-silver-graphite` | Swiss operator, silver and graphite | [Photo](https://commons.wikimedia.org/wiki/File:Pilatus_PC-12_NGX_%E2%80%98HB-FWO%E2%80%99_(52644871206).jpg) |

**Pilatus NGX factory scheme.** Pilatus NGX demonstrator layout from the referenced photograph of N49GX: pearl white overall with paired red and grey swooshes, one sweeping up from the chin along the cabin and one rising over the rear fuselage toward the fin, and a small grey registration. The manufacturer titles are omitted, the registration N68GX is fictional and the swoosh curves are redrawn freehand.

**US Air Force U-28A Draco.** US Air Force Special Operations U-28A Draco from the referenced photographs: medium grey overall with the small US flag over the serial 60581 in light grey on the fin, redrawn as original vector art. Sensor turrets, antennas and the low-visibility stencils are not modelled; the grey is an approximation.

**Finnish Air Force PI-02.** Finnish Air Force PC-12/47E PI-02 from the referenced photograph: light grey overall, FINNISH AIR FORCE above the rear cabin windows, the Finnish roundel and the code PI-02 on the rear fuselage, redrawn as original vector art. Applied to the NGX model; the yellow rescue corners around an exit window are omitted; approximate colors and sizes.

**Flying doctor air ambulance, red, white and blue.** Colors and layout of the Royal Flying Doctor Service from the referenced photograph of VH-OWR: white upper fuselage, red lower fuselage and cowl, a blue stripe sweeping up the tail cone into a blue fin, tailplane and rudder, and a black registration on the rear fuselage. The service's name, RFDS fin letters and emblems are omitted; the registration VH-FXQ is fictional and the paint lines are straight-segment approximations.

**Swiss operator, silver and graphite.** Corporate scheme of the referenced photograph of HB-FWO: silver metallic upper fuselage and wings, graphite lower fuselage under a red pinstripe that sweeps up the tail cone and along a diagonal across the fin, graphite rear fin, rudder and tailplane with the Swiss flag at the fin tip, and the registration on the rear fuselage. The registration HB-FQX is fictional; the red rescue marks are omitted.

### Pilatus PC-6/B2-H4 Turbo Porter

Type: `molen.entities.aircraft.pc_6`.

[![Pilatus PC-6/B2-H4 Turbo Porter livery comparison: Swiss Air Force V-618, Austrian Air Force 3G-EH, AU-23A Peacemaker, Southeast Asia camouflage, Belgian skydiving club, pink, German skydiving operator, white and navy](https://molen.dev/guide-media/liveries/pc_6.png)](https://molen.dev/guide-media/liveries/pc_6.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `swiss-air-force-v-618` | Swiss Air Force V-618 | [Photo](https://commons.wikimedia.org/wiki/File:Swiss_Air_Force_Pilatus_PC-6_V-618_parked_at_IBT'11.jpg) |
| `austrian-air-force-3g-eh` | Austrian Air Force 3G-EH | [Photo](https://commons.wikimedia.org/wiki/File:Pilatus_PC-6_Turbo-Porter_3G-EH_aircraft_02.jpg) |
| `au-23a-peacemaker-sea` | AU-23A Peacemaker, Southeast Asia camouflage | [Photo 1](https://commons.wikimedia.org/wiki/File:Fairchild_AU-23A_Peacemaker_in_flight.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:Fairchild_AU-23A_Peacemaker.jpg) |
| `skydiving-pink` | Belgian skydiving club, pink | [Photo](https://commons.wikimedia.org/wiki/File:Pilatus_PC-6,_OO-PCV.JPG) |
| `skydiving-white-navy` | German skydiving operator, white and navy | [Photo](https://commons.wikimedia.org/wiki/File:Pilatus_PC-6_Turbo_Porter.jpg) |

**Swiss Air Force V-618.** Swiss Air Force PC-6/B2-H2M-1 V-618 from the referenced photograph: two-tone olive green camouflage overall (a generated pattern in the two greens), the serial V-618 in light grey on the rear fuselage and the Swiss marking in a white border above and below the wings, redrawn as original vector art. The unit badges on the nose are omitted; colors and sizes are approximations.

**Austrian Air Force 3G-EH.** Austrian Bundesheer PC-6/B2-H4 3G-EH from the referenced photograph: olive drab overall, the code 3G (national marking) EH in black on the rear fuselage and the national marking (white triangle on a red disc) above and below the wings, redrawn as original vector art. The EUFOR mission titles carried on that deployment are omitted; approximate colors and sizes.

**AU-23A Peacemaker, Southeast Asia camouflage.** Fairchild-built AU-23A Peacemaker in Royal Thai Air Force service from the referenced color photograph: Southeast Asia camouflage of tan, light green and dark green overall (a generated three-color pattern), tan spinner, the sharkmouth on the lower cowling and the tail number 42082 in white on the fin, redrawn as original vector art. The small national roundel and the Thai lettering by the cockpit are too small in the photograph to redraw reliably and are omitted; the US evaluation photograph is a second reference for the camouflage.

**Belgian skydiving club, pink.** Colors of the referenced photograph of a Belgian parachute club Porter (OO-PCV): pink overall with a thin white line along the lower fuselage and a white registration on the rear fuselage. The registration OO-PJX is fictional; the aircraft name, the club artwork on the fin and the manufacturer titles are omitted.

**German skydiving operator, white and navy.** Colors and stripe layout of the referenced photograph of a German drop-zone Turbo Porter (D-FSC.): white overall, a navy band with an amber pinstripe along the cowling and lower fuselage, a navy diagonal across the fin and rudder edged in amber, the German flag at the top of the rudder, navy spinner and a navy registration. The registration D-FJMP is fictional; manufacturer titles are omitted and the band edges are straight-line approximations.

### Piper PA-28-180 Cherokee

Type: `molen.entities.aircraft.pa_28_180`.

[![Piper PA-28-180 Cherokee livery comparison: Cherokee B factory blue, 1964 (UK), Cherokee D factory navy and red, 1968 (UK), Cherokee F factory maroon, 1971 (UK), Cherokee 180 blue tail sweep, 1968 (US)](https://molen.dev/guide-media/liveries/pa_28_180.png)](https://molen.dev/guide-media/liveries/pa_28_180.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `cherokee-b-1964-blue` | Cherokee B factory blue, 1964 (UK) | [Photo](https://commons.wikimedia.org/wiki/File:G-ASHX_Piper_PA-28-180_Cherokee_B_(9693386490).jpg) |
| `cherokee-d-1968-navy-red` | Cherokee D factory navy and red, 1968 (UK) | [Photo](https://commons.wikimedia.org/wiki/File:G-HOCK_Piper_PA-28-180_Cherokee_D_(9693445922).jpg) |
| `cherokee-f-1971-maroon` | Cherokee F factory maroon, 1971 (UK) | [Photo](https://commons.wikimedia.org/wiki/File:G-AZDX_Piper_PA-28-180_Cherokee_F_(9683616211).jpg) |
| `cherokee-1968-blue-sweep` | Cherokee 180 blue tail sweep, 1968 (US) | [Photo](https://commons.wikimedia.org/wiki/File:N6350J_1968_PIPER_PA-28-180_Cherokee_(30272810356).jpg) |

**Cherokee B factory blue, 1964 (UK).** Piper’s 1964 Cherokee B paint from the referenced British aircraft: white over a blue lower fuselage and cowling, two blue pinstripes along the split, the top of the fin blue over two fin pinstripes, and a large white UK registration on the blue (G-ATRB, fictional). Approximate colors.

**Cherokee D factory navy and red, 1968 (UK).** Piper’s 1968 Cherokee D paint from the referenced British aircraft: white with a navy cheatline and pinstripe under the windows, a long red stripe tapering in from the cowling, a red and navy flash rising across the fin and a silver-gray UK registration (G-AVKH, fictional). Wheel-fairing stripes and the owner’s badge are omitted; approximate colors.

**Cherokee F factory maroon, 1971 (UK).** Piper’s early-1970s Cherokee F paint from the referenced British aircraft: maroon lower fuselage, cowling and spinner, a maroon cheatline and black pinstripe above the split, maroon and black bands near the top of the fin, maroon stabilator tips and wheel-fairing bottoms, and a black UK registration (G-AZKR, fictional). Approximate colors.

**Cherokee 180 blue tail sweep, 1968 (US).** A 1968 Cherokee 180 scheme from the referenced US photograph: cream with blue and black cheatlines from the spinner, a black-edged blue sweep over the rear fuselage, blue fin leading edge and cap, and a small white US registration on the blue (N7246J, fictional). Wheel-fairing stripes are omitted; approximate colors.

### Robinson R44 Raven II

Type: `molen.entities.aircraft.robinson_r44`.

[![Robinson R44 Raven II livery comparison: Philippine Army trainer 202, Peruvian Army EP-913, South African Police Service, Black and gold private R44, Alaska tour red](https://molen.dev/guide-media/liveries/robinson_r44.png)](https://molen.dev/guide-media/liveries/robinson_r44.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `philippine-army-202` | Philippine Army trainer 202 | [Photo](https://commons.wikimedia.org/wiki/File:2022-06-17_PA_R44_001.jpg) |
| `peruvian-army-ep-913` | Peruvian Army EP-913 | [Photo](https://commons.wikimedia.org/wiki/File:R44_Raven_I,_Ej%C3%A9rcito_del_Per%C3%BA.jpg) |
| `south-african-police` | South African Police Service | [Photo](https://commons.wikimedia.org/wiki/File:South_African_Police_Robinson_R44_II_ZS-RIC_(31234626902).jpg) |
| `black-r44` | Black and gold private R44 | [Photo](https://commons.wikimedia.org/wiki/File:Black_Robinson_R44.jpg) |
| `alaska-red-and-cream` | Alaska tour red | [Photo](https://commons.wikimedia.org/wiki/File:Helic%C3%B3ptero_Robinson_R44,_Portage,_Alaska,_Estados_Unidos,_2017-08-22,_DD_43.jpg) |

**Philippine Army trainer 202.** Philippine Army R44 training helicopter 202 from the referenced 2022 photograph: metallic silver-grey overall with a grey belt-line stripe, large black 202 on the mast pylon, ARMY on the tail boom behind an aviation wings badge (an original simplified drawing of the unit badge), the Philippine flag and serial 13982 on the fin. The round unit seal on the fin and small stencils are omitted. Colors are approximate.

**Peruvian Army EP-913.** Peruvian Army (Ejército del Perú) R44 Raven I EP-913 from the referenced photograph, applied to the Raven II model: very dark green overall with a white belt-line pinstripe, the serial EP-913 in large white letters on the boom and the Peruvian flag on the fin. The R44 Raven I title, DANGER stencils and crew placards are omitted. Colors are approximate.

**South African Police Service.** South African Police Service R44 II from the referenced photograph: white overall with a blue belt-line pinstripe, POLICE in navy on the rear cabin, the registration in blue italic capitals on the boom and the South African flag on the fin. The registration is fictional (ZS-RJP; the photographed aircraft is ZS-RIC) and the service star badge on the pylon is omitted. Colors are approximate.

**Black and gold private R44.** Privately owned R44 from the referenced photograph: gloss black overall with two thin gold pinstripes sweeping up the rear cabin toward the boom and the registration in orange-red on the boom. The registration is fictional (N447BK) and the stripe curve is simplified to two straight sloping lines. Colors are approximate.

**Alaska tour red.** Alaska flightseeing R44 from the referenced Portage photograph: bright red overall with a cream belt-line pinstripe and a thin white one above it, black skids and the registration in large white italic capitals on the boom. The registration is fictional (N7428A; the photographed aircraft is N99605); the operator name on the pylon and the web address on the cabin are omitted. Colors are approximate.

### Saab JAS 39C Gripen

Type: `molen.entities.aircraft.gripen_c`.

[![Saab JAS 39C Gripen livery comparison: Swedish Air Force, F 7 Skaraborg (228), Czech Air Force, 211th Tactical Squadron (9241), Hungarian Air Force, 59th Tactical Fighter Wing (31), South African Air Force, 2 Squadron (3920), Royal Thai Air Force, 701 Squadron (70106)](https://molen.dev/guide-media/liveries/gripen_c.png)](https://molen.dev/guide-media/liveries/gripen_c.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `sweden-f7-228` | Swedish Air Force, F 7 Skaraborg (228) | [Photo](https://commons.wikimedia.org/wiki/File:JAS_39C_39228.jpg) |
| `czech-211-tactical-squadron` | Czech Air Force, 211th Tactical Squadron (9241) | [Photo](https://commons.wikimedia.org/wiki/File:Saab.jas39c.gripen.taxi.arp.jpg) |
| `hungary-59th-wing-31` | Hungarian Air Force, 59th Tactical Fighter Wing (31) | [Photo](https://commons.wikimedia.org/wiki/File:HUNGARIAN_AIR_FORCE_SAAB_JAS-39C_GRIPEN_31_(52247155611).jpg) |
| `saaf-2-squadron-3920` | South African Air Force, 2 Squadron (3920) | [Photo](https://commons.wikimedia.org/wiki/File:Saab_JAS-39C_Gripen_'3920_-_20'_(16667130587).jpg) |
| `royal-thai-701-squadron-70106` | Royal Thai Air Force, 701 Squadron (70106) | [Photo 1](https://commons.wikimedia.org/wiki/File:Saab_JAS_39_Gripen_70106_(Royal_Thai_Air_Force)_in_Australia.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:RATF_GRIPEN_C.JPG) · [Photo 3](https://commons.wikimedia.org/wiki/File:Roundel_of_Thailand.svg) |

**Swedish Air Force, F 7 Skaraborg (228).** JAS 39C 39228 from the referenced photograph: Saab medium gray with a lighter belly, the tactical number 228 in dark gray on the fin, the low-visibility Swedish roundel (dark ring and three crowns, original drawing) on the forward fuselage and above and below both wings. The F 7 wing badge on the nose and the small stencils are omitted.

**Czech Air Force, 211th Tactical Squadron (9241).** JAS 39C 9241 of the 21st Tactical Air Force Base, Caslav, from the referenced photograph: Saab two-gray scheme, the low-visibility Czech roundel on the fin (outline, solid blue sector, hatched red sector, blue sector leading on both sides) with CZECH AIR FORCE beneath, JAS 39C on the lower fin, the serial 9241 on the nose and the same roundel on the wings. Stencils are omitted.

**Hungarian Air Force, 59th Tactical Fighter Wing (31).** JAS 39C 31 of the 59th Tactical Fighter Wing, Kecskemet, from the referenced photograph: Saab two-gray scheme, the large dark gray 31 on the forward fuselage, and on the fin the low-visibility national triangle (white outline round gray bands, apex forward), the wing falcon badge (simplified) and HUNAF 59th TFW. The small nose badge, stencils and wing markings are omitted (not visible in the reference).

**South African Air Force, 2 Squadron (3920).** JAS 39C 3920 of 2 Squadron, AFB Makhado, from the referenced photograph: Saab two-gray scheme, the full-color South African flag at the top of the fin (hoist forward on both sides), the squadron badge disc (simplified bird and scroll) and the number 20 on the fin, and the low-visibility Castle roundel with its eagle (simplified) on the nose. Stencils and wing markings are omitted.

**Royal Thai Air Force, 701 Squadron (70106).** JAS 39C 70106 of 701 Squadron, Wing 7 Surat Thani, from the referenced photographs: the Saab two-gray scheme (the photographed underside is a uniform light gray without wing roundels), the flag of Thailand at the top of the fin, the white leaping shark of 701 Squadron (original silhouette, leaping forward on both sides) and 70106 in dark gray on the fin, and the RTAF roundel (red, white, navy, white, red) on the rear fuselage below the fin. Stencils are omitted.

### Sikorsky UH-60M Black Hawk

Type: `molen.entities.aircraft.uh_60m`.

[![Sikorsky UH-60M Black Hawk livery comparison: US Army, US Army HH-60M MEDEVAC, Swedish Armed Forces Hkp 16, Lithuanian Air Force, Mexican Navy](https://molen.dev/guide-media/liveries/uh_60m.png)](https://molen.dev/guide-media/liveries/uh_60m.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `us-army` | US Army | [Photo 1](https://commons.wikimedia.org/wiki/File:RS24-_1st_Battalion_-_150th_Aviation_Regiment_prepares_UH-60M_Black_Hawk_for_operations_(8447133).jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:A_U.S._Army_UH-60M_Black_Hawk_helicopter_assigned_to_Charlie_Company%2C_2nd_Battalion%2C_10th_Combat_Aviation_Brigade%2C_Task_Force_Knighthawk_flies_a_personnel_movement_mission_Dec._23%2C_2013%2C_over_Kabul_131223-A-MH207-006.jpg) |
| `us-army-hh60m-medevac` | US Army HH-60M MEDEVAC | [Photo 1](https://commons.wikimedia.org/wiki/File:A_U.S._Army_HH-60M_Blackhawk_medical_evacuation_(medevac)_helicopter_of_Army_Task_Force_Lift_%22Dust_Off%22%2C_Charlie_Company_1-171%2C_Aviation_Regiment%2C_departs_for_mission%2C_Forward_Operating_Base_Edinburgh%2C_Helmand_111209-M-CL319-178.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:Sikorsky_HH-60_MEDEVAC_Black_Hawk_Helicopter_MOD_45162031.jpg) · [Photo 3](https://commons.wikimedia.org/wiki/File:Oregon_Army_National_Guard_HH-60M_Blackhawk_helicopter_(9576423831).jpg) |
| `swedish-hkp16` | Swedish Armed Forces Hkp 16 | [Photo 1](https://commons.wikimedia.org/wiki/File:Swedish_Black_Hawk_at_Turku_Airshow_2023.jpg) · [Photo 2](https://commons.wikimedia.org/wiki/File:06_UH-60M_Black_Hawk_Swedish_AF_Flygdagarna_2026_01.jpg) |
| `lithuanian-air-force` | Lithuanian Air Force | [Photo](https://commons.wikimedia.org/wiki/File:Lithuanian_Air_Force_UH-60M_Black_Hawk_helicopter_in_flight.jpg) |
| `mexican-navy` | Mexican Navy | [Photo](https://commons.wikimedia.org/wiki/File:Sikorsky_UH-60M_Black_Hawk%2C_Mexico_-_Navy_JP7602302.jpg) |

**US Army.** US Army UH-60M: FS 34031 aircraft green overall, black UNITED STATES ARMY on the tail cone and the serial on the pylon, as photographed; no national insignia, per current Army practice. The serial 09-20208 is illustrative of the M-model series. Approximate colors and letter sizes.

**US Army HH-60M MEDEVAC.** US Army HH-60M MEDEVAC (Dust Off): aircraft green with red crosses on white on the nose, both nose sides, the cabin doors and the belly, black UNITED STATES ARMY on the tail cone and a pylon serial (11-20339, illustrative). The UH-60M model stands in for the HH-60M (no rescue hoist or FLIR turret); approximate cross sizes.

**Swedish Armed Forces Hkp 16.** Swedish Armed Forces Hkp 16 (UH-60M) as photographed at Turku 2023 and Flygdagarna 2026: dark green overall with the low-visibility three-crowns roundel and SWEDISH ARMED FORCES title on the tail cone and the code 06 on the pylon, all in a darker grey-green, redrawn. Approximate colors and sizes.

**Lithuanian Air Force.** Lithuanian Air Force UH-60M 62: medium blue-grey overall, LITHUANIAN AIR FORCE on the tail cone, the national flag and the code 62 on the engine nacelles and the white Cross of Vytis on the pylon, all redrawn. Approximate colors and sizes.

**Mexican Navy.** Mexican Navy UH-60M AMHA-302 (Toluca 2013): light grey overall, MARINA in bold black on the sliding doors, the naval aviation triangle on the engine nacelles, a large outlined 302 and the registration, redrawn. The navy crest beneath the triangle is omitted, and the outlined number sits on the aft cabin rather than across the door windows. Approximate colors.

## Cars, trucks and RVs

### 2005 Chevrolet SSR

Type: `molen.entities.vehicle.chevrolet_ssr_2005`.

[![2005 Chevrolet SSR livery comparison: Redline Red, Silver](https://molen.dev/guide-media/liveries/chevrolet_ssr_2005.png)](https://molen.dev/guide-media/liveries/chevrolet_ssr_2005.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `redline-red` | Redline Red | [Photo](https://commons.wikimedia.org/wiki/File:2005_Chevrolet_SSR_in_Redline_Red,_Front_Right,_07-31-2022.jpg) |
| `silver` | Silver | [Photo](https://commons.wikimedia.org/wiki/File:2005_Chevrolet_SSR,_front_right,_06-15-2024.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2005 Ford GT

Type: `molen.entities.vehicle.ford_gt_2005`.

[![2005 Ford GT livery comparison: Midnight blue and silver, Black and silver](https://molen.dev/guide-media/liveries/ford_gt_2005.png)](https://molen.dev/guide-media/liveries/ford_gt_2005.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `midnight-blue-and-silver` | Midnight blue and silver | [Photo](https://commons.wikimedia.org/wiki/File:2005_Ford_GT_7.jpg) |
| `black-and-silver` | Black and silver | [Photo](https://commons.wikimedia.org/wiki/File:2005_Ford_GT_at_Chelsea_Auto_Legends_2012,_London_(Ank_Kumar)_01.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2006 Chrysler PT Cruiser

Type: `molen.entities.vehicle.chrysler_pt_cruiser_2006`.

[![2006 Chrysler PT Cruiser livery comparison: Silver, Touring blue](https://molen.dev/guide-media/liveries/chrysler_pt_cruiser_2006.png)](https://molen.dev/guide-media/liveries/chrysler_pt_cruiser_2006.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `silver` | Silver | [Photo](https://commons.wikimedia.org/wiki/File:2006_Chrysler_PT_Cruiser_(PG_MY06)_Limited_hatchback_(2015-06-15)_01.jpg) |
| `touring-blue` | Touring blue | [Photo](https://commons.wikimedia.org/wiki/File:2006_Chrysler_PT_Cruiser_Touring_2.4_Front.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2006 Scion xB

Type: `molen.entities.vehicle.scion_xb_2006`.

[![2006 Scion xB livery comparison: Silver, Burgundy](https://molen.dev/guide-media/liveries/scion_xb_2006.png)](https://molen.dev/guide-media/liveries/scion_xb_2006.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `silver` | Silver | [Photo](https://commons.wikimedia.org/wiki/File:2006_Scion_xB_.jpg) |
| `burgundy` | Burgundy | [Photo](https://commons.wikimedia.org/wiki/File:2006_Scion_xB_with_Toyota_bB_badge_and_Japanese_plate_(LHD).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2007 Hummer H3

Type: `molen.entities.vehicle.hummer_h3_2007`.

[![2007 Hummer H3 livery comparison: Silver, Black](https://molen.dev/guide-media/liveries/hummer_h3_2007.png)](https://molen.dev/guide-media/liveries/hummer_h3_2007.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `silver` | Silver | [Photo](https://commons.wikimedia.org/wiki/File:2007_Hummer_H3_--_NHTSA.jpg) |
| `black` | Black | [Photo](https://commons.wikimedia.org/wiki/File:2007_Hummer_H3_wagon_(22837607164).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2007 Pontiac Solstice

Type: `molen.entities.vehicle.pontiac_solstice_2007`.

[![2007 Pontiac Solstice livery comparison: Red, Yellow](https://molen.dev/guide-media/liveries/pontiac_solstice_2007.png)](https://molen.dev/guide-media/liveries/pontiac_solstice_2007.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `red` | Red | [Photo](https://commons.wikimedia.org/wiki/File:2007_Pontiac_Solstice_(34168415513).jpg) |
| `yellow` | Yellow | [Photo](https://commons.wikimedia.org/wiki/File:2024_Downtown_West_Allis_Classic_Car_Show_12_(2007_Pontiac_Solstice).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2008 Honda Element

Type: `molen.entities.vehicle.honda_element_2008`.

[![2008 Honda Element livery comparison: Silver, EX green](https://molen.dev/guide-media/liveries/honda_element_2008.png)](https://molen.dev/guide-media/liveries/honda_element_2008.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `silver` | Silver | [Photo](https://commons.wikimedia.org/wiki/File:2008_silver_Honda_Element_side.JPG) |
| `ex-green` | EX green | [Photo](https://commons.wikimedia.org/wiki/File:2008_Honda_Element_EX,_front_left,_07-25-2026.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2008 Volvo V70

Type: `molen.entities.vehicle.volvo_v70_2008`.

[![2008 Volvo V70 livery comparison: Blue, Silver beige](https://molen.dev/guide-media/liveries/volvo_v70_2008.png)](https://molen.dev/guide-media/liveries/volvo_v70_2008.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `blue` | Blue | [Photo](https://commons.wikimedia.org/wiki/File:2008_Volvo_V70,_Avesta.jpg) |
| `silver-beige` | Silver beige | [Photo](https://commons.wikimedia.org/wiki/File:2008_Volvo_V70_front.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2009 Nissan 370Z

Type: `molen.entities.vehicle.nissan_370z_2009`.

[![2009 Nissan 370Z livery comparison: Yellow, Black](https://molen.dev/guide-media/liveries/nissan_370z_2009.png)](https://molen.dev/guide-media/liveries/nissan_370z_2009.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `yellow` | Yellow | [Photo](https://commons.wikimedia.org/wiki/File:2009_Nissan_370Z_(3076564746).jpg) |
| `black` | Black | [Photo](https://commons.wikimedia.org/wiki/File:Tino_Rossini%27s_Reviews_-_009_-_2009_Nissan_370Z.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2009 Smart fortwo

Type: `molen.entities.vehicle.smart_fortwo_2009`.

[![2009 Smart fortwo livery comparison: Blue and silver, Rally Red](https://molen.dev/guide-media/liveries/smart_fortwo_2009.png)](https://molen.dev/guide-media/liveries/smart_fortwo_2009.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `blue-and-silver` | Blue and silver | [Photo](https://commons.wikimedia.org/wiki/File:2009_smart_fortwo_passion_coupe_in_blue_metallic,_Rear_Left,_2024-03-12.jpg) |
| `rally-red` | Rally Red | [Photo](https://commons.wikimedia.org/wiki/File:2009_Smart_Fortwo_Pure_in_Rally_Red,_Front_Left,_05-17-2022.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2010 Cadillac CTS

Type: `molen.entities.vehicle.cadillac_cts_2010`.

[![2010 Cadillac CTS livery comparison: White, Red study](https://molen.dev/guide-media/liveries/cadillac_cts_2010.png)](https://molen.dev/guide-media/liveries/cadillac_cts_2010.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `white` | White | [Photo](https://commons.wikimedia.org/wiki/File:2010_Cadillac_CTS_sedan_--_10-30-2009.jpg) |
| `red-study` | Red study | [Photo](https://commons.wikimedia.org/wiki/File:2010_Cadillac_CTS_wagon--DC.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2010 Toyota FJ Cruiser

Type: `molen.entities.vehicle.toyota_fj_cruiser_2010`.

[![2010 Toyota FJ Cruiser livery comparison: Blue and white, Green and white](https://molen.dev/guide-media/liveries/toyota_fj_cruiser_2010.png)](https://molen.dev/guide-media/liveries/toyota_fj_cruiser_2010.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `blue-and-white` | Blue and white | [Photo](https://commons.wikimedia.org/wiki/File:2010_Toyota_FJ_Cruiser_(GSJ15R)_wagon_(2010-10-16)_02.jpg) |
| `green-and-white` | Green and white | [Photo](https://commons.wikimedia.org/wiki/File:2010_Toyota_FJ_Cruiser.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2011 Chevrolet Volt

Type: `molen.entities.vehicle.chevrolet_volt_2011`.

[![2011 Chevrolet Volt livery comparison: White, Black](https://molen.dev/guide-media/liveries/chevrolet_volt_2011.png)](https://molen.dev/guide-media/liveries/chevrolet_volt_2011.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `white` | White | [Photo](https://commons.wikimedia.org/wiki/File:2011_Chevrolet_Volt_--_NHTSA_1.jpg) |
| `black` | Black | [Photo](https://commons.wikimedia.org/wiki/File:2011_Chevrolet_Volt_--_NHTSA_2.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2011 Saab 9-3 SportCombi

Type: `molen.entities.vehicle.saab_9_3_sportcombi_2011`.

[![2011 Saab 9-3 SportCombi livery comparison: Black, Aero red](https://molen.dev/guide-media/liveries/saab_9_3_sportcombi_2011.png)](https://molen.dev/guide-media/liveries/saab_9_3_sportcombi_2011.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `black` | Black | [Photo](https://commons.wikimedia.org/wiki/File:Saab_9-3_SportCombi_1.9_TTiD_(YS3F,_Facelift)_%E2%80%93_Frontansicht,_13._M%C3%A4rz_2011,_W%C3%BClfrath.jpg) |
| `aero-red` | Aero red | [Photo](https://commons.wikimedia.org/wiki/File:Saab_9-3_SportCombi_Aero_East_Burke_VT_August_2018_rear.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2012 Fiat 500

Type: `molen.entities.vehicle.fiat_500_2012`.

[![2012 Fiat 500 livery comparison: Sport red, Pop pale green](https://molen.dev/guide-media/liveries/fiat_500_2012.png)](https://molen.dev/guide-media/liveries/fiat_500_2012.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `sport-red` | Sport red | [Photo](https://commons.wikimedia.org/wiki/File:2012_FIAT_500_Sport,_front_right,_09-09-2023.jpg) |
| `pop-pale-green` | Pop pale green | [Photo](https://commons.wikimedia.org/wiki/File:2012_Fiat_500_Pop.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2012 MINI Cooper Countryman

Type: `molen.entities.vehicle.mini_cooper_countryman_2012`.

[![2012 MINI Cooper Countryman livery comparison: Orange and black, White](https://molen.dev/guide-media/liveries/mini_cooper_countryman_2012.png)](https://molen.dev/guide-media/liveries/mini_cooper_countryman_2012.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `orange-and-black` | Orange and black | [Photo](https://commons.wikimedia.org/wiki/File:2012_Mini_Countryman_in_Cyberjaya,_Malaysia_(01).jpg) |
| `white` | White | [Photo](https://commons.wikimedia.org/wiki/File:2012_Mini_Countryman_--_03-24-2012_1.JPG) |

**Orange and black.** Orange body and black roof studied from the linked Countryman photograph. The roof is projected onto the body shell; glass and interior retain their own materials. Color values and the roof perimeter are approximate.

**White.** Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2012 Nissan Leaf

Type: `molen.entities.vehicle.nissan_leaf_2012`.

[![2012 Nissan Leaf livery comparison: Blue, Red](https://molen.dev/guide-media/liveries/nissan_leaf_2012.png)](https://molen.dev/guide-media/liveries/nissan_leaf_2012.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `blue` | Blue | [Photo](https://commons.wikimedia.org/wiki/File:2012_Nissan_Leaf.jpg) |
| `red` | Red | [Photo](https://commons.wikimedia.org/wiki/File:Nissan_Leaf_(2012).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2013 Acura TL

Type: `molen.entities.vehicle.acura_tl_2013`.

[![2013 Acura TL livery comparison: Silver, Black study](https://molen.dev/guide-media/liveries/acura_tl_2013.png)](https://molen.dev/guide-media/liveries/acura_tl_2013.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `silver` | Silver | [Photo](https://commons.wikimedia.org/wiki/File:Acura-tl-2007washauto.jpg) |
| `black-study` | Black study | [Photo](https://commons.wikimedia.org/wiki/File:2006_Acura_TL_A-Spec_at_the_beach.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2013 MINI Cooper

Type: `molen.entities.vehicle.mini_cooper_2013`.

[![2013 MINI Cooper livery comparison: Red, Cooper S black](https://molen.dev/guide-media/liveries/mini_cooper_2013.png)](https://molen.dev/guide-media/liveries/mini_cooper_2013.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `red` | Red | [Photo](https://commons.wikimedia.org/wiki/File:2013_Mini_Cooper_Convertible.png) |
| `cooper-s-black` | Cooper S black | [Photo](https://commons.wikimedia.org/wiki/File:2013_Mini_Cooper_S_(9267259147).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2014 Chevrolet Corvette

Type: `molen.entities.vehicle.chevrolet_corvette_2014`.

[![2014 Chevrolet Corvette livery comparison: Stingray white, Z06 red](https://molen.dev/guide-media/liveries/chevrolet_corvette_2014.png)](https://molen.dev/guide-media/liveries/chevrolet_corvette_2014.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `stingray-white` | Stingray white | [Photo](https://commons.wikimedia.org/wiki/File:2014_Chevrolet_Corvette_C7_Stingray.jpg) |
| `z06-red` | Z06 red | [Photo](https://commons.wikimedia.org/wiki/File:2014-2019_Chevrolet_Corvette_Z06,_red,_Golden_Super_Cruise_2026-10-03.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2014 Subaru BRZ

Type: `molen.entities.vehicle.subaru_brz_2014`.

[![2014 Subaru BRZ livery comparison: Silver, Black](https://molen.dev/guide-media/liveries/subaru_brz_2014.png)](https://molen.dev/guide-media/liveries/subaru_brz_2014.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `silver` | Silver | [Photo](https://commons.wikimedia.org/wiki/File:Subaru_BRZ_2014.jpg) |
| `black` | Black | [Photo](https://commons.wikimedia.org/wiki/File:Subaru_BRZ_2014-04-14_01-36.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2015 Chrysler 300

Type: `molen.entities.vehicle.chrysler_300_2015`.

[![2015 Chrysler 300 livery comparison: Gray, 300S black](https://molen.dev/guide-media/liveries/chrysler_300_2015.png)](https://molen.dev/guide-media/liveries/chrysler_300_2015.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `gray` | Gray | [Photo](https://commons.wikimedia.org/wiki/File:2015_Chrysler_300_front_4.8.18.jpg) |
| `300s-black` | 300S black | [Photo](https://commons.wikimedia.org/wiki/File:Chrysler_300S_(2015)_IMG_7734.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2015 Kia Soul

Type: `molen.entities.vehicle.kia_soul_2015`.

[![2015 Kia Soul livery comparison: Solar Yellow, White](https://molen.dev/guide-media/liveries/kia_soul_2015.png)](https://molen.dev/guide-media/liveries/kia_soul_2015.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `solar-yellow` | Solar Yellow | [Photo](https://commons.wikimedia.org/wiki/File:2015_Kia_Soul_EX_in_Solar_Yellow,_front_left,_2024-10-06.jpg) |
| `white` | White | [Photo](https://commons.wikimedia.org/wiki/File:Kia_Soul_1.6_EX_2015_(16529530157).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2016 Mazda MX-5 Miata

Type: `molen.entities.vehicle.mazda_mx_5_miata_2016`.

[![2016 Mazda MX-5 Miata livery comparison: Grand Touring red, Pale blue gray](https://molen.dev/guide-media/liveries/mazda_mx_5_miata_2016.png)](https://molen.dev/guide-media/liveries/mazda_mx_5_miata_2016.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `grand-touring-red` | Grand Touring red | [Photo](https://commons.wikimedia.org/wiki/File:2016_Mazda_MX-5_Miata_Grand_Touring,_front_left,_06-13-2026.jpg) |
| `pale-blue-gray` | Pale blue gray | [Photo](https://commons.wikimedia.org/wiki/File:2016_Mazda_MX-5_Sport_NAV_1.5_Front.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2016 Volkswagen Golf GTI

Type: `molen.entities.vehicle.volkswagen_golf_gti_2016`.

[![2016 Volkswagen Golf GTI livery comparison: Night Blue Metallic, Clubsport red](https://molen.dev/guide-media/liveries/volkswagen_golf_gti_2016.png)](https://molen.dev/guide-media/liveries/volkswagen_golf_gti_2016.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `night-blue-metallic` | Night Blue Metallic | [Photo](https://commons.wikimedia.org/wiki/File:2016_Volkswagen_Golf_GTI_S_in_Night_Blue_Metallic,_front_left,_07-04-2026.jpg) |
| `clubsport-red` | Clubsport red | [Photo](https://commons.wikimedia.org/wiki/File:2016_Volkswagen_Golf_GTi_Clubsport_S_(66298).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2017 BMW i3

Type: `molen.entities.vehicle.bmw_i3_2017`.

[![2017 BMW i3 livery comparison: Gray, Blue](https://molen.dev/guide-media/liveries/bmw_i3_2017.png)](https://molen.dev/guide-media/liveries/bmw_i3_2017.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `gray` | Gray | [Photo](https://commons.wikimedia.org/wiki/File:2017_BMW_i3_Front.jpg) |
| `blue` | Blue | [Photo](https://commons.wikimedia.org/wiki/File:Osaka_Motor_Show_2017_(77)_-_BMW_i3_ATELIER_(DLA-1Z06).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2017 Porsche 911

Type: `molen.entities.vehicle.porsche_911_2017`.

[![2017 Porsche 911 livery comparison: Carrera GTS blue, GT3 red](https://molen.dev/guide-media/liveries/porsche_911_2017.png)](https://molen.dev/guide-media/liveries/porsche_911_2017.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `carrera-gts-blue` | Carrera GTS blue | [Photo](https://commons.wikimedia.org/wiki/File:2017_Porsche_911_Carrera_GTS.jpg) |
| `gt3-red` | GT3 red | [Photo](https://commons.wikimedia.org/wiki/File:2017_Porsche_911_991_GT3_7.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2018 Alfa Romeo Giulia

Type: `molen.entities.vehicle.alfa_romeo_giulia_2018`.

[![2018 Alfa Romeo Giulia livery comparison: Red, Quadrifoglio blue](https://molen.dev/guide-media/liveries/alfa_romeo_giulia_2018.png)](https://molen.dev/guide-media/liveries/alfa_romeo_giulia_2018.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `red` | Red | [Photo](https://commons.wikimedia.org/wiki/File:2018_Alfa_Romeo_Giulia_(952)_sedan_(2018-11-22)_01.jpg) |
| `quadrifoglio-blue` | Quadrifoglio blue | [Photo](https://commons.wikimedia.org/wiki/File:2018_Alfa_Romeo_Giulia_Quadrifoglio_Blue.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2018 Dodge Challenger

Type: `molen.entities.vehicle.dodge_challenger_2018`.

[![2018 Dodge Challenger livery comparison: RT gray, Hemi green](https://molen.dev/guide-media/liveries/dodge_challenger_2018.png)](https://molen.dev/guide-media/liveries/dodge_challenger_2018.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `rt-gray` | RT gray | [Photo](https://commons.wikimedia.org/wiki/File:2018_Dodge_Challenger_RT,_Front_Left,_09-25-2021.jpg) |
| `hemi-green` | Hemi green | [Photo](https://commons.wikimedia.org/wiki/File:Dodge_Challenger_Hemi_(Auto_classique_VACM_2018).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2019 Acura MDX

Type: `molen.entities.vehicle.acura_mdx_2019`.

[![2019 Acura MDX livery comparison: White, Dark blue](https://molen.dev/guide-media/liveries/acura_mdx_2019.png)](https://molen.dev/guide-media/liveries/acura_mdx_2019.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `white` | White | [Photo](https://commons.wikimedia.org/wiki/File:2019_Acura_MDX_SH-AWD_front_in_white_NYIAS_2019.jpg) |
| `dark-blue` | Dark blue | [Photo](https://commons.wikimedia.org/wiki/File:Acura_MDX_III_Hybrid_facelift_China_2018-04-03.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2019 Jaguar I-PACE

Type: `molen.entities.vehicle.jaguar_i_pace_2019`.

[![2019 Jaguar I-PACE livery comparison: Caesium Blue, First Edition red](https://molen.dev/guide-media/liveries/jaguar_i_pace_2019.png)](https://molen.dev/guide-media/liveries/jaguar_i_pace_2019.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `caesium-blue` | Caesium Blue | [Photo](https://commons.wikimedia.org/wiki/File:2019_Jaguar_I-Pace_in_Caesium_Blue.jpg) |
| `first-edition-red` | First Edition red | [Photo](https://commons.wikimedia.org/wiki/File:Osaka_Motor_Show_2019_(115)_-_Jaguar_I-PACE_FIRST_EDITION_(ZAA-DH1AA).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2019 Mercedes-Benz Sprinter

Type: `molen.entities.vehicle.mercedes_benz_sprinter_2019`.

[![2019 Mercedes-Benz Sprinter livery comparison: White, Charcoal](https://molen.dev/guide-media/liveries/mercedes_benz_sprinter_2019.png)](https://molen.dev/guide-media/liveries/mercedes_benz_sprinter_2019.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `white` | White | [Photo](https://commons.wikimedia.org/wiki/File:2019_Mercedes-Benz_Sprinter_314_CDi_2.1.jpg) |
| `charcoal` | Charcoal | [Photo](https://commons.wikimedia.org/wiki/File:Mercedes-Benz_Sprinter_BBQ_Qu%C3%A9bec_(Grand_Prix_Weekend_In_Little_Italy_2019).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2020 Hyundai Veloster

Type: `molen.entities.vehicle.hyundai_veloster_2020`.

[![2020 Hyundai Veloster livery comparison: Red, N pale blue](https://molen.dev/guide-media/liveries/hyundai_veloster_2020.png)](https://molen.dev/guide-media/liveries/hyundai_veloster_2020.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `red` | Red | [Photo](https://commons.wikimedia.org/wiki/File:2019_Hyundai_Veloster_1.6_Turbo.jpg) |
| `n-pale-blue` | N pale blue | [Photo](https://commons.wikimedia.org/wiki/File:2019_Hyundai_Veloster_N_front_4.2.18.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2020 Lincoln Continental

Type: `molen.entities.vehicle.lincoln_continental_2020`.

[![2020 Lincoln Continental livery comparison: Infinite Black, Reserve white](https://molen.dev/guide-media/liveries/lincoln_continental_2020.png)](https://molen.dev/guide-media/liveries/lincoln_continental_2020.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `infinite-black` | Infinite Black | [Photo](https://commons.wikimedia.org/wiki/File:2020_Lincoln_Continental_Reserve_Luxury_Package_in_Infinite_Black,_Front_Left,_05-18-2023.jpg) |
| `reserve-white` | Reserve white | [Photo](https://commons.wikimedia.org/wiki/File:2018_Lincoln_Continental_Reserve,_Rear_Right,_05-18-2020.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2021 Audi TT

Type: `molen.entities.vehicle.audi_tt_2021`.

[![2021 Audi TT livery comparison: Blue, White](https://molen.dev/guide-media/liveries/audi_tt_2021.png)](https://molen.dev/guide-media/liveries/audi_tt_2021.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `blue` | Blue | [Photo](https://commons.wikimedia.org/wiki/File:2021_Audi_TT.jpg) |
| `white` | White | [Photo](https://commons.wikimedia.org/wiki/File:Audi_TT_45_TFSI_(2021)_(54708481113).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2021 Ford Transit

Type: `molen.entities.vehicle.ford_transit_2021`.

[![2021 Ford Transit livery comparison: Red, White](https://molen.dev/guide-media/liveries/ford_transit_2021.png)](https://molen.dev/guide-media/liveries/ford_transit_2021.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `red` | Red | [Photo](https://commons.wikimedia.org/wiki/File:Ford_Transit_2.2_TDCi_2021.jpg) |
| `white` | White | [Photo](https://commons.wikimedia.org/wiki/File:2021_Ford_Transit_460_Leader_EcoBlue.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2022 Hyundai IONIQ 5

Type: `molen.entities.vehicle.hyundai_ioniq_5_2022`.

[![2022 Hyundai IONIQ 5 livery comparison: White, Blue](https://molen.dev/guide-media/liveries/hyundai_ioniq_5_2022.png)](https://molen.dev/guide-media/liveries/hyundai_ioniq_5_2022.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `white` | White | [Photo](https://commons.wikimedia.org/wiki/File:2022_Hyundai_Ioniq_5_Signature.jpg) |
| `blue` | Blue | [Photo](https://commons.wikimedia.org/wiki/File:2022_Hyundai_Ioniq_5.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2022 Lucid Air

Type: `molen.entities.vehicle.lucid_air_2022`.

[![2022 Lucid Air livery comparison: Gray, Bronze](https://molen.dev/guide-media/liveries/lucid_air_2022.png)](https://molen.dev/guide-media/liveries/lucid_air_2022.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `gray` | Gray | [Photo](https://commons.wikimedia.org/wiki/File:2022_Lucid_Air_(65592).jpg) |
| `bronze` | Bronze | [Photo](https://commons.wikimedia.org/wiki/File:2022_Lucid_Air_(66341).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2022 Winnebago View 24D

Type: `molen.entities.vehicle.winnebago_view_2022`.

[![2022 Winnebago View 24D livery comparison: Bay Mist II study, Silver and charcoal study](https://molen.dev/guide-media/liveries/rv.png)](https://molen.dev/guide-media/liveries/rv.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `bay-mist-ii-study` | Bay Mist II study | [Photo](https://www.cflrv.com/2022-winnebago-view-24d-used-miscellaneous-apopka-fl-32703-i4152488) |
| `silver-and-charcoal-study` | Silver and charcoal study | [Photo](https://www.motorhomesoftexas.com/inventory/2022-winnebago-view-p1457) |

**Bay Mist II study.** Exterior paint and broad graphic layout studied from 2022 Winnebago View 24D, Bay Mist II, stock 5511. The photographed View 24D graphic is adapted to this View body. Colors and mask edges are visual approximations. Unlisted lettering, small stencils and complex emblems are omitted; this is a photo-based adaptation, not a certified replica.

**Silver and charcoal study.** Exterior paint and broad graphic layout studied from 2022 Winnebago View, stock P1457, exterior photograph. The photographed View 24D graphic is adapted to this View body. Colors and mask edges are visual approximations. Unlisted lettering, small stencils and complex emblems are omitted; this is a photo-based adaptation, not a certified replica.

### 2023 Land Rover Defender 90

Type: `molen.entities.vehicle.land_rover_defender_90_2023`.

[![2023 Land Rover Defender 90 livery comparison: 75th Edition green, Silver](https://molen.dev/guide-media/liveries/land_rover_defender_90_2023.png)](https://molen.dev/guide-media/liveries/land_rover_defender_90_2023.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `75th-edition-green` | 75th Edition green | [Photo](https://commons.wikimedia.org/wiki/File:2023_Land_Rover_Defender_90_75th_Edition.jpg) |
| `silver` | Silver | [Photo](https://commons.wikimedia.org/wiki/File:2023_Land_Rover_Defender_90.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2023 Rivian R1T

Type: `molen.entities.vehicle.rivian_r1t_2023`.

[![2023 Rivian R1T livery comparison: Forest green, Blue](https://molen.dev/guide-media/liveries/rivian_r1t_2023.png)](https://molen.dev/guide-media/liveries/rivian_r1t_2023.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `forest-green` | Forest green | [Photo](https://commons.wikimedia.org/wiki/File:Rivian_R1T_(2023)_(53487999620).jpg) |
| `blue` | Blue | [Photo](https://commons.wikimedia.org/wiki/File:Rivian_R1T_(52730220537).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 BYD Qin Plus DM-i

Type: `molen.entities.vehicle.byd_qin_plus_2024`.

[![2024 BYD Qin Plus DM-i livery comparison: EV white, DM-i red](https://molen.dev/guide-media/liveries/byd_qin_plus_2024.png)](https://molen.dev/guide-media/liveries/byd_qin_plus_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `ev-white` | EV white | [Photo](https://commons.wikimedia.org/wiki/File:BYD_Qin_Plus_EV_005.jpg) |
| `dm-i-red` | DM-i red | [Photo](https://commons.wikimedia.org/wiki/File:BYD_Qin_Plus_001.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 BYD Seagull

Type: `molen.entities.vehicle.byd_seagull_2024`.

[![2024 BYD Seagull livery comparison: Lime, White](https://molen.dev/guide-media/liveries/byd_seagull_2024.png)](https://molen.dev/guide-media/liveries/byd_seagull_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `lime` | Lime | [Photo](https://commons.wikimedia.org/wiki/File:BYD_Seagull_001.jpg) |
| `white` | White | [Photo](https://commons.wikimedia.org/wiki/File:BYD_Seagull_005.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Chevrolet Onix

Type: `molen.entities.vehicle.chevrolet_onix_2024`.

[![2024 Chevrolet Onix livery comparison: Red, White](https://molen.dev/guide-media/liveries/chevrolet_onix_2024.png)](https://molen.dev/guide-media/liveries/chevrolet_onix_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `red` | Red | [Photo](https://commons.wikimedia.org/wiki/File:Chevrolet_Onix_Turbo_RS_2024_(53354238074).jpg) |
| `white` | White | [Photo](https://commons.wikimedia.org/wiki/File:Chevrolet_Onix_1.0T_Premier_2023.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Dacia Duster

Type: `molen.entities.vehicle.dacia_duster_2024`.

[![2024 Dacia Duster livery comparison: Sand, Blue gray](https://molen.dev/guide-media/liveries/dacia_duster_2024.png)](https://molen.dev/guide-media/liveries/dacia_duster_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `sand` | Sand | [Photo](https://commons.wikimedia.org/wiki/File:2024_Dacia_Duster_front.jpg) |
| `blue-gray` | Blue gray | [Photo](https://commons.wikimedia.org/wiki/File:Dacia_Duster_III_GIMS_2024_1X7A2328.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Fiat Strada

Type: `molen.entities.vehicle.fiat_strada_2024`.

[![2024 Fiat Strada livery comparison: Ultra white, Endurance silver](https://molen.dev/guide-media/liveries/fiat_strada_2024.png)](https://molen.dev/guide-media/liveries/fiat_strada_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `ultra-white` | Ultra white | [Photo](https://commons.wikimedia.org/wiki/File:2024_Fiat_Strada_Ultra_T200_CVT.jpg) |
| `endurance-silver` | Endurance silver | [Photo](https://commons.wikimedia.org/wiki/File:Fiat_Strada_Mk6_1.4_Endurance_in_Montevideo_in_2024.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Ford Mustang

Type: `molen.entities.vehicle.ford_mustang_2024`.

[![2024 Ford Mustang livery comparison: Race Red, Yellow](https://molen.dev/guide-media/liveries/mustang.png)](https://molen.dev/guide-media/liveries/mustang.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `race-red` | Race Red | [Photo](https://commons.wikimedia.org/wiki/File:2024_Ford_Mustang_2.3_EcoBoost_in_Race_Red,_rear_left,_06-26-2024.jpg) |
| `yellow` | Yellow | [Photo](https://commons.wikimedia.org/wiki/File:Ford_Mustang_VII_Sindelfingen_2024_IMG_9164.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Geely Monjaro

Type: `molen.entities.vehicle.geely_monjaro_2024`.

[![2024 Geely Monjaro livery comparison: Silver, Teal](https://molen.dev/guide-media/liveries/geely_monjaro_2024.png)](https://molen.dev/guide-media/liveries/geely_monjaro_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `silver` | Silver | [Photo](https://commons.wikimedia.org/wiki/File:Geely_Monjaro_(cropped).jpg) |
| `teal` | Teal | [Photo](https://commons.wikimedia.org/wiki/File:Moscow,_Geely_Monjaro_blue,_Feb_2026_01.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Genesis G80

Type: `molen.entities.vehicle.genesis_g80_2024`.

[![2024 Genesis G80 livery comparison: Gray, Magma orange study](https://molen.dev/guide-media/liveries/genesis_g80_2024.png)](https://molen.dev/guide-media/liveries/genesis_g80_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `gray` | Gray | [Photo](https://commons.wikimedia.org/wiki/File:2024_Genesis_G80.jpg) |
| `magma-orange-study` | Magma orange study | [Photo](https://commons.wikimedia.org/wiki/File:2024_Genesis_G80_Magma_Special.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 GMC Hummer EV SUV

Type: `molen.entities.vehicle.gmc_hummer_ev_suv_2024`.

[![2024 GMC Hummer EV SUV livery comparison: Gray green, Void Black](https://molen.dev/guide-media/liveries/gmc_hummer_ev_suv_2024.png)](https://molen.dev/guide-media/liveries/gmc_hummer_ev_suv_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `gray-green` | Gray green | [Photo](https://commons.wikimedia.org/wiki/File:2024_GMC_Hummer_EV3X_SUV,_front_left,_10-29-2023.jpg) |
| `void-black` | Void Black | [Photo](https://commons.wikimedia.org/wiki/File:GMC_HUMMER_EV_SUV_BT1UG_Void_Black_(1).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Honda N-BOX

Type: `molen.entities.vehicle.honda_n_box_2024`.

[![2024 Honda N-BOX livery comparison: White, Blue study](https://molen.dev/guide-media/liveries/honda_n_box_2024.png)](https://molen.dev/guide-media/liveries/honda_n_box_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `white` | White | [Photo](https://commons.wikimedia.org/wiki/File:3rd_generation_Honda_N-BOX_Custom.jpg) |
| `blue-study` | Blue study | [Photo](https://commons.wikimedia.org/wiki/File:Moscow,_Honda_N-box_blue,_Feb_2026_02.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Hyundai Casper Electric

Type: `molen.entities.vehicle.hyundai_casper_electric_2024`.

[![2024 Hyundai Casper Electric livery comparison: Butter yellow green, Sage green](https://molen.dev/guide-media/liveries/hyundai_casper_electric_2024.png)](https://molen.dev/guide-media/liveries/hyundai_casper_electric_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `butter-yellow-green` | Butter yellow green | [Photo](https://commons.wikimedia.org/wiki/File:2024_Hyundai_Casper_Electric_front_view.png) |
| `sage-green` | Sage green | [Photo](https://commons.wikimedia.org/wiki/File:Hyundai_Inster_Auto_Zuerich_2024_DSC_6263.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Hyundai Staria

Type: `molen.entities.vehicle.hyundai_staria_2024`.

[![2024 Hyundai Staria livery comparison: Abyss Black, Premium white](https://molen.dev/guide-media/liveries/hyundai_staria_2024.png)](https://molen.dev/guide-media/liveries/hyundai_staria_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `abyss-black` | Abyss Black | [Photo](https://commons.wikimedia.org/wiki/File:Perpignan_-_66000_-_2024.07.10_-_Hyundai_Staria_(vue_arri%C3%A8re)_%C2%A9_Anthony_Levrot.jpg) |
| `premium-white` | Premium white | [Photo](https://commons.wikimedia.org/wiki/File:Hyundai_Staria_Premium_2024.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Isuzu D-MAX

Type: `molen.entities.vehicle.isuzu_d_max_2024`.

[![2024 Isuzu D-MAX livery comparison: Orange, LSE blue](https://molen.dev/guide-media/liveries/isuzu_d_max_2024.png)](https://molen.dev/guide-media/liveries/isuzu_d_max_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `orange` | Orange | [Photo](https://commons.wikimedia.org/wiki/File:2024_Isuzu_D-Max_(third_generation)_GIMS_2024_1X7A2056.jpg) |
| `lse-blue` | LSE blue | [Photo](https://commons.wikimedia.org/wiki/File:Isuzu_D-Max_4x4_LSE_2024_(1).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Kia K5

Type: `molen.entities.vehicle.kia_k5_2024`.

[![2024 Kia K5 livery comparison: White, Silver study](https://molen.dev/guide-media/liveries/kia_k5_2024.png)](https://molen.dev/guide-media/liveries/kia_k5_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `white` | White | [Photo](https://commons.wikimedia.org/wiki/File:2024_Kia_K5_(DL3)_1_cropped.jpg) |
| `silver-study` | Silver study | [Photo](https://commons.wikimedia.org/wiki/File:0_Kia_K5_(TF)_5.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Peugeot 208

Type: `molen.entities.vehicle.peugeot_208_2024`.

[![2024 Peugeot 208 livery comparison: Agueda Yellow, Black](https://molen.dev/guide-media/liveries/peugeot_208_2024.png)](https://molen.dev/guide-media/liveries/peugeot_208_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `agueda-yellow` | Agueda Yellow | [Photo](https://commons.wikimedia.org/wiki/File:2024_Peugeot_208_GT_PureTech_-_1200cc_1.2_(100PS)_Petrol_-_Agueda_Yellow_-_06-2024,_Front.jpg) |
| `black` | Black | [Photo](https://commons.wikimedia.org/wiki/File:Peugeot_208_B_facelift_Automesse_Ludwigsburg_2024_IMG_1534.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Renault Clio

Type: `molen.entities.vehicle.renault_clio_2024`.

[![2024 Renault Clio livery comparison: Evolution silver, Iron Blue](https://molen.dev/guide-media/liveries/renault_clio_2024.png)](https://molen.dev/guide-media/liveries/renault_clio_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `evolution-silver` | Evolution silver | [Photo](https://commons.wikimedia.org/wiki/File:2024_Renault_Clio_Evolution_E-Tech_HEV_Auto.jpg) |
| `iron-blue` | Iron Blue | [Photo](https://commons.wikimedia.org/wiki/File:2024_Renault_Clio_1.6_E-Tech_Hybrid_espirit_Alpine_in_Iron_Blue_at_Renault_Manchester_02.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Renault Kwid

Type: `molen.entities.vehicle.renault_kwid_2024`.

[![2024 Renault Kwid livery comparison: Silver, Red](https://molen.dev/guide-media/liveries/renault_kwid_2024.png)](https://molen.dev/guide-media/liveries/renault_kwid_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `silver` | Silver | [Photo](https://commons.wikimedia.org/wiki/File:Renault_Kwid_1.0_Outsider_2024_(53459301692).jpg) |
| `red` | Red | [Photo](https://commons.wikimedia.org/wiki/File:2021_Renault_Kwid_1.0_Life.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Skoda Octavia Combi

Type: `molen.entities.vehicle.skoda_octavia_combi_2024`.

[![2024 Skoda Octavia Combi livery comparison: RS red, Blue](https://molen.dev/guide-media/liveries/skoda_octavia_combi_2024.png)](https://molen.dev/guide-media/liveries/skoda_octavia_combi_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `rs-red` | RS red | [Photo](https://commons.wikimedia.org/wiki/File:%C5%A0koda_Octavia_IV_Combi_RS_Facelift_Auto_Zuerich_2024_DSC_6911.jpg) |
| `blue` | Blue | [Photo](https://commons.wikimedia.org/wiki/File:2024_%C5%A0koda_Octavia_Estate_1.5_TSI_SE_in_Listers_%C5%A0koda_Coventry_01.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Suzuki Jimny Sierra

Type: `molen.entities.vehicle.suzuki_jimny_sierra_2024`.

[![2024 Suzuki Jimny Sierra livery comparison: Bluish Black Pearl 3, JC gray](https://molen.dev/guide-media/liveries/suzuki_jimny_sierra_2024.png)](https://molen.dev/guide-media/liveries/suzuki_jimny_sierra_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `bluish-black-pearl-3` | Bluish Black Pearl 3 | [Photo](https://commons.wikimedia.org/wiki/File:2024_Suzuki_Jimny_Sierra_JC_in_Bluish_Black_Pearl_3,_front_right.jpg) |
| `jc-gray` | JC gray | [Photo](https://commons.wikimedia.org/wiki/File:2018-2024_Suzuki_Jimny_Sierra_JC.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Suzuki Swift

Type: `molen.entities.vehicle.suzuki_swift_2024`.

[![2024 Suzuki Swift livery comparison: Pale green, Gray](https://molen.dev/guide-media/liveries/suzuki_swift_2024.png)](https://molen.dev/guide-media/liveries/suzuki_swift_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `pale-green` | Pale green | [Photo](https://commons.wikimedia.org/wiki/File:Suzuki_Swift_(2024)_hybrid_DSC_7922.jpg) |
| `gray` | Gray | [Photo](https://commons.wikimedia.org/wiki/File:Suzuki_Swift_(2024)_hybrid_IMG_1873.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Tesla Model Y

Type: `molen.entities.vehicle.tesla_model_y_2024`.

[![2024 Tesla Model Y livery comparison: Pearl White, Blue](https://molen.dev/guide-media/liveries/tesla_model_y_2024.png)](https://molen.dev/guide-media/liveries/tesla_model_y_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `pearl-white` | Pearl White | [Photo](https://commons.wikimedia.org/wiki/File:2024_Tesla_Model_Y_Long_Range_FWD_in_Pearl_White,_front_right.jpg) |
| `blue` | Blue | [Photo](https://commons.wikimedia.org/wiki/File:Tesla_Model_Y_Dual_Motor_Deep_Blue_Metallic_(1).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Toyota Alphard

Type: `molen.entities.vehicle.toyota_alphard_2024`.

[![2024 Toyota Alphard livery comparison: Platinum White Pearl Mica, Black](https://molen.dev/guide-media/liveries/toyota_alphard_2024.png)](https://molen.dev/guide-media/liveries/toyota_alphard_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `platinum-white-pearl-mica` | Platinum White Pearl Mica | [Photo](https://commons.wikimedia.org/wiki/File:2024_Toyota_Alphard_2.5_HEV_in_Platinum_White_Pearl_Mica,_front_right,_06-23-2024.jpg) |
| `black` | Black | [Photo](https://commons.wikimedia.org/wiki/File:2024_Toyota_Alphard_2.5_HEV_in_Black,_front_left.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Toyota GR Supra

Type: `molen.entities.vehicle.toyota_gr_supra_2024`.

[![2024 Toyota GR Supra livery comparison: Red, Anniversary white](https://molen.dev/guide-media/liveries/toyota_gr_supra_2024.png)](https://molen.dev/guide-media/liveries/toyota_gr_supra_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `red` | Red | [Photo](https://commons.wikimedia.org/wiki/File:Toyota_GR_Supra_(2024)_(53627057168).jpg) |
| `anniversary-white` | Anniversary white | [Photo](https://commons.wikimedia.org/wiki/File:Toyota_GR_Supra_45th_Anniversary_(2024)_(53626392887).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Toyota Hiace Sesfikile

Type: `molen.entities.vehicle.toyota_hiace_2024`.

[![2024 Toyota Hiace Sesfikile livery comparison: Hiace white, Commuter beige study](https://molen.dev/guide-media/liveries/toyota_hiace_2024.png)](https://molen.dev/guide-media/liveries/toyota_hiace_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `hiace-white` | Hiace white | [Photo](https://commons.wikimedia.org/wiki/File:Toyota_HiAce_Commuter_(H200)_mid_roof_window_van_in_Japan.jpg) |
| `commuter-beige-study` | Commuter beige study | [Photo](https://commons.wikimedia.org/wiki/File:Toyota_HiAce_H200_Taxi_MC-115.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Toyota Hilux

Type: `molen.entities.vehicle.toyota_hilux_2024`.

[![2024 Toyota Hilux livery comparison: Emotional Red, Super White II](https://molen.dev/guide-media/liveries/toyota_hilux_2024.png)](https://molen.dev/guide-media/liveries/toyota_hilux_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `emotional-red` | Emotional Red | [Photo](https://commons.wikimedia.org/wiki/File:2024_Toyota_Hilux_2.8_GR_Sport_4x4_in_Emotional_Red,_06-30-2024.jpg) |
| `super-white-ii` | Super White II | [Photo](https://commons.wikimedia.org/wiki/File:2024_Toyota_Hilux_2.8_GR_Sport_4x4_in_Super_White_II,_front_right.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Toyota Prius

Type: `molen.entities.vehicle.toyota_prius_2024`.

[![2024 Toyota Prius livery comparison: XLE gray, Red](https://molen.dev/guide-media/liveries/toyota_prius_2024.png)](https://molen.dev/guide-media/liveries/toyota_prius_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `xle-gray` | XLE gray | [Photo](https://commons.wikimedia.org/wiki/File:2024_Toyota_Prius_XLE_AWD,_front_right,_06-01-2024.jpg) |
| `red` | Red | [Photo](https://commons.wikimedia.org/wiki/File:Toyota_Prius_HEV_XLE_XW60_Emotional_Red_2_(13).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Toyota Yaris

Type: `molen.entities.vehicle.toyota_yaris_2024`.

[![2024 Toyota Yaris livery comparison: Hybrid blue, Hybrid Z red](https://molen.dev/guide-media/liveries/toyota_yaris_2024.png)](https://molen.dev/guide-media/liveries/toyota_yaris_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `hybrid-blue` | Hybrid blue | [Photo](https://commons.wikimedia.org/wiki/File:2024_Toyota_Yaris_Hybrid_130_(XP210)_IMG_9425.jpg) |
| `hybrid-z-red` | Hybrid Z red | [Photo](https://commons.wikimedia.org/wiki/File:2024_Toyota_Yaris_Hybrid_Z.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2024 Volkswagen Polo

Type: `molen.entities.vehicle.volkswagen_polo_2024`.

[![2024 Volkswagen Polo livery comparison: Life white, Flash Red](https://molen.dev/guide-media/liveries/volkswagen_polo_2024.png)](https://molen.dev/guide-media/liveries/volkswagen_polo_2024.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `life-white` | Life white | [Photo](https://commons.wikimedia.org/wiki/File:2024_Volkswagen_Polo_Life_front.jpg) |
| `flash-red` | Flash Red | [Photo](https://commons.wikimedia.org/wiki/File:2019_Volkswagen_Polo_SEL_TSI_-_999cc_1.0_(115PS)_Petrol_-_Flash_Red_-_03-2024,_Front.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Chevrolet Colorado

Type: `molen.entities.vehicle.chevrolet_colorado_2025`.

[![2025 Chevrolet Colorado livery comparison: ZR2 blue, LT green](https://molen.dev/guide-media/liveries/chevrolet_colorado_2025.png)](https://molen.dev/guide-media/liveries/chevrolet_colorado_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `zr2-blue` | ZR2 blue | [Photo](https://commons.wikimedia.org/wiki/File:2025_Chevrolet_Colorado_ZR2,_front_NYIAS_2025.jpg) |
| `lt-green` | LT green | [Photo](https://commons.wikimedia.org/wiki/File:Chevrolet_Colorado_LT_2025.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Chevrolet Equinox

Type: `molen.entities.vehicle.chevrolet_equinox_2025`.

[![2025 Chevrolet Equinox livery comparison: Activ pale green, Gray](https://molen.dev/guide-media/liveries/chevrolet_equinox_2025.png)](https://molen.dev/guide-media/liveries/chevrolet_equinox_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `activ-pale-green` | Activ pale green | [Photo](https://commons.wikimedia.org/wiki/File:2025_Chevrolet_Equinox_Activ_(United_States)_front_view.jpg) |
| `gray` | Gray | [Photo](https://commons.wikimedia.org/wiki/File:2025_Chevrolet_Equinox_front_view.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Chevrolet Silverado 1500

Type: `molen.entities.vehicle.chevrolet_silverado_1500_2025`.

[![2025 Chevrolet Silverado 1500 livery comparison: ZR2 white, RST blue](https://molen.dev/guide-media/liveries/chevrolet_silverado_1500_2025.png)](https://molen.dev/guide-media/liveries/chevrolet_silverado_1500_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `zr2-white` | ZR2 white | [Photo](https://commons.wikimedia.org/wiki/File:2025_Chevrolet_Silverado_ZR2_au_SIAM_2025.jpg) |
| `rst-blue` | RST blue | [Photo](https://commons.wikimedia.org/wiki/File:2023_Chevrolet_Silverado_1500_RST_Las_Vegas_Fall_2025.jpg) |

**ZR2 white.** White 2025 Silverado ZR2 at SIAM; black trim remains model-owned. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

**RST blue.** Blue 2023 Silverado 1500 RST photographed in 2025; same-generation color study adapted to the 2025 model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Chevrolet Traverse

Type: `molen.entities.vehicle.chevrolet_traverse_2025`.

[![2025 Chevrolet Traverse livery comparison: RS red, LT blue](https://molen.dev/guide-media/liveries/chevrolet_traverse_2025.png)](https://molen.dev/guide-media/liveries/chevrolet_traverse_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `rs-red` | RS red | [Photo](https://commons.wikimedia.org/wiki/File:2025_Chevrolet_Traverse_RS_(United_States)_front_view.png) |
| `lt-blue` | LT blue | [Photo](https://commons.wikimedia.org/wiki/File:2025_Chevrolet_Traverse_LT,_front_4.4.25.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Chevrolet Trax

Type: `molen.entities.vehicle.chevrolet_trax_2025`.

[![2025 Chevrolet Trax livery comparison: Pale green, Red](https://molen.dev/guide-media/liveries/chevrolet_trax_2025.png)](https://molen.dev/guide-media/liveries/chevrolet_trax_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `pale-green` | Pale green | [Photo](https://commons.wikimedia.org/wiki/File:2025_Chevrolet_Trax_au_SIAM_2025.jpg) |
| `red` | Red | [Photo](https://commons.wikimedia.org/wiki/File:2024_Chevrolet_Trax_1RS,_front_right,_05-18-2023.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Ford Bronco

Type: `molen.entities.vehicle.ford_bronco_2025`.

[![2025 Ford Bronco livery comparison: Big Bend red, Black](https://molen.dev/guide-media/liveries/ford_bronco_2025.png)](https://molen.dev/guide-media/liveries/ford_bronco_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `big-bend-red` | Big Bend red | [Photo](https://commons.wikimedia.org/wiki/File:2025_Ford_Bronco_Big_Bend_4-door_with_Sasquatch_package,_front_right,_06-27-2026.jpg) |
| `black` | Black | [Photo](https://commons.wikimedia.org/wiki/File:Moscow,_Ford_Bronco_(6th_gen)_Aug_2025_01.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Ford Escape

Type: `molen.entities.vehicle.ford_escape_2025`.

[![2025 Ford Escape livery comparison: Race Red, Black](https://molen.dev/guide-media/liveries/ford_escape_2025.png)](https://molen.dev/guide-media/liveries/ford_escape_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `race-red` | Race Red | [Photo](https://commons.wikimedia.org/wiki/File:2024_Ford_Escape_Active_in_Race_Red,_rear_left,_2025-11-20.jpg) |
| `black` | Black | [Photo](https://commons.wikimedia.org/wiki/File:Ford_Escape,_Windsor,_Ontario,_2025-07-01.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Ford Explorer

Type: `molen.entities.vehicle.ford_explorer_2025`.

[![2025 Ford Explorer livery comparison: Active blue, Charcoal](https://molen.dev/guide-media/liveries/ford_explorer_2025.png)](https://molen.dev/guide-media/liveries/ford_explorer_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `active-blue` | Active blue | [Photo](https://commons.wikimedia.org/wiki/File:Ford_Explorer_Active_2025.jpg) |
| `charcoal` | Charcoal | [Photo](https://commons.wikimedia.org/wiki/File:Moscow,_Ford_Explorer_black,_Sept_2025_01.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Ford F-150

Type: `molen.entities.vehicle.ford_f_150_2025`.

[![2025 Ford F-150 livery comparison: Photographed black, Photographed metallic gray](https://molen.dev/guide-media/liveries/ford_f_150_2025.png)](https://molen.dev/guide-media/liveries/ford_f_150_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `photographed-black` | Photographed black | [Photo](https://commons.wikimedia.org/wiki/File:Ford_F-150_(fourteenth_generation)_Rutesheimer_Autoschau_2025_DSC_9231.jpg) |
| `photographed-metallic-gray` | Photographed metallic gray | [Photo](https://commons.wikimedia.org/wiki/File:Ford_F-150_(fourteenth_generation)_Rutesheimer_Autoschau_2025_DSC_9217.jpg) |

**Photographed black.** Black fourteenth-generation F-150 photographed in 2025; paint study applied to the catalog's 2025 body without a factory color-code claim. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

**Photographed metallic gray.** Gray fourteenth-generation F-150 photographed in 2025; photographed trim differs from the library model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Ford Maverick

Type: `molen.entities.vehicle.ford_maverick_2025`.

[![2025 Ford Maverick livery comparison: Red, Lobo blue](https://molen.dev/guide-media/liveries/ford_maverick_2025.png)](https://molen.dev/guide-media/liveries/ford_maverick_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `red` | Red | [Photo](https://commons.wikimedia.org/wiki/File:2025_Ford_Maverick_au_SIAM_2025.jpg) |
| `lobo-blue` | Lobo blue | [Photo](https://commons.wikimedia.org/wiki/File:2025_Ford_Maverick_Lobo_au_salon_auto_Lanaudi%C3%A8re_2025.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Ford Ranger

Type: `molen.entities.vehicle.ford_ranger_2025`.

[![2025 Ford Ranger livery comparison: Blue, Limited silver](https://molen.dev/guide-media/liveries/ford_ranger_2025.png)](https://molen.dev/guide-media/liveries/ford_ranger_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `blue` | Blue | [Photo](https://commons.wikimedia.org/wiki/File:2025_Ford_Ranger_au_SIAM_2025.jpg) |
| `limited-silver` | Limited silver | [Photo](https://commons.wikimedia.org/wiki/File:Ford_Ranger_Limited_2025.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 GMC Sierra 1500

Type: `molen.entities.vehicle.gmc_sierra_1500_2025`.

[![2025 GMC Sierra 1500 livery comparison: Thunderstorm Gray, Fleet white](https://molen.dev/guide-media/liveries/gmc_sierra_1500_2025.png)](https://molen.dev/guide-media/liveries/gmc_sierra_1500_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `thunderstorm-gray` | Thunderstorm Gray | [Photo](https://commons.wikimedia.org/wiki/File:2025_GMC_Sierra_1500_Denali_Ultimate_in_Thunderstorm_Gray.jpg) |
| `fleet-white` | Fleet white | [Photo](https://commons.wikimedia.org/wiki/File:GMC_Sierra_1500_GMTT1XX_Crew_Cab_@_Lanaudi%C3%A8re_Auto_Show_2025.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Honda Accord

Type: `molen.entities.vehicle.honda_accord_2025`.

[![2025 Honda Accord livery comparison: Touring white, Blue](https://molen.dev/guide-media/liveries/honda_accord_2025.png)](https://molen.dev/guide-media/liveries/honda_accord_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `touring-white` | Touring white | [Photo](https://commons.wikimedia.org/wiki/File:2025_Honda_Accord_Touring_Hybrid,_front_right,_09-13-2026.jpg) |
| `blue` | Blue | [Photo](https://commons.wikimedia.org/wiki/File:Moscow,_Honda_Accord_(2022)_blue,_Sept_2025_03.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Honda Civic

Type: `molen.entities.vehicle.honda_civic_2025`.

[![2025 Honda Civic livery comparison: Black, Blue](https://molen.dev/guide-media/liveries/honda_civic_2025.png)](https://molen.dev/guide-media/liveries/honda_civic_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `black` | Black | [Photo](https://commons.wikimedia.org/wiki/File:2025_Honda_Civic_Hybrid_(Europe)_DSC_2729.jpg) |
| `blue` | Blue | [Photo](https://commons.wikimedia.org/wiki/File:2025_Honda_Civic_Hybrid_(Europe)_DSC_2733.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Honda CR-V

Type: `molen.entities.vehicle.honda_cr_v_2025`.

[![2025 Honda CR-V livery comparison: Platinum White Pearl, RS green](https://molen.dev/guide-media/liveries/honda_cr_v_2025.png)](https://molen.dev/guide-media/liveries/honda_cr_v_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `platinum-white-pearl` | Platinum White Pearl | [Photo](https://commons.wikimedia.org/wiki/File:2025_Honda_CR-V_LX_2WD_in_Platinum_White_Pearl,_front_left,_2024-09-29.jpg) |
| `rs-green` | RS green | [Photo](https://commons.wikimedia.org/wiki/File:2025_Honda_CR-V_e-HEV_RS_4WD.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Honda Odyssey

Type: `molen.entities.vehicle.honda_odyssey_2025`.

[![2025 Honda Odyssey livery comparison: Red, Gray](https://molen.dev/guide-media/liveries/honda_odyssey_2025.png)](https://molen.dev/guide-media/liveries/honda_odyssey_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `red` | Red | [Photo](https://commons.wikimedia.org/wiki/File:2025_Honda_Odyssey_front_view.jpg) |
| `gray` | Gray | [Photo](https://commons.wikimedia.org/wiki/File:Honda_Odyssey_in_Ochsner_Medical_Center_Parking_Garage_Feb_2025.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Honda Pilot

Type: `molen.entities.vehicle.honda_pilot_2025`.

[![2025 Honda Pilot livery comparison: White Black Edition, Black](https://molen.dev/guide-media/liveries/honda_pilot_2025.png)](https://molen.dev/guide-media/liveries/honda_pilot_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `white-black-edition` | White Black Edition | [Photo](https://commons.wikimedia.org/wiki/File:2025_Honda_Pilot_AWD_Black_Edition,_front_NYIAS_2025.jpg) |
| `black` | Black | [Photo](https://commons.wikimedia.org/wiki/File:2025_Honda_Pilot.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Hyundai Palisade

Type: `molen.entities.vehicle.hyundai_palisade_2025`.

[![2025 Hyundai Palisade livery comparison: Blue, Calligraphy gray](https://molen.dev/guide-media/liveries/hyundai_palisade_2025.png)](https://molen.dev/guide-media/liveries/hyundai_palisade_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `blue` | Blue | [Photo](https://commons.wikimedia.org/wiki/File:2025_Hyundai_Palisade_au_SIAM_2025.jpg) |
| `calligraphy-gray` | Calligraphy gray | [Photo](https://commons.wikimedia.org/wiki/File:2025_Hyundai_Palisade_Calligraphy_Hybrid_Front.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Hyundai Tucson

Type: `molen.entities.vehicle.hyundai_tucson_2025`.

[![2025 Hyundai Tucson livery comparison: XRT olive gray, Blue](https://molen.dev/guide-media/liveries/hyundai_tucson_2025.png)](https://molen.dev/guide-media/liveries/hyundai_tucson_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `xrt-olive-gray` | XRT olive gray | [Photo](https://commons.wikimedia.org/wiki/File:2025_Hyundai_Tucson_XRT_(United_States)_front_view.jpg) |
| `blue` | Blue | [Photo](https://commons.wikimedia.org/wiki/File:2025_Hyundai_Tucson_au_SIAM_2025.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Jeep Grand Cherokee

Type: `molen.entities.vehicle.jeep_grand_cherokee_2025`.

[![2025 Jeep Grand Cherokee livery comparison: Silver Zynith, 4xe white](https://molen.dev/guide-media/liveries/jeep_grand_cherokee_2025.png)](https://molen.dev/guide-media/liveries/jeep_grand_cherokee_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `silver-zynith` | Silver Zynith | [Photo](https://commons.wikimedia.org/wiki/File:2025_Jeep_Grand_Cherokee_Laredo_in_Silver_Zynith,_front_left,_2025-08-24.jpg) |
| `4xe-white` | 4xe white | [Photo](https://commons.wikimedia.org/wiki/File:Jeep_Grand_Cherokee_WL_4xe_01_China_2025-04-19.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Jeep Wrangler

Type: `molen.entities.vehicle.jeep_wrangler_2025`.

[![2025 Jeep Wrangler livery comparison: Joose orange, Red](https://molen.dev/guide-media/liveries/jeep_wrangler_2025.png)](https://molen.dev/guide-media/liveries/jeep_wrangler_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `joose-orange` | Joose orange | [Photo](https://commons.wikimedia.org/wiki/File:2025_Jeep_Wrangler_2-Door_Sport_in_Joose,_front_right,_2025-08-24.jpg) |
| `red` | Red | [Photo](https://commons.wikimedia.org/wiki/File:Jeep_Wrangler_-_January_2025_-_Sarah_Stierch.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Kia Sportage

Type: `molen.entities.vehicle.kia_sportage_2025`.

[![2025 Kia Sportage livery comparison: SX pale blue, White](https://molen.dev/guide-media/liveries/kia_sportage_2025.png)](https://molen.dev/guide-media/liveries/kia_sportage_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `sx-pale-blue` | SX pale blue | [Photo](https://commons.wikimedia.org/wiki/File:2025_Kia_Sportage_SX_rear.jpg) |
| `white` | White | [Photo](https://commons.wikimedia.org/wiki/File:2025_Kia_Sportage_S_front_only.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Kia Telluride

Type: `molen.entities.vehicle.kia_telluride_2025`.

[![2025 Kia Telluride livery comparison: Black, Silver](https://molen.dev/guide-media/liveries/kia_telluride_2025.png)](https://molen.dev/guide-media/liveries/kia_telluride_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `black` | Black | [Photo](https://commons.wikimedia.org/wiki/File:Kia_Telluride_DSC_9807.jpg) |
| `silver` | Silver | [Photo](https://commons.wikimedia.org/wiki/File:2022_Kia_Telluride_DSC_2922.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Mazda CX-5

Type: `molen.entities.vehicle.mazda_cx_5_2025`.

[![2025 Mazda CX-5 livery comparison: Machine Gray, Red](https://molen.dev/guide-media/liveries/mazda_cx_5_2025.png)](https://molen.dev/guide-media/liveries/mazda_cx_5_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `machine-gray` | Machine Gray | [Photo](https://commons.wikimedia.org/wiki/File:2025_Mazda_CX-5_2.5_Skyactiv_AWD_Turbo_in_Machine_Gray,_front_left.jpg) |
| `red` | Red | [Photo](https://commons.wikimedia.org/wiki/File:Mazda_CX-5_(KI)_Auto_Zuerich_2025_DSC_3145.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Nissan Altima

Type: `molen.entities.vehicle.nissan_altima_2025`.

[![2025 Nissan Altima livery comparison: SR white, Java Metallic study](https://molen.dev/guide-media/liveries/nissan_altima_2025.png)](https://molen.dev/guide-media/liveries/nissan_altima_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `sr-white` | SR white | [Photo](https://commons.wikimedia.org/wiki/File:2024_Nissan_Altima_SR,_front_left,_05-05-2025.jpg) |
| `java-metallic-study` | Java Metallic study | [Photo](https://commons.wikimedia.org/wiki/File:2015_Nissan_Altima_in_Java_Metallic,_front_left,_10-11-2025.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Nissan Rogue

Type: `molen.entities.vehicle.nissan_rogue_2025`.

[![2025 Nissan Rogue livery comparison: Champagne, Orange study](https://molen.dev/guide-media/liveries/nissan_rogue_2025.png)](https://molen.dev/guide-media/liveries/nissan_rogue_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `champagne` | Champagne | [Photo](https://commons.wikimedia.org/wiki/File:2024_Nissan_Rogue_au_SIAM_2024.jpg) |
| `orange-study` | Orange study | [Photo](https://commons.wikimedia.org/wiki/File:Nissan_Rogue_(T32)_Washington_DC_Metro_Area,_USA_(1).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Ram 1500

Type: `molen.entities.vehicle.ram_1500_2025`.

[![2025 Ram 1500 livery comparison: Forged Blue, TRX gray](https://molen.dev/guide-media/liveries/ram_1500_2025.png)](https://molen.dev/guide-media/liveries/ram_1500_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `forged-blue` | Forged Blue | [Photo](https://commons.wikimedia.org/wiki/File:2025_RAM_1500_eTorque_Crew_Cab_Short_Box_Off-Roader_Value_Package_in_Forged_Blue_Metallic,_front_left,_2025-08-24.jpg) |
| `trx-gray` | TRX gray | [Photo](https://commons.wikimedia.org/wiki/File:Moscow,_Ram_1500_TRX,_Aug_2025_01.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Subaru Forester

Type: `molen.entities.vehicle.subaru_forester_2025`.

[![2025 Subaru Forester livery comparison: Brilliant Bronze Metallic, Sport white](https://molen.dev/guide-media/liveries/subaru_forester_2025.png)](https://molen.dev/guide-media/liveries/subaru_forester_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `brilliant-bronze-metallic` | Brilliant Bronze Metallic | [Photo](https://commons.wikimedia.org/wiki/File:2025_Subaru_Forester_Hybrid_Touring_in_Brilliant_Bronze_Metallic,_front_right.jpg) |
| `sport-white` | Sport white | [Photo](https://commons.wikimedia.org/wiki/File:2025_Subaru_Forester_Sport_(United_States)_front_view.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Subaru Outback

Type: `molen.entities.vehicle.subaru_outback_2025`.

[![2025 Subaru Outback livery comparison: Premium silver, Magnetite Grey Metallic](https://molen.dev/guide-media/liveries/subaru_outback_2025.png)](https://molen.dev/guide-media/liveries/subaru_outback_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `premium-silver` | Premium silver | [Photo](https://commons.wikimedia.org/wiki/File:2025_Subaru_Outback_AWD_Premium_Special_Edition_front.jpg) |
| `magnetite-grey-metallic` | Magnetite Grey Metallic | [Photo](https://commons.wikimedia.org/wiki/File:2024_Subaru_Outback_Convenience_in_Magnetite_Grey_Metallic,_front_left,_2025-05-01.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Tesla Model 3

Type: `molen.entities.vehicle.tesla_model_3_2025`.

[![2025 Tesla Model 3 livery comparison: Obsidian Black Metallic, Red](https://molen.dev/guide-media/liveries/tesla_model_3_2025.png)](https://molen.dev/guide-media/liveries/tesla_model_3_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `obsidian-black-metallic` | Obsidian Black Metallic | [Photo](https://commons.wikimedia.org/wiki/File:2025_Tesla_Model_3_Long_Range_in_Obsidian_Black_Metallic,_front_right.jpg) |
| `red` | Red | [Photo](https://commons.wikimedia.org/wiki/File:2025_Tesla_Model_3_au_salon_auto_Lanaudi%C3%A8re_2025.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Toyota Camry

Type: `molen.entities.vehicle.toyota_camry_2025`.

[![2025 Toyota Camry livery comparison: Black, LE white](https://molen.dev/guide-media/liveries/toyota_camry_2025.png)](https://molen.dev/guide-media/liveries/toyota_camry_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `black` | Black | [Photo](https://commons.wikimedia.org/wiki/File:2025_Toyota_Camry_HEV.jpg) |
| `le-white` | LE white | [Photo](https://commons.wikimedia.org/wiki/File:2025_Toyota_Camry_LE,_front_left,_05-24-2025.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Toyota Corolla

Type: `molen.entities.vehicle.toyota_corolla_2025`.

[![2025 Toyota Corolla livery comparison: Ice Cap, Hybrid bronze](https://molen.dev/guide-media/liveries/toyota_corolla_2025.png)](https://molen.dev/guide-media/liveries/toyota_corolla_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `ice-cap` | Ice Cap | [Photo](https://commons.wikimedia.org/wiki/File:2025_Toyota_Corolla_LE_ice_cap.jpg) |
| `hybrid-bronze` | Hybrid bronze | [Photo](https://commons.wikimedia.org/wiki/File:Toyota_Corolla_Hybrid_SEG_2025.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Toyota Highlander

Type: `molen.entities.vehicle.toyota_highlander_2025`.

[![2025 Toyota Highlander livery comparison: Limited white, Gray](https://molen.dev/guide-media/liveries/toyota_highlander_2025.png)](https://molen.dev/guide-media/liveries/toyota_highlander_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `limited-white` | Limited white | [Photo](https://commons.wikimedia.org/wiki/File:2025_Toyota_Highlander_Limited_white_rear.jpg) |
| `gray` | Gray | [Photo](https://commons.wikimedia.org/wiki/File:2024_Toyota_Highlander_LE_AWD_in_Magnetic_Gray_Met.,_front_left.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Toyota RAV4

Type: `molen.entities.vehicle.toyota_rav4_2025`.

[![2025 Toyota RAV4 livery comparison: Red, Woodland green](https://molen.dev/guide-media/liveries/toyota_rav4_2025.png)](https://molen.dev/guide-media/liveries/toyota_rav4_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `red` | Red | [Photo](https://commons.wikimedia.org/wiki/File:2024_Toyota_RAV4_-_red.jpg) |
| `woodland-green` | Woodland green | [Photo](https://commons.wikimedia.org/wiki/File:2024_Toyota_RAV4_Hybrid_Woodland_Edition,_front_right,_03-21-2026.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Toyota Sienna

Type: `molen.entities.vehicle.toyota_sienna_2025`.

[![2025 Toyota Sienna livery comparison: White, Blue Mirage Metallic study](https://molen.dev/guide-media/liveries/toyota_sienna_2025.png)](https://molen.dev/guide-media/liveries/toyota_sienna_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `white` | White | [Photo](https://commons.wikimedia.org/wiki/File:Toyota_Sienna_Las_Vegas_2025.jpg) |
| `blue-mirage-metallic-study` | Blue Mirage Metallic study | [Photo](https://commons.wikimedia.org/wiki/File:2010_Toyota_Sienna_in_Blue_Mirage_Metallic,_front_left,_10-12-2025.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Toyota Tacoma

Type: `molen.entities.vehicle.toyota_tacoma_2025`.

[![2025 Toyota Tacoma livery comparison: Celestial Silver Metallic, TRD black](https://molen.dev/guide-media/liveries/toyota_tacoma_2025.png)](https://molen.dev/guide-media/liveries/toyota_tacoma_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `celestial-silver-metallic` | Celestial Silver Metallic | [Photo](https://commons.wikimedia.org/wiki/File:2025_Toyota_Tacoma_Double_Cab_SR5_4x4_in_Celestial_Silver_Metallic,_front_right,_2025-10-17.jpg) |
| `trd-black` | TRD black | [Photo](https://commons.wikimedia.org/wiki/File:2025_Toyota_Tacoma_Rogue_Offroad_Las_Vegas_Fall_2025.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Toyota Tundra

Type: `molen.entities.vehicle.toyota_tundra_2025`.

[![2025 Toyota Tundra livery comparison: TRD red, White](https://molen.dev/guide-media/liveries/toyota_tundra_2025.png)](https://molen.dev/guide-media/liveries/toyota_tundra_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `trd-red` | TRD red | [Photo](https://commons.wikimedia.org/wiki/File:2024_Toyota_Tundra_TRD_Pro_au_salon_international_de_l%27auto_de_Montr%C3%A9al_2025.jpg) |
| `white` | White | [Photo](https://commons.wikimedia.org/wiki/File:White_Toyota_Tundra_at_riverside,_Windsor,_Ontario,_2025-06-14.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### 2025 Wuling Hongguang MINI EV

Type: `molen.entities.vehicle.wuling_hongguang_mini_ev_2025`.

[![2025 Wuling Hongguang MINI EV livery comparison: Mint and ivory, Blue and white study](https://molen.dev/guide-media/liveries/wuling_hongguang_mini_ev_2025.png)](https://molen.dev/guide-media/liveries/wuling_hongguang_mini_ev_2025.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `mint-and-ivory` | Mint and ivory | [Photo](https://commons.wikimedia.org/wiki/File:Wuling_Hongguang_Mini_EV_II_007.jpg) |
| `blue-and-white-study` | Blue and white study | [Photo](https://commons.wikimedia.org/wiki/File:Wuling_Hongguang_Mini_EV_Shishi_01_2022-10-15.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Auto

Type: `molen.entities.vehicle.auto_rickshaw`.

[![Bendy Auto livery comparison: Delhi CNG green, Mumbai black and yellow](https://molen.dev/guide-media/liveries/auto_rickshaw.png)](https://molen.dev/guide-media/liveries/auto_rickshaw.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `delhi-cng` | Delhi CNG green | [Photo](https://commons.wikimedia.org/wiki/File:Auto-rickshaw_in_Delhi.jpeg) |
| `mumbai-black` | Mumbai black and yellow | [Photo](https://commons.wikimedia.org/wiki/File:Auto-rickshaw_in_Mumbai_2009-09-26.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Box Truck

Type: `molen.entities.vehicle.box_truck`.

[![Bendy Box Truck livery comparison: Isuzu red cab, Isuzu white cab](https://molen.dev/guide-media/liveries/box_truck.png)](https://molen.dev/guide-media/liveries/box_truck.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `isuzu-red-cab` | Isuzu red cab | [Photo](https://commons.wikimedia.org/wiki/File:Isuzu_NPR_box_truck_in_red_(TR).jpg) |
| `isuzu-white-cab` | Isuzu white cab | [Photo](https://commons.wikimedia.org/wiki/File:2024_Isuzu_NPR-HD_Box_Truck_in_Mineral_White,_front_left,_2026-05-09.jpg) |

**Isuzu red cab.** Red Isuzu NPR cab with white cargo box, adapted to the generic box truck. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

**Isuzu white cab.** Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Class A Compact

Type: `molen.entities.vehicle.bendy_class_a_compact`.

[![Bendy Class A Compact livery comparison: LeSharo cream and gray, Brave cream and burgundy](https://molen.dev/guide-media/liveries/bendy_class_a_compact.png)](https://molen.dev/guide-media/liveries/bendy_class_a_compact.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `lesharo-cream-and-gray` | LeSharo cream and gray | [Photo](https://commons.wikimedia.org/wiki/File:Winnebago_Motorhome_2.jpg) |
| `brave-cream-and-burgundy` | Brave cream and burgundy | [Photo](https://commons.wikimedia.org/wiki/File:1974_Winnebago_Brave_in_Off_White,_Front_Left,_07-15-2022.jpg) |

**LeSharo cream and gray.** Exterior paint and broad graphic layout studied from Winnebago Motorhome 2.jpg. The photographed coach finish is adapted to the fictional Bendy body; it is not the same make or model. Colors and mask edges are visual approximations. Unlisted lettering, small stencils and complex emblems are omitted; this is a photo-based adaptation, not a certified replica.

**Brave cream and burgundy.** Exterior paint and broad graphic layout studied from 1974 Winnebago Brave in Off White, Front Left, 07-15-2022.jpg. The photographed coach finish is adapted to the fictional Bendy body; it is not the same make or model. Colors and mask edges are visual approximations. Unlisted lettering, small stencils and complex emblems are omitted; this is a photo-based adaptation, not a certified replica.

### Bendy Class A Grand

Type: `molen.entities.vehicle.bendy_class_a_grand`.

[![Bendy Class A Grand livery comparison: Dutch Star blue and silver, Allegro cream and burgundy](https://molen.dev/guide-media/liveries/bendy_class_a_grand.png)](https://molen.dev/guide-media/liveries/bendy_class_a_grand.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `dutch-star-blue-and-silver` | Dutch Star blue and silver | [Photo](https://commons.wikimedia.org/wiki/File:Azalea_Festival_2026_14.jpg) |
| `allegro-cream-and-burgundy` | Allegro cream and burgundy | [Photo](https://commons.wikimedia.org/wiki/File:1990_Chevrolet_P30_Tiffin_Allegro_Motorhome,_Front_Left,_08-06-2022.jpg) |

**Dutch Star blue and silver.** Exterior paint and broad graphic layout studied from Azalea Festival 2026 14.jpg. The photographed coach finish is adapted to the fictional Bendy body; it is not the same make or model. Colors and mask edges are visual approximations. Unlisted lettering, small stencils and complex emblems are omitted; this is a photo-based adaptation, not a certified replica.

**Allegro cream and burgundy.** Exterior paint and broad graphic layout studied from 1990 Chevrolet P30 Tiffin Allegro Motorhome, Front Left, 08-06-2022.jpg. The photographed coach finish is adapted to the fictional Bendy body; it is not the same make or model. Colors and mask edges are visual approximations. Unlisted lettering, small stencils and complex emblems are omitted; this is a photo-based adaptation, not a certified replica.

### Bendy Class A Touring

Type: `molen.entities.vehicle.bendy_class_a_touring`.

[![Bendy Class A Touring livery comparison: Adventurer cream and blue, Adventurer white and green](https://molen.dev/guide-media/liveries/bendy_class_a_touring.png)](https://molen.dev/guide-media/liveries/bendy_class_a_touring.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `adventurer-cream-and-blue` | Adventurer cream and blue | [Photo](https://commons.wikimedia.org/wiki/File:1995_Winnebago_Adventurer_For_Sale-2.jpg) |
| `adventurer-white-and-green` | Adventurer white and green | [Photo](https://commons.wikimedia.org/wiki/File:Winnebago-Adventurer.jpg) |

**Adventurer cream and blue.** Exterior paint and broad graphic layout studied from 1995 Winnebago Adventurer For Sale-2.jpg. The photographed coach finish is adapted to the fictional Bendy body; it is not the same make or model. Colors and mask edges are visual approximations. Unlisted lettering, small stencils and complex emblems are omitted; this is a photo-based adaptation, not a certified replica.

**Adventurer white and green.** Exterior paint and broad graphic layout studied from Winnebago-Adventurer.jpg. The photographed coach finish is adapted to the fictional Bendy body; it is not the same make or model. Colors and mask edges are visual approximations. Unlisted lettering, small stencils and complex emblems are omitted; this is a photo-based adaptation, not a certified replica.

### Bendy Class B Camper

Type: `molen.entities.vehicle.bendy_class_b_camper`.

[![Bendy Class B Camper livery comparison: Travato red, Travato white](https://molen.dev/guide-media/liveries/bendy_class_b_camper.png)](https://molen.dev/guide-media/liveries/bendy_class_b_camper.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `travato-red` | Travato red | [Photo](https://commons.wikimedia.org/wiki/File:Winnebago_Travato_(52877555311).jpg) |
| `travato-white` | Travato white | [Photo](https://commons.wikimedia.org/wiki/File:2018_Winnebago_Travato_(Ram_ProMaster),_rear_left.jpg) |

**Travato red.** Exterior paint and broad graphic layout studied from Winnebago Travato (52877555311).jpg. The photographed coach finish is adapted to the fictional Bendy body; it is not the same make or model. Colors and mask edges are visual approximations. Unlisted lettering, small stencils and complex emblems are omitted; this is a photo-based adaptation, not a certified replica.

**Travato white.** Exterior paint and broad graphic layout studied from 2018 Winnebago Travato (Ram ProMaster), rear left.jpg. The photographed coach finish is adapted to the fictional Bendy body; it is not the same make or model. Colors and mask edges are visual approximations. Unlisted lettering, small stencils and complex emblems are omitted; this is a photo-based adaptation, not a certified replica.

### Bendy Class C Family

Type: `molen.entities.vehicle.bendy_class_c_family`.

[![Bendy Class C Family livery comparison: Minnie Winnie cream and brown, Minnie Winnie white and teal](https://molen.dev/guide-media/liveries/bendy_class_c_family.png)](https://molen.dev/guide-media/liveries/bendy_class_c_family.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `minnie-winnie-cream-and-brown` | Minnie Winnie cream and brown | [Photo](https://commons.wikimedia.org/wiki/File:1992_Ford_E-350_Winnebago_Minnie_Winnie_motorhome,_front_left,_08-08-2022.jpg) |
| `minnie-winnie-white-and-teal` | Minnie Winnie white and teal | [Photo](https://commons.wikimedia.org/wiki/File:1997_Winnebago_Minnie_Winnie_DL_on_Ford_E-Super_Duty_in_Oxford_White,_Front_Right,_09-26-2022.jpg) |

**Minnie Winnie cream and brown.** Exterior paint and broad graphic layout studied from 1992 Ford E-350 Winnebago Minnie Winnie motorhome, front left, 08-08-2022.jpg. The photographed coach finish is adapted to the fictional Bendy body; it is not the same make or model. Colors and mask edges are visual approximations. Unlisted lettering, small stencils and complex emblems are omitted; this is a photo-based adaptation, not a certified replica.

**Minnie Winnie white and teal.** Exterior paint and broad graphic layout studied from 1997 Winnebago Minnie Winnie DL on Ford E-Super Duty in Oxford White, Front Right, 09-26-2022.jpg. The photographed coach finish is adapted to the fictional Bendy body; it is not the same make or model. Colors and mask edges are visual approximations. Unlisted lettering, small stencils and complex emblems are omitted; this is a photo-based adaptation, not a certified replica.

### Bendy Compact

Type: `molen.entities.vehicle.compact`.

[![Bendy Compact livery comparison: Vitz blue, Yaris white](https://molen.dev/guide-media/liveries/compact.png)](https://molen.dev/guide-media/liveries/compact.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `vitz-blue` | Vitz blue | [Photo](https://commons.wikimedia.org/wiki/File:Toyota_Vitz,_Korle-Klottey_(P1100243).jpg) |
| `yaris-white` | Yaris white | [Photo](https://commons.wikimedia.org/wiki/File:Toyota_Yaris_GRMN_IMG_0856.jpg) |

**Vitz blue.** Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

**Yaris white.** White body color of the photographed Yaris GRMN adapted to the generic compact; red performance graphics omitted. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Electric Hatchback

Type: `molen.entities.vehicle.electric_hatchback`.

[![Bendy Electric Hatchback livery comparison: Leaf light blue, Leaf white](https://molen.dev/guide-media/liveries/electric_hatchback.png)](https://molen.dev/guide-media/liveries/electric_hatchback.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `leaf-light-blue` | Leaf light blue | [Photo](https://commons.wikimedia.org/wiki/File:2017_Nissan_LEAF_(ZE0_MY17)_hatchback_(2018-11-02)_01.jpg) |
| `leaf-white` | Leaf white | [Photo](https://commons.wikimedia.org/wiki/File:Nissan_Leaf_2018_(31874639158)_(cropped).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Offroad

Type: `molen.entities.vehicle.offroad`.

[![Bendy Offroad livery comparison: Wrangler lime, Wrangler charcoal](https://molen.dev/guide-media/liveries/offroad.png)](https://molen.dev/guide-media/liveries/offroad.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `wrangler-lime` | Wrangler lime | [Photo](https://commons.wikimedia.org/wiki/File:Jeep_Wrangler_Rubicon_(JL)_4xe_1X7A0285.jpg) |
| `wrangler-charcoal` | Wrangler charcoal | [Photo](https://commons.wikimedia.org/wiki/File:Jeep_Wrangler_Rubicon_392_IMG_7673.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Pickup

Type: `molen.entities.vehicle.pickup`.

[![Bendy Pickup livery comparison: F-150 black, F-150 white](https://molen.dev/guide-media/liveries/pickup.png)](https://molen.dev/guide-media/liveries/pickup.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `f-150-black` | F-150 black | [Photo](https://commons.wikimedia.org/wiki/File:Ford_F-150_(fourteenth_generation)_Rutesheimer_Autoschau_2025_DSC_9231.jpg) |
| `f-150-white` | F-150 white | [Photo](https://commons.wikimedia.org/wiki/File:Ford_F-150_(thirteenth_generation)_IMG_0504.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Sedan

Type: `molen.entities.vehicle.sedan`.

[![Bendy Sedan livery comparison: Camry black, Camry white](https://molen.dev/guide-media/liveries/sedan.png)](https://molen.dev/guide-media/liveries/sedan.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `camry-black` | Camry black | [Photo](https://commons.wikimedia.org/wiki/File:2016_Toyota_Camry_Exclusive_black_rear.jpg) |
| `camry-white` | Camry white | [Photo](https://commons.wikimedia.org/wiki/File:(USA-Massachusetts)_Private_Toyota_Camry_NJ-Z22UKZ_rear_2024-06-06.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Sled

Type: `molen.entities.vehicle.snowmobile`.

[![Bendy Sled livery comparison: Trail red, Trail blue](https://molen.dev/guide-media/liveries/snowmobile.png)](https://molen.dev/guide-media/liveries/snowmobile.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `trail-red` | Trail red | [Photo](https://commons.wikimedia.org/wiki/File:Snowmobile_Lynx_Enduro_400.jpg) |
| `trail-blue` | Trail blue | [Photo](https://commons.wikimedia.org/wiki/File:Snowmobile.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Sports Coupe

Type: `molen.entities.vehicle.sports_coupe`.

[![Bendy Sports Coupe livery comparison: Mustang blue, Classic Mustang white](https://molen.dev/guide-media/liveries/sports_coupe.png)](https://molen.dev/guide-media/liveries/sports_coupe.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `mustang-blue` | Mustang blue | [Photo](https://commons.wikimedia.org/wiki/File:Ford_Mustang_VII_Convertible_Autofr%C3%BChling_Ulm_IMG_9339.jpg) |
| `classic-mustang-white` | Classic Mustang white | [Photo](https://commons.wikimedia.org/wiki/File:1966_Ford_Mustang_coupe_white_001.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Station Wagon

Type: `molen.entities.vehicle.station_wagon`.

[![Bendy Station Wagon livery comparison: Volvo dark blue, Volvo red](https://molen.dev/guide-media/liveries/station_wagon.png)](https://molen.dev/guide-media/liveries/station_wagon.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `volvo-dark-blue` | Volvo dark blue | [Photo](https://commons.wikimedia.org/wiki/File:2008_Volvo_V70,_Avesta.jpg) |
| `volvo-red` | Volvo red | [Photo](https://commons.wikimedia.org/wiki/File:Volvo_V70_in_yard.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy SUV

Type: `molen.entities.vehicle.suv`.

[![Bendy SUV livery comparison: Explorer white, Explorer EV pale blue](https://molen.dev/guide-media/liveries/suv.png)](https://molen.dev/guide-media/liveries/suv.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `explorer-white` | Explorer white | [Photo](https://commons.wikimedia.org/wiki/File:Ford_Explorer_PHEV_1X7A6478.jpg) |
| `explorer-ev-pale-blue` | Explorer EV pale blue | [Photo](https://commons.wikimedia.org/wiki/File:Ford_Explorer_EV_IAA_2023_1X7A0593.jpg) |

**Explorer white.** Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

**Explorer EV pale blue.** Pale blue Explorer EV paint adapted to the fictional SUV body; this is a color reference, not a claim that the Bendy SUV depicts an Explorer EV. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Taxi

Type: `molen.entities.vehicle.taxi`.

[![Bendy Taxi livery comparison: Tokyo yellow taxi, Japanese black taxi](https://molen.dev/guide-media/liveries/taxi.png)](https://molen.dev/guide-media/liveries/taxi.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `tokyo-yellow-taxi` | Tokyo yellow taxi | [Photo](https://commons.wikimedia.org/wiki/File:Toyota_Crown_Comfort_(Kawasaki_Taxi_4116).jpg) |
| `japanese-black-taxi` | Japanese black taxi | [Photo](https://commons.wikimedia.org/wiki/File:Sanco_Taxi_Toyota_Crown_Comfort_TSS10.jpg) |

**Tokyo yellow taxi.** Yellow Crown Comfort taxi with black door panel, adapted to the generic taxi. Advertising and black door panel omitted. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

**Japanese black taxi.** Black Sanco Crown Comfort with gold side stripe; gold stripe simplified and company crest omitted. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Van

Type: `molen.entities.vehicle.van`.

[![Bendy Van livery comparison: Transit fleet white, Classic Transit olive](https://molen.dev/guide-media/liveries/van.png)](https://molen.dev/guide-media/liveries/van.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `transit-fleet-white` | Transit fleet white | [Photo](https://commons.wikimedia.org/wiki/File:Ford_E-Transit_1X7A1522.jpg) |
| `classic-transit-olive` | Classic Transit olive | [Photo](https://commons.wikimedia.org/wiki/File:Ford_Transit_BW_2016-09-03_13-49-03.jpg) |

**Transit fleet white.** Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

**Classic Transit olive.** Olive green photographed on a classic Transit, adapted to the fictional van's modern body. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

## Cycles

### Bendy Cargo Bicycle

Type: `molen.entities.cycle.cargo_bicycle`.

[![Bendy Cargo Bicycle livery comparison: Urban Arrow white frame, Urban Arrow black frame](https://molen.dev/guide-media/liveries/cargo_bicycle.png)](https://molen.dev/guide-media/liveries/cargo_bicycle.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `urban-arrow-white-frame` | Urban Arrow white frame | [Photo](https://commons.wikimedia.org/wiki/File:Urban_Arrow_Bioflair.jpg) |
| `urban-arrow-black-frame` | Urban Arrow black frame | [Photo](https://commons.wikimedia.org/wiki/File:Urban_Arrow,_Cyclingworld_Europe_2025,_Meerbusch_(P1045016).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy City Bicycle

Type: `molen.entities.cycle.city_bicycle`.

[![Bendy City Bicycle livery comparison: Van Stael brown, Gazelle pale blue](https://molen.dev/guide-media/liveries/city_bicycle.png)](https://molen.dev/guide-media/liveries/city_bicycle.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `van-stael-brown` | Van Stael brown | [Photo](https://commons.wikimedia.org/wiki/File:Gazelle_Van_Stael_Velo_(2017).jpg) |
| `gazelle-pale-blue` | Gazelle pale blue | [Photo](https://commons.wikimedia.org/wiki/File:Gazelle_bicycle,_Bratislava,_2023-01-30_11.19.37.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Cruiser Motorcycle

Type: `molen.entities.cycle.cruiser_motorcycle`.

[![Bendy Cruiser Motorcycle livery comparison: Softail black, Heritage red and cream](https://molen.dev/guide-media/liveries/cruiser_motorcycle.png)](https://molen.dev/guide-media/liveries/cruiser_motorcycle.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `softail-black` | Softail black | [Photo](https://commons.wikimedia.org/wiki/File:Harley-Davidson_Softail_Springer_Screamin%27_Eagle_2008.jpg) |
| `heritage-red-and-cream` | Heritage red and cream | [Photo](https://commons.wikimedia.org/wiki/File:Harley-Davidson_Softail_Heritage_(1).jpg) |

**Softail black.** Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

**Heritage red and cream.** Red body and cream tank inset adapted from the pictured Heritage Softail to the Bendy cruiser. The tank panel, body geometry and equipment are simplified; logos and pinstripes are omitted. Paint tones are visual approximations.

### Bendy E-Board

Type: `molen.entities.cycle.electric_skateboard`.

[![Bendy E-Board livery comparison: Bamboo, Red stain](https://molen.dev/guide-media/liveries/electric_skateboard.png)](https://molen.dev/guide-media/liveries/electric_skateboard.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `bamboo` | Bamboo | [Photo](https://commons.wikimedia.org/wiki/File:Electric_skateboard_at_TED.jpg) |
| `red-stain` | Red stain | [Photo](https://commons.wikimedia.org/wiki/File:Electric_skateboard(800,600,400watt).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy E-Moped

Type: `molen.entities.cycle.electric_moped`.

[![Bendy E-Moped livery comparison: Battery scooter silver, Lime green](https://molen.dev/guide-media/liveries/electric_moped.png)](https://molen.dev/guide-media/liveries/electric_moped.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `battery-silver` | Battery scooter silver | [Photo](https://commons.wikimedia.org/wiki/File:Yadea_G5_2023-09-24.jpg) |
| `lime-green` | Lime green | [Photo](https://commons.wikimedia.org/wiki/File:Niu_UQi_Sport_Electric_Scooter.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Moped

Type: `molen.entities.cycle.underbone_moped`.

[![Bendy Moped livery comparison: Step-through blue-grey, Commuter gloss black](https://molen.dev/guide-media/liveries/underbone_moped.png)](https://molen.dev/guide-media/liveries/underbone_moped.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `step-through-blue` | Step-through blue-grey | [Photo](https://commons.wikimedia.org/wiki/File:Honda_super_cub,_1st_Gen._1958,_Left_side.jpg) |
| `commuter-black` | Commuter gloss black | [Photo](https://commons.wikimedia.org/wiki/File:2026_Honda_Wave_110_Special_Edition_(Alloy_Type).jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Motorcycle

Type: `molen.entities.cycle.standard_motorcycle`.

[![Bendy Motorcycle livery comparison: Honda Hornet red, Honda CB500 green](https://molen.dev/guide-media/liveries/standard_motorcycle.png)](https://molen.dev/guide-media/liveries/standard_motorcycle.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `honda-hornet-red` | Honda Hornet red | [Photo](https://commons.wikimedia.org/wiki/File:Honda_CB500_Hornet_2026.jpg) |
| `honda-cb500-green` | Honda CB500 green | [Photo](https://commons.wikimedia.org/wiki/File:Honda_CB500_twin.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Road Bicycle

Type: `molen.entities.cycle.road_bicycle`.

[![Bendy Road Bicycle livery comparison: Trek red, Trek navy](https://molen.dev/guide-media/liveries/road_bicycle.png)](https://molen.dev/guide-media/liveries/road_bicycle.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `trek-red` | Trek red | [Photo](https://commons.wikimedia.org/wiki/File:Trek_Madone_detail,_Giro_d%27Italia_2023_(53309340988).jpg) |
| `trek-navy` | Trek navy | [Photo](https://commons.wikimedia.org/wiki/File:2005_Trek_Madone.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Scooter

Type: `molen.entities.cycle.motor_scooter`.

[![Bendy Scooter livery comparison: Vespa red, Primavera white](https://molen.dev/guide-media/liveries/motor_scooter.png)](https://molen.dev/guide-media/liveries/motor_scooter.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `vespa-red` | Vespa red | [Photo](https://commons.wikimedia.org/wiki/File:Vespa_Prima_125b.jpg) |
| `primavera-white` | Primavera white | [Photo](https://commons.wikimedia.org/wiki/File:08-2024_Vespa_Primavera_Alter-Markt_Potsdam.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Share Scooter

Type: `molen.entities.cycle.kick_scooter`.

[![Bendy Share Scooter livery comparison: Black, Graphite](https://molen.dev/guide-media/liveries/kick_scooter.png)](https://molen.dev/guide-media/liveries/kick_scooter.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `black` | Black | [Photo](https://commons.wikimedia.org/wiki/File:Xiaomi_M365_Scooter.jpg) |
| `graphite` | Graphite | [Photo](https://commons.wikimedia.org/wiki/File:Elektrische-tretroller.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Skateboard

Type: `molen.entities.cycle.skateboard`.

[![Bendy Skateboard livery comparison: Green graphic, Blue graphic](https://molen.dev/guide-media/liveries/skateboard.png)](https://molen.dev/guide-media/liveries/skateboard.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `green-graphic` | Green graphic | [Photo](https://commons.wikimedia.org/wiki/File:Nash_Vintage_60's_Wooden_Deck_Shark_Skateboard.jpg) |
| `blue-graphic` | Blue graphic | [Photo](https://commons.wikimedia.org/wiki/File:Street-skateboard.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Skis

Type: `molen.entities.cycle.skis`.

[![Bendy Skis livery comparison: Black topsheet, White topsheet](https://molen.dev/guide-media/liveries/skis.png)](https://molen.dev/guide-media/liveries/skis.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `black-topsheet` | Black topsheet | [Photo](https://commons.wikimedia.org/wiki/File:Rossignol_Experience_88_Ti_Skis.jpg) |
| `white-topsheet` | White topsheet | [Photo](https://commons.wikimedia.org/wiki/File:Snowborad_and_ski.jpeg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Snowboard

Type: `molen.entities.cycle.snowboard`.

[![Bendy Snowboard livery comparison: White deck, Black deck](https://molen.dev/guide-media/liveries/snowboard.png)](https://molen.dev/guide-media/liveries/snowboard.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `white-deck` | White deck | [Photo](https://commons.wikimedia.org/wiki/File:White-Snowboard-With-Bindings.jpg) |
| `black-deck` | Black deck | [Photo](https://commons.wikimedia.org/wiki/File:Snowboard-In-The-Snow-2008.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

## Transit

### Bendy Bus

Type: `molen.entities.transit.bus`.

[![Bendy Bus livery comparison: London Transit white and blue, Xcelsior blue](https://molen.dev/guide-media/liveries/bus.png)](https://molen.dev/guide-media/liveries/bus.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `london-transit-white-and-blue` | London Transit white and blue | [Photo](https://commons.wikimedia.org/wiki/File:New_Flyer_Xcelsior_in_London_Transit_livery,_London,_Ontario,_2026-08-01.jpg) |
| `xcelsior-blue` | Xcelsior blue | [Photo](https://commons.wikimedia.org/wiki/File:New_Flyer_Xcelsior.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Light Rail

Type: `molen.entities.transit.lightrail`.

[![Bendy Light Rail livery comparison: Avanto white and blue, San Diego red](https://molen.dev/guide-media/liveries/lightrail.png)](https://molen.dev/guide-media/liveries/lightrail.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `avanto-white-and-blue` | Avanto white and blue | [Photo](https://commons.wikimedia.org/wiki/File:Siemens_Avanto_U25500_TT18_Thann.jpg) |
| `san-diego-red` | San Diego red | [Photo](https://commons.wikimedia.org/wiki/File:Siemens_S70-San_Diego_Trolley.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

## Watercraft

### Bendy Bulk Carrier

Type: `molen.entities.watercraft.bulk_carrier`.

[![Bendy Bulk Carrier livery comparison: Darya Ganga red hull, Szare Szeregi blue hull](https://molen.dev/guide-media/liveries/bulk_carrier.png)](https://molen.dev/guide-media/liveries/bulk_carrier.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `darya-ganga-red-hull` | Darya Ganga red hull | [Photo](https://commons.wikimedia.org/wiki/File:Bulk_carrier_Darya_Ganga_at_Alcoa_Jetty,_November_2022_16.jpg) |
| `szare-szeregi-blue-hull` | Szare Szeregi blue hull | [Photo](https://commons.wikimedia.org/wiki/File:2023-02-25_SZARE_SZEREGI_-_IMO_9708057.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Car Ferry

Type: `molen.entities.watercraft.car_ferry`.

[![Bendy Car Ferry livery comparison: Washington green and white, Jurmo white and yellow](https://molen.dev/guide-media/liveries/car_ferry.png)](https://molen.dev/guide-media/liveries/car_ferry.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `washington-green-and-white` | Washington green and white | [Photo](https://commons.wikimedia.org/wiki/File:Washington_State_Ferry_2.jpg) |
| `jurmo-white-and-yellow` | Jurmo white and yellow | [Photo](https://commons.wikimedia.org/wiki/File:Finferries_ship_Jurmo.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Container Ship

Type: `molen.entities.watercraft.container_ship`.

[![Bendy Container Ship livery comparison: Maersk turquoise hull, Ludwigshafen Express black hull](https://molen.dev/guide-media/liveries/container_ship.png)](https://molen.dev/guide-media/liveries/container_ship.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `maersk-turquoise-hull` | Maersk turquoise hull | [Photo](https://commons.wikimedia.org/wiki/File:MAERSK_HANOI_Container_Ship_(Port_Koper_SIKOP,_2023).jpg) |
| `ludwigshafen-express-black-hull` | Ludwigshafen Express black hull | [Photo](https://commons.wikimedia.org/wiki/File:Hapag-Lloyd-Ship.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Fishing Boat

Type: `molen.entities.watercraft.fishing_boat`.

[![Bendy Fishing Boat livery comparison: Bodo blue hull, Bingo red hull](https://molen.dev/guide-media/liveries/fishing_boat.png)](https://molen.dev/guide-media/liveries/fishing_boat.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `bodo-blue-hull` | Bodo blue hull | [Photo](https://commons.wikimedia.org/wiki/File:Fischerboot_vor_Bod%C3%B8.jpg) |
| `bingo-red-hull` | Bingo red hull | [Photo](https://commons.wikimedia.org/wiki/File:2015-09-19_01_BINGO_III_-_GR_2-122_%E2%80%93_MMSI_331214000.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Passenger Ferry

Type: `molen.entities.watercraft.passenger_ferry`.

[![Bendy Passenger Ferry livery comparison: Thames white and navy, Canal waterbus black and cream](https://molen.dev/guide-media/liveries/passenger_ferry.png)](https://molen.dev/guide-media/liveries/passenger_ferry.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `thames-white-and-navy` | Thames white and navy | [Photo](https://commons.wikimedia.org/wiki/File:Thames_Clipper_-_geograph.org.uk_-_1154399.jpg) |
| `canal-waterbus-black-and-cream` | Canal waterbus black and cream | [Photo](https://commons.wikimedia.org/wiki/File:Little_Venice_waterbus,_London_-_geograph.org.uk_-_3137027.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Sailboat

Type: `molen.entities.watercraft.sailboat`.

[![Bendy Sailboat livery comparison: Oceanis white hull, Blue yacht hull](https://molen.dev/guide-media/liveries/sailboat.png)](https://molen.dev/guide-media/liveries/sailboat.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `oceanis-white-hull` | Oceanis white hull | [Photo](https://commons.wikimedia.org/wiki/File:Beneteau_Oceanis_281_sailboat_Attitude_I_1729.jpg) |
| `blue-yacht-hull` | Blue yacht hull | [Photo](https://commons.wikimedia.org/wiki/File:Sailing_yacht_Tamer_II_during_re-launch.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Speedboat

Type: `molen.entities.watercraft.speedboat`.

[![Bendy Speedboat livery comparison: Bayliner black hull, Bayliner ivory hull](https://molen.dev/guide-media/liveries/speedboat.png)](https://molen.dev/guide-media/liveries/speedboat.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `bayliner-black-hull` | Bayliner black hull | [Photo](https://commons.wikimedia.org/wiki/File:2019_Bayliner_VR5.jpg) |
| `bayliner-ivory-hull` | Bayliner ivory hull | [Photo](https://commons.wikimedia.org/wiki/File:Bayliner_175,_port_side.JPG) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

### Bendy Tugboat

Type: `molen.entities.watercraft.tugboat`.

[![Bendy Tugboat livery comparison: Wulf black hull, Damen red hull](https://molen.dev/guide-media/liveries/tugboat.png)](https://molen.dev/guide-media/liveries/tugboat.png)

| Livery id | Appearance | Photographs |
| --- | --- | --- |
| `wulf-black-hull` | Wulf black hull | [Photo](https://commons.wikimedia.org/wiki/File:WULF_4_(49725434131).jpg) |
| `damen-red-hull` | Damen red hull | [Photo](https://commons.wikimedia.org/wiki/File:2_damen_asd_tug_3212_512501_baladha.jpg) |

Paint colors studied from the linked photograph. The photographed vehicle may differ in year, trim or body style; this recipe adapts its visible finish to the catalog model. Color values are visual approximations, not measured paint codes. Accessories and any advertising in the photograph are not part of the paint recipe.

## Refresh the gallery

In the engine repository, edit `content/entities/source/liveries.json`, validate and propagate the recipes, capture changed sheets, then regenerate the guides:

```sh
node packages/entities/scripts/generate-liveries.mjs
node packages/entities/scripts/preview-liveries.mjs --capture
node docs-site/scripts/generate-livery-gallery.mjs
```

The capture command reuses sheets whose model, recipe and camera hashes still match. Documentation builds verify and copy one small summary image per vehicle; they do not download reference photos or render models. Bulk captures stay local.
