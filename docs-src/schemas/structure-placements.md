# Geographic structure placements (`molen/structure-placements@1`)

WGS84 anchors for authored models; draft entries are indexed but not rendered.

## Example

```json
{
  "format": "molen/structure-placements@1",
  "title": "Example structures",
  "entries": [
    {
      "id": "sample.tower",
      "title": "Sample tower",
      "asset": "sample.structure.tower",
      "anchor": [
        -122.3493,
        47.62051
      ],
      "status": "draft",
      "source": "https://example.com/tower"
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
      "const": "molen/structure-placements@1"
    },
    "title": {
      "type": "string",
      "minLength": 1
    },
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9.-]*$"
          },
          "title": {
            "type": "string",
            "minLength": 1
          },
          "asset": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_.-]*$"
          },
          "anchor": {
            "type": "array",
            "prefixItems": [
              {
                "type": "number",
                "minimum": -180,
                "maximum": 180
              },
              {
                "type": "number",
                "minimum": -90,
                "maximum": 90
              }
            ],
            "items": false,
            "minItems": 2,
            "maxItems": 2
          },
          "heading": {
            "type": "number"
          },
          "scale": {
            "type": "array",
            "prefixItems": [
              {
                "type": "number",
                "exclusiveMinimum": 0
              },
              {
                "type": "number",
                "exclusiveMinimum": 0
              },
              {
                "type": "number",
                "exclusiveMinimum": 0
              }
            ],
            "items": false,
            "minItems": 3,
            "maxItems": 3
          },
          "datum": {
            "type": "string",
            "enum": [
              "terrain",
              "sea-level"
            ]
          },
          "elevation": {
            "type": "number"
          },
          "terrainReference": {
            "type": "object",
            "properties": {
              "anchor": {
                "type": "array",
                "prefixItems": [
                  {
                    "type": "number",
                    "minimum": -180,
                    "maximum": 180
                  },
                  {
                    "type": "number",
                    "minimum": -90,
                    "maximum": 90
                  }
                ],
                "items": false,
                "minItems": 2,
                "maxItems": 2
              },
              "modelHeight": {
                "type": "number"
              },
              "basis": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "anchor",
              "modelHeight",
              "basis"
            ],
            "additionalProperties": false
          },
          "bounds": {
            "type": "array",
            "prefixItems": [
              {
                "type": "number",
                "minimum": -180,
                "maximum": 180
              },
              {
                "type": "number",
                "minimum": -90,
                "maximum": 90
              },
              {
                "type": "number",
                "minimum": -180,
                "maximum": 180
              },
              {
                "type": "number",
                "minimum": -90,
                "maximum": 90
              }
            ],
            "items": false,
            "minItems": 4,
            "maxItems": 4
          },
          "replaceRoads": {
            "type": "object",
            "properties": {
              "length": {
                "type": "number",
                "exclusiveMinimum": 0
              },
              "width": {
                "type": "number",
                "exclusiveMinimum": 0
              },
              "outline": {
                "minItems": 3,
                "maxItems": 512,
                "type": "array",
                "items": {
                  "type": "array",
                  "prefixItems": [
                    {
                      "type": "number"
                    },
                    {
                      "type": "number"
                    }
                  ],
                  "items": false,
                  "minItems": 2,
                  "maxItems": 2
                }
              },
              "deckHeight": {
                "type": "number"
              },
              "deckHeights": {
                "type": "array",
                "prefixItems": [
                  {
                    "type": "number"
                  },
                  {
                    "type": "number"
                  }
                ],
                "items": false,
                "minItems": 2,
                "maxItems": 2
              },
              "includeConnectedApproaches": {
                "type": "boolean"
              }
            },
            "required": [
              "length",
              "width"
            ],
            "additionalProperties": false
          },
          "replaceFootprint": {
            "type": "boolean"
          },
          "groundCutout": {
            "type": "object",
            "properties": {
              "outline": {
                "minItems": 3,
                "maxItems": 512,
                "type": "array",
                "items": {
                  "type": "array",
                  "prefixItems": [
                    {
                      "type": "number"
                    },
                    {
                      "type": "number"
                    }
                  ],
                  "items": false,
                  "minItems": 2,
                  "maxItems": 2
                }
              },
              "basis": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "outline",
              "basis"
            ],
            "additionalProperties": false
          },
          "mapIdentity": {
            "type": "object",
            "properties": {
              "wikidata": {
                "type": "string",
                "pattern": "^Q[1-9][0-9]*$"
              },
              "names": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "maxDistance": {
                "type": "number",
                "exclusiveMinimum": 0,
                "maximum": 10000
              }
            },
            "additionalProperties": false
          },
          "orientation": {
            "type": "string",
            "enum": [
              "fixed",
              "mapped"
            ]
          },
          "lengthAxis": {
            "type": "string",
            "enum": [
              "x",
              "z"
            ]
          },
          "minLevel": {
            "type": "integer",
            "minimum": 0,
            "maximum": 26
          },
          "status": {
            "type": "string",
            "enum": [
              "preview",
              "draft",
              "historical"
            ]
          },
          "appearance": {
            "type": "object",
            "properties": {
              "kind": {
                "type": "string",
                "const": "historical"
              },
              "currentWorldEligible": {
                "type": "boolean",
                "const": false
              },
              "representedDate": {
                "type": "string",
                "minLength": 1
              },
              "validFrom": {
                "type": "string"
              },
              "validUntil": {
                "type": "string"
              }
            },
            "required": [
              "kind",
              "currentWorldEligible",
              "validFrom",
              "validUntil"
            ],
            "additionalProperties": false
          },
          "source": {
            "type": "string",
            "format": "uri"
          },
          "note": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "title",
          "asset",
          "anchor",
          "status",
          "source"
        ],
        "additionalProperties": false
      }
    },
    "rules": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9.-]*$"
          },
          "title": {
            "type": "string",
            "minLength": 1
          },
          "asset": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_.-]*$"
          },
          "match": {
            "type": "object",
            "properties": {
              "classes": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "subclasses": {
                "minItems": 1,
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "tags": {
                "type": "object",
                "propertyNames": {
                  "type": "string",
                  "minLength": 1
                },
                "additionalProperties": {
                  "minItems": 1,
                  "type": "array",
                  "items": {
                    "type": "string",
                    "minLength": 1
                  }
                }
              }
            },
            "additionalProperties": false
          },
          "dimensions": {
            "type": "array",
            "prefixItems": [
              {
                "type": "number",
                "exclusiveMinimum": 0
              },
              {
                "type": "number",
                "exclusiveMinimum": 0
              },
              {
                "type": "number",
                "exclusiveMinimum": 0
              }
            ],
            "items": false,
            "minItems": 3,
            "maxItems": 3
          },
          "orientation": {
            "type": "string",
            "enum": [
              "direction",
              "longest-edge",
              "north"
            ]
          },
          "lengthAxis": {
            "type": "string",
            "enum": [
              "x",
              "z"
            ]
          },
          "fit": {
            "type": "string",
            "enum": [
              "native",
              "footprint"
            ]
          },
          "replaceFootprint": {
            "type": "boolean"
          },
          "minLevel": {
            "type": "integer",
            "minimum": 0,
            "maximum": 26
          },
          "maxPerTile": {
            "type": "integer",
            "minimum": 1,
            "maximum": 64
          },
          "source": {
            "type": "string",
            "format": "uri"
          }
        },
        "required": [
          "id",
          "title",
          "asset",
          "match",
          "dimensions",
          "source"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "format",
    "title",
    "entries"
  ],
  "additionalProperties": false
}
```
