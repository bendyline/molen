# Poniatowski Bridge exterior evidence

This asset represents the current eight-span river bridge and its four bank towers and stairways. The western 701 m approach viaduct is a separate structure. All geometry is original reconstruction; reference photographs and third-party architecture meshes are not embedded.

## Shape and structure

- The rebuilding committee's [1927 book](https://commons.wikimedia.org/wiki/Category:Most_i_wiadukt_imienia_ks._J%C3%B3zefa_Poniatowskiego_przez_rzek%C4%99_Wis%C5%82%C4%99_w_Warszawie_(1927)) supplies original dimensions, sections and historical photographs. Printed pages 15, 19 and 29 show the river elevation, steel cross section and pier section. The original 21.4 m width and historic steel spans are not treated as the present widened bridge. Several other plates show the western viaduct or unbuilt competition proposals and were excluded from the river geometry.
- The [district's June2021 publication](https://mbc.cyfrowemazowsze.pl/Content/83246/PDF/00090666_-_Zycie-Srodmiescia-bezpl-2021-nr-6-43-czerwiec-_-.pdf), PDF page11, describes eight spans and seven steel ribs across the deck.
- [Current bridge photographs](https://commons.wikimedia.org/wiki/File:Most_Poniatowskiego_w_Warszawie_2021.jpg) establish the outer N-truss spans and four rebuilt middle arches. Seven current mapped pier outlines fix the actual span stations. The three central piers retain short caps; tall stone pylons survive at piers1,2,6,7. The seven ribs, transverse steelwork, underdeck bracing and inspection catwalks are modeled as geometry.
- Current road photographs distinguish the tram median, four rails, red edge fascia, black ornamental railing, paired poles and trolley wires. The railing includes shallow hanging loops and paired circular flowers on curved stems, rather than a generic vertical picket fence.
- Four mapped tower and stair footprints fix the bank architecture. The towers include inset arched windows, diamond grilles, upper triple arches, scalloped crowns, ashlar courses and hanging lantern brackets. The stair flights rise around solid stepped volumes; there is no full-height cylindrical core blocking the flight.

## Heraldry

[Direct photographic documentation](https://bedeker.waw.pl/index.php/2020/07/18/most-ksiecia-jozefa-poniatowskiego-plaskorzezby/) supplies the carved subjects. The [Warszawa1939 foundation's current-position account](https://www.warszawa1939.pl/galeria-powiazany/most-poniatowskiego-f/galeria-powiazana-1960-kartusze-zdobiace-most) distinguishes surviving positions from earlier arrangements, including the1985 Suwałki relocation.

The model has eight benches: four Warsaw mermaids on the outer tall pylons; Suwałki and Kalisz at pier2; Warsaw Governorate and Lublin at pier6. Shields, curled stone surrounds, stepped molding, small lantern crowns, figures, trees, water lines and animals are original relief geometry. These are photographic reconstructions, not scans or measured conservation replicas.

## Map and vertical placement

The durable `map-frame.json` and `mapped-features.json` preserve the directed current road axis, seven piers, four towers and four stairs from [OpenStreetMap](https://www.openstreetmap.org/way/368095449). The native +X axis points east-northeast toward Praga and +Z is the upstream/southeast face. Anchor and heading follow the road axis; they do not use the wider bank-tower bounding rectangle as the bridge axis.

Independent GUGiK NMT ground and NMPT surface data in **PL-EVRF2007-NH** are retained in `content/earth/structures/evidence/bridge-terrain/gugik`. The model origin is77.0 m in that datum. Lane medians establish an asymmetric road profile: west end95.55 m, broad crest96.86 m and east end94.48 m. A monotone cubic curve smooths centimetric raster noise. The median carrying the tram rails is0.24 m above the road lanes. River-facing lower bank bases are86.1/86.5 m, rather than the much higher terrain samples inside the stepped tower footprints.

The aerial surface raster cannot measure bearings hidden beneath the deck, submerged foundations or bathymetry. Those are reconstructed from section proportions and photographs. The historical book's water gauge has no assumed conversion to the current height datum. Hosts must supply compatible terrain elevations or an explicit datum conversion. Geographic approval additionally requires production terrain and road-approach captures.

## Extent and precision limits

- The mapped deck runs503.74 m between its end sections. Published506.13 m and the1927 book's503.92 m describe different or conflicting extents. The model keeps current pier stations and mapped bank architecture; it does not uniformly stretch the bridge to force a nominal dimension.
- The modern deck is reconstructed at24.8 m width, close to the mapped road-edge extent; exact curb allocations remain photographic interpretation. The original21.4 m width is historical.
- Tower elevations above deck, bearing heights, steel member sections, rivet schedules, relief depths and stair sections are inferred from photographs. No fabrication accuracy is claimed.
- Thin railing and mortar detail can alias in distant views. Full-resolution close-ups and shared-material views must be inspected before approval.

## Authored detail and shared surfaces

The source includes modeled I sections, open arches and trusses, bearings, gussets/rivets, stone coursing, eight heraldic benches, ornate ironwork, four towers, curved stairs, raised tram paving and overhead lines. Stone, concrete, asphalt and metal surfaces resolve through the central material library; the imported runtime asset does not carry a separate set of photographic textures. `qa.json` records only reviews bound to the current source, runtime, placement and capture hashes.
