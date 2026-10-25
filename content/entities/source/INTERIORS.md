# Fleet interiors and reference ledger

This pass authors cabin/helm/control profiles for all 142 controllable models.
Road vehicles and RVs use model-specific instrument arrangements, vents, selectors, steering
wheels, trim, storage and door fittings. Boats have purpose-specific helms; transit has distinct
bus and rail desks; aircraft retain their model-owned instrument pivots and gain close-view
hardware. Everything is original polygon geometry, without photographic textures.

The geometry is **generation-informed and approximate**, not a certified reproduction of every
trim. Existing per-model steering-side/seat conventions remain in place; a photograph's
steering side may differ. Screens are diagrammatic; the game HUD supplies live numeric telemetry.
Analog speed pointers and steering controls retain model-owned signal bindings.

## Review

Current turntables, lit three-quarter, operator and cabin captures stay in each bundle's ignored
`shots/` directory. The existing collection previews summarize the current cabin views.
[Verification report](interior-review.json) pins source/runtime hashes and checks.

Browse the [MINI/Acura cabins](../mini-acura-interiors-preview.png),
[RV cabins](../rv-interiors-preview.png), [regional fleet](../regional-vehicles-interiors-preview.png),
[boat helms](../watercraft-interiors-preview.png) and [aircraft](../aircraft-interiors-preview.png).

## Sources and licenses

Checked 22 October 2026. **86 selected photo references**, including
**20 CC0/public-domain sources**. File-page licenses were checked individually;
Commons' CC0 metadata license is not the license of every photograph. Images were inspected
locally as research references and are not shipped in this pack. Exact title, author, source
revision, license link and generation caveats are in [interior-references.json](interior-references.json).

