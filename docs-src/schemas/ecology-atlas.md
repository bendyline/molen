# Ecological geography atlas (`molen/ecology-atlas@1`)

Compact global ecological geography with attributed source and run-length encoded rows.

## Example

```json
{
  "format": "molen/ecology-atlas@1",
  "id": "example.ecology",
  "version": 1,
  "title": "Coarse habitat geography",
  "cellDegrees": 10,
  "regions": [
    {
      "id": 1,
      "name": "Example forest",
      "biome": 4,
      "realm": "Palearctic"
    }
  ],
  "rows": [
    [
      36,
      0
    ],
    [
      36,
      0
    ],
    [
      36,
      0
    ],
    [
      36,
      0
    ],
    [
      36,
      1
    ],
    [
      36,
      0
    ],
    [
      36,
      0
    ],
    [
      36,
      0
    ],
    [
      36,
      0
    ],
    [
      36,
      0
    ],
    [
      36,
      0
    ],
    [
      36,
      0
    ],
    [
      36,
      0
    ],
    [
      36,
      0
    ],
    [
      36,
      0
    ],
    [
      36,
      0
    ],
    [
      36,
      0
    ],
    [
      36,
      0
    ]
  ],
  "source": {
    "title": "Synthetic schema example",
    "url": "https://example.com/ecology",
    "license": "MIT",
    "citation": "Molen schema example",
    "sha256": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    "interpretation": "Synthetic geography for format demonstration only."
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
      "const": "molen/ecology-atlas@1"
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$"
    },
    "version": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991
    },
    "title": {
      "type": "string",
      "minLength": 1
    },
    "cellDegrees": {
      "type": "number",
      "minimum": 0.05,
      "maximum": 10,
      "description": "Global equal-angle cell size in degrees."
    },
    "regions": {
      "maxItems": 65534,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991
          },
          "name": {
            "type": "string",
            "minLength": 1
          },
          "biome": {
            "type": "integer",
            "minimum": 0,
            "maximum": 14
          },
          "realm": {
            "type": "string",
            "minLength": 1
          }
        },
        "required": [
          "id",
          "name",
          "biome",
          "realm"
        ],
        "additionalProperties": false
      }
    },
    "rows": {
      "maxItems": 3600,
      "type": "array",
      "items": {
        "maxItems": 14400,
        "type": "array",
        "items": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991
        }
      },
      "description": "North-to-south rows: alternating run length and 1-based region index; 0 is uncovered."
    },
    "source": {
      "type": "object",
      "properties": {
        "title": {
          "type": "string",
          "minLength": 1
        },
        "url": {
          "type": "string",
          "format": "uri"
        },
        "license": {
          "type": "string",
          "minLength": 1
        },
        "citation": {
          "type": "string",
          "minLength": 1
        },
        "sha256": {
          "type": "string",
          "pattern": "^sha256:[a-f0-9]{64}$"
        },
        "interpretation": {
          "type": "string",
          "minLength": 1
        }
      },
      "required": [
        "title",
        "url",
        "license",
        "citation",
        "sha256",
        "interpretation"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "format",
    "id",
    "version",
    "title",
    "cellDegrees",
    "regions",
    "rows",
    "source"
  ],
  "additionalProperties": false
}
```
