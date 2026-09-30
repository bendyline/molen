# Transport network (`molen/transport-network@1`)

Roads, railways and paths ambient NPCs move on, for scenes without streamed map tiles. Ways that share a vertex, cross at the same grade or end on one another connect.

## Example

```json
{
  "format": "molen/transport-network@1",
  "name": "crossroads",
  "drivingSide": "right",
  "ways": [
    {
      "id": "main",
      "class": "road",
      "subclass": "primary",
      "points": [
        [
          -200,
          0
        ],
        [
          200,
          0
        ]
      ],
      "lanes": 4
    },
    {
      "id": "cross",
      "class": "road",
      "subclass": "residential",
      "points": [
        [
          0,
          -200
        ],
        [
          0,
          200
        ]
      ]
    },
    {
      "id": "tram",
      "class": "rail",
      "subclass": "tram",
      "points": [
        [
          -200,
          30
        ],
        [
          200,
          30
        ]
      ]
    }
  ],
  "stations": [
    {
      "id": "central",
      "at": [
        0,
        30
      ],
      "kind": "rail"
    }
  ],
  "signals": [
    {
      "at": [
        0,
        0
      ],
      "kind": "light"
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
      "const": "molen/transport-network@1",
      "description": "Format envelope; always 'molen/transport-network@1'."
    },
    "name": {
      "type": "string"
    },
    "origin": {
      "anyOf": [
        {
          "type": "object",
          "properties": {
            "latitude": {
              "type": "number"
            },
            "longitude": {
              "type": "number"
            }
          },
          "required": [
            "latitude",
            "longitude"
          ],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "x": {
              "type": "number"
            },
            "z": {
              "type": "number"
            }
          },
          "required": [
            "x",
            "z"
          ],
          "additionalProperties": false
        }
      ],
      "description": "Where the network came from (geographic anchor of a baked network)."
    },
    "drivingSide": {
      "type": "string",
      "enum": [
        "right",
        "left"
      ],
      "description": "Traffic side (default 'right')."
    },
    "sidewalks": {
      "type": "boolean",
      "description": "Infer sidewalks along streets that have no mapped paths nearby (default false)."
    },
    "ways": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1,
            "description": "Optional stable id."
          },
          "class": {
            "type": "string",
            "enum": [
              "road",
              "rail",
              "path",
              "air"
            ],
            "description": "What moves on it."
          },
          "subclass": {
            "type": "string",
            "description": "motorway, trunk, primary, secondary, tertiary, residential, service; rail/tram; crossing."
          },
          "points": {
            "minItems": 2,
            "type": "array",
            "items": {
              "anyOf": [
                {
                  "minItems": 2,
                  "maxItems": 2,
                  "type": "array",
                  "items": {
                    "type": "number"
                  }
                },
                {
                  "minItems": 3,
                  "maxItems": 3,
                  "type": "array",
                  "items": {
                    "type": "number"
                  }
                }
              ]
            },
            "description": "[x, z] or [x, y, z] points in scene metres (y = road surface height)."
          },
          "oneway": {
            "type": "boolean",
            "description": "Traffic only in point order."
          },
          "lanes": {
            "type": "integer",
            "exclusiveMinimum": 0,
            "maximum": 9007199254740991,
            "description": "Total lanes across both directions."
          },
          "width": {
            "type": "number",
            "exclusiveMinimum": 0,
            "description": "Carriageway width in metres."
          },
          "layer": {
            "type": "integer",
            "minimum": -9007199254740991,
            "maximum": 9007199254740991,
            "description": "Grade: different layers never connect mid-way."
          },
          "speed": {
            "type": "number",
            "exclusiveMinimum": 0,
            "description": "Design speed in m/s."
          },
          "bridge": {
            "type": "boolean"
          },
          "tunnel": {
            "type": "boolean"
          },
          "name": {
            "type": "string"
          }
        },
        "required": [
          "class",
          "points"
        ],
        "additionalProperties": false
      },
      "description": "Roads, railways and paths."
    },
    "stations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1
          },
          "at": {
            "minItems": 2,
            "maxItems": 2,
            "type": "array",
            "items": {
              "type": "number"
            },
            "description": "[x, z]; projected onto the nearest rail (rail) or footway (bus)."
          },
          "kind": {
            "type": "string",
            "enum": [
              "rail",
              "bus"
            ]
          },
          "dwell": {
            "type": "number",
            "exclusiveMinimum": 0,
            "description": "Dwell time in seconds."
          }
        },
        "required": [
          "id",
          "at",
          "kind"
        ],
        "additionalProperties": false
      },
      "description": "Stops trains (and buses) serve."
    },
    "signals": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "at": {
            "minItems": 2,
            "maxItems": 2,
            "type": "array",
            "items": {
              "type": "number"
            }
          },
          "kind": {
            "type": "string",
            "enum": [
              "stop",
              "yield",
              "light"
            ]
          }
        },
        "required": [
          "at",
          "kind"
        ],
        "additionalProperties": false
      },
      "description": "Junction controls: a light signalises the junction nearest the point; a stop or yield sign makes the junction arm nearest the point give way."
    },
    "aerodromes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1
          },
          "at": {
            "minItems": 2,
            "maxItems": 2,
            "type": "array",
            "items": {
              "type": "number"
            }
          },
          "heading": {
            "type": "number",
            "description": "Runway heading in radians about +Y (0 = +Z)."
          },
          "length": {
            "type": "number",
            "exclusiveMinimum": 0,
            "description": "Runway length in metres (default 2500)."
          }
        },
        "required": [
          "id",
          "at"
        ],
        "additionalProperties": false
      },
      "description": "Runways aircraft approach and depart."
    }
  },
  "required": [
    "format",
    "ways"
  ],
  "additionalProperties": false
}
```