[CC BY](https://creativecommons.org/licenses/by/4.0/) requires attribution, a license link and
indication of modifications when sharing the licensed work. [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/)
also requires the same license for adaptations. Open-source software status does not replace
those terms. This ledger records reference provenance; it does not relicense photographs under MIT.

| Model | Photograph / creator | License | Match / limitation |
| --- | --- | --- | --- |
| acura-mdx-2019 | [2018 Acura MDX interior.jpg](https://commons.wikimedia.org/wiki/File:2018_Acura_MDX_interior.jpg) — Deathpallie325 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| alfa-romeo-giulia-2018 | [2020 ALFA ROMEO GIULIA INTERIOR IN BRUNEI.jpg](https://commons.wikimedia.org/wiki/File:2020_ALFA_ROMEO_GIULIA_INTERIOR_IN_BRUNEI.jpg) — AIMHO'S REBELLION 8490s | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same generation; 2020 console refresh is not copied to the 2018 model. |
| audi-tt-2021 | [Audi TT Coupé 1.8 TFSI (8S) interior.jpg](https://commons.wikimedia.org/wiki/File:Audi_TT_Coup%C3%A9_1.8_TFSI_(8S)_interior.jpg) — Tokumeigakarinoaoshima | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| bmw-i3-2017 | [The interior of BMW i3.JPG](https://commons.wikimedia.org/wiki/File:The_interior_of_BMW_i3.JPG) — Tokumeigakarinoaoshima | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| byd-seagull-2024 | [BYD Seagull interior.jpg](https://commons.wikimedia.org/wiki/File:BYD_Seagull_interior.jpg) — GZrex | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| chevrolet-colorado-2025 | [2024 Chevrolet Colorado interior.jpg](https://commons.wikimedia.org/wiki/File:2024_Chevrolet_Colorado_interior.jpg) — Deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| chevrolet-corvette-2014 | [Chevrolet Corvette (C7) Stingray interior (16133754430).jpg](https://commons.wikimedia.org/wiki/File:Chevrolet_Corvette_(C7)_Stingray_interior_(16133754430).jpg) — Yahya S. from Livonia, United States | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| chevrolet-equinox-2025 | [2025 Chevrolet Equinox interior.jpg](https://commons.wikimedia.org/wiki/File:2025_Chevrolet_Equinox_interior.jpg) — Deathpallie325 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| chevrolet-silverado-1500-2025 | [2022 Chevrolet Silverado facelift interior.jpg](https://commons.wikimedia.org/wiki/File:2022_Chevrolet_Silverado_facelift_interior.jpg) — deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| chevrolet-volt-2011 | [Front Interior - 2012 Chevrolet Volt (7686099030).jpg](https://commons.wikimedia.org/wiki/File:Front_Interior_-_2012_Chevrolet_Volt_(7686099030).jpg) — Michael Sheehan | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| chrysler-300-2015 | [Chrysler 300C Luxury interior.jpg](https://commons.wikimedia.org/wiki/File:Chrysler_300C_Luxury_interior.jpg) — TTTNIS | [Public domain](https://commons.wikimedia.org/wiki/Commons:Public_domain) | Same second-generation fascia; 2015 rotary selector is authored separately. |
| dodge-challenger-2018 | [2015 Dodge Challenger SRT 392 interior-drivers position.jpg](https://commons.wikimedia.org/wiki/File:2015_Dodge_Challenger_SRT_392_interior-drivers_position.jpg) — McChizzle | [Public domain](https://commons.wikimedia.org/wiki/Commons:Public_domain) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| fiat-500-2012 | [2012 Fiat 500 Interior (6879416809).jpg](https://commons.wikimedia.org/wiki/File:2012_Fiat_500_Interior_(6879416809).jpg) — qJake | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| ford-bronco-2025 | [2022 Ford Bronco interior.jpg](https://commons.wikimedia.org/wiki/File:2022_Ford_Bronco_interior.jpg) — deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| ford-escape-2025 | [2024 Ford Escape Plug-in Hybrid interior.jpg](https://commons.wikimedia.org/wiki/File:2024_Ford_Escape_Plug-in_Hybrid_interior.jpg) — Deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| ford-f-150-2025 | [2022 Ford F-150 interior.jpg](https://commons.wikimedia.org/wiki/File:2022_Ford_F-150_interior.jpg) — deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| ford-gt-2005 | [Ford GT 2006 Cockpit CECF 9April2011 (14414270998) (2).jpg](https://commons.wikimedia.org/wiki/File:Ford_GT_2006_Cockpit_CECF_9April2011_(14414270998)_(2).jpg) — Valder137 | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| ford-ranger-2025 | [2024 Ford Ranger interior.jpg](https://commons.wikimedia.org/wiki/File:2024_Ford_Ranger_interior.jpg) — Deathpallie325 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| genesis-g80-2024 | [GENESIS G80 (RG3) CHINA VERSION INTERIOR.jpg](https://commons.wikimedia.org/wiki/File:GENESIS_G80_(RG3)_CHINA_VERSION_INTERIOR.jpg) — Dinkun Chen | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | RG3 pre-facelift China-spec panel; not the later 27-inch facelift OLED layout. |
| gmc-hummer-ev-suv-2024 | [2023 Hummer EV SUT interior.jpg](https://commons.wikimedia.org/wiki/File:2023_Hummer_EV_SUT_interior.jpg) — deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | SUT shares the basic EV SUV instrument and center-screen architecture; cabin trim differs. |
| gmc-sierra-1500-2025 | [2022 GMC Sierra facelift interior.jpg](https://commons.wikimedia.org/wiki/File:2022_GMC_Sierra_facelift_interior.jpg) — deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| honda-accord-2025 | [2023 Honda Accord interior.jpg](https://commons.wikimedia.org/wiki/File:2023_Honda_Accord_interior.jpg) — deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| honda-civic-2025 | [2021 Honda Civic RS 1.5 FE1 interior (20211117).jpg](https://commons.wikimedia.org/wiki/File:2021_Honda_Civic_RS_1.5_FE1_interior_(20211117).jpg) — オーバードライブ83 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | FE-generation RHD reference; driver side remains the existing Molen left-hand-drive convention. |
| honda-cr-v-2025 | [2023 Honda CR-V interior.jpg](https://commons.wikimedia.org/wiki/File:2023_Honda_CR-V_interior.jpg) — deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| honda-odyssey-2025 | [2023 Honda Odyssey interior.jpg](https://commons.wikimedia.org/wiki/File:2023_Honda_Odyssey_interior.jpg) — deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| honda-pilot-2025 | [2023 Honda Pilot interior.jpg](https://commons.wikimedia.org/wiki/File:2023_Honda_Pilot_interior.jpg) — deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| hyundai-casper-electric-2024 | [2024 Hyundai Casper Electric interior.png](https://commons.wikimedia.org/wiki/File:2024_Hyundai_Casper_Electric_interior.png) — jasonryudotnet | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| hyundai-ioniq-5-2022 | [Hyundai IONIQ5 interior in Japan.jpg](https://commons.wikimedia.org/wiki/File:Hyundai_IONIQ5_interior_in_Japan.jpg) — 東経待機 | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| hyundai-palisade-2025 | [2023 Hyundai Palisade interior.jpg](https://commons.wikimedia.org/wiki/File:2023_Hyundai_Palisade_interior.jpg) — deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| hyundai-staria-2024 | [Hyundai Staria Lounge US4 Interior (1).jpg](https://commons.wikimedia.org/wiki/File:Hyundai_Staria_Lounge_US4_Interior_(1).jpg) — Damian B Oh | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| hyundai-veloster-2020 | [2021 Hyundai Veloster 2.0 Cobalt Eclipse interior view in Brunei.jpg](https://commons.wikimedia.org/wiki/File:2021_Hyundai_Veloster_2.0_Cobalt_Eclipse_interior_view_in_Brunei.jpg) — AIMHO'S REBELLION 8490s | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| jaguar-i-pace-2019 | [2018 Jaguar I-Pace EV400 AWD (Pre-production) Interior.jpg](https://commons.wikimedia.org/wiki/File:2018_Jaguar_I-Pace_EV400_AWD_(Pre-production)_Interior.jpg) — Vauxford | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Pre-production same-generation panel; approximate production controls. |
| jeep-grand-cherokee-2025 | [2021 Jeep Grand Cherokee L interior.jpg](https://commons.wikimedia.org/wiki/File:2021_Jeep_Grand_Cherokee_L_interior.jpg) — deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | WL long-wheelbase reference; basic fascia shared with short-wheelbase model. |
| jeep-wrangler-2025 | [2024 Jeep Wrangler Unlimited interior.jpg](https://commons.wikimedia.org/wiki/File:2024_Jeep_Wrangler_Unlimited_interior.jpg) — Deathpallie325 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| kia-k5-2024 | [2024 Kia K5 interior.jpg](https://commons.wikimedia.org/wiki/File:2024_Kia_K5_interior.jpg) — deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| kia-soul-2015 | [2017 Kia Soul EV (Cockpit).jpg](https://commons.wikimedia.org/wiki/File:2017_Kia_Soul_EV_(Cockpit).jpg) — Chanokchon | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Second-generation EV instrument treatment differs; used for vent and center-stack arrangement. |
| kia-telluride-2025 | [2023 Kia Telluride interior.jpg](https://commons.wikimedia.org/wiki/File:2023_Kia_Telluride_interior.jpg) — deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| land-rover-defender-90-2023 | [Land Rover DEFENDER 90 HSE EXPLORER PACK (3BA-LE62XCA) interior.jpg](https://commons.wikimedia.org/wiki/File:Land_Rover_DEFENDER_90_HSE_EXPLORER_PACK_(3BA-LE62XCA)_interior.jpg) — Tokumeigakarinoaoshima | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| mazda-cx-5-2025 | [2025 Mazda CX-5 2.5 AWD Turbo interior.jpg](https://commons.wikimedia.org/wiki/File:2025_Mazda_CX-5_2.5_AWD_Turbo_interior.jpg) — Ethan Llamas | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| mazda-mx-5-miata-2016 | [Mazda MX-5 ND 35th Anniversary Edition Convertible - interior view.jpg](https://commons.wikimedia.org/wiki/File:Mazda_MX-5_ND_35th_Anniversary_Edition_Convertible_-_interior_view.jpg) — Ethan Llamas | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | ND-family reference has a later infotainment screen; 2016 small tablet retained. |
| mini-cooper-2013 | [Mini John Cooper Works interior.jpg](https://commons.wikimedia.org/wiki/File:Mini_John_Cooper_Works_interior.jpg) — TTTNIS | [Public domain](https://commons.wikimedia.org/wiki/Commons:Public_domain) | R56 John Cooper Works trim; central speedometer and separate tachometer, not F56 infotainment. |
| mini-cooper-countryman-2012 | [Interior - 2012 Mini Cooper Countryman (8025569433).jpg](https://commons.wikimedia.org/wiki/File:Interior_-_2012_Mini_Cooper_Countryman_(8025569433).jpg) — Michael Sheehan | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| nissan-370z-2009 | [Nissan FAIRLADY Z NISMO (Z34) interior.JPG](https://commons.wikimedia.org/wiki/File:Nissan_FAIRLADY_Z_NISMO_(Z34)_interior.JPG) — Tokumeigakarinoaoshima | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | Z34 NISMO trim; same three driver instruments and auxiliary pods, simplified base wheel. |
| nissan-altima-2025 | [2023 Nissan Altima interior.jpg](https://commons.wikimedia.org/wiki/File:2023_Nissan_Altima_interior.jpg) — deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| nissan-leaf-2012 | [Dashboard-Nissan-Leaf.jpg](https://commons.wikimedia.org/wiki/File:Dashboard-Nissan-Leaf.jpg) — Gereon Meyer | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| nissan-rogue-2025 | [2025 Nissan Rogue interior.jpg](https://commons.wikimedia.org/wiki/File:2025_Nissan_Rogue_interior.jpg) — Deathpallie325 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| peugeot-208-2024 | [Peugeot 208 GT (5BA-P21HN05) interior.jpg](https://commons.wikimedia.org/wiki/File:Peugeot_208_GT_(5BA-P21HN05)_interior.jpg) — Tokumeigakarinoaoshima | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| pontiac-solstice-2007 | [2006 Pontiac Solstice interior.jpg](https://commons.wikimedia.org/wiki/File:2006_Pontiac_Solstice_interior.jpg) — No machine-readable author provided. Sfoskett~commonswiki assumed (based on copyright claims). | [CC BY-SA 3.0](http://creativecommons.org/licenses/by-sa/3.0/) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| porsche-911-2017 | [2017 Porsche 911 Turbo S Cabriolet 3.8 Interior.jpg](https://commons.wikimedia.org/wiki/File:2017_Porsche_911_Turbo_S_Cabriolet_3.8_Interior.jpg) — Vauxford | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | 991.2 Turbo S trim; five-gauge arrangement retained, base controls simplified. |
| ram-1500-2025 | [2022 Ram 1500 interior.jpg](https://commons.wikimedia.org/wiki/File:2022_Ram_1500_interior.jpg) — deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | DT portrait-screen family; screen size and selector approximate the 2025 refresh. |
| saab-9-3-sportcombi-2011 | [Saab 9-3 Convertible (2008) interior.jpg](https://commons.wikimedia.org/wiki/File:Saab_9-3_Convertible_(2008)_interior.jpg) — Magnus Bäck | [Public domain](https://commons.wikimedia.org/wiki/Commons:Public_domain) | 2008 facelift convertible shares the SportCombi instrument panel; body interior differs. |
| smart-fortwo-2009 | [2010 Smart ForTwo Passion Coupe interior 1.JPG](https://commons.wikimedia.org/wiki/File:2010_Smart_ForTwo_Passion_Coupe_interior_1.JPG) — BrokenSphere | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| subaru-brz-2014 | [Subaru BRZ S (DBA-ZC6) interior.jpg](https://commons.wikimedia.org/wiki/File:Subaru_BRZ_S_(DBA-ZC6)_interior.jpg) — Tokumeigakarinoaoshima | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| subaru-forester-2025 | [2025 Subaru Forester Sport (United States) interior.jpg](https://commons.wikimedia.org/wiki/File:2025_Subaru_Forester_Sport_(United_States)_interior.jpg) — Charles | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| subaru-outback-2025 | [2023 Subaru Outback Limited cockpit view.jpg](https://commons.wikimedia.org/wiki/File:2023_Subaru_Outback_Limited_cockpit_view.jpg) — Colin Venable | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| suzuki-jimny-sierra-2024 | [Suzuki Jimny SIERRA JC (3BA-JB74W-GJCR-J) interior.jpg](https://commons.wikimedia.org/wiki/File:Suzuki_Jimny_SIERRA_JC_(3BA-JB74W-GJCR-J)_interior.jpg) — Tokumeigakarinoaoshima | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| suzuki-swift-2024 | [Suzuki Swift HYBRID MX 5MT 2023 JAPAN Interior.jpg](https://commons.wikimedia.org/wiki/File:Suzuki_Swift_HYBRID_MX_5MT_2023_JAPAN_Interior.jpg) — Suzuki-Ham | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| tesla-model-3-2025 | [Upgraded Tesla Model 3 - 2023 - Interior 2.jpg](https://commons.wikimedia.org/wiki/File:Upgraded_Tesla_Model_3_-_2023_-_Interior_2.jpg) — Mpelas199 | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| toyota-alphard-2024 | [Toyota ALPHARD Z 2WD (3BA-AGH40W-PFXLK) interior.jpg](https://commons.wikimedia.org/wiki/File:Toyota_ALPHARD_Z_2WD_(3BA-AGH40W-PFXLK)_interior.jpg) — Tokumeigakarinoaoshima | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Fourth-generation AGH40W Z dashboard; steering side and trim differ from the Molen convention. |
| toyota-camry-2025 | [2025 Toyota Camry Hybrid XSE (United States) interior.png](https://commons.wikimedia.org/wiki/File:2025_Toyota_Camry_Hybrid_XSE_(United_States)_interior.png) — Autosdeprimera | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| toyota-corolla-2025 | [2020 Toyota Corolla Altis 1.6 interior view in Brunei.jpg](https://commons.wikimedia.org/wiki/File:2020_Toyota_Corolla_Altis_1.6_interior_view_in_Brunei.jpg) — AIMHO'S REBELLION 8490s | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | E210 Altis market/trim reference; screen size and driver cluster vary by region. |
| toyota-fj-cruiser-2010 | [Toyota FJ Cruiser interior.JPG](https://commons.wikimedia.org/wiki/File:Toyota_FJ_Cruiser_interior.JPG) — Tokumeigakarinoaoshima | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| toyota-gr-supra-2024 | [The interior of Toyota GR Supra RZ (3BA-DB42-ZRRW).jpg](https://commons.wikimedia.org/wiki/File:The_interior_of_Toyota_GR_Supra_RZ_(3BA-DB42-ZRRW).jpg) — Tokumeigakarinoaoshima | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| toyota-hiace-2024 | [Toyota Hiace KDH202L 3.0 Commuter - interior view.jpg](https://commons.wikimedia.org/wiki/File:Toyota_Hiace_KDH202L_3.0_Commuter_-_interior_view.jpg) — Ethan Llamas | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | H200 Commuter fascia reference; Sesfikile trim and steering side differ. |
| toyota-highlander-2025 | [2023 Toyota Highlander interior.jpg](https://commons.wikimedia.org/wiki/File:2023_Toyota_Highlander_interior.jpg) — deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| toyota-hilux-2024 | [Toyota Hilux GUN126 2.8 GR Sport - interior view.jpg](https://commons.wikimedia.org/wiki/File:Toyota_Hilux_GUN126_2.8_GR_Sport_-_interior_view.jpg) — Ethan Llamas | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| toyota-prius-2024 | [Toyota PRIUS Z 2WD (6AA-MXWH60-AHXHB) interior.jpg](https://commons.wikimedia.org/wiki/File:Toyota_PRIUS_Z_2WD_(6AA-MXWH60-AHXHB)_interior.jpg) — Tokumeigakarinoaoshima | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| toyota-rav4-2025 | [The interior of Toyota RAV4 Adventure (6BA-MXAA54-ANXVB).jpg](https://commons.wikimedia.org/wiki/File:The_interior_of_Toyota_RAV4_Adventure_(6BA-MXAA54-ANXVB).jpg) — Tokumeigakarinoaoshima | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| toyota-sienna-2025 | [TOYOTA GRANVIA (XL40) (TOYOTA SIENNA (XL40)) INTERIOR.jpg](https://commons.wikimedia.org/wiki/File:TOYOTA_GRANVIA_(XL40)_(TOYOTA_SIENNA_(XL40))_INTERIOR.jpg) — Dinkun Chen | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | XL40 China-market reference; screen and trim simplified for the existing fleet model. |
| toyota-tacoma-2025 | [2024 Toyota Tacoma TRD Sport interior.jpg](https://commons.wikimedia.org/wiki/File:2024_Toyota_Tacoma_TRD_Sport_interior.jpg) — Deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| toyota-tundra-2025 | [2023 Toyota Tundra interior.jpg](https://commons.wikimedia.org/wiki/File:2023_Toyota_Tundra_interior.jpg) — deathpallie325 | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| toyota-yaris-2024 | [The interior of Toyota YARIS HYBRID G 2WD (6AA-MXPH10-AHXGB).jpg](https://commons.wikimedia.org/wiki/File:The_interior_of_Toyota_YARIS_HYBRID_G_2WD_(6AA-MXPH10-AHXGB).jpg) — Tokumeigakarinoaoshima | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| volkswagen-golf-gti-2016 | [Volkswagen Golf GTI (ABA-AUCHH) interior.jpg](https://commons.wikimedia.org/wiki/File:Volkswagen_Golf_GTI_(ABA-AUCHH)_interior.jpg) — Tokumeigakarinoaoshima | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| volvo-v70-2008 | [Volvo V70 T4 SE interior.jpg](https://commons.wikimedia.org/wiki/File:Volvo_V70_T4_SE_interior.jpg) — TTTNIS | [Public domain](https://commons.wikimedia.org/wiki/Commons:Public_domain) | Same dashboard generation; trim, screen size, steering side and small controls may differ. |
| p-51 | [North American P-51D Mustang cockpit.jpg](https://commons.wikimedia.org/wiki/File:North_American_P-51D_Mustang_cockpit.jpg) — United States Army Air Forces | [Public domain](https://commons.wikimedia.org/wiki/Commons:Public_domain) | Wartime USAAF P-51D cockpit; instrument fittings interpreted, not a serial-specific restoration. |
| airliner | [Boeing 737-300 Cockpit.jpg](https://commons.wikimedia.org/wiki/File:Boeing_737-300_Cockpit.jpg) — Weatherhistory | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | 737-300 analogue for a fictional Bendy flight deck; glass-screen arrangement is original. |
| bus | [2013 in Bonn. BYD ebus (electrical bus). Bus interior. Driver view . Spielvogel.JPG](https://commons.wikimedia.org/wiki/File:2013_in_Bonn._BYD_ebus_(electrical_bus)._Bus_interior._Driver_view_._Spielvogel.JPG) — For a gallery of some more of my uploaded pictures see: here. | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | BYD electric-bus operator station used as a generic city-bus analogue, not a BYD replica. |
| light-rail-car | [Danhai LRT Cab 2.jpg](https://commons.wikimedia.org/wiki/File:Danhai_LRT_Cab_2.jpg) — wctaiwan | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Danhai LRT cab used as a contemporary tram analogue, not a production-vehicle replica. |
| sailboat | [US Navy 050816-N-6775N-126 Hull Technician 1st Class Rick Pellton mans the helm while on watch aboard the sailboat, Coruba.jpg](https://commons.wikimedia.org/wiki/File:US_Navy_050816-N-6775N-126_Hull_Technician_1st_Class_Rick_Pellton_mans_the_helm_while_on_watch_aboard_the_sailboat,_Coruba.jpg) — U.S. Navy photo by Photographer's Mate 2nd Class Justin P. Nesbitt | [Public domain](https://commons.wikimedia.org/wiki/Commons:Public_domain) | US Navy photograph of a small yacht helm; generic Bendy binnacle and cockpit. |
| tugboat | [Learning on a tugboat bridge -a.jpg](https://commons.wikimedia.org/wiki/File:Learning_on_a_tugboat_bridge_-a.jpg) — Adam Cole | [Public domain](https://commons.wikimedia.org/wiki/Commons:Public_domain) | US Navy tug bridge used as a generic workboat reference. |
| bulk-carrier | [Bridge of a bulk carrier with ARPA radar system.jpg](https://commons.wikimedia.org/wiki/File:Bridge_of_a_bulk_carrier_with_ARPA_radar_system.jpg) — Yannbertholet | [Public domain](https://commons.wikimedia.org/wiki/Commons:Public_domain) | Merchant bridge with radar and long console, used as a generic bridge reference. |
| standard-motorcycle | [2009-02-14 Yamaha FZ6 instrument cluster.jpg](https://commons.wikimedia.org/wiki/File:2009-02-14_Yamaha_FZ6_instrument_cluster.jpg) — Ildar Sagdejev (Specious) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Yamaha FZ6 control layout used as a generic road-motorcycle analogue. |
| cruiser-motorcycle | [Tacho einer Harley Davidson.JPG](https://commons.wikimedia.org/wiki/File:Tacho_einer_Harley_Davidson.JPG) — Usien | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) | Tank instrument and wide bar controls used as a generic cruiser analogue. |
| motor-scooter | [Yamaha Cuxi dashboard 20090315.jpg](https://commons.wikimedia.org/wiki/File:Yamaha_Cuxi_dashboard_20090315.jpg) — mr.5/4™ | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | Compact scooter dashboard analogue; original Bendy controls. |
| byd-qin-plus-2024 | [BYD Qin Plus DM-i facelift 003.jpg](https://commons.wikimedia.org/wiki/File:BYD_Qin_Plus_DM-i_facelift_003.jpg) — JustAnotherCarDesigner | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | Later facelift Qin Plus family reference, not an exact 2024 trim; used for separate driver/tablet architecture. Exact 2024 fascia remains approximate. |
| wuling-hongguang-mini-ev-2025 | [Wuling Hongguang Mini EV II 005.jpg](https://commons.wikimedia.org/wiki/File:Wuling_Hongguang_Mini_EV_II_005.jpg) — JustAnotherCarDesigner | [CC0](http://creativecommons.org/publicdomain/zero/1.0/deed.en) | Second-generation four-door MINI EV dashboard, matching the 2025 model family; trim simplified. |

## Original designs and remaining photo gaps

The remaining entries comprise **24 original Bendy designs** and **32 open-photo gaps**.

A gap means no suitably matched, explicitly open-licensed cockpit photograph was verified in
this pass. It does not mean the model is unchanged. Older/newer-generation photos and rear-seat
photos were rejected as dashboard evidence. Generic Bendy designs do not claim production-model
accuracy. Existing manufacturer links remain in individual recipes for further research.

| Model | Status | Limitation |
| --- | --- | --- |
| acura-tl-2013 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| chevrolet-onix-2024 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| chevrolet-ssr-2005 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| chevrolet-traverse-2025 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| chevrolet-trax-2025 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| chrysler-pt-cruiser-2006 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| dacia-duster-2024 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| fiat-strada-2024 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| ford-explorer-2025 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| ford-maverick-2025 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| ford-mustang-2024 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| ford-transit-2021 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| geely-monjaro-2024 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| honda-element-2008 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| honda-n-box-2024 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| hummer-h3-2007 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| hyundai-tucson-2025 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| isuzu-d-max-2024 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| kia-sportage-2025 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| lincoln-continental-2020 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| lucid-air-2022 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| mercedes-benz-sprinter-2019 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| renault-clio-2024 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| renault-kwid-2024 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| rivian-r1t-2023 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| scion-xb-2006 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| skoda-octavia-combi-2024 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| tesla-model-y-2024 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| volkswagen-polo-2024 | open-photo-gap | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| winnebago-view-2022 | open-photo-gap | No open-licensed 2022 View cab photo verified. Official 2022 Winnebago brochure, page 6 (Cab), supports the W907 Sprinter/MBUX layout; brochure images are copyrighted, not public domain. |
| bendy-class-a-compact | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| bendy-class-a-grand | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| bendy-class-a-touring | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| bendy-class-b-camper | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| bendy-class-c-family | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| box-truck | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| compact | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| electric-hatchback | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| offroad | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| pickup | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| sedan | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| sports-coupe | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| station-wagon | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| suv | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| taxi | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| van | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| car-ferry | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| container-ship | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| fishing-boat | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| passenger-ferry | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| speedboat | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| cargo-bicycle | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| city-bicycle | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| road-bicycle | original-bendy-design | No suitably matched, explicitly open-licensed cockpit photo verified in this pass. Original approximate geometry; no claim of exact production trim. |
| oh-6 | open-photo-gap | No explicitly open-licensed OH-6A cockpit photo verified. Existing museum walkaround references remain in aircraft/oh-6/REFERENCES.md; those photos are copyrighted. This pass refines existing hardware and upholstery without changing the reference-informed panel arrangement. |
| cadillac-cts-2010 | open-photo-gap | Rejected first- and third-generation CTS photographs; model targets the second-generation 2010 dashboard. |

The [2022 Winnebago View brochure](https://www.winnebago.com/Files/Images/Winnebago/brochures/2022/2022_View_Digital.X.pdf), page 6, documents the cab equipment; its images are copyrighted and are not counted among the open photo references.

## Authored road layouts

Profiles are stored in [interiors.json](interiors.json). Each model owns its profile and palette;
related production models may share a layout family, just as they share real dashboard architecture.

| Model | Layout | Defining features |
| --- | --- | --- |
| acura-mdx-2019 | acura-dual | Stacked recessed navigation and touch displays, twin analog binnacle, push-button selector |
| acura-tl-2013 | acura-old | Deep upper navigation hood, silver waterfall radio keypad, twin analog gauges |
| alfa-romeo-giulia-2018 | alfa | Twin circular cowls, driver-angled integrated display, round outer vents and wheel start button |
| audi-tt-2021 | tt | Driver-only virtual cockpit, three turbine center vents with integrated climate knobs |
| bmw-i3-2017 | i3 | Floating instrument pod and tablet above a curved wood shelf, open center footwell |
| byd-qin-plus-2024 | byd | Small driver display and large rotating-format landscape tablet, horizontal center vents |
| byd-seagull-2024 | byd-wave | Small raised cluster, wave-shaped fascia, landscape tablet and lower cylindrical switch bar |
| cadillac-cts-2010 | cts | Twin cowl gauges, pop-up navigation hood, vertical vents and silver radio/climate stack |
| chevrolet-colorado-2025 | gm-wide | Separate wide driver and center screens, truck vents and physical climate bank |
| chevrolet-corvette-2014 | corvette | Deep driver binnacle, angled center stack, passenger grab rail and flat-bottom wheel |
| chevrolet-equinox-2025 | gm-wide | Driver-oriented paired wide displays, broad horizontal vents, open console storage |
| chevrolet-onix-2024 | compact-tablet | Two analog gauges, high center tablet and compact three-dial climate stack |
| chevrolet-silverado-1500-2025 | gm-wide | Wide landscape infotainment flanked by truck vents, separate digital driver binnacle |
| chevrolet-ssr-2005 | retro-triple | Three circular instrument recesses, round vents and compact DIN radio stack |
| chevrolet-traverse-2025 | gm-wide | Extra-wide landscape center display, separate driver screen, lower climate rail |
| chevrolet-trax-2025 | gm-linked | Joined driver and center screen surround, round outer vents and rectangular center vents |
| chevrolet-volt-2011 | volt | White center waterfall, separate recessed driver display, upright infotainment panel |
| chrysler-300-2015 | luxury-clock | Uconnect screen between vertical vents, small analog clock, wide twin-dial cluster |
| chrysler-pt-cruiser-2006 | retro-triple | Body-color fascia, hooded circular gauges and paired round center vents above radio |
| dacia-duster-2024 | duster | Angled high screen, Y-themed vent separators, chunky shelf and physical HVAC row |
| dodge-challenger-2018 | muscle | Deep twin round gauges, wide inset center screen and thick horizontal passenger fascia |
| fiat-500-2012 | fiat | Body-color dash, concentric central driver dial, round vents and dash-mounted selector |
| fiat-strada-2024 | utility-tablet | Conventional hooded instruments, high center tablet, rectangular utility vents |
| ford-bronco-2025 | bronco | Upright rugged dashboard, rectangular touchscreen, passenger grab handle and auxiliary switches |
| ford-escape-2025 | ford-wide | Low wide tablet, horizontal vents and separate driver binnacle, rotary selector |
| ford-explorer-2025 | ford-wide | Facelift landscape screen with low climate rail, separate driver binnacle |
| ford-f-150-2025 | f150 | Large inset center screen, tall outer vents, broad digital cluster and trailer-control bank |
| ford-gt-2005 | gt | Seven circular instruments across a long panel, metal center tunnel and toggle bank |
| ford-maverick-2025 | ford-wide | Facelift wide center display, exposed storage shelf and blue-gray molded trim |
| ford-mustang-2024 | mustang | Connected driver and landscape center displays, three rectangular center vents, flat-bottom wheel |
| ford-ranger-2025 | ford-portrait | Tall portrait touchscreen between vertical vents, raised cluster and truck switch bank |
| ford-transit-2021 | transit-van | Hooded analog instruments, upper display recess, dash selector and open storage shelves |
| geely-monjaro-2024 | triple-screen | Continuous three-screen fascia including passenger display, long vent rail and short selector |
| genesis-g80-2024 | genesis | Wide upper navigation display, hooded driver cluster and lower climate panel, rotary controller |
| gmc-hummer-ev-suv-2024 | hummer-ev | Two large separate rectangles, blocky vertical vents, square-edged console and metal grips |
| gmc-sierra-1500-2025 | gm-wide | Wide landscape center screen, digital driver binnacle, wood-toned passenger band |
| honda-accord-2025 | honda-mesh | Long honeycomb vent band, raised landscape tablet, separate digital cluster |
| honda-civic-2025 | honda-mesh | Honeycomb vent strip with projecting adjusters, smaller raised tablet and lower climate knobs |
| honda-cr-v-2025 | honda-mesh | Honeycomb fascia, raised tablet, conventional raised center tunnel and climate dials |
| honda-element-2008 | element | Utility shelf, rectangular center audio stack, large round vents and high dash selector |
| honda-n-box-2024 | kei-high | Raised driver digital pod, shelf-like dash, upper center screen and high selector |
| honda-odyssey-2025 | honda-van | High driver cluster, inset center display, broad shelf and push-button selector stack |
| honda-pilot-2025 | honda-suv | Raised screen above broad horizontal vents, hooded cluster and button selector |
| hummer-h3-2007 | rugged-radio | Deep round gauges, four round vents, compact radio and three rotary HVAC controls |
| hyundai-casper-electric-2024 | casper | Separate instrument and media rectangles, chunky storage shelf, compact column selector |
| hyundai-ioniq-5-2022 | ioniq | Light-framed twin rectangular screens, open center floor and two-spoke wheel |
| hyundai-palisade-2025 | hyundai-bridge | Wide connected instrument and media hood, broad lower vent rail and button console |
| hyundai-staria-2024 | staria | Very high slim driver display, vertical central screen tower and large lower storage recess |
| hyundai-tucson-2025 | hyundai-bridge | Facelift panoramic driver/media bridge above horizontal vent strip and physical climate knobs |
| hyundai-veloster-2020 | sport-tablet | Analog cluster, trapezoidal raised tablet, angular vents and driver-oriented console |
| isuzu-d-max-2024 | truck-tablet | Hooded twin gauges, inset central touchscreen and broad piano-key climate switches |
| jaguar-i-pace-2019 | jaguar | Wide upper infotainment plus lower climate display, digital binnacle and floating center bridge |
| jeep-grand-cherokee-2025 | jeep-luxury | Recessed center display under broad vent rail, digital driver hood and glossy lower control stack |
| jeep-wrangler-2025 | wrangler | Long landscape screen, four circular vents, upright body-color fascia and auxiliary levers |
| kia-k5-2024 | kia-bridge | Wide joined display surround with driver-oriented center panel, slim climate row |
| kia-soul-2015 | soul | Circular upper speaker pods, inset center display and chunky climate dials |
| kia-sportage-2025 | kia-bridge | Angled panoramic display, distinctive tall outer vents and narrow climate bar |
| kia-telluride-2025 | kia-bridge | Panoramic display surround, rectangular lower vents and broad console grab rails |
| land-rover-defender-90-2023 | defender | Exposed structural dash beam, shelf, inset display and high selector with large climate dials |
| lincoln-continental-2020 | lincoln | Inset landscape touchscreen with vertical selector buttons, broad wood passenger fascia |
| lucid-air-2022 | lucid | Three-part curved upper glass cockpit and lower portrait pilot panel, slim vents |
| mazda-cx-5-2025 | mazda | High slim landscape display, sculpted twin-level fascia and console rotary controller |
| mazda-mx-5-miata-2016 | miata | Three-dial driver binnacle, small raised tablet and circular vents, narrow tunnel |
| mercedes-benz-sprinter-2019 | sprinter | W907 twin-dial cluster, integrated center screen, round turbine vents and high storage shelf |
| mini-cooper-2013 | mini-r56 | R56 large central white speedometer, separate wheel-top tachometer and toggle switches |
| mini-cooper-countryman-2012 | mini-r60 | R60 central white speedometer and separate tachometer, vertical center stack and console rail |
| nissan-370z-2009 | z34 | Three driver dials plus three auxiliary pods above the center radio/display recess |
| nissan-altima-2025 | nissan-tablet | Wide raised tablet, twin analog cluster and horizontal vents with physical climate bank |
| nissan-leaf-2012 | leaf | Separate high speed display above lower digital cluster, integrated center stack and small selector puck |
| nissan-rogue-2025 | nissan-tablet | Raised large center tablet, separate driver pod and stepped passenger shelf |
| peugeot-208-2024 | peugeot | High i-Cockpit cluster above a small flat wheel, wide center screen and piano keys |
| pontiac-solstice-2007 | solstice | Round vents, twin driver gauges, driver-angled radio stack and simple three-dial climate bank |
| porsche-911-2017 | porsche | Five overlapping round driver instruments, inset center screen and tall switch-lined tunnel |
| ram-1500-2025 | ram | Tall portrait screen between vertical vents, rotary gear selector and large truck center tunnel |
| renault-clio-2024 | clio | Upright portrait screen, slim rectangular vents and three physical climate dials |
| renault-kwid-2024 | economy | Simple hooded cluster, compact inset touchscreen, round outer vents and open shelf |
| rivian-r1t-2023 | rivian | Separate wide driver and center displays, curved wood fascia and open lower console |
| saab-9-3-sportcombi-2011 | saab | Driver-angled radio/climate stack, green instrument markings, rectangular vent frames |
| scion-xb-2006 | scion-center | High central instrument pod, open driver shelf and vertical center radio/climate stack |
| skoda-octavia-combi-2024 | skoda | High center tablet, two-spoke wheel, slim vent row and small console selector |
| smart-fortwo-2009 | smart | Single driver dial, two small upper auxiliary pods, compact radio and circular vent ends |
| subaru-brz-2014 | brz | Three round instrument recesses, inset DIN media panel, round vents and three climate dials |
| subaru-forester-2025 | subaru | Tall portrait display with vertical side vents, hooded twin analog gauges and broad tunnel |
| subaru-outback-2025 | subaru | Portrait center display framed by vents and physical buttons, deep analog driver binnacle |
| suzuki-jimny-sierra-2024 | jimny | Twin squared-off instrument housings, four round vents, passenger grab handle and transfer lever |
| suzuki-swift-2024 | suzuki | High trapezoidal center screen, conventional twin gauges, lower climate controls |
| tesla-model-3-2025 | tesla-highland | Single landscape screen, concealed horizontal vent, fabric fascia and stalk-free three-spoke wheel |
| tesla-model-y-2024 | tesla-y | Single landscape screen, wood fascia strip, column selector and conventional stalks |
| toyota-alphard-2024 | alphard | Broad sculpted dash with large central screen, wide driver cluster and tall console bridge |
| toyota-camry-2025 | toyota-wide | Large landscape center display, separate driver binnacle and lower physical climate strip |
| toyota-corolla-2025 | toyota-tablet | Upright central tablet, shallow rectangular vents and compact lower climate panel |
| toyota-fj-cruiser-2010 | fj | Body-color upright fascia, three upper auxiliary pods, tall radio and rugged grab handle |
| toyota-gr-supra-2024 | supra | Driver-centered gauge pod, wide raised screen, low horizontal vents and rotary media controller |
| toyota-hiace-2024 | hiace | H200 hooded analog cluster, high dash selector, rectangular radio and broad storage shelves |
| toyota-highlander-2025 | toyota-shelf | Large central screen over open passenger shelf, independent driver hood and climate rail |
| toyota-hilux-2024 | hilux | Twin deeply hooded analog gauges, raised center screen and substantial rectangular vents |
| toyota-prius-2024 | prius | Slim high driver cluster above small steering wheel, low wide center screen and ambient strip |
| toyota-rav4-2025 | rav4 | Raised rectangular center display, big climate knobs, broad rubberized shelf and angular vents |
| toyota-sienna-2025 | sienna | High media tablet, bridge-like center console with open lower tray and wide passenger shelf |
| toyota-tacoma-2025 | toyota-truck | Very large landscape center display, squared driver hood and rugged grab-handle fascia |
| toyota-tundra-2025 | toyota-truck | Wide center screen flanked by chunky vents, deep driver binnacle and broad console |
| toyota-yaris-2024 | yaris | High compact center tablet, small hooded cluster, low climate stack and rounded vent ends |
| volkswagen-golf-gti-2016 | golf | Driver-angled inset media screen, wide horizontal vents, twin gauges and flat-bottom wheel |
| volkswagen-polo-2024 | polo | Geometric horizontal fascia, integrated center display, separate driver hood and lower HVAC dials |
| volvo-v70-2008 | volvo | Floating narrow waterfall center stack with keypad, two large gauges and broad wood fascia |
| winnebago-view-2022 | sprinter | 2022 View W907 Sprinter cab with integrated MBUX screen and round vents; coach palette retained |
| wuling-hongguang-mini-ev-2025 | wuling | Compact twin rectangular displays, light fascia, round outer vents and small rotary selector |
| bendy-class-a-compact | coach-analog | Compact wraparound analog coach binnacle, side-mounted transmission keys and radio |
| bendy-class-a-grand | coach-digital | Broad digital coach binnacle, twin navigation/camera screens and wood control console |
| bendy-class-a-touring | coach-mixed | Raised analog instrument pod, center navigation display, lower camera monitor and switch bank |
| bendy-class-b-camper | camper-van | Compact van cab with landscape screen, round vents, cubbies and swiveling-seat trim |
| bendy-class-c-family | e-series | Wide van-based analog dash, rectangular center audio, column selector and passenger cubby |
| box-truck | worktruck | Upright commercial cab with twin gauges, radio, deep storage trays and wide wheel |
| compact | economy | Simple molded dash, round outer vents, compact radio and twin driver gauges |
| electric-hatchback | bendy-ev | Separate floating driver and media displays, slim vents and open console |
| offroad | rugged-radio | Upright analog fascia, four round vents, large grab handle and transfer selector |
| pickup | truck-tablet | Wide truck binnacle, inset screen, rectangular vents and trailer switches |
| sedan | luxury-clock | Twin analog binnacle, center clock and screen, satin trim and console storage |
| sports-coupe | sport-tablet | Three-spoke wheel, twin gauges, driver-oriented tablet and narrow console |
| station-wagon | volvo | Broad shelf, floating center stack with radio keypad, warm trim and deep seats |
| suv | toyota-shelf | Wide dash and passenger tray, high media display, paired climate dials |
| taxi | worktaxi | Conventional twin gauges with taxi meter, dispatch screen and central radio |
| van | transit-van | High dash selector, broad storage shelves, twin gauges and inset radio/display |

## Targeted authoring loop

```sh
node packages/entities/scripts/generate-fleet.mjs --ids=mini-cooper-2013
node packages/tooling/dist/cli.mjs asset import content/entities/source/vehicles/mini-cooper-2013/models/source.glb --id molen.entities.vehicle.mini_cooper_2013 --project content/entities/project.json --force
node packages/tooling/dist/cli.mjs asset inspect molen.entities.vehicle.mini_cooper_2013 --project content/entities/project.json --verify
node packages/entities/scripts/capture-fleet.mjs --ids=mini-cooper-2013
node packages/entities/scripts/preview-fleet.mjs --ids=mini-cooper-2013
```

Inspect the current images, then run the entity model tests. Aircraft and transit use their
bundle-local generators. Regenerate aggregate types after binding edits. Keep photographic
research and bulk screenshots in ignored authoring folders; no runtime download depends on them.
