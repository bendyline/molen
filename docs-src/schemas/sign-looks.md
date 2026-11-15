# Storefront sign looks (`molen/sign-looks@1`)

Plate and letter colors, accent band, font role and case for signs that show mapped place names.

## Example

```json
{
  "format": "molen/sign-looks@1",
  "version": 1,
  "families": {
    "cafe": [
      {
        "plate": "#4c4036",
        "ink": "#f3e4c7",
        "font": "serif"
      },
      {
        "plate": "#efe9df",
        "ink": "#1f5a46",
        "font": "bold"
      }
    ]
  },
  "chains": {
    "neighborhood_grocery": {
      "look": {
        "plate": "#bc2530",
        "ink": "#ffffff"
      }
    }
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
      "const": "molen/sign-looks@1"
    },
    "version": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991
    },
    "families": {
      "type": "object",
      "propertyNames": {
        "type": "string",
        "enum": [
          "grocery",
          "restaurant",
          "cafe",
          "pharmacy",
          "shop",
          "mall",
          "department_store",
          "outlet_mall",
          "strip_mall"
        ]
      },
      "additionalProperties": {
        "minItems": 1,
        "maxItems": 64,
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "plate": {
              "type": "string",
              "pattern": "^#[0-9a-fA-F]{6}$"
            },
            "ink": {
              "type": "string",
              "pattern": "^#[0-9a-fA-F]{6}$"
            },
            "stripe": {
              "type": "string",
              "pattern": "^#[0-9a-fA-F]{6}$"
            },
            "font": {
              "type": "string",
              "minLength": 1,
              "maxLength": 100
            },
            "case": {
              "type": "string",
              "enum": [
                "as-is",
                "upper"
              ]
            },
            "letterSpacing": {
              "type": "number",
              "minimum": -0.1,
              "maximum": 0.5
            }
          },
          "required": [
            "plate",
            "ink"
          ],
          "additionalProperties": false
        }
      }
    },
    "chains": {
      "type": "object",
      "propertyNames": {
        "type": "string",
        "minLength": 1
      },
      "additionalProperties": {
        "type": "object",
        "properties": {
          "display": {
            "type": "string",
            "minLength": 1,
            "maxLength": 48
          },
          "look": {
            "type": "object",
            "properties": {
              "plate": {
                "type": "string",
                "pattern": "^#[0-9a-fA-F]{6}$"
              },
              "ink": {
                "type": "string",
                "pattern": "^#[0-9a-fA-F]{6}$"
              },
              "stripe": {
                "type": "string",
                "pattern": "^#[0-9a-fA-F]{6}$"
              },
              "font": {
                "type": "string",
                "minLength": 1,
                "maxLength": 100
              },
              "case": {
                "type": "string",
                "enum": [
                  "as-is",
                  "upper"
                ]
              },
              "letterSpacing": {
                "type": "number",
                "minimum": -0.1,
                "maximum": 0.5
              }
            },
            "additionalProperties": false
          }
        },
        "additionalProperties": false
      }
    }
  },
  "required": [
    "format",
    "version",
    "families"
  ],
  "additionalProperties": false
}
```
