# Style pack manifest (`molen/stylepack@1`)

Index of a shippable look: archstyles, scatter rules, materials, prop assets, default style rules, imports, and attribution. One directory is one pack; the version feeds every seed.

## Example

```json
{
  "format": "molen/stylepack@1",
  "name": "molen-worldgen-default",
  "version": "2026.09.0",
  "title": "Molen default world styles",
  "doc": "Regional architecture and vegetation looks for outlines and labeled polygons.",
  "namespace": "molen.worldgen",
  "styles": {
    "molen.worldgen.pnw.house": "styles/pnw/house.archstyle.json",
    "molen.worldgen.generic.house": "styles/generic/house.archstyle.json",
    "molen.worldgen.generic.commercial": "styles/generic/commercial.archstyle.json",
    "molen.worldgen.generic.box": "styles/generic/box.archstyle.json"
  },
  "scatter": {
    "molen.worldgen.scatter.global": "scatter/global.scatter.json"
  },
  "materials": {
    "molen.worldgen.material.siding_lap": "materials/siding-lap.matgraph.json"
  },
  "assets": {
    "molen.worldgen.prop.chimney.brick": "assets/prop/chimney/brick/asset.json"
  },
  "defaults": {
    "style": "molen.worldgen.generic.box",
    "scatter": "molen.worldgen.scatter.global",
    "rules": [
      {
        "when": {
          "class": [
            "commercial",
            "retail",
            "industrial",
            "office",
            "apartments"
          ]
        },
        "style": "molen.worldgen.generic.commercial"
      },
      {
        "when": {
          "class": [
            "house",
            "residential",
            "yes",
            "building"
          ],
          "areaMax": 600
        },
        "style": "molen.worldgen.generic.house"
      }
    ]
  },
  "imports": [
    {
      "namespace": "molen.entities",
      "package": "@bendyline/molen-entities",
      "note": "Trees, shrub, boulder."
    }
  ],
  "attribution": [
    {
      "text": "Molen default world styles",
      "license": "MIT"
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
      "const": "molen/stylepack@1",
      "description": "Format envelope; always 'molen/stylepack@1'."
    },
    "name": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "description": "Pack name, e.g. 'molen-worldgen-default'."
    },
    "version": {
      "type": "string",
      "minLength": 1,
      "description": "Pack version string, e.g. '2026.09.0'; participates in every seed."
    },
    "title": {
      "type": "string"
    },
    "doc": {
      "type": "string"
    },
    "namespace": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
      "description": "Namespace every id in the pack lives under, e.g. 'molen.worldgen'."
    },
    "styles": {
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string",
        "minLength": 1,
        "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$"
      },
      "description": "Archstyle id to pack-relative molen/archstyle@1 path."
    },
    "scatter": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string",
        "minLength": 1,
        "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$"
      },
      "description": "Scatter id to pack-relative molen/scatter@1 path."
    },
    "materials": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string",
        "minLength": 1,
        "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$"
      },
      "description": "Material id to pack-relative matgraph/pixelgrid document path (resolves matgraph:<id>)."
    },
    "assets": {
      "default": {},
      "type": "object",
      "propertyNames": {
        "type": "string"
      },
      "additionalProperties": {
        "type": "string",
        "minLength": 1,
        "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$"
      },
      "description": "Asset id to pack-relative molen/asset@1 sidecar path (props)."
    },
    "defaults": {
      "type": "object",
      "properties": {
        "style": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
          "description": "Archstyle used when no rule matches."
        },
        "scatter": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
          "description": "Scatter rule set used when a binding names none."
        },
        "rules": {
          "default": [],
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "when": {
                "type": "object",
                "properties": {
                  "class": {
                    "minItems": 1,
                    "type": "array",
                    "items": {
                      "type": "string",
                      "minLength": 1
                    },
                    "description": "Match when any label equals or contains one of these words; \"house\" matches \"semidetached_house\" but not \"warehouse\"."
                  },
                  "notClass": {
                    "minItems": 1,
                    "type": "array",
                    "items": {
                      "type": "string",
                      "minLength": 1
                    },
                    "description": "Reject when any label matches one of these words."
                  },
                  "contextClass": {
                    "minItems": 1,
                    "type": "array",
                    "items": {
                      "type": "string",
                      "minLength": 1
                    },
                    "description": "Match the surrounding label (e.g. the land class); 'none' matches an absent context."
                  },
                  "notContextClass": {
                    "minItems": 1,
                    "type": "array",
                    "items": {
                      "type": "string",
                      "minLength": 1
                    },
                    "description": "Reject when the surrounding label matches."
                  },
                  "areaMin": {
                    "type": "number",
                    "minimum": 0,
                    "description": "Minimum footprint area in m²."
                  },
                  "areaMax": {
                    "type": "number",
                    "minimum": 0,
                    "description": "Maximum footprint area in m²."
                  },
                  "heightMin": {
                    "type": "number",
                    "minimum": 0,
                    "description": "Minimum known height in meters; never matches an unknown height."
                  },
                  "heightMax": {
                    "type": "number",
                    "minimum": 0,
                    "description": "Maximum known height in meters; never matches an unknown height."
                  },
                  "hasHeight": {
                    "type": "boolean",
                    "description": "Require (true) or forbid (false) a known source height."
                  },
                  "levelsMin": {
                    "type": "number",
                    "minimum": 0,
                    "description": "Minimum floor count; roof choices also use resolved estimates."
                  },
                  "levelsMax": {
                    "type": "number",
                    "minimum": 0,
                    "description": "Maximum floor count; roof choices also use resolved estimates."
                  },
                  "elongationMin": {
                    "type": "number",
                    "minimum": 1,
                    "description": "Minimum long/short axis ratio of the oriented bounding box (>= 1)."
                  },
                  "elongationMax": {
                    "type": "number",
                    "minimum": 1,
                    "description": "Maximum long/short axis ratio of the oriented bounding box (>= 1)."
                  },
                  "rectangularityMin": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                    "description": "Minimum area / (width * depth), 0..1."
                  },
                  "rectangularityMax": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 1,
                    "description": "Maximum area / (width * depth), 0..1."
                  },
                  "verticesMax": {
                    "type": "integer",
                    "minimum": 3,
                    "maximum": 9007199254740991,
                    "description": "Maximum outline vertex count after cleaning."
                  },
                  "holes": {
                    "type": "boolean",
                    "description": "Require (true) or forbid (false) holes (courtyards)."
                  },
                  "wingsMin": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 9007199254740991,
                    "description": "Minimum roof wing count (archstyle rules only)."
                  },
                  "wingsMax": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 9007199254740991,
                    "description": "Maximum roof wing count (archstyle rules only)."
                  }
                },
                "additionalProperties": false,
                "description": "Conditions; omit for a catch-all rule."
              },
              "style": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
                "description": "Archstyle id to apply, e.g. 'molen.worldgen.pnw.house'."
              },
              "variants": {
                "minItems": 1,
                "maxItems": 120,
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "style": {
                      "type": "string",
                      "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
                    },
                    "weight": {
                      "type": "number",
                      "exclusiveMinimum": 0
                    }
                  },
                  "required": [
                    "style",
                    "weight"
                  ],
                  "additionalProperties": false
                },
                "description": "Optional weighted styles sampled from stable building identity. Without identity, use style."
              }
            },
            "required": [
              "style"
            ],
            "additionalProperties": false
          },
          "description": "Ordered style rules evaluated after any world binding rules."
        }
      },
      "required": [
        "style"
      ],
      "additionalProperties": false
    },
    "imports": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "namespace": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
            "description": "External asset namespace the pack may reference, e.g. 'molen.entities'."
          },
          "package": {
            "type": "string"
          },
          "note": {
            "type": "string"
          }
        },
        "required": [
          "namespace"
        ],
        "additionalProperties": false
      },
      "description": "Namespaces of external asset libraries the pack references."
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
            "description": "License identifier, e.g. 'MIT'."
          },
          "sourceUrl": {
            "type": "string",
            "format": "uri"
          },
          "licenseUrl": {
            "type": "string",
            "format": "uri"
          }
        },
        "required": [
          "text",
          "license"
        ],
        "additionalProperties": false
      },
      "description": "Content attributions (at least one)."
    }
  },
  "required": [
    "format",
    "name",
    "version",
    "namespace",
    "styles",
    "defaults",
    "attribution"
  ],
  "additionalProperties": false
}
```
