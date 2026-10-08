"""Reduce attributed MDD native-country membership and Natural Earth into a small wildlife pack.

Use the ecology-requirements.txt authoring venv. Inputs are explicit local files; no
runtime or normal package build downloads the full source datasets.
"""
import argparse
import csv
import gzip
import hashlib
import json
from pathlib import Path
import unicodedata

import numpy as np
import rasterio.features
from rasterio.transform import from_origin
import shapefile


def digest(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def normalized(name):
    return ''.join(c for c in unicodedata.normalize('NFKD', name.lower()) if c.isalnum()).replace('and', '')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mdd', type=Path)
    parser.add_argument('metadata', type=Path)
    parser.add_argument('countries', type=Path)
    parser.add_argument('--catalog', type=Path, default=Path('content/wildlife/regional.catalog.json'))
    parser.add_argument('--out', type=Path, default=Path('content/wildlife/ranges.json'))
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    expected = ['0d07a7e9409712fa86c1e3afadcf4c67bf4f9e16d5693a878e11ec1bf6860493',
                'de6efba79c560025582e10382a153ff400eae7123ff7f8881d6aa1a1b4d0c111',
                'f449ec126985e5aab30aea4b439c2d9eb0c5d40bd722fc1036ad3b6477e25cdd']
    for path, sha in zip([args.mdd, args.metadata, args.countries], expected):
        if digest(path) != sha:
            raise ValueError(f'Unexpected source bytes: {path}')
    reader = shapefile.Reader(str(args.countries), encoding='utf-8')
    records = [record.as_dict() for record in reader.iterRecords()]
    countries = {}
    for record in records:
        code = record['ISO_A2_EH']
        if code == '-99':
            code = {'Kosovo': 'XK', 'Somaliland': 'SO', 'N. Cyprus': 'CY'}.get(record['NAME'])
        if record['NAME'] == 'Siachen Glacier':
            record['_code'] = None
            continue
        if not code or code == '-99':
            raise ValueError(f'Unmapped Natural Earth country: {record["NAME"]}')
        record['_code'] = code
        countries.setdefault(code, {'code': code, 'name': record['GEOUNIT']})
    countries = [countries[code] for code in sorted(countries)]
    indices = {country['code']: i + 1 for i, country in enumerate(countries)}
    aliases = {}
    admin_codes = {}
    for record in records:
        if record['_code'] is not None:
            admin_codes.setdefault(record['ADMIN'], set()).add(record['_code'])
    for name, codes in admin_codes.items():
        if len(codes) == 1:
            aliases[normalized(name)] = next(iter(codes))
    for record in records:
        if record['_code'] is None:
            continue
        for field in ['GEOUNIT', 'NAME', 'NAME_LONG', 'BRK_NAME']:
            if record[field]:
                aliases[normalized(record[field])] = record['_code']
    aliases.update({normalized(name): code for name, code in {
        'United States': 'US', 'Czech Republic': 'CZ', 'Eswatini': 'SZ',
        'Democratic Republic of the Congo': 'CD', 'Republic of the Congo': 'CG',
        "Cote d'Ivoire": 'CI', 'Bosnia and Herzegovina': 'BA', 'Turkey': 'TR',
        'North Macedonia': 'MK', 'Palestine': 'PS', 'South Korea': 'KR',
        'North Korea': 'KP', 'Tanzania': 'TZ', 'Vietnam': 'VN', 'Laos': 'LA',
        'French Guiana': 'GF', 'Curaçao': 'CW', 'United Kingdom': 'GB',
    }.items()})
    catalog = json.loads(args.catalog.read_text(encoding='utf-8'))
    requested = {animal['range'] for animal in catalog['animals'] if 'range' in animal}
    taxa = []
    with args.mdd.open(encoding='utf-8-sig', newline='') as source:
        for row in csv.DictReader(source):
            if row['sciName'] not in requested:
                continue
            if row['domestic'] != '0' or row['extinct'] != '0':
                raise ValueError(f'Unsupported taxon status: {row["sciName"]}')
            members = set()
            for name in row['countryDistribution'].split('|'):
                if '?' in name:
                    continue
                code = aliases.get(normalized(name))
                if code is None or code not in indices:
                    raise ValueError(f'Unmapped MDD country: {name} ({row["sciName"]})')
                members.add(code)
            taxa.append({'id': row['sciName'], 'sourceId': row['id'], 'name': row['mainCommonName'], 'countries': sorted(members)})
    if {taxon['id'] for taxon in taxa} != requested:
        raise ValueError(f'Missing MDD taxa: {requested - {taxon["id"] for taxon in taxa}}')
    grid = np.zeros((720, 1440), dtype=np.uint16)
    transform = from_origin(-180, 90, 0.25, 0.25)
    for i in sorted((i for i in range(len(records)) if records[i]['_code'] is not None), key=lambda i: (records[i]['_code'], i)):
        rasterio.features.rasterize([(reader.shape(i).__geo_interface__, indices[records[i]['_code']])], out=grid, transform=transform)
    rows = []
    for row in grid:
        runs, previous, count = [], int(row[0]), 0
        for value in row:
            value = int(value)
            if value != previous:
                runs.extend([count, previous])
                previous, count = value, 0
            count += 1
        runs.extend([count, previous])
        rows.append(runs)
    doc = {'format': 'molen/wildlife-ranges@1', 'id': 'molen.wildlife.ranges', 'version': 1,
           'title': 'Native-country limits for supported mammals', 'cellDegrees': 0.25,
           'countries': countries, 'rows': rows, 'taxa': sorted(taxa, key=lambda taxon: taxon['id']),
           'sources': [
               {'title': 'Mammal Diversity Database v2.5', 'url': 'https://doi.org/10.5281/zenodo.21654811',
                'license': 'CC-BY-4.0', 'sha256': 'sha256:' + expected[0],
                'interpretation': 'Supported extant non-domestic taxa; native/reintroduced/ancient country membership. Uncertain countries omitted. Not within-country occupancy or observed presence.'},
               {'title': 'Natural Earth Admin 0 Map Units 1:50m, 5.1.1', 'url': 'https://naturalearth.s3.amazonaws.com/50m_cultural/ne_50m_admin_0_map_units.zip',
                'license': 'public-domain', 'sha256': 'sha256:' + expected[2],
                'interpretation': 'Quarter-degree center-sampled country prior. Uncovered coastal cells remain uncovered; no implied occurrence.'},
           ]}
    text = json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n'
    if args.check:
        if args.out.read_text(encoding='utf-8') != text:
            raise ValueError('Wildlife ranges are stale')
    else:
        args.out.write_text(text, encoding='utf-8', newline='\n')
    print(f'{len(taxa)} taxa, {len(countries)} countries, {len(text.encode())} bytes, {len(gzip.compress(text.encode(), mtime=0))} gzip bytes')


if __name__ == '__main__':
    main()
