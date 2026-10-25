# New York Stock Exchange —1903 block

This ordinary geographic model represents the original Broad Street block, including its New Street elevation and roof envelope. It excludes the taller Wall Street annex and neighboring20Broad Street. Its catalog identity is `new_york_stock_exchange`.

All86local candidate thumbnails and three complete originals were inspected. The2015and2013unbannered oblique views control the columns, glazing and podium; the2008frontal view controls the pediment. Its temporary large flag is not geometry authority for the obscured column bodies. Permanent inscription lettering is original line geometry, not a photo texture. Temporary flags, event banners, fences, people and street furniture are excluded.

The model retains six fluted Corinthian columns on Broad Street, six smooth columns on New Street, recessed opaque bronze-grid glazing, the seven-bay podium and balconies, the asymmetric south entrance, parapets and eleven pose-directed pediment figures. Two closer levels use static geometry baked from the public Molen figures kernel; the central draped figure, children and flanking work groups have distinct poses. Fine sculpture, capital leaves and floral relief are simplified. Coarser levels preserve the architectural openings and use conservative sculpture proxies.

## Source controls and limits

The [NYC designation report](https://s-media.nyc.gov/agencies/lpc/lp/1529.pdf), physical description on pages4–5, supports the different front/rear colonnades, sloping-street podium, south entrance and rear attic. The [NPS nomination](https://npgallery.nps.gov/GetAsset/a7592662-8c96-46be-af44-ebf03e828d13), physical description, supplies the original156ft roof,52½ft columns,96×50ft glazing and eleven-figure pediment. Historical descriptions are scale controls, not a present measured survey. The upper office/plant setbacks and unseen side/rear details are conservative estimates; the tallest authored envelope is47.5488m.

The native parent35184650142362 merges the original building and later annex. The18Broad address point and41.406m Broad frontage identify the southern portion. Six original parent vertices define the model perimeter; the north join between existing parent vertices5and1 is explicitly inferred. It is not a cadastral boundary. The frame anchor is−74.01125853178179,40.706926724054284, heading1.1242609803179457radians. No whole-parent generic footprint replacement is enabled.

## Independent ground

The original source-specific USGS F32 GeoTIFF and catalog/service/export metadata remain in `terrain-sources`. The locked raster is30939, **USGS one meter x58y451 NY CMPG2013**, catalog acquisition2014-04-21, publication20200330. The NY source was chosen explicitly; nearby NJ project listings are not treated as verified New York coverage. All203,401original pixels were independently compared, and the standard-library TIFF decoder reproduces all66,049derived grid values to rounding precision. The source-relative dry Broad Street datum is5.3501m in the catalog's NAVD88 context, without a separate local survey transformation.

This field was frozen before geometry and remains unchanged. It rises toward New Street as the historical site description states. The actual modeled basement wall foot is−1.2m, and the two-storey podium reaches11.3m. The exposed basement and low door thresholds vary with the sloping streets. All354native perimeter probes range approximately−0.569165to+2.602082m relative to the datum, and actual imported wall rays confirm the perimeter above ground. There is no terrain cutout, flattened site or fitted terrain pad. This is acceptance for the retained source preview; another host DEM needs its own contact review. One-metre data does not establish surveyed paving/foundation accuracy.

## Validation evidence

`verify-geometry.mjs` checks actual Float32 source/imported attributes, normals, winding, UVs, finite values and all four strict triangle budgets. Geometric controls verify both six-column shafts, true intercolumn and behind-column air, recessed opaque glazing, fourteen upper podium arches, native basement continuity, excluded annex/neighbor air and roof envelope. Nine sampled roof heights coincide across the levels; these samples are not a global error bound. Declared2.2/1.2/0.5m approximations also cover omitted sculpture, rails and relief.

Current hashes, inspected frames, actual material/LOD identities, pack inclusion, repeated simulation and shared placement lifecycle are bound in `qa.json` and the capture reports. Bulk images stay in ignored local review folders. `preview.png` and `detail-preview.jpg` are the small summary previews.
