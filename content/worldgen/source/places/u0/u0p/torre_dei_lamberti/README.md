# Torre dei Lamberti

![Lit Molen preview](preview.png)

The 84 m Veronese tower with alternating tuff and cotto lower shaft, recessed putlog holes, southwest Roman-numeral clock, four true triple-arched galleries, corbelled terraces, octagonal brick drum, open white-marble belfry, four bells and a pitched copper roof with wind vane.

## Identity and geometry

Catalog torre_dei_lamberti, [Q1819804](https://www.wikidata.org/wiki/Q1819804). The operator gives 84 m overall height and 37 m original lower tower, identifies tuff/cotto and the later marble/brick octagonal belfry. Exact mapped tower width/depth sets plan scale. Current operator photographs DSCF8933, R_UD0028 and R_UD0090 establish the clock face, triple arcades, two-light octagonal bays, stone corbels, iron rails, bell supports and shallow pitched roof. Intermediate floor ordinates, opening widths and small relief are proportional reconstructions; they are not represented as surveyed dimensions.

Center of the exact mapped tower footprint, Y=0 at exterior ground. Native +Z faces the southwest clock elevation toward Piazza delle Erbe; +X is southeast; +Y is up. The geographic proposal identifies its anchor and orientation evidence separately from remaining terrain and azimuth uncertainty.

Source facts and measured references are recorded in spec.json. References: [1](https://www.torredeilamberti.it/storia/), [2](https://www.torredeilamberti.it/), [3](https://www.torredeilamberti.it/wp-content/uploads/DSCF8933.jpg), [4](https://www.torredeilamberti.it/wp-content/uploads/R_UD0028.jpg), [5](https://www.torredeilamberti.it/wp-content/uploads/R_UD0090.jpg), [6](https://www.editorialepolis.it/img/notiziario_pdf/palazzoragione.pdf), [7](https://campanologia.org/campanologia/misurazioni), [8](https://www.openstreetmap.org/way/138829597). Reference pages and images are not redistributed.

## Original source and shared materials

Geometry is authored in `packages/worldgen/scripts/lamberti-tower-model.mjs`. Shared material graphs with metric repeat UV0 and original vertex tints; GLB PBR fallback remains self-contained. No per-model texture duplication. No third-party mesh or photograph is embedded.

89,562 triangles; 181,972 vertices; 8 material groups; 7,630,404 source bytes. Source hash: `sha256:b741403ffec1690b3a0b8c29847dc72f2fe58fffc447627e6d0d8739c2793dd3`. Geometry validation checks finite Float32 coordinates, indices, triangle area and winding before export.

Regenerate with `node packages/worldgen/scripts/generate-heritage-towers.mjs torre_dei_lamberti`; add `--check` for reproducibility. The generator refuses to overwrite a master whose hash differs from source.json. Import uses `--no-optimize` to preserve facade recesses.

## Remaining detail and review

- The tower is independent of attached Palazzo della Ragione wings, palace roofs and Arco della Costa. Interiors are excluded.
- Retained mapped shaft anchor/orientation and photo-proportioned intermediate levels remain approximate at ordinary host ground contact.
- Clock hands are a fixed decorative display. Shields carry plain relief; tiny corbel ornament, putlog depth, railing density and bell fittings aggregate at distance. No physical-device performance measurements are claimed.

Named near/far cameras are included for lit visual review. A valid export is not maximum-fidelity certification.
