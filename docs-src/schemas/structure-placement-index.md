# Regional structure placement directory (`molen/structure-placement-index@1`)

Spatial coverage and pack paths for lazily loaded placement regions.

## Example

```json
{
  "format": "molen/structure-placement-index@1",
  "shards": {},
  "cells": {}
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
      "const": "molen/structure-placement-index@1"
    },
    "shards": {
      "type": "object",
      "propertyNames": {
        "type": "string",
        "pattern": "^[0123456789bcdefghjkmnpqrstuvwxyz]{2,12}$"
      },
      "additionalProperties": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.?(?:\\/|$)).+\\.json$"
          },
          "bytes": {
            "type": "integer",
            "exclusiveMinimum": 0,
            "maximum": 9007199254740991
          },
          "count": {
            "type": "integer",
            "exclusiveMinimum": 0,
            "maximum": 9007199254740991
          },
          "minLevel": {
            "type": "integer",
            "minimum": 0,
            "maximum": 26
          }
        },
        "required": [
          "path",
          "bytes",
          "count",
          "minLevel"
        ],
        "additionalProperties": false
      }
    },
    "cells": {
      "type": "object",
      "propertyNames": {
        "type": "string",
        "pattern": "^[0123456789bcdefghjkmnpqrstuvwxyz]{2}$"
      },
      "additionalProperties": {
        "minItems": 1,
        "type": "array",
        "items": {
          "type": "string",
          "pattern": "^[0123456789bcdefghjkmnpqrstuvwxyz]{2,12}$"
        }
      }
    }
  },
  "required": [
    "format",
    "shards",
    "cells"
  ],
  "additionalProperties": false
}
```
