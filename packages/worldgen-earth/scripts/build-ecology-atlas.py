"""Bake RESOLVE Ecoregions 2017 into a small, deterministic global lookup.

Install ecology-requirements.txt in an authoring venv. Pass the upstream zip explicitly;
neither builds nor the viewer download that 149 MB source. Output is attributed CC-BY-4.0
derived data, not a map of current vegetation, animal observations, or exact coastlines.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
import rasterio.features
from rasterio.transform import from_origin
import shapefile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--out", type=Path, default=Path("content/ecology/ecoregions.json"))
    parser.add_argument("--degrees", type=float, default=0.25)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    step = args.degrees
    if not 0.05 <= step <= 10 or 360 / step != int(360 / step) or 180 / step != int(180 / step):
        raise ValueError("Cell size must evenly divide the globe and stay in [0.05, 10] degrees")
    digest = hashlib.file_digest(args.source.open("rb"), "sha256").hexdigest()
    # The upstream DBF uses Windows-1252 (e.g. accented South American region names).
    reader = shapefile.Reader(str(args.source), encoding="cp1252")
    records = [record.as_dict() for record in reader.iterRecords()]
    by_id = {}
    for record in records:
        eco_id = int(record["ECO_ID"])
        biome = int(record["BIOME_NUM"])
        entry = {"id": eco_id, "name": record["ECO_NAME"],
                 "biome": biome if 1 <= biome <= 14 else 0, "realm": record["REALM"] or "Unclassified"}
        if eco_id in by_id and by_id[eco_id] != entry:
            raise ValueError(f"Conflicting source metadata for {eco_id}")
        by_id[eco_id] = entry
    regions = [by_id[key] for key in sorted(by_id)]
    indices = {entry["id"]: index + 1 for index, entry in enumerate(regions)}
    height, width = int(180 / step), int(360 / step)
    centers = np.zeros((height, width), dtype=np.uint16)
    intersections = np.zeros_like(centers)
    transform = from_origin(-180, 90, step, step)
    # Stable ID order makes overlaps deterministic. Center samples always outrank intersections;
    # the latter preserve narrow coasts and small islands that have no grid-cell center on land.
    for ordinal in sorted(range(len(records)), key=lambda i: (int(records[i]["ECO_ID"]), i)):
        geometry = reader.shape(ordinal).__geo_interface__
        index = indices[int(records[ordinal]["ECO_ID"])]
        rasterio.features.rasterize([(geometry, index)], out=centers, transform=transform)
        rasterio.features.rasterize([(geometry, index)], out=intersections,
                                   transform=transform, all_touched=True)
    grid = np.where(centers != 0, centers, intersections)
    rows = []
    for row in grid:
        runs = []
        previous, count = int(row[0]), 0
        for value in row:
            value = int(value)
            if value != previous:
                runs.extend([count, previous])
                previous, count = value, 0
            count += 1
        runs.extend([count, previous])
        rows.append(runs)
    doc = {
        "format": "molen/ecology-atlas@1", "id": "molen.ecology.ecoregions", "version": 1,
        "title": "RESOLVE terrestrial ecoregions, quarter-degree lookup", "cellDegrees": step,
        "regions": regions, "rows": rows,
        "source": {
            "title": "RESOLVE Ecoregions 2017",
            "url": "https://storage.googleapis.com/teow2016/Ecoregions2017.zip",
            "license": "CC-BY-4.0",
            "citation": "Dinerstein et al. (2017), An Ecoregion-Based Approach to Protecting Half the Terrestrial Realm. BioScience 67(6):534-545. https://doi.org/10.1093/biosci/bix014",
            "sha256": f"sha256:{digest}",
            "interpretation": "Potential terrestrial habitat geography, not current land cover or species presence. Cell-center sampling; uncovered centers use intersecting land polygons to retain small islands. Coastlines and habitat boundaries are approximate at this resolution; use mapped land/water and land use for actual placement.",
        },
    }
    encoded = (json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    if args.check:
        if args.out.read_bytes() != encoded:
            raise ValueError(f"Stale ecology atlas: {args.out}")
    else:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_bytes(encoded)
    represented = set(int(value) for value in np.unique(grid) if value)
    print(json.dumps({"path": str(args.out), "sourceSha256": digest,
                      "bytes": len(encoded), "gzipBytes": len(gzip.compress(encoded, mtime=0)),
                      "cellDegrees": step, "width": width, "height": height,
                      "sourceRegions": len(regions), "representedRegions": len(represented),
                      "subgridRegions": [entry["name"] for i, entry in enumerate(regions)
                                         if i + 1 not in represented]}, indent=2))


if __name__ == "__main__":
    main()
