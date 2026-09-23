# Region style atlas (`molen/region-atlas@1`)

Binds archstyles and scatter rule sets to places on Earth: prioritized lon/lat regions with ordered style rules, plus a worldwide default chain evaluated before the pack defaults.

## Example

```json
{
  "format": "molen/region-atlas@1",
  "id": "molen.worldgen.atlas.world",
  "title": "World style atlas",
  "version": 1,
  "regions": [
    {
      "id": "us.pnw",
      "title": "Pacific Northwest",
      "priority": 10,
      "bbox": [
        -125.5,
        41.9,
        -116.4,
        51.6
      ],
      "bindings": {
        "buildings": [
          {
            "when": {
              "class": [
                "house",
                "detached",
                "semidetached",
                "residential",
                "bungalow",
                "cabin"
              ]
            },
            "style": "molen.worldgen.pnw.house"
          },
          {
            "when": {
              "class": [
                "yes",
                "building"
              ],
              "contextClass": [
                "residential",
                "none"
              ],
              "areaMax": 400
            },
            "style": "molen.worldgen.pnw.house"
          }
        ],
        "scatter": "molen.worldgen.scatter.pnw"
      }
    },
    {
      "id": "jp",
      "title": "Japan",
      "priority": 10,
      "bbox": [
        122.9,
        24,
        146.2,
        45.8
      ],
      "polygons": [
        [
          [
            129,
            30.9
          ],
          [
            131.6,
            30.6
          ],
          [
            142.4,
            34.4
          ],
          [
            146.2,
            43.4
          ],
          [
            141.2,
            45.8
          ],
          [
            139.4,
            41.4
          ],
          [
            136,
            38.2
          ],
          [
            130.8,
            35.2
          ],
          [
            129,
            32.4
          ]
        ]
      ],
      "bindings": {
        "buildings": [
          {
            "when": {
              "class": [
                "house",
                "detached",
                "residential"
              ],
              "areaMax": 250
            },
            "style": "molen.worldgen.japan.house"
          }
        ],
        "scatter": "molen.worldgen.scatter.japan"
      }
    }
  ],
  "default": {
    "buildings": [
      {
        "when": {
          "class": [
            "mall",
            "supermarket",
            "warehouse"
          ],
          "areaMin": 1500
        },
        "style": "molen.worldgen.generic.mall"
      }
    ],
    "scatter": "molen.worldgen.scatter.global"
  }
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
      "const": "molen/region-atlas@1",
      "description": "Format envelope; always 'molen/region-atlas@1'."
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
      "description": "Atlas id, e.g. 'molen.worldgen.atlas.world'."
    },
    "title": {
      "type": "string",
      "minLength": 1
    },
    "doc": {
      "type": "string"
    },
    "version": {
      "default": 1,
      "type": "integer",
      "minimum": 1,
      "maximum": 9007199254740991,
      "description": "Bump when bindings change on purpose."
    },
    "regions": {
      "default": [],
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9_.-]*$",
            "description": "Region id, e.g. 'us.pnw'."
          },
          "title": {
            "type": "string"
          },
          "priority": {
            "default": 0,
            "type": "integer",
            "minimum": -1000,
            "maximum": 1000,
            "description": "Higher priority wins where regions overlap."
          },
          "bbox": {
            "minItems": 4,
            "maxItems": 4,
            "type": "array",
            "items": {
              "type": "number"
            },
            "description": "[minLon, minLat, maxLon, maxLat] in degrees; the sole geometry when polygons are absent."
          },
          "polygons": {
            "type": "array",
            "items": {
              "minItems": 3,
              "type": "array",
              "items": {
                "minItems": 2,
                "maxItems": 2,
                "type": "array",
                "items": {
                  "type": "number"
                },
                "description": "[longitude, latitude] in degrees (WGS84)."
              }
            },
            "description": "WGS84 outer rings (union). No holes; must not cross the antimeridian."
          },
          "bindings": {
            "type": "object",
            "properties": {
              "buildings": {
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
                "description": "Ordered style rules for buildings inside the region; first match wins."
              },
              "default": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
                "description": "Archstyle when no region rule matches (before pack rules)."
              },
              "scatter": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
                "description": "Scatter rule set for the region."
              },
              "treeFillFactor": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "description": "Synthetic tree fill around homes, 0..1; 0 disables it. Inherits atlas default."
              }
            },
            "additionalProperties": false
          }
        },
        "required": [
          "id",
          "bindings"
        ],
        "additionalProperties": false
      },
      "description": "Regions in document order (ties resolve to the first)."
    },
    "default": {
      "type": "object",
      "properties": {
        "buildings": {
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
          "description": "Worldwide style rules."
        },
        "style": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
          "description": "Worldwide archstyle when no rule matches (else the pack default)."
        },
        "scatter": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$",
          "description": "Worldwide scatter rule set (else the pack default)."
        },
        "treeFillFactor": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Synthetic tree fill around homes, 0..1. Omitted disables infill outside configured regions."
        }
      },
      "additionalProperties": false
    }
  },
  "required": [
    "format",
    "id",
    "title",
    "default"
  ],
  "additionalProperties": false
}
```
