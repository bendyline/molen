# Wildlife country range limits (`molen/wildlife-ranges@1`)

Attributed coarse country membership for supported taxa. Combine with ecology and mapped habitat; not occurrence data.

## Example

```json
{
  "format": "molen/wildlife-ranges@1",
  "id": "example.ranges",
  "version": 1,
  "title": "Range example",
  "cellDegrees": 10,
  "countries": [],
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
    ],
    [
      36,
      0
    ]
  ],
  "taxa": [],
  "sources": [
    {
      "title": "Example source",
      "url": "https://example.com",
      "license": "CC0-1.0",
      "sha256": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "interpretation": "Example only."
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
      "const": "molen/wildlife-ranges@1"
    },
    "id": {
      "type": "string",
      "minLength": 1
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
      "maximum": 10
    },
    "countries": {
      "maxItems": 65534,
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "minLength": 2,
            "maxLength": 3
          },
          "name": {
            "type": "string",
            "minLength": 1
          }
        },
        "required": [
          "code",
          "name"
        ],
        "additionalProperties": false
      }
    },
    "rows": {
      "type": "array",
      "items": {
        "type": "array",
        "items": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991
        }
      }
    },
    "taxa": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1
          },
          "sourceId": {
            "type": "string",
            "minLength": 1
          },
          "name": {
            "type": "string",
            "minLength": 1
          },
          "countries": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 2,
              "maxLength": 3
            }
          }
        },
        "required": [
          "id",
          "sourceId",
          "name",
          "countries"
        ],
        "additionalProperties": false
      }
    },
    "sources": {
      "minItems": 1,
      "type": "array",
      "items": {
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
          "sha256",
          "interpretation"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "format",
    "id",
    "version",
    "title",
    "cellDegrees",
    "countries",
    "rows",
    "taxa",
    "sources"
  ],
  "additionalProperties": false
}
```
