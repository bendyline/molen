# Ho Chi Minh Mausoleum — principal exterior

Reviewed 2026-11-02. **Complete medium-fi exterior; approximate native contact accepted.**

The model includes the whole T-shaped podium, flanking terraces, eight central steps, a deep entrance with closed jambs, ceiling, floor and paired wooden doors, the broad lower stone mass, receding terraces, six front piers and five deep stone-backed bays, connected side and rear piers, flared cap and raised roof. End-pier returns close the bays from oblique views. Original stone courses and wood panels provide detail; inscriptions, sculpture, furnishings and funerary interiors are outside scope.

The retained identity is **Q874234 / way 37625751**. Current PMTiles supply the parent polygon and 26 connected principal parts. Their heights resolve the parent's 7.8 m tag: terraces at 9.4/10.4 m, piers at 18.25 m, cap at 20.5 m and roof at 20.9/21.6 m. All 20 native pier plans are explicit source controls. Placement replaces these **27 components** and preserves **460 independent neighbors**, including parade stands. The facade faces ESE toward Ba Dinh square at heading 1.374100234508, with approximately 8° uncertainty.

Two ordinary photographs were inspected: a whole front with slight side and a tight entrance detail. The latter's local filename is misleading; it supplies no upper, side, rear or roof evidence. Hidden details and exact paving remain approximate. One unchanged standard global Terrarium tile gives reasonable podium and stair contact. The fixture only rebases its vertical reference to 13.794426 m; it does not flatten or alter the raw field. Only the occupied podium cuts terrain.

Detailed source: **11,752 triangles / 1,412,728 bytes**. Browser tiers: **664 / 2,456 / 4,692 / 5,552 triangles**. Initial skyline plus district: **289,148 bytes**; close-up: **514,280 bytes**. Existing shared granite and wood graphs supply three material groups, metric UVs and linear vertex colors. There are no private or embedded images; GPU streams remain separate.

Four focused tests pass. Six GLBs validate without errors or warnings. All **46 final rendered views** were actually inspected, including shared materials, native terrain, all faces, entrance details, lighting modes and LODs. Corrected defects include a coordinate-substitution error caught by the map-plan check, end-bay sightline gaps and an unnecessarily dark rear patch. Exact hashes and commands are in qa.json. Unloading disposes geometry and restores ground.

Rebuild with `node packages/worldgen/scripts/generate-ho-chi-minh-mausoleum.mjs`; append `--check` for exact source bytes. Import, LOD and placement commands select `--ids=ho_chi_minh_mausoleum`. GLBs remain ignored build outputs. Numerical LOD errors and physical-device timings remain unmeasured.
