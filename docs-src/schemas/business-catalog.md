# Business identity catalog (`molen/business-catalog@1`)

Map source brand IDs, aliases and place categories onto reusable landmark manifests.

## Example

```json
{
  "format": "molen/business-catalog@1",
  "version": 1,
  "profiles": [
    {
      "id": "neighborhood_grocery",
      "aliases": [
        "Neighborhood Grocery"
      ],
      "brandIds": [
        "Q0000001"
      ],
      "categories": [
        "supermarket",
        "grocery"
      ],
      "landmark": "sign.neighborhood_grocery"
    }
  ],
  "categories": [
    {
      "id": "grocery",
      "kinds": [
        "supermarket",
        "grocery"
      ],
      "landmark": "sign.grocery"
    },
    {
      "id": "cafe",
      "kinds": [
        "cafe",
        "coffee_shop"
      ],
      "landmark": "sign.cafe"
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
      "const": "molen/business-catalog@1"
    },
    "version": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991
    },
    "profiles": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1
          },
          "aliases": {
            "minItems": 1,
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          },
          "brandIds": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          },
          "categories": {
            "minItems": 1,
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          },
          "landmark": {
            "type": "string",
            "minLength": 1,
            "pattern": "^sign\\.[a-z][a-z0-9_.]*$"
          }
        },
        "required": [
          "id",
          "aliases",
          "brandIds",
          "categories",
          "landmark"
        ],
        "additionalProperties": false
      }
    },
    "categories": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
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
          "kinds": {
            "minItems": 1,
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          },
          "landmark": {
            "type": "string",
            "minLength": 1,
            "pattern": "^sign\\.[a-z][a-z0-9_.]*$"
          }
        },
        "required": [
          "id",
          "kinds",
          "landmark"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "format",
    "version",
    "profiles",
    "categories"
  ],
  "additionalProperties": false
}
```
