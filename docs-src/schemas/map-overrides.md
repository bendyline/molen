# Map overrides (`molen/map-overrides@1`)

Rectangles of the mapped world to clear, with the buildings, models and props a host places there instead.

## Example

```json
{
  "format": "molen/map-overrides@1",
  "title": "A warehouse where a landmark stood",
  "overrides": [
    {
      "id": "sample-warehouse",
      "area": {
        "center": [
          -122.3493,
          47.62051
        ],
        "size": [
          80,
          60
        ]
      },
      "surface": "paved",
      "buildings": [
        {
          "id": "shed",
          "rect": {
            "size": [
              48,
              30
            ]
          },
          "height": 9,
          "use": "warehouse",
          "wall": "#b9b4a8"
        }
      ],
      "props": [
        {
          "id": "lamp",
          "kind": "street_lamp",
          "position": [
            28,
            18
          ]
        }
      ]
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
      "const": "molen/map-overrides@1"
    },
    "title": {
      "type": "string",
      "minLength": 1
    },
    "overrides": {
      "maxItems": 256,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-z0-9][a-z0-9._-]{0,63}$",
            "description": "Stable id; names the features the override generates."
          },
          "area": {
            "anyOf": [
              {
                "type": "object",
                "properties": {
                  "center": {
                    "type": "array",
                    "prefixItems": [
                      {
                        "type": "number",
                        "minimum": -180,
                        "maximum": 180
                      },
                      {
                        "type": "number",
                        "minimum": -85,
                        "maximum": 85
                      }
                    ],
                    "items": false,
                    "minItems": 2,
                    "maxItems": 2,
                    "description": "[longitude, latitude] of the rectangle center, the origin of the override frame."
                  },
                  "size": {
                    "type": "array",
                    "prefixItems": [
                      {
                        "type": "number",
                        "minimum": 1,
                        "maximum": 2000
                      },
                      {
                        "type": "number",
                        "minimum": 1,
                        "maximum": 2000
                      }
                    ],
                    "items": false,
                    "minItems": 2,
                    "maxItems": 2,
                    "description": "[width, depth] in meters, each 1 to 2000."
                  },
                  "heading": {
                    "type": "number",
                    "description": "Compass heading the frame -z side faces, radians; default 0."
                  }
                },
                "required": [
                  "center",
                  "size"
                ],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
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
                        "minimum": -85,
                        "maximum": 85
                      },
                      {
                        "type": "number",
                        "minimum": -180,
                        "maximum": 180
                      },
                      {
                        "type": "number",
                        "minimum": -85,
                        "maximum": 85
                      }
                    ],
                    "items": false,
                    "minItems": 4,
                    "maxItems": 4,
                    "description": "WGS84 [west, south, east, north], at most 2000 m a side; the frame is north up."
                  }
                },
                "required": [
                  "bounds"
                ],
                "additionalProperties": false
              }
            ]
          },
          "clear": {
            "type": "object",
            "properties": {
              "buildings": {
                "anyOf": [
                  {
                    "type": "boolean"
                  },
                  {
                    "type": "string",
                    "const": "clip"
                  }
                ],
                "description": "Mapped footprints at least half inside the rectangle (default true); \"clip\" trims every footprint at its edge instead."
              },
              "landmarks": {
                "type": "boolean",
                "description": "Catalogued landmark models anchored in the rectangle; default true."
              },
              "vegetation": {
                "type": "boolean",
                "description": "Land cover, scattered plants and mapped trees; default true."
              },
              "props": {
                "type": "boolean",
                "description": "Mapped street furniture; default true."
              },
              "parking": {
                "type": "boolean",
                "description": "Parking lots, their aisles and driveways, and the cars on them; default true."
              },
              "roads": {
                "type": "boolean",
                "description": "Roads and paths whose center line is in the rectangle; default false. Bridges, tunnels, railways and runways stay, and the ground keeps its grading."
              }
            },
            "additionalProperties": false
          },
          "surface": {
            "type": "string",
            "enum": [
              "ground",
              "grass",
              "paved",
              "plaza",
              "gravel",
              "bare",
              "sand"
            ],
            "description": "Ground of the cleared rectangle; default ground."
          },
          "buildings": {
            "maxItems": 64,
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "pattern": "^[a-z0-9][a-z0-9._-]{0,63}$",
                  "description": "Lowercase letters, digits, \".\", \"_\" and \"-\"; at most 64 characters."
                },
                "outline": {
                  "minItems": 3,
                  "maxItems": 256,
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
                    "maxItems": 2,
                    "description": "[x, z] in meters from the area center: +x east, +z south before the area heading."
                  },
                  "description": "Footprint ring that does not cross itself. Give this or rect."
                },
                "rect": {
                  "type": "object",
                  "properties": {
                    "center": {
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
                      "maxItems": 2,
                      "description": "[x, z] in meters from the area center: +x east, +z south before the area heading."
                    },
                    "size": {
                      "type": "array",
                      "prefixItems": [
                        {
                          "type": "number",
                          "minimum": 1,
                          "maximum": 1000
                        },
                        {
                          "type": "number",
                          "minimum": 1,
                          "maximum": 1000
                        }
                      ],
                      "items": false,
                      "minItems": 2,
                      "maxItems": 2,
                      "description": "[width, depth] in meters."
                    },
                    "heading": {
                      "type": "number",
                      "description": "Compass sense, radians clockwise seen from above; default 0."
                    }
                  },
                  "required": [
                    "size"
                  ],
                  "additionalProperties": false,
                  "description": "A rectangular footprint instead of outline."
                },
                "height": {
                  "type": "number",
                  "exclusiveMinimum": 0,
                  "maximum": 1000,
                  "description": "Meters above its base."
                },
                "levels": {
                  "type": "integer",
                  "minimum": 1,
                  "maximum": 200,
                  "description": "Floors; default 1 when there is no height."
                },
                "minHeight": {
                  "type": "number",
                  "minimum": 0,
                  "maximum": 500,
                  "description": "Meters its base stands above the ground."
                },
                "use": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 64,
                  "description": "What it is, as map data names buildings (warehouse, school, house); picks a default look."
                },
                "style": {
                  "type": "string",
                  "pattern": "^[a-z][a-z0-9_.-]*$",
                  "description": "An architecture style id of the style pack; ignored when the pack has none by that id."
                },
                "wall": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "A #rrggbb color."
                },
                "trim": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "A #rrggbb color."
                },
                "name": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 120
                }
              },
              "required": [
                "id"
              ],
              "additionalProperties": false
            }
          },
          "models": {
            "maxItems": 16,
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "pattern": "^[a-z0-9][a-z0-9._-]{0,63}$",
                  "description": "Lowercase letters, digits, \".\", \"_\" and \"-\"; at most 64 characters."
                },
                "asset": {
                  "type": "string",
                  "pattern": "^[A-Za-z0-9][A-Za-z0-9_./:@-]{0,255}$",
                  "description": "A structure asset id of the style pack, or a ref the host view loads."
                },
                "position": {
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
                  "maxItems": 2,
                  "description": "[x, z] in meters from the area center: +x east, +z south before the area heading."
                },
                "heading": {
                  "type": "number",
                  "description": "Compass sense, radians clockwise seen from above; default 0."
                },
                "scale": {
                  "anyOf": [
                    {
                      "type": "number",
                      "minimum": 0.01,
                      "maximum": 100
                    },
                    {
                      "type": "array",
                      "prefixItems": [
                        {
                          "type": "number",
                          "minimum": 0.01,
                          "maximum": 100
                        },
                        {
                          "type": "number",
                          "minimum": 0.01,
                          "maximum": 100
                        },
                        {
                          "type": "number",
                          "minimum": 0.01,
                          "maximum": 100
                        }
                      ],
                      "items": false,
                      "minItems": 3,
                      "maxItems": 3
                    }
                  ],
                  "description": "One factor or [x, y, z], each 0.01 to 100; default 1."
                },
                "elevation": {
                  "type": "number",
                  "minimum": -100,
                  "maximum": 1000,
                  "description": "Meters above the ground at position."
                },
                "minLevel": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 26,
                  "description": "Coarsest tile level it is drawn at."
                }
              },
              "required": [
                "id",
                "asset",
                "position"
              ],
              "additionalProperties": false
            }
          },
          "props": {
            "maxItems": 256,
            "type": "array",
            "items": {
              "anyOf": [
                {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string",
                      "pattern": "^[a-z0-9][a-z0-9._-]{0,63}$",
                      "description": "Lowercase letters, digits, \".\", \"_\" and \"-\"; at most 64 characters."
                    },
                    "position": {
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
                      "maxItems": 2,
                      "description": "[x, z] in meters from the area center: +x east, +z south before the area heading."
                    },
                    "heading": {
                      "type": "number",
                      "description": "Compass sense, radians clockwise seen from above; default 0."
                    },
                    "kind": {
                      "type": "string",
                      "enum": [
                        "tree",
                        "street_lamp",
                        "bench",
                        "bike_rack",
                        "charger"
                      ]
                    },
                    "height": {
                      "type": "number",
                      "exclusiveMinimum": 0,
                      "maximum": 80,
                      "description": "Meters; trees and street lamps."
                    },
                    "crownDiameter": {
                      "type": "number",
                      "exclusiveMinimum": 0,
                      "maximum": 40,
                      "description": "Meters; trees."
                    },
                    "leafType": {
                      "type": "string",
                      "enum": [
                        "broadleaved",
                        "needleleaved"
                      ]
                    },
                    "species": {
                      "type": "string",
                      "minLength": 1
                    }
                  },
                  "required": [
                    "id",
                    "position",
                    "kind"
                  ],
                  "additionalProperties": false
                },
                {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string",
                      "pattern": "^[a-z0-9][a-z0-9._-]{0,63}$",
                      "description": "Lowercase letters, digits, \".\", \"_\" and \"-\"; at most 64 characters."
                    },
                    "position": {
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
                      "maxItems": 2,
                      "description": "[x, z] in meters from the area center: +x east, +z south before the area heading."
                    },
                    "heading": {
                      "type": "number",
                      "description": "Compass sense, radians clockwise seen from above; default 0."
                    },
                    "model": {
                      "type": "string",
                      "pattern": "^[A-Za-z0-9][A-Za-z0-9_./:@-]{0,255}$",
                      "description": "A prop model ref: a builtin: model, a regional plant, or a ref the view loads."
                    },
                    "scale": {
                      "anyOf": [
                        {
                          "type": "number",
                          "minimum": 0.01,
                          "maximum": 100
                        },
                        {
                          "type": "array",
                          "prefixItems": [
                            {
                              "type": "number",
                              "minimum": 0.01,
                              "maximum": 100
                            },
                            {
                              "type": "number",
                              "minimum": 0.01,
                              "maximum": 100
                            },
                            {
                              "type": "number",
                              "minimum": 0.01,
                              "maximum": 100
                            }
                          ],
                          "items": false,
                          "minItems": 3,
                          "maxItems": 3
                        }
                      ],
                      "description": "One factor or [x, y, z], each 0.01 to 100; default 1."
                    },
                    "color": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "A #rrggbb color."
                    }
                  },
                  "required": [
                    "id",
                    "position",
                    "model"
                  ],
                  "additionalProperties": false
                }
              ]
            }
          },
          "minLevel": {
            "type": "integer",
            "minimum": 0,
            "maximum": 26,
            "description": "Coarsest tile level the map is edited at; default 11. Landmarks hide at every level."
          },
          "actors": {
            "maxItems": 256,
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "pattern": "^[a-z0-9][a-z0-9._-]{0,63}$",
                  "description": "Lowercase letters, digits, \".\", \"_\" and \"-\"; at most 64 characters."
                }
              },
              "required": [
                "id"
              ],
              "additionalProperties": {}
            },
            "description": "Kept for the host view (see the Earth view guide); not read by the map edit."
          },
          "vehicles": {
            "maxItems": 256,
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "pattern": "^[a-z0-9][a-z0-9._-]{0,63}$",
                  "description": "Lowercase letters, digits, \".\", \"_\" and \"-\"; at most 64 characters."
                }
              },
              "required": [
                "id"
              ],
              "additionalProperties": {}
            },
            "description": "Kept for the host view (see the Earth view guide); not read by the map edit."
          }
        },
        "required": [
          "id",
          "area"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "format",
    "overrides"
  ],
  "additionalProperties": false
}
```
