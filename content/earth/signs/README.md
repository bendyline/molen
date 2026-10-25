# Road sign appearances

`catalog.json` separates country conventions from the terrain renderer's ten global detection
patterns. It currently covers the United States, Great Britain, Germany, France, Italy and
Switzerland. Every profile includes official reference URLs and approximation notes. The
`generic` fallback is explicitly unclassified, with neutral guide panels, visible speed units
and no inferred stop controls. It does not claim a worldwide national standard.

The catalog supplies colours, circular/rectangular speed panels, native-unit display rules,
driving-side placement, stop/yield/exit labels and font roles. The speed and destination text
always comes from semantic map data. Missing speed limits and exit numbers stay unknown.
Only the U.S. preset currently enables inferred stop controls; mapped controls work globally.
Uniform mapped destination colours override guide defaults. Mixed destination panels, detailed
national layouts and route shields are still approximate. Driving side is shared with ambient
road lanes, junction turns, stop lines and signal heads; one-way point order is preserved.

The `generic-left` profile adds left-driving countries and territories, including Japan,
Australia, New Zealand, Ireland, India, Thailand, South Africa, Hong Kong and Macao. Its source
links document driving side; its neutral colours, legends and shapes do not claim a national
sign standard. A dedicated country profile can replace a binding without changing simulation
rules. Unknown regions retain the right-driving `generic` fallback. Explicit host overrides
apply to traffic, markings, signals and signs together.

`sign.us`, `sign.gb`, `sign.de`, `sign.fr`, `sign.it` and `sign.ch` are optional font roles.
They fall back to the Earth catalog's Overpass highway face until a host provides a matching
compiled font. No Transport, DIN or Frutiger font files are included.

`regions.atlas.json` contains countries and all 50 U.S. states, with lowercase ISO alpha-2
country IDs and `us-wa`-style subdivision IDs. States take priority over the country profile.
It is a separate atlas so an architectural overlay cannot change traffic signage.
Its public-domain Natural Earth outlines are reused from
`../source/architecture-countries.json`; see `../architecture-geography.NOTICE.txt` for the
upstream revision and source hash. Simplification makes borders/coasts approximate. Selection
uses each terrain tile's centre for both surfaces and traffic, with a bounded 2.5 km coastal fallback when no outline contains the point. Exact containment
always wins; right-driving countries are also included so a nearby left-driving region cannot
override them.
Repeated source features for a country are combined; Cyprus includes the separate northern
outline because it follows the same road rule.

Reproduce or check it from the repository root:

```sh
node scripts/build-road-sign-regions.mjs
node scripts/build-road-sign-regions.mjs --check
node scripts/build-us-road-signs.mjs
node scripts/build-us-road-signs.mjs --check
```

Add a country by authoring a sourced profile and regenerating the atlas. The Earth loader
validates duplicate IDs, duplicate country assignments, fallback references and atlas geometry.
Run `packages/earth/test/road-signs.test.ts` for representative geographic lookups, and
`examples/world-explorer/test/visual/capture-road-sign-gallery.mjs` for production-mesh previews
and selector checks. Inspect the gallery at `road-signs.html`; `?region=gb` selects a preset.

## U.S. state route identities

`us-states.json` adds 50 profiles to the country catalog. `route-shields.json` supplies normalized
triangles and font text boxes for each state's primary route marker. Earth loads both through
the `road-sign-profiles` and `route-shields` pack capabilities. The renderer keeps real route
numbers as font geometry, and sends the artwork library to its worker once per change.

The `route-marker` detector accepts an exact supported `network` plus `shield_text` or `ref`,
or an explicit state reference such as `WA 520`. A local `SR`/`SH` reference requires state
geography. Bare numbers without a network, compound references, county/federal/Interstate
networks, and unimplemented toll/business variants are omitted. Tennessee requires
`US:TN:primary`; its secondary route design is not implied by a generic `TN` or `SR` reference.
These cues establish identity, not a surveyed marker position. See the
[Protomaps shield attributes](https://docs.protomaps.com/basemaps/layers#shields).

Stop, yield, speed and guide panels retain the shared U.S. convention. Street-name blades
vary by municipality and are not assigned invented statewide colours. The gallery's
`?view=states` collection compares all 50 designs; `?region=us-wa` shows a state's full pattern
set. Route 28 in the gallery is synthetic, not a claim that every state has that route.

The state silhouettes and decorative artwork are adapted from
[OpenStreetMap Americana](https://github.com/osm-americana/openstreetmap-americana), CC0-1.0,
revision `879d6d30e551410fc1b52b584d71fdd337cf4e4d`. Pinned SVGs, hashes and URLs are in
`../source/signs/americana/`; the full license is [americana-LICENSE.txt](americana-LICENSE.txt).
Common circles, rectangles, diamonds and the stylized Wyoming rider are authored in the
compiler. This is medium-fi artwork adapted from map symbols, not a set of fabrication-ready
state DOT drawings. Some crests and small legends are simplified; proprietary typefaces are
not included. Overpass remains the highway lettering fallback.

State boundaries come from Natural Earth's public-domain 1:50m admin-1 data, revision
`ca96624a56bd078437bca8184e78163e5039ad19`. The filtered input, upstream URL and SHA-256 are in
`../source/signs/us-state-boundaries.json`. The compiler runs offline using Chromium's SVG
parser and bundled Three.js, verifies source hashes, and produces deterministic JSON.
