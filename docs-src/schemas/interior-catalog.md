# Interior catalog (`molen/interior-catalog@1`)

Versioned type-specific layout algorithms, metric clearances and furnishing palettes for inferred interiors, including connected residential storeys.

## Example

```json
{
  "format": "molen/interior-catalog@1",
  "fallback": "generic",
  "profiles": [
    {
      "id": "grocery",
      "version": 1,
      "labels": [
        "supermarket",
        "grocery"
      ],
      "algorithm": "aisles",
      "furnishing": "shelf",
      "moduleWidth": 1.1,
      "moduleDepth": 6,
      "aisleWidth": 2.4,
      "density": 0.9,
      "palette": {
        "floor": "#d0cec5",
        "wall": "#eeeae0",
        "wood": "#b8b6aa",
        "accent": "#54785b"
      }
    },
    {
      "id": "fast-food",
      "version": 1,
      "labels": [
        "fast_food",
        "fast-food"
      ],
      "algorithm": "dining",
      "furnishing": "table",
      "moduleWidth": 2.3,
      "moduleDepth": 2.3,
      "aisleWidth": 1.6,
      "density": 0.9,
      "palette": {
        "floor": "#c7beb0",
        "wall": "#f0e5d3",
        "wood": "#b48654",
        "accent": "#a64e36"
      }
    },
    {
      "id": "restaurant",
      "version": 1,
      "labels": [
        "restaurant",
        "food_court"
      ],
      "algorithm": "dining",
      "furnishing": "table",
      "moduleWidth": 2.5,
      "moduleDepth": 2.5,
      "aisleWidth": 1.5,
      "density": 0.9,
      "palette": {
        "floor": "#b9b2a2",
        "wall": "#e2ddcf",
        "wood": "#856249",
        "accent": "#536b66"
      }
    },
    {
      "id": "cafe",
      "version": 1,
      "labels": [
        "cafe",
        "coffee_shop"
      ],
      "algorithm": "dining",
      "furnishing": "table",
      "moduleWidth": 1.8,
      "moduleDepth": 1.8,
      "aisleWidth": 1.4,
      "density": 0.9,
      "palette": {
        "floor": "#a48569",
        "wall": "#e5d8c2",
        "wood": "#77523b",
        "accent": "#4e746a"
      }
    },
    {
      "id": "pharmacy",
      "version": 1,
      "labels": [
        "pharmacy",
        "chemist"
      ],
      "algorithm": "aisles",
      "furnishing": "shelf",
      "moduleWidth": 0.9,
      "moduleDepth": 3,
      "aisleWidth": 1.8,
      "density": 0.9,
      "palette": {
        "floor": "#b9b2a2",
        "wall": "#e2ddcf",
        "wood": "#856249",
        "accent": "#536b66"
      }
    },
    {
      "id": "retail",
      "version": 1,
      "labels": [
        "retail",
        "shop",
        "department_store",
        "commercial"
      ],
      "algorithm": "aisles",
      "furnishing": "shelf",
      "moduleWidth": 1.1,
      "moduleDepth": 3.5,
      "aisleWidth": 1.8,
      "density": 0.9,
      "palette": {
        "floor": "#b9b2a2",
        "wall": "#e2ddcf",
        "wood": "#856249",
        "accent": "#536b66"
      }
    },
    {
      "id": "house",
      "version": 2,
      "residential": {
        "upstairs": true,
        "stairWidth": 1.3,
        "runPerRise": 1.65,
        "minRoomWidth": 2.4
      },
      "labels": [
        "house",
        "detached",
        "residential",
        "bungalow",
        "terrace",
        "semidetached_house",
        "semidetached",
        "townhouse",
        "townhouses",
        "cabin",
        "hut",
        "farm"
      ],
      "algorithm": "residential",
      "furnishing": "bed",
      "moduleWidth": 4.2,
      "moduleDepth": 4.5,
      "aisleWidth": 1.4,
      "density": 0.9,
      "palette": {
        "floor": "#a98a67",
        "wall": "#ddd5c5",
        "wood": "#816047",
        "accent": "#597b77"
      }
    },
    {
      "id": "apartments",
      "version": 1,
      "labels": [
        "apartments",
        "hotel",
        "dormitory"
      ],
      "algorithm": "rooms",
      "furnishing": "bed",
      "moduleWidth": 4.4,
      "moduleDepth": 5,
      "aisleWidth": 1.8,
      "density": 0.9,
      "palette": {
        "floor": "#b9b2a2",
        "wall": "#e2ddcf",
        "wood": "#856249",
        "accent": "#536b66"
      }
    },
    {
      "id": "office",
      "version": 1,
      "labels": [
        "office",
        "offices"
      ],
      "algorithm": "workplace",
      "furnishing": "desk",
      "moduleWidth": 2.4,
      "moduleDepth": 2.1,
      "aisleWidth": 1.5,
      "density": 0.9,
      "palette": {
        "floor": "#78848c",
        "wall": "#e0e4e1",
        "wood": "#b8a17c",
        "accent": "#4e6379"
      }
    },
    {
      "id": "school",
      "version": 1,
      "labels": [
        "school",
        "university",
        "college"
      ],
      "algorithm": "rooms",
      "furnishing": "desk",
      "moduleWidth": 6,
      "moduleDepth": 7,
      "aisleWidth": 2.4,
      "density": 0.9,
      "palette": {
        "floor": "#b9b2a2",
        "wall": "#e2ddcf",
        "wood": "#856249",
        "accent": "#536b66"
      }
    },
    {
      "id": "clinic",
      "version": 1,
      "labels": [
        "clinic",
        "hospital",
        "doctors"
      ],
      "algorithm": "rooms",
      "furnishing": "bed",
      "moduleWidth": 4.2,
      "moduleDepth": 4.8,
      "aisleWidth": 2,
      "density": 0.9,
      "palette": {
        "floor": "#becfc9",
        "wall": "#ecf1ec",
        "wood": "#cbd2ca",
        "accent": "#5b8c95"
      }
    },
    {
      "id": "warehouse",
      "version": 1,
      "labels": [
        "warehouse",
        "industrial",
        "storage",
        "hangar"
      ],
      "algorithm": "storage",
      "furnishing": "rack",
      "moduleWidth": 1.8,
      "moduleDepth": 5,
      "aisleWidth": 3,
      "density": 0.9,
      "palette": {
        "floor": "#969892",
        "wall": "#c5c7be",
        "wood": "#987143",
        "accent": "#bb8a39"
      }
    },
    {
      "id": "library",
      "version": 1,
      "labels": [
        "library",
        "books"
      ],
      "algorithm": "aisles",
      "furnishing": "shelf",
      "moduleWidth": 0.8,
      "moduleDepth": 4,
      "aisleWidth": 1.8,
      "density": 0.9,
      "palette": {
        "floor": "#b9b2a2",
        "wall": "#e2ddcf",
        "wood": "#856249",
        "accent": "#536b66"
      }
    },
    {
      "id": "assembly",
      "version": 1,
      "labels": [
        "church",
        "place_of_worship",
        "theatre",
        "community_centre"
      ],
      "algorithm": "hall",
      "furnishing": "bench",
      "moduleWidth": 3.2,
      "moduleDepth": 1,
      "aisleWidth": 1.5,
      "density": 0.9,
      "palette": {
        "floor": "#b9b2a2",
        "wall": "#e2ddcf",
        "wood": "#856249",
        "accent": "#536b66"
      }
    },
    {
      "id": "generic",
      "version": 1,
      "labels": [],
      "algorithm": "hall",
      "furnishing": "sofa",
      "moduleWidth": 2.2,
      "moduleDepth": 1.2,
      "aisleWidth": 1.8,
      "density": 0.9,
      "palette": {
        "floor": "#b9b2a2",
        "wall": "#e2ddcf",
        "wood": "#856249",
        "accent": "#536b66"
      }
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
      "const": "molen/interior-catalog@1"
    },
    "fallback": {
      "type": "string",
      "minLength": 1
    },
    "profiles": {
      "minItems": 1,
      "maxItems": 128,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-z][a-z0-9.-]*$"
          },
          "version": {
            "type": "integer",
            "exclusiveMinimum": 0,
            "maximum": 9007199254740991
          },
          "labels": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          },
          "algorithm": {
            "type": "string",
            "enum": [
              "aisles",
              "dining",
              "rooms",
              "workplace",
              "storage",
              "hall",
              "residential"
            ]
          },
          "residential": {
            "type": "object",
            "properties": {
              "upstairs": {
                "type": "boolean"
              },
              "stairWidth": {
                "type": "number",
                "minimum": 1.2,
                "maximum": 2
              },
              "runPerRise": {
                "type": "number",
                "minimum": 1.5,
                "maximum": 2
              },
              "minRoomWidth": {
                "type": "number",
                "minimum": 2.2,
                "maximum": 4
              }
            },
            "required": [
              "upstairs",
              "stairWidth",
              "runPerRise",
              "minRoomWidth"
            ],
            "additionalProperties": false
          },
          "furnishing": {
            "type": "string",
            "enum": [
              "shelf",
              "checkout",
              "table",
              "counter",
              "bed",
              "sofa",
              "desk",
              "rack",
              "bench",
              "wardrobe",
              "kitchen",
              "vanity",
              "toilet",
              "shower",
              "rug",
              "coffee-table",
              "bookcase",
              "plant",
              "dresser"
            ]
          },
          "aisleWidth": {
            "type": "number",
            "minimum": 1.2,
            "maximum": 8,
            "description": "Minimum clear route width in meters."
          },
          "moduleWidth": {
            "type": "number",
            "minimum": 0.5,
            "maximum": 20
          },
          "moduleDepth": {
            "type": "number",
            "minimum": 0.5,
            "maximum": 30
          },
          "density": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "palette": {
            "type": "object",
            "properties": {
              "floor": {
                "type": "string",
                "pattern": "^#[0-9a-fA-F]{6}$"
              },
              "wall": {
                "type": "string",
                "pattern": "^#[0-9a-fA-F]{6}$"
              },
              "wood": {
                "type": "string",
                "pattern": "^#[0-9a-fA-F]{6}$"
              },
              "accent": {
                "type": "string",
                "pattern": "^#[0-9a-fA-F]{6}$"
              }
            },
            "required": [
              "floor",
              "wall",
              "wood",
              "accent"
            ],
            "additionalProperties": false
          }
        },
        "required": [
          "id",
          "version",
          "labels",
          "algorithm",
          "furnishing",
          "aisleWidth",
          "moduleWidth",
          "moduleDepth",
          "density",
          "palette"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "format",
    "fallback",
    "profiles"
  ],
  "additionalProperties": false
}
```
