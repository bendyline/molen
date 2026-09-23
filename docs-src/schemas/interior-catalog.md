# Interior catalog (`molen/interior-catalog@1`)

Versioned type-specific layout algorithms, metric clearances and furnishing palettes for inferred interiors, including connected residential storeys.

## Example

```json
{
  "format": "molen/interior-catalog@1",
  "fallback": "generic",
  "profiles": [
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
