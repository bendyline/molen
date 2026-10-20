> Historical review. Superseded by [CONSTRUCTION-REVIEW.md](CONSTRUCTION-REVIEW.md) for the current model and public-domain imagery policy.

# White Tower of Thessaloniki

Original medium-fi exterior informed by inspected local 2019, 2015, 2011 and
2006 photographs and the museum's roof photograph. The operator's 21.70m body
diameter and 33.90m masonry height control the two-cylinder structure. Stone
patches, small recessed openings, pointed entrance, cordon, arch corbels,
brick battlements, terrace grilles and axial mast are represented. Individual
opening locations, profiles, threshold and fittings remain estimates. The
former enclosure, square, sea, trees, cars, interpretation furniture and
interiors are outside this model. Photographic pixels are not redistributed.

The initial coastal Terrarium field left part of the existing footing
unsupported. It remains verbatim in `terrain-sources/rejected-terrarium/`.
`terrain-sources/before-deltadtm.json` preserves the model, four LODs, frame,
dry reference and prior geographic review before the replacement experiment.
The building geometry, anchor, heading, threshold and footing have not been
changed to match elevations.

The replacement is the published [DeltaDTM v1.1.1 dataset, release 4](https://doi.org/10.4121/21997565),
licensed CC BY 4.0. Original Europe ZIP directory, local header/TIFF prefix
and the exact compressed TIFF block covering the site are retained with
their original HTTP range responses. This is a verified subset of the
archive; a complete TIFF or whole-archive checksum is not claimed.
Provider attribution, license, source hashes, offsets, georeferencing and
derivation are in `terrain-sources/derivation.json`.

The source is one arcsecond, approximately 30m. The 33 by 33 review grid at
1m spacing interpolates those source pixels; it does not add source detail.
The 32m land patch contains the whole existing footing and the original dry
approach [0,13]. Sea and surrounding square are outside this bounded review.
All grid values are bilinear samples of four original pixels. Any NODATA
sample is rejected; there is no filling, flattening or height fitting.
The unchanged reference gives datum 3.0965865m EGM2008. The vertical datum
comes from provider documentation; TIFF GeoKeys encode horizontal WGS84.

Run `python3 -B terrain-sources/verify-derived-grid.py` from any directory to
check original byte ranges and reproduce all 1089 heights offline. It needs
Python 3.14, NumPy and Pillow/libtiff for verification only. Two independent
floating predictor decoders agree bitwise for all 262144 source pixels;
because local libtiff lacks ZSTD, its check losslessly re-Deflates the original
predictor bytes. PNG16 encoding is independently checked. Normal builds use
the saved inputs and have no Python dependency.

`node verify-geometry.mjs` checks original and imported Float32 meshes,
normals, winding, UVs, budgets, actual polygonal footing contact at all four
detail levels, and unfilled entrance/window/corbel reveals. Runtime/source
and all four LOD hashes must match the pre-replacement geometry. Current
capture hashes and final review decisions belong in `qa.json`; historical
captures are not evidence for the replacement field.

Placement is a bounded source-relative preview. It uses no terrain cutout
or parent footprint replacement. Another host terrain needs its own contact
check; provider-wide accuracy statistics do not establish surveyed site or
floor accuracy here. The main entry is closed, and the skyline deliberately
simplifies corbel arches and small windows.
