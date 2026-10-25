# Stonewall Inn ground correction

The original Terrarium review terrain obscured the left rounded entrance threshold. The replacement is a source-specific USGS NY_CMPG_2013 one-metre bare-earth export (dataset 30939), sampled without alteration into a one-metre grid. The original Christopher Street contact at [-1.8,15.1] supplies the provider-relative datum 6.5691 m NAVD88; the building and host terrain-reference placement have not moved. No elevations are fitted to the architecture.

The original 201 by 201 F32 raster and provider metadata are retained in terrain-sources/. The independent standard-library reader and Pillow agree on all 40,401 original pixels; all 16,641 derived samples reproduce within 0.05 mm rounding. Run `python3 terrain-sources/verify-derived-grid.py` from any directory. Grid-to-PNG round-trip and current-render contact review must also pass before geographic approval. Source-era interpolation and later paving/curb changes remain uncertain; another host DEM can differ.

Both full 51–53 exteriors remain in scope. This ground correction is independent of the still-unresolved public-domain view of 51 Christopher Street; it is not whole-model fidelity approval.

Current review passed on 2026-10-19: all39fresh captures inspected, original geometry/placement hashes retained, all51threshold boundary controls clear ground with embedded bases, and grid/PNG round-trip error 0.000053566837310725646m. Approval is recorded in qa.json; site-construction-controls.json retains the pre-render registration state. Full51–53fidelity remains pending.
