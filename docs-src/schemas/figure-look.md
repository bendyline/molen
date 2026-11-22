# Figure look (`molen/figure-look@1`)

A person and their outfit chosen from a catalogue of named options (skin, head, hair, body shape, clothing, accessories). `figureFromLook` from @bendyline/molen-figures/look turns it into a figure descriptor; `normalizeFigureLook` repairs a saved look against a catalogue.

## Example

```json
{
  "format": "molen/figure-look@1",
  "catalog": "molen.people@4",
  "person": {
    "age": "adult",
    "body": "body.straight",
    "height": 1.72,
    "skin": "#9d6742",
    "eyes": "#4b3020",
    "head": "head.01",
    "hair": "hair.crop",
    "hairTexture": "texture.straight",
    "hairColor": "#1c1714",
    "facialHair": "facial.none"
  },
  "outfit": {
    "top": {
      "id": "top.jacket",
      "colors": {
        "outer": "#2f5a3b",
        "top": "#e8eef6"
      }
    },
    "bottom": {
      "id": "bottom.trousers",
      "colors": {
        "bottom": "#2f3b52",
        "accent": "#c8a24a"
      }
    },
    "footwear": {
      "id": "footwear.shoes",
      "colors": {
        "shoes": "#4a2e1f"
      }
    },
    "accessories": {
      "eyewear": {
        "id": "eyewear.glasses",
        "colors": {
          "eyewear": "#6e4a2c"
        }
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
      "const": "molen/figure-look@1",
      "description": "Format envelope; always 'molen/figure-look@1'."
    },
    "catalog": {
      "type": "string",
      "minLength": 1,
      "description": "The catalogue the look was made with, as '<id>@<revision>'."
    },
    "person": {
      "type": "object",
      "properties": {
        "age": {
          "type": "string",
          "enum": [
            "child",
            "adult",
            "elder"
          ],
          "description": "Age band."
        },
        "body": {
          "type": "string",
          "minLength": 1,
          "description": "Body shape option id."
        },
        "height": {
          "type": "number",
          "minimum": 0.5,
          "maximum": 2.5,
          "description": "Standing height in meters."
        },
        "skin": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Color as \"#rrggbb\"."
        },
        "eyes": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Color as \"#rrggbb\"."
        },
        "head": {
          "type": "string",
          "minLength": 1,
          "description": "Head option id."
        },
        "hair": {
          "type": "string",
          "minLength": 1,
          "description": "Hair style option id."
        },
        "hairTexture": {
          "type": "string",
          "minLength": 1,
          "description": "Hair texture option id."
        },
        "hairColor": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Color as \"#rrggbb\"."
        },
        "facialHair": {
          "type": "string",
          "minLength": 1,
          "description": "Facial hair option id."
        }
      },
      "required": [
        "age",
        "body",
        "height",
        "skin",
        "eyes",
        "head",
        "hair",
        "hairTexture",
        "hairColor",
        "facialHair"
      ],
      "additionalProperties": false,
      "description": "Who the person is."
    },
    "outfit": {
      "type": "object",
      "properties": {
        "top": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "description": "Option id from the catalogue."
            },
            "colors": {
              "type": "object",
              "properties": {
                "top": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "bottom": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "shoes": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "accent": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "outer": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "A jacket or coat, over the shirt in top."
                },
                "headwear": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "eyewear": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "neckwear": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "backwear": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "earwear": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "wristwear": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "bag": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                }
              },
              "additionalProperties": false,
              "description": "Colours of the item by figure palette slot."
            }
          },
          "required": [
            "id",
            "colors"
          ],
          "additionalProperties": false,
          "description": "A worn item: a catalogue option and its colours."
        },
        "bottom": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "description": "Option id from the catalogue."
            },
            "colors": {
              "type": "object",
              "properties": {
                "top": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "bottom": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "shoes": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "accent": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "outer": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "A jacket or coat, over the shirt in top."
                },
                "headwear": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "eyewear": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "neckwear": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "backwear": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "earwear": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "wristwear": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "bag": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                }
              },
              "additionalProperties": false,
              "description": "Colours of the item by figure palette slot."
            }
          },
          "required": [
            "id",
            "colors"
          ],
          "additionalProperties": false,
          "description": "A worn item: a catalogue option and its colours."
        },
        "footwear": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "description": "Option id from the catalogue."
            },
            "colors": {
              "type": "object",
              "properties": {
                "top": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "bottom": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "shoes": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "accent": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "outer": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "A jacket or coat, over the shirt in top."
                },
                "headwear": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "eyewear": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "neckwear": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "backwear": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "earwear": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "wristwear": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                },
                "bag": {
                  "type": "string",
                  "pattern": "^#[0-9a-fA-F]{6}$",
                  "description": "Color as \"#rrggbb\"."
                }
              },
              "additionalProperties": false,
              "description": "Colours of the item by figure palette slot."
            }
          },
          "required": [
            "id",
            "colors"
          ],
          "additionalProperties": false,
          "description": "A worn item: a catalogue option and its colours."
        },
        "accessories": {
          "type": "object",
          "properties": {
            "headwear": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "minLength": 1,
                  "description": "Option id from the catalogue."
                },
                "colors": {
                  "type": "object",
                  "properties": {
                    "top": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "bottom": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "shoes": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "accent": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "outer": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "A jacket or coat, over the shirt in top."
                    },
                    "headwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "eyewear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "neckwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "backwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "earwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "wristwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "bag": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    }
                  },
                  "additionalProperties": false,
                  "description": "Colours of the item by figure palette slot."
                }
              },
              "required": [
                "id",
                "colors"
              ],
              "additionalProperties": false,
              "description": "A worn item: a catalogue option and its colours."
            },
            "eyewear": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "minLength": 1,
                  "description": "Option id from the catalogue."
                },
                "colors": {
                  "type": "object",
                  "properties": {
                    "top": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "bottom": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "shoes": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "accent": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "outer": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "A jacket or coat, over the shirt in top."
                    },
                    "headwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "eyewear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "neckwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "backwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "earwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "wristwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "bag": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    }
                  },
                  "additionalProperties": false,
                  "description": "Colours of the item by figure palette slot."
                }
              },
              "required": [
                "id",
                "colors"
              ],
              "additionalProperties": false,
              "description": "A worn item: a catalogue option and its colours."
            },
            "neckwear": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "minLength": 1,
                  "description": "Option id from the catalogue."
                },
                "colors": {
                  "type": "object",
                  "properties": {
                    "top": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "bottom": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "shoes": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "accent": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "outer": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "A jacket or coat, over the shirt in top."
                    },
                    "headwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "eyewear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "neckwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "backwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "earwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "wristwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "bag": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    }
                  },
                  "additionalProperties": false,
                  "description": "Colours of the item by figure palette slot."
                }
              },
              "required": [
                "id",
                "colors"
              ],
              "additionalProperties": false,
              "description": "A worn item: a catalogue option and its colours."
            },
            "backwear": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "minLength": 1,
                  "description": "Option id from the catalogue."
                },
                "colors": {
                  "type": "object",
                  "properties": {
                    "top": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "bottom": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "shoes": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "accent": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "outer": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "A jacket or coat, over the shirt in top."
                    },
                    "headwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "eyewear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "neckwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "backwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "earwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "wristwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "bag": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    }
                  },
                  "additionalProperties": false,
                  "description": "Colours of the item by figure palette slot."
                }
              },
              "required": [
                "id",
                "colors"
              ],
              "additionalProperties": false,
              "description": "A worn item: a catalogue option and its colours."
            },
            "earwear": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "minLength": 1,
                  "description": "Option id from the catalogue."
                },
                "colors": {
                  "type": "object",
                  "properties": {
                    "top": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "bottom": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "shoes": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "accent": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "outer": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "A jacket or coat, over the shirt in top."
                    },
                    "headwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "eyewear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "neckwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "backwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "earwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "wristwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "bag": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    }
                  },
                  "additionalProperties": false,
                  "description": "Colours of the item by figure palette slot."
                }
              },
              "required": [
                "id",
                "colors"
              ],
              "additionalProperties": false,
              "description": "A worn item: a catalogue option and its colours."
            },
            "wristwear": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "minLength": 1,
                  "description": "Option id from the catalogue."
                },
                "colors": {
                  "type": "object",
                  "properties": {
                    "top": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "bottom": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "shoes": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "accent": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "outer": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "A jacket or coat, over the shirt in top."
                    },
                    "headwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "eyewear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "neckwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "backwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "earwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "wristwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "bag": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    }
                  },
                  "additionalProperties": false,
                  "description": "Colours of the item by figure palette slot."
                }
              },
              "required": [
                "id",
                "colors"
              ],
              "additionalProperties": false,
              "description": "A worn item: a catalogue option and its colours."
            },
            "bag": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "minLength": 1,
                  "description": "Option id from the catalogue."
                },
                "colors": {
                  "type": "object",
                  "properties": {
                    "top": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "bottom": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "shoes": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "accent": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "outer": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "A jacket or coat, over the shirt in top."
                    },
                    "headwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "eyewear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "neckwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "backwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "earwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "wristwear": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    },
                    "bag": {
                      "type": "string",
                      "pattern": "^#[0-9a-fA-F]{6}$",
                      "description": "Color as \"#rrggbb\"."
                    }
                  },
                  "additionalProperties": false,
                  "description": "Colours of the item by figure palette slot."
                }
              },
              "required": [
                "id",
                "colors"
              ],
              "additionalProperties": false,
              "description": "A worn item: a catalogue option and its colours."
            }
          },
          "additionalProperties": false,
          "description": "Accessories by slot; a missing slot is empty."
        }
      },
      "required": [
        "top",
        "bottom",
        "footwear",
        "accessories"
      ],
      "additionalProperties": false,
      "description": "What the person wears."
    }
  },
  "required": [
    "format",
    "catalog",
    "person",
    "outfit"
  ],
  "additionalProperties": false
}
```
