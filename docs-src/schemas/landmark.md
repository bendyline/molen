# Landmark model (`molen/landmark@1`)

Reusable sign or furniture geometry recipe, with colors, facade appearance and detail levels.

## Example

```json
{
  "format": "molen/landmark@1",
  "id": "sign.grocery",
  "version": 1,
  "title": "GROCERY",
  "generator": "sign",
  "sign": {
    "text": "GROCERY",
    "background": "#315949",
    "foreground": "#f5f0df",
    "mark": "#d7ac59",
    "symbol": "letters",
    "letters": "G"
  },
  "appearance": {
    "wall": "#ccc4b4",
    "accent": "#315949"
  },
  "storefront": {
    "width": 18,
    "sharedWidth": 9
  }
}
```

## JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "format": {
          "type": "string",
          "const": "molen/landmark@1"
        },
        "id": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9_.]*$",
          "description": "Stable builtin model name, such as sign.burger_restaurant."
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
        "generator": {
          "type": "string",
          "const": "sign"
        },
        "sign": {
          "type": "object",
          "properties": {
            "text": {
              "type": "string",
              "minLength": 1,
              "maxLength": 40
            },
            "background": {
              "type": "string",
              "pattern": "^#[0-9a-fA-F]{6}$"
            },
            "foreground": {
              "type": "string",
              "pattern": "^#[0-9a-fA-F]{6}$"
            },
            "mark": {
              "type": "string",
              "pattern": "^#[0-9a-fA-F]{6}$"
            },
            "symbol": {
              "type": "string",
              "enum": [
                "arches",
                "spark",
                "disc",
                "target",
                "cross",
                "letters",
                "cup",
                "tag",
                "roofline",
                "star",
                "burger",
                "bell",
                "bucket",
                "domino"
              ]
            },
            "letters": {
              "type": "string",
              "maxLength": 3
            }
          },
          "required": [
            "text",
            "background",
            "foreground",
            "mark",
            "symbol"
          ],
          "additionalProperties": false
        },
        "appearance": {
          "type": "object",
          "properties": {
            "wall": {
              "type": "string",
              "pattern": "^#[0-9a-fA-F]{6}$"
            },
            "accent": {
              "type": "string",
              "pattern": "^#[0-9a-fA-F]{6}$"
            }
          },
          "required": [
            "wall",
            "accent"
          ],
          "additionalProperties": false
        },
        "storefront": {
          "type": "object",
          "properties": {
            "width": {
              "type": "number",
              "exclusiveMinimum": 0,
              "maximum": 100
            },
            "sharedWidth": {
              "type": "number",
              "exclusiveMinimum": 0,
              "maximum": 100
            },
            "style": {
              "description": "Preferred architectural style for a directly identified low-rise host, when the active pack includes it. Tenants never select the host style.",
              "type": "string",
              "pattern": "^[a-z][a-z0-9_.]*$"
            }
          },
          "required": [
            "width",
            "sharedWidth"
          ],
          "additionalProperties": false
        }
      },
      "required": [
        "format",
        "id",
        "version",
        "title",
        "generator",
        "sign",
        "appearance",
        "storefront"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "format": {
          "type": "string",
          "const": "molen/landmark@1"
        },
        "id": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9_.]*$",
          "description": "Stable builtin model name, such as sign.burger_restaurant."
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
        "generator": {
          "type": "string",
          "const": "boxes"
        },
        "parts": {
          "minItems": 1,
          "maxItems": 256,
          "type": "array",
          "items": {
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
                  },
                  {
                    "type": "number"
                  }
                ],
                "items": false,
                "minItems": 3,
                "maxItems": 3
              },
              "size": {
                "type": "array",
                "prefixItems": [
                  {
                    "type": "number",
                    "exclusiveMinimum": 0
                  },
                  {
                    "type": "number",
                    "exclusiveMinimum": 0
                  },
                  {
                    "type": "number",
                    "exclusiveMinimum": 0
                  }
                ],
                "items": false,
                "minItems": 3,
                "maxItems": 3
              },
              "color": {
                "type": "string",
                "pattern": "^#[0-9a-fA-F]{6}$"
              },
              "yaw": {
                "type": "number"
              },
              "tiers": {
                "minItems": 1,
                "maxItems": 3,
                "type": "array",
                "items": {
                  "anyOf": [
                    {
                      "type": "number",
                      "const": 0
                    },
                    {
                      "type": "number",
                      "const": 1
                    },
                    {
                      "type": "number",
                      "const": 2
                    }
                  ]
                }
              }
            },
            "required": [
              "center",
              "size",
              "color"
            ],
            "additionalProperties": false
          },
          "description": "Ordered metric box parts; omitted tiers means all three detail levels."
        }
      },
      "required": [
        "format",
        "id",
        "version",
        "title",
        "generator",
        "parts"
      ],
      "additionalProperties": false
    }
  ]
}
```
