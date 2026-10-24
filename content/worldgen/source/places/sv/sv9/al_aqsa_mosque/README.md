# Al-Aqsa Mosque — Al-Qibli prayer hall

![Molen preview](preview.png)

Individual medium-fi Al-Qibli prayer hall:seven open northern pointed porch arches,green panel doors/pointed fanlights,raised nave with lead-grey roofs and large ribbed silver dome/finial near the south end;limestone buttresses,pointed windows/oculi,low attached wings and sparse parapet crenels. Five existing shared graphs and four browser LODs. Exact whole/dome controls retained;heights nominal and detailed profiles/current finish/exact terrain joins estimated or unverified. Other compound monuments excluded.

## Evidence and reconstruction

Published dimensions and reconstructed details are separated in spec.json. Primary references:

- [Reference](https://commons.wikimedia.org/wiki/File:Jerusalem-Al-Quds-2013(2)-Aerial-Qibli_Mosque-_(cropped).jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Jerusalem-2013-Temple_Mount-Al-Aqsa_Mosque_(NE_exposure).jpg)
- [Reference](https://commons.wikimedia.org/wiki/File:Jerusalem-2013(2)-Temple_Mount-Al-Aqsa_Mosque,_portal_(north_exposure).jpg)

Five existing shared256² limestone,raw limestone,standing-seam metal,plain wood and bronze graphs,six merged groups including local blue-grey glazing. Plain wood abstracts the green panel doors;metal graph abstracts lead cladding. Linear tints,metric UVs and flat architectural normals;no embedded images,bespoke facade bitmaps,baked lighting or invented lettering.

## Model and axes

16,737 triangles; 50,211 vertices; 6 material groups; 2,012,264 bytes. Native bounds: -60.025, -10.021, -42.826 to 59.819, 40.198, 42.166. Source hash: `sha256:276f8b4e59ae982284ec1e0c1a3e81c93e4783469a38260d4a56faa6408f1b8e`.

{"x":"east-northeast toward east side wall","y":"up","z":"south-southeast toward silver dome and south retaining edge"}

Standard viewer DEM datum734.068928m;whole perimeter-9.67 to2.75m relative to it. Floor3.198m uses the highest retained north-front sample plus0.45m,so the porch does not sit below the coarse forecourt samples. This declares an approximate raised attachment plane,not surveyed thresholds. Adaptive limestone footings crossY=0 and extend below retained samples;the south edge has a deep retained-terrain fall. The DEM is not used to infer exact historical retaining-wall courses,steps,street or courtyard paving. Exact contact,altitude,walking and site joins remain unverified. No terrain flattening,ground cutout or road replacement.

## Reproduce

Run `node packages/worldgen/scripts/generate-additional-landmarks.mjs --ids=al_aqsa_mosque` (or add `--check`). The generator preserves manually edited masters by checking their baseline hashes. Import through the standard authored-model workflow with optimization disabled; then capture all QA cameras, including shared-surface views.

## Pending work

- Retained way/280309331 /Q12192963 identifies the southern Al-Qibli main prayer hall,not the entire Al-Aqsa compound or the separate golden Dome of the Rock. Current standard PMTiles whole35184652398163 and dome part35184663933670 retain32 raw outline points/properties. Earlier exact-QID whole/multilingual tags/facts and current named POI retained. Anchor[35.235542683,31.776175889] and heading0.175752450172rad unchanged,no horizontal rescale. Native+X east-northeast toward the east side wall,+Z south-southeast toward the silver dome/southern retaining edge,−Z north-northwest toward the seven-arch entrance and open forecourt. Three inspected pictures resolve signed facing,approximate3° uncertainty. Four compound minarets,separate pavilions,Dome of the Rock,other compound/town buildings and public forecourt remain host content.
- Current whole height20m and dome part35m are nominal controls. Retained Wikidata37m height/55m width/80m length lack linked reference URLs and are consistency hints,not surveyed dimensions. The mapped whole includes attached lower west/east wings;the derived main hall is approximately55×81m. Estimated above-floor partitions:side walls14m/sloping lead roofs14.4–16.8m,raised central nave18.8m/eave and20m ridge;north seven-arch porch11.6m roof/12.4m parapet;dome drum20–23m and cap35m/finial37m. Lower attached wings8.5–10m are estimates;the whole20m tag does not survey each subsection. Open porch arches,door/window/oculus/portal/buttress/cornice/crenel/roof-rib details are picture-led approximations. Precise profiles,construction and current finish unverified.
- Standard viewer DEM datum734.068928m;whole perimeter-9.67 to2.75m relative to it. Floor3.198m uses the highest retained north-front sample plus0.45m,so the porch does not sit below the coarse forecourt samples. This declares an approximate raised attachment plane,not surveyed thresholds. Adaptive limestone footings crossY=0 and extend below retained samples;the south edge has a deep retained-terrain fall. The DEM is not used to infer exact historical retaining-wall courses,steps,street or courtyard paving. Exact contact,altitude,walking and site joins remain unverified. No terrain flattening,ground cutout or road replacement.
- Individual medium-fi southern prayer hall from three inspected2013 pictures and standard viewer PMTiles/DEM. Whole/dome heights are nominal;roof/drum/finial/annex/portal/window/buttress/parapet profiles and shallow door/fanlight detail are estimates or abstractions. Seven front arches open into a shallow modeled porch terminated by closed door/window fields;no prayer-hall interior or free traversal claim. Fine carving,masonry chronology,inscriptions,leaded artwork,lighting/furniture,engineering/current restoration finish and hidden site joins are excluded or unverified. Other compound monuments,minarets,pavilions,forecourt fixtures,trees and city walls remain host content. The south-facing below-floor mass is a conservative terrain footing,not a faithful reconstruction of the archaeological retaining walls. Synthetic neighbors and physical-device performance remain unverified.

This bundle follows the medium-fi standard. Medium-fi appearance and geographic fit are reviewed separately. Hash-bound visual acceptance is recorded separately after capture inspection.

## Additional geographic data

©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.
