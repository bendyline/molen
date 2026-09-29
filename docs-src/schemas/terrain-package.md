# Terrain package manifest (`molen/terrain-package@1`)

Installable tiled-world package: coordinate space, elevation, optional semantic layers, provenance, and checksums.

## Example

```json
{
  "format": "molen/terrain-package@1",
  "name": "earth-lite",
  "version": "2026.08",
  "coordinateSpace": {
    "kind": "geospatial",
    "crs": "EPSG:3857",
    "bounds": [
      -180,
      -85.05112878,
      180,
      85.05112878
    ]
  },
  "tileMatrix": {
    "scheme": "xyz",
    "minLevel": 0,
    "maxLevel": 8
  },
  "elevation": {
    "source": {
      "kind": "pmtiles",
      "path": "elevation.pmtiles"
    },
    "encoding": "png16",
    "height": {
      "min": -500,
      "max": 9000
    }
  },
  "surface": {
    "seaLevel": 0,
    "layers": [
      {
        "name": "grass",
        "color": "#527346",
        "tiling": 24,
        "auto": {
          "heightMin": 2
        }
      },
      {
        "name": "rock",
        "color": "#77766e",
        "tiling": 10,
        "auto": {
          "slopeMin": 0.1
        }
      }
    ]
  },
  "landcover": {
    "source": {
      "kind": "pmtiles",
      "path": "world.pmtiles"
    },
    "encoding": "mvt",
    "layer": "landcover",
    "profile": "protomaps-basemap@1"
  },
  "features": {
    "source": {
      "kind": "pmtiles",
      "path": "world.pmtiles"
    },
    "encoding": "mvt",
    "layers": [
      "water",
      "transportation",
      "building"
    ],
    "profile": "protomaps-basemap@1"
  },
  "preset": "1gb",
  "attribution": [
    {
      "text": "Example terrain data",
      "license": "CC-BY-4.0",
      "sourceUrl": "https://example.com/terrain"
    }
  ],
  "provenance": {
    "compiler": "example terrain compiler",
    "compilerVersion": "0.1.0",
    "sources": [
      {
        "id": "example-dem",
        "release": "2026-08"
      }
    ]
  },
  "files": [
    {
      "path": "elevation.pmtiles",
      "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
      "bytes": 1024
    },
    {
      "path": "world.pmtiles",
      "sha256": "1111111111111111111111111111111111111111111111111111111111111111",
      "bytes": 2048
    }
  ]
}
```

## JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "format": {
      "type": "string",
      "const": "molen/terrain-package@1",
      "description": "Format envelope; always 'molen/terrain-package@1'."
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "description": "Package name."
    },
    "version": {
      "type": "string",
      "minLength": 1,
      "description": "Package version string, e.g. '2026.08'."
    },
    "coordinateSpace": {
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "kind": {
              "type": "string",
              "const": "local",
              "description": "Invented world in a local metric frame."
            },
            "units": {
              "type": "string",
              "const": "meters",
              "description": "Bounds units; always 'meters'."
            },
            "bounds": {
              "minItems": 4,
              "maxItems": 4,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "[minX, minZ, maxX, maxZ] in meters (world XZ, Y-up)."
            }
          },
          "required": [
            "kind",
            "units",
            "bounds"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "kind": {
              "type": "string",
              "const": "geospatial",
              "description": "Real-Earth data in a geographic CRS."
            },
            "crs": {
              "type": "string",
              "enum": [
                "EPSG:3857",
                "EPSG:4326"
              ],
              "description": "Coordinate reference system: EPSG:3857 (Web Mercator) or EPSG:4326 (WGS84 lon/lat)."
            },
            "ellipsoid": {
              "default": "WGS84",
              "type": "string",
              "const": "WGS84",
              "description": "Reference ellipsoid; always 'WGS84'."
            },
            "bounds": {
              "minItems": 4,
              "maxItems": 4,
              "type": "array",
              "items": {
                "type": "number"
              },
              "description": "[minLon, minLat, maxLon, maxLat] in degrees."
            }
          },
          "required": [
            "kind",
            "crs",
            "bounds"
          ],
          "additionalProperties": false
        }
      ],
      "description": "Coordinate space the package covers: local metric or geospatial."
    },
    "tileMatrix": {
      "type": "object",
      "properties": {
        "scheme": {
          "default": "xyz",
          "type": "string",
          "enum": [
            "xyz",
            "tms"
          ],
          "description": "Tile row numbering: 'xyz' (row 0 at the top, default) or 'tms' (row 0 at the bottom)."
        },
        "minLevel": {
          "default": 0,
          "type": "integer",
          "minimum": 0,
          "maximum": 30,
          "description": "Coarsest zoom level present (default 0)."
        },
        "maxLevel": {
          "type": "integer",
          "minimum": 0,
          "maximum": 30,
          "description": "Finest zoom level present."
        },
        "rootTiles": {
          "default": [
            1,
            1
          ],
          "minItems": 2,
          "maxItems": 2,
          "type": "array",
          "items": {
            "type": "integer",
            "exclusiveMinimum": 0,
            "maximum": 9007199254740991
          },
          "description": "Tiles along [x, z] at level 0 (default [1, 1])."
        },
        "tileResolution": {
          "default": 257,
          "type": "integer",
          "minimum": 2,
          "maximum": 1025,
          "description": "Height samples per tile edge (default 257)."
        }
      },
      "required": [
        "maxLevel"
      ],
      "additionalProperties": false,
      "description": "Tile pyramid layout shared by every archive in the package."
    },
    "elevation": {
      "type": "object",
      "properties": {
        "source": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "kind": {
                  "type": "string",
                  "const": "pmtiles",
                  "description": "Archive kind; always 'pmtiles'."
                },
                "path": {
                  "type": "string",
                  "minLength": 1,
                  "description": "Package-relative path of the PMTiles archive."
                }
              },
              "required": [
                "kind",
                "path"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "kind": {
                  "type": "string",
                  "const": "pmtiles",
                  "description": "Archive kind; always 'pmtiles'."
                },
                "url": {
                  "type": "string",
                  "format": "uri",
                  "description": "Absolute URL of the PMTiles archive."
                }
              },
              "required": [
                "kind",
                "url"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "kind": {
                  "type": "string",
                  "const": "pmtiles-set",
                  "description": "Archive kind 'pmtiles-set': a molen/archive-set@1 document naming many archives."
                },
                "path": {
                  "type": "string",
                  "minLength": 1,
                  "description": "Package-relative path of the archive-set document."
                }
              },
              "required": [
                "kind",
                "path"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "kind": {
                  "type": "string",
                  "const": "pmtiles-set",
                  "description": "Archive kind 'pmtiles-set': a molen/archive-set@1 document naming many archives."
                },
                "url": {
                  "type": "string",
                  "format": "uri",
                  "description": "Absolute URL of the archive-set document."
                }
              },
              "required": [
                "kind",
                "url"
              ],
              "additionalProperties": false
            }
          ],
          "description": "Archive holding the elevation tiles."
        },
        "encoding": {
          "type": "string",
          "const": "png16",
          "description": "Tile encoding; always 'png16' (16-bit grayscale PNG)."
        },
        "height": {
          "type": "object",
          "properties": {
            "min": {
              "type": "number",
              "description": "Height in meters encoded by sample value 0."
            },
            "max": {
              "type": "number",
              "description": "Height in meters encoded by sample value 65535."
            }
          },
          "required": [
            "min",
            "max"
          ],
          "additionalProperties": false,
          "description": "Height range in meters the PNG16 samples map onto."
        }
      },
      "required": [
        "source",
        "encoding",
        "height"
      ],
      "additionalProperties": false,
      "description": "Elevation tiles."
    },
    "surface": {
      "type": "object",
      "properties": {
        "seaLevel": {
          "default": 0,
          "type": "number",
          "description": "Sea level in meters within the elevation height range (default 0)."
        },
        "layers": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": {
                "type": "string",
                "minLength": 1,
                "description": "Layer name, e.g. 'grass' or 'rock'."
              },
              "materialRef": {
                "type": "string",
                "minLength": 1,
                "description": "Material reference for the layer surface (project material doc id)."
              },
              "color": {
                "type": "string",
                "pattern": "^#[0-9a-fA-F]{6}$",
                "description": "Flat '#rrggbb' color used for vertex-color splat banding."
              },
              "tiling": {
                "default": 8,
                "type": "number",
                "exclusiveMinimum": 0,
                "description": "Texture repeats per chunk edge for the layer material (default 8)."
              },
              "auto": {
                "type": "object",
                "properties": {
                  "heightMin": {
                    "type": "number",
                    "description": "Lowest height in meters at which the layer applies."
                  },
                  "heightMax": {
                    "type": "number",
                    "description": "Highest height in meters at which the layer applies."
                  },
                  "slopeMin": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                    "description": "Minimum slope 0..1 (0 = flat, 1 = vertical) at which the layer applies."
                  },
                  "slopeMax": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                    "description": "Maximum slope 0..1 (0 = flat, 1 = vertical) at which the layer applies."
                  }
                },
                "additionalProperties": false,
                "description": "Automatic height/slope banding that selects where the layer paints."
              }
            },
            "required": [
              "name"
            ],
            "additionalProperties": false
          },
          "description": "Surface layers painted by auto banding, in order."
        }
      },
      "additionalProperties": false,
      "description": "Surface shading settings."
    },
    "landcover": {
      "type": "object",
      "properties": {
        "source": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "kind": {
                  "type": "string",
                  "const": "pmtiles",
                  "description": "Archive kind; always 'pmtiles'."
                },
                "path": {
                  "type": "string",
                  "minLength": 1,
                  "description": "Package-relative path of the PMTiles archive."
                }
              },
              "required": [
                "kind",
                "path"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "kind": {
                  "type": "string",
                  "const": "pmtiles",
                  "description": "Archive kind; always 'pmtiles'."
                },
                "url": {
                  "type": "string",
                  "format": "uri",
                  "description": "Absolute URL of the PMTiles archive."
                }
              },
              "required": [
                "kind",
                "url"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "kind": {
                  "type": "string",
                  "const": "pmtiles-set",
                  "description": "Archive kind 'pmtiles-set': a molen/archive-set@1 document naming many archives."
                },
                "path": {
                  "type": "string",
                  "minLength": 1,
                  "description": "Package-relative path of the archive-set document."
                }
              },
              "required": [
                "kind",
                "path"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "kind": {
                  "type": "string",
                  "const": "pmtiles-set",
                  "description": "Archive kind 'pmtiles-set': a molen/archive-set@1 document naming many archives."
                },
                "url": {
                  "type": "string",
                  "format": "uri",
                  "description": "Absolute URL of the archive-set document."
                }
              },
              "required": [
                "kind",
                "url"
              ],
              "additionalProperties": false
            }
          ],
          "description": "Archive holding the landcover tiles."
        },
        "encoding": {
          "type": "string",
          "enum": [
            "mvt",
            "png8"
          ],
          "description": "Tile encoding: 'mvt' (Mapbox vector tiles) or 'png8' (indexed PNG)."
        },
        "layer": {
          "default": "landcover",
          "type": "string",
          "const": "landcover",
          "description": "MVT layer name; always 'landcover'."
        },
        "profile": {
          "type": "string",
          "const": "protomaps-basemap@1",
          "description": "Attribute profile of the tiles; always 'protomaps-basemap@1' when set."
        }
      },
      "required": [
        "source",
        "encoding"
      ],
      "additionalProperties": false,
      "description": "Optional semantic landcover classification tiles."
    },
    "features": {
      "type": "object",
      "properties": {
        "source": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "kind": {
                  "type": "string",
                  "const": "pmtiles",
                  "description": "Archive kind; always 'pmtiles'."
                },
                "path": {
                  "type": "string",
                  "minLength": 1,
                  "description": "Package-relative path of the PMTiles archive."
                }
              },
              "required": [
                "kind",
                "path"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "kind": {
                  "type": "string",
                  "const": "pmtiles",
                  "description": "Archive kind; always 'pmtiles'."
                },
                "url": {
                  "type": "string",
                  "format": "uri",
                  "description": "Absolute URL of the PMTiles archive."
                }
              },
              "required": [
                "kind",
                "url"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "kind": {
                  "type": "string",
                  "const": "pmtiles-set",
                  "description": "Archive kind 'pmtiles-set': a molen/archive-set@1 document naming many archives."
                },
                "path": {
                  "type": "string",
                  "minLength": 1,
                  "description": "Package-relative path of the archive-set document."
                }
              },
              "required": [
                "kind",
                "path"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "kind": {
                  "type": "string",
                  "const": "pmtiles-set",
                  "description": "Archive kind 'pmtiles-set': a molen/archive-set@1 document naming many archives."
                },
                "url": {
                  "type": "string",
                  "format": "uri",
                  "description": "Absolute URL of the archive-set document."
                }
              },
              "required": [
                "kind",
                "url"
              ],
              "additionalProperties": false
            }
          ],
          "description": "Archive holding the feature tiles."
        },
        "encoding": {
          "type": "string",
          "const": "mvt",
          "description": "Tile encoding; always 'mvt'."
        },
        "layers": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "water",
              "transportation",
              "building",
              "poi"
            ]
          },
          "description": "MVT feature layers included (unique; at least one)."
        },
        "profile": {
          "type": "string",
          "const": "protomaps-basemap@1",
          "description": "Attribute profile of the tiles; always 'protomaps-basemap@1' when set."
        }
      },
      "required": [
        "source",
        "encoding",
        "layers"
      ],
      "additionalProperties": false,
      "description": "Optional vector feature tiles (water, roads, buildings)."
    },
    "models": {
      "type": "object",
      "properties": {
        "index": {
          "type": "string",
          "minLength": 1,
          "description": "Package-relative path of the model placement index."
        }
      },
      "required": [
        "index"
      ],
      "additionalProperties": false,
      "description": "Optional placed 3D models."
    },
    "preset": {
      "type": "string",
      "enum": [
        "1gb",
        "5gb",
        "20gb"
      ],
      "description": "Size preset the package was compiled with (drives default streaming budgets)."
    },
    "attribution": {
      "minItems": 1,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "text": {
            "type": "string",
            "minLength": 1,
            "description": "Attribution text to display."
          },
          "license": {
            "type": "string",
            "minLength": 1,
            "description": "License identifier, e.g. 'CC-BY-4.0'."
          },
          "sourceUrl": {
            "type": "string",
            "format": "uri",
            "description": "URL of the data source."
          },
          "licenseUrl": {
            "type": "string",
            "format": "uri",
            "description": "URL of the license text."
          }
        },
        "required": [
          "text",
          "license"
        ],
        "additionalProperties": false
      },
      "description": "Data attributions (at least one)."
    },
    "provenance": {
      "type": "object",
      "properties": {
        "compiler": {
          "type": "string",
          "minLength": 1,
          "description": "Tool that compiled the package."
        },
        "compilerVersion": {
          "type": "string",
          "minLength": 1,
          "description": "Version of the compiler."
        },
        "sources": {
          "minItems": 1,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string",
                "minLength": 1,
                "description": "Source dataset id."
              },
              "release": {
                "type": "string",
                "minLength": 1,
                "description": "Source dataset release/version."
              },
              "sha256": {
                "type": "string",
                "pattern": "^[0-9a-f]{64}$",
                "description": "Hex sha256 of the source dataset."
              }
            },
            "required": [
              "id",
              "release"
            ],
            "additionalProperties": false
          },
          "description": "Source datasets the package was compiled from (at least one)."
        }
      },
      "required": [
        "compiler",
        "compilerVersion",
        "sources"
      ],
      "additionalProperties": false,
      "description": "How and from what the package was built."
    },
    "files": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "minLength": 1,
            "description": "Package-relative file path."
          },
          "sha256": {
            "type": "string",
            "pattern": "^[0-9a-f]{64}$",
            "description": "Hex sha256 of the file."
          },
          "bytes": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991,
            "description": "File size in bytes."
          }
        },
        "required": [
          "path",
          "sha256",
          "bytes"
        ],
        "additionalProperties": false
      },
      "description": "Checksum/size records for every content file (paths unique)."
    }
  },
  "required": [
    "format",
    "name",
    "version",
    "coordinateSpace",
    "tileMatrix",
    "elevation",
    "attribution",
    "provenance"
  ],
  "additionalProperties": false
}
```
