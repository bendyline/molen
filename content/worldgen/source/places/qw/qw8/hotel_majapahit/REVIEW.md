# Hotel Majapahit

Historic Art Deco street entrance, principal courtyard wings and pedimented
classical crosswing. Local 2017 streetfront, 2016 courtyard, 2025 nightfront
and 2011 crosswing originals were individually inspected again on 2026-10-17.
The earlier inspected official Accor elevated photograph and mapped compound
control the three gardens and oblique streetfront. Heights, roof joins,
gallery depths, window spacing and hidden elevations remain estimates.
Later eastern pool/service structures, gardens' vegetation, cars, freestanding
furniture, signs and interiors are outside the model. No photographic pixels
are embedded.

The prior Terrarium field obscured lower arcades and remained unaccepted.
Its complete saved grid, descriptor, height PNG and original two source tiles
are retained in `terrain-sources/rejected-terrarium/`. The pre-replacement
source/runtime/four LOD identities, frame and dry reference are recorded in
`terrain-sources/before-deltadtm.json`. Original wall and footing depths,
floor levels, anchor, heading and dry reference are unchanged. Subsequent
close views exposed an upper portico roof/ceiling gap and thin curved-balcony
supports. The 2011 original controls a photo-directed roof notch, white
soffit, upper rear wall and substantial turned balusters.
`terrain-sources/before-portico-repair.json` freezes the independent source
field and architectural controls before that edit. Roof joins and these
dimensions remain estimates; no ground height determines them.
Skyline/district omit small ridge beams to keep the detail budgets.

The independent replacement is [DeltaDTM v1.1.1, dataset release4](https://doi.org/10.4121/21997565),
licensed CC BY 4.0. Original ZIP64 central directory, local ZIP header/TIFF
prefix and compressed TIFF block are retained with original HTTP206range
responses, hashes and byte offsets. This is verified original subset data;
a whole-TIFF/archive checksum is not claimed. Full attribution and provider
metadata are in `terrain-sources/derivation.json`.

The original source has one arcsecond spacing, approximately30m. The existing
320m review extent and 65 by65 grid at5m spacing are preserved. All4225heights
bilinearly sample four original source pixels; any NODATA value is rejected.
There is no filling, flattening or geometry fitting. The original dry street
reference[-7,80] gives3.0098565mEGM2008. EGM2008 is documented by the provider;
the TIFF GeoKeys encode horizontal WGS84. Neither5m review spacing nor
provider-wide accuracy statistics establish surveyed site/floor accuracy.

Run `python3 -B terrain-sources/verify-derived-grid.py` for offline independent
range/directory/TIFF decoding and grid/PNG verification. Verification needs
Python3.14,NumPy and Pillow/libtiff; ordinary model builds do not. Two
independent floating predictor decoders agree bitwise for all262144source
pixels. Local libtiff lacks ZSTD, so its check losslessly re-Deflates the
original unchanged predictor bytes before independent predictor inversion.

`node verify-geometry.mjs` validates original and actual imported Float32
geometry,normals,winding,UVs and budgets. It checks sampled actual low wall
contacts across all4levels,three open garden spaces,upward roof faces and
courtyard gallery air. Skyline/district gallery fronts are explicit solid
proxies;street/closeup galleries have actual air. This is sampled coverage,
not a measured global LOD error bound. Source/runtime/LOD hashes record the
intentional photographic portico repair; the complete source field, native
frame and dry reference must match the pre-repair snapshot. Roof/ceiling rays
also check the repaired physical join.

Final current-frame decisions and hashes belong in `qa.json`. Placement is
a bounded source-relative preview without footprint replacement or cutout.
Another host terrain field needs its own contact review.
