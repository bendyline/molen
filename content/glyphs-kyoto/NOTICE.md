# Kyoto sign lettering

`glyphs/kyoto.glyphs.json` (molen/glyph-atlas@1) and its page `glyphs/kyoto.glyphs.0.r8` hold the
Japanese letters Kyoto's storefront signs use, as a distance-field atlas: 1,569 characters taken
from the sign-eligible place names in the Kyoto map extract (`source/charset.json`, with the
archive's SHA-256), plus Basic Latin and the business catalog's aliases. An Earth view that opens
this pack sets those names in Japanese; without it they fall back to an English name, or to the
place's category sign.

## Font

**Molen Sign Gothic JP** is a glyph subset rasterized from Noto Sans JP Medium, renamed for the
derivative.

- Copyright © 2014-2021 Adobe (http://www.adobe.com/). Noto is a trademark of Google Inc.
- Licensed under the SIL Open Font License, Version 1.1: `glyphs/OFL.txt`.
- Source: https://github.com/notofonts/noto-cjk, revision
  `165c01b46ea533872e002e0785ff17e44f6d97d8`, `Sans/SubsetOTF/JP/NotoSansJP-Medium.otf`
  (SHA-256 `f396a3b57256e4515be9cb41f7aac54766d654890082a9f1b5c2451b5c093d8a`).

## Rebuilding

In the engine repository, after building the terrain, worldgen-earth, materials and client
packages:

```sh
node scripts/build-glyph-charset.mjs kyoto content/glyphs-kyoto/source/charset.json
node scripts/build-fonts.mjs
```

`--check` on either verifies the committed outputs byte for byte. The place names themselves come
from OpenStreetMap through the map extract (© OpenStreetMap contributors, ODbL); the atlas holds
letter shapes, not names.
