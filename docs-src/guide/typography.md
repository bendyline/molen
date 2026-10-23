# Fonts and world-space lettering

Use the shared font engine for shop names, highway signs, equipment labels and generated models.
`@bendyline/molen-materials/text` lays out text and emits indexed triangles without DOM, canvas,
three.js, GPU state or a system-font dependency. `@bendyline/molen-client/text` adds a three.js
geometry adapter and an offline outline compiler. Both consume the same host-supplied font data.

## Loading fonts

`loadEarthContent` reads the Earth pack's `provides.fonts` catalog into `content.fonts`. Earth
view and world explorer pass it to road surfaces and storefront models. The stock catalog has
Overpass semibold (`highway`), Overpass regular (`sans`), Overpass Mono semibold (`mono`), and
Molen Sign Serif (`serif`, derived from Libre Baskerville). Overpass is inspired by Highway
Gothic; it does not reproduce an exact FHWA alphabet. Font assets carry their SIL OFL licenses
inside the content pack. Libraries ship code, not font files, and never choose a font host.

For another pack or local content source:

```ts
import { loadFontLibrary } from '@bendyline/molen-materials/text';

const fonts = await loadFontLibrary(
  await pack.readJson('fonts/catalog.json'),
  (path) => pack.readJson(`fonts/${path}`),
);
```

The catalog format is `molen/font-catalog@1`, with `defaultFont`, a `fonts` map from id to
catalog-relative JSON path, and optional `roles` mapping semantic names to ids. Loading validates
font ids, metrics and triangle buffers. Treat a loaded library as immutable; replace it with
a new library when changing faces. Terrain workers receive it once per change, not per tile.
Old packs without fonts still load; panels and symbols render without lettering until a host
supplies a library.

## Rendering and fitting

```ts
import * as THREE from 'three';
import { createTextGeometry } from '@bendyline/molen-client/text';

const geometry = createTextGeometry('Café Étoile', fonts, {
  font: 'serif',
  size: 0.6,
  maxWidth: 3.2,
  maxHeight: 0.5,
  align: 'center',
  verticalAlign: 'center',
});
const label = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#eeeadd' }));
label.position.set(0, 2.8, 0.11);
scene.add(label);
```

Text lies in XY with its front facing +Z. Rotate/place it in the sign's local frame and keep it
slightly ahead of the panel to prevent z-fighting. The caller owns the geometry and material;
dispose them when no longer used. Merge static labels into material batches or export their
buffers into a GLB, rather than adding a draw call for every letter.

`buildTextMesh(text, fonts, options)` returns `positions`, `indices`, fitted `width` and `height`,
the rendered `text`, `missingGlyphs`, and `truncated`. It uses proportional advances, pair
kerning, NFC normalization, Unicode code points and explicit `\n` line breaks. `size` is the
maximum em size; width/height constraints uniformly shrink the whole label. Glyphs are never
stretched sideways. `overflow: 'ellipsis'` shortens each line at the requested size before
fitting; default is `shrink`. `letterSpacing` adds em spacing, `lineHeight` sets baseline spacing,
and `fallbackFonts` supplies additional face ids/roles. `maxCharacters` bounds work (default 256,
maximum 4096). The geometry adapter exposes the same diagnostics in `geometry.userData.textLayout`.

The stock subset covers available Latin, accented Latin, digits, punctuation and arrows.
Unknown characters use a visible `?` and appear in `missingGlyphs`; they are never silently
dropped. This is left-to-right layout with pair kerning, not a complex-script shaper. Arabic,
Indic shaping, bidirectional paragraphs and automatic word wrapping need a shaping/layout stage
before adding those scripts. Font family selection alone does not provide that stage.

## Signs and authored assets

Pass `{ fonts, signFont: 'highway' }` to `createTerrainSurfaceRenderer` or
`createTerrainSurfaceObject`. Preserve `fonts` when calling `setOptions`. Sign text keeps the
source's case and accents; an exit number still comes only from mapped exit metadata.

Storefront `SignDesign`/landmark `sign` accepts `font` and `letterSpacing`. Call
`generateSignModel(design, detail, fonts)`, `generateLandmarkModel(id, definitions, detail, fonts)`,
or `new ModelLibrary(loader, definitions, disposeLoadedScene, plants, fonts)`. Detail 2 keeps
the panel and mark and omits name lettering. `molen worldgen preview` also reads the `fonts` catalog provided by its style or configured
project content packs (including the Earth pack). Fine signs use real text instead of decorative
stripes. The generators' buffers can be passed to `encodeGlb` like any other model.

For Node asset generators, call `createTextGeometry` and merge its triangles into the authored
mesh; this is the same API used in the browser. Existing baked GLBs must be regenerated to
change their lettering. Seven-segment electronic displays can retain their physical segments;
fixed captions around those displays should use font geometry.

## Compiling another face

`compileVectorFont(typefaceJson, { id, characters, weight, style, curveSegments, kerning })`
from `@bendyline/molen-client/text` converts three.js `FontLoader` typeface data to a serializable
`molen/vector-font@1` document. It preserves counters/holes and uses a configurable outline
tessellation (default six segments per curve). Store that document, its license and provenance
in your content pack. Runtime rendering does not parse TTFs or retessellate outlines.

TTFLoader output is accepted. It uses historical 100000/72 outline units per em: set its
`resolution = 100000 / 72` before compiling if you need true em metrics. Supply pair kerning
in matching em units from your font parser; TTFLoader's JSON does not include kerning tables.
Variable fonts use their default outlines unless instantiated to a static face beforehand.
Regular, bold and italic variants are separate faces, not synthetic distortions. Check the
font's redistribution license and reserved-name terms before shipping a compiled subset.
