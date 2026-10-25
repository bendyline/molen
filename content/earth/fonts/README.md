# Lettering fonts

Host-supplied vector fonts for road signs, storefronts, labels and authored models. No OS fonts
or external font service are required. `catalog.json` names each face and its semantic roles.
The source TTFs live in `../source/fonts/`; `node scripts/build-fonts.mjs` (from the repository
root, after materials/client builds) regenerates the glyph meshes and `build.json` hashes.
`--check` verifies byte-for-byte reproducibility without fetching anything.

- Overpass regular and semibold, and Overpass Mono semibold: copyright 2021 The Overpass
  Project Authors, SIL OFL 1.1, [upstream](https://github.com/RedHatOfficial/Overpass), revision
  `c580d28bfab7f39013568e684a65eeb23eff588d`, `fonts/ttf/` and `fonts/ttf_mono/`.
  Overpass is inspired by Highway Gothic; it is not an exact FHWA alphabet or a claim of
  regulatory sign compliance. See `Overpass-OFL.txt`.
- Molen Sign Serif is a compiled outline subset derived from Libre Baskerville's default
  weight (400): copyright 2012 The Libre Baskerville Project Authors, SIL OFL 1.1.
  The derivative is renamed to respect the reserved font name. Source:
  [Google Fonts](https://github.com/google/fonts/tree/main/ofl/librebaskerville), revision
  `e7db6ca603fd4862010383ff17ffd6cc4ffac1c0`, `ofl/librebaskerville/LibreBaskerville[wght].ttf`.
  See `LibreBaskerville-OFL.txt`.

The subset retains available Basic Latin, Latin-1, Latin Extended-A, typographic punctuation
and arrows. Unsupported characters use a visible replacement glyph. More scripts require
additional fonts and, for connected/complex scripts, a shaping stage; the current engine lays
out Unicode characters left to right with pair kerning. The original sources and compiled
font derivatives retain their OFL licenses; engine code is MIT.
