# Figure descriptor (`molen/figure@1`)

A figure descriptor document: a preset plus overrides, the same shape as the `figure` component. Preview it with `molen figure preview`, bake it with `molen figure bake`.

## Example

```json
{
  "format": "molen/figure@1",
  "preset": "horse",
  "height": 1.6,
  "palette": {
    "skin": "#3b2a1e",
    "markings": "#f0ead6"
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
      "const": "molen/figure@1",
      "description": "Format envelope; always 'molen/figure@1'."
    },
    "preset": {
      "type": "string",
      "enum": [
        "human.adult",
        "human.child",
        "human.elder",
        "dog",
        "cat",
        "horse",
        "deer",
        "cow",
        "sheep"
      ],
      "description": "Preset the descriptor starts from, e.g. 'human.adult' or 'horse'."
    },
    "height": {
      "type": "number",
      "minimum": 0.2,
      "maximum": 4,
      "description": "Standing height in meters (bipeds: head top; quadrupeds: withers)."
    },
    "build": {
      "type": "number",
      "minimum": -1,
      "maximum": 1,
      "description": "Body mass from -1 (slight) to 1 (heavy): limb and torso radii, shoulder width."
    },
    "age": {
      "type": "string",
      "enum": [
        "child",
        "adult",
        "elder"
      ],
      "description": "Age band (head and limb ratios)."
    },
    "proportions": {
      "type": "object",
      "properties": {
        "legRatio": {
          "type": "number",
          "minimum": 0.5,
          "maximum": 1.6,
          "description": "Leg length multiplier (1 = preset)."
        },
        "armRatio": {
          "type": "number",
          "minimum": 0.5,
          "maximum": 1.6,
          "description": "Arm length multiplier (1 = preset)."
        },
        "torsoRatio": {
          "type": "number",
          "minimum": 0.5,
          "maximum": 1.6,
          "description": "Torso length multiplier (1 = preset)."
        },
        "headScale": {
          "type": "number",
          "minimum": 0.6,
          "maximum": 2,
          "description": "Head size multiplier (1 = preset)."
        },
        "neckLength": {
          "type": "number",
          "minimum": 0.5,
          "maximum": 1.6,
          "description": "Neck length multiplier (1 = preset)."
        },
        "neckPitch": {
          "type": "number",
          "minimum": -1.2,
          "maximum": 1.6,
          "description": "Quadruped neck pitch above the spine line, radians."
        },
        "shoulderWidth": {
          "type": "number",
          "minimum": 0.5,
          "maximum": 1.6,
          "description": "Shoulder width multiplier (1 = preset)."
        },
        "hipWidth": {
          "type": "number",
          "minimum": 0.5,
          "maximum": 1.6,
          "description": "Hip width multiplier (1 = preset)."
        },
        "bodyLength": {
          "type": "number",
          "minimum": 0.8,
          "maximum": 2.5,
          "description": "Quadruped body length as a multiple of height (withers)."
        },
        "tailLength": {
          "type": "number",
          "minimum": 0,
          "maximum": 2,
          "description": "Tail length as a multiple of height."
        },
        "earSize": {
          "type": "number",
          "minimum": 0,
          "maximum": 2,
          "description": "Ear size multiplier (1 = preset)."
        },
        "snoutLength": {
          "type": "number",
          "minimum": 0,
          "maximum": 1.5,
          "description": "Snout length as a multiple of the head unit (0 = flat face)."
        },
        "waist": {
          "type": "number",
          "minimum": 0.7,
          "maximum": 1.3,
          "description": "Human waist width multiplier (absent = the body form’s)."
        },
        "bust": {
          "type": "number",
          "minimum": 0,
          "maximum": 1.5,
          "description": "Human bust or pectoral swell (absent = the body form’s: 1 feminine, 0.25 else)."
        },
        "belly": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Human belly fullness (absent = 0)."
        },
        "seat": {
          "type": "number",
          "minimum": 0.8,
          "maximum": 1.3,
          "description": "Human hip, seat and thigh fullness multiplier (absent = 1)."
        }
      },
      "additionalProperties": false,
      "description": "Proportion multipliers over the preset."
    },
    "features": {
      "type": "object",
      "properties": {
        "form": {
          "type": "string",
          "enum": [
            "neutral",
            "masculine",
            "feminine"
          ],
          "description": "Human body form: shoulder, waist, hip and chest shape (bipeds)."
        },
        "hair": {
          "type": "string",
          "enum": [
            "none",
            "buzz",
            "balding",
            "cap",
            "crop",
            "bob",
            "long",
            "ponytail",
            "bun",
            "afro",
            "shoulder",
            "fade",
            "mohawk",
            "topknot",
            "puffs",
            "braids",
            "rows",
            "locs"
          ],
          "description": "Hair style: none, buzz, balding, cap (short), crop, bob, long, ponytail, bun, afro, shoulder, fade, mohawk, topknot, puffs, braids, rows, locs."
        },
        "hairTexture": {
          "type": "string",
          "enum": [
            "straight",
            "wavy",
            "curly",
            "coily"
          ],
          "description": "How hair lies: straight (default), wavy, curly or coily (volume and ripple)."
        },
        "facialHair": {
          "type": "string",
          "enum": [
            "none",
            "stubble",
            "mustache",
            "beard"
          ],
          "description": "Facial hair (humans), drawn in the hair color."
        },
        "hands": {
          "type": "string",
          "enum": [
            "mitten",
            "fingers"
          ],
          "description": "Hand geometry (fingers: near tier only)."
        },
        "sleeves": {
          "type": "string",
          "enum": [
            "none",
            "short",
            "long"
          ],
          "description": "Sleeve length (top color extent)."
        },
        "legs": {
          "type": "string",
          "enum": [
            "shorts",
            "long",
            "skirt",
            "slim",
            "wide",
            "cropped"
          ],
          "description": "Legwear (bottom color): shorts, long trousers, a knee-length skirt, slim or wide trousers, or cropped trousers."
        },
        "top": {
          "type": "string",
          "enum": [
            "shirt",
            "tee",
            "tank",
            "polo",
            "sweater",
            "hoodie",
            "jacket",
            "coat",
            "dress"
          ],
          "description": "Top: shirt (default), tee, tank, polo, sweater, hoodie, jacket or coat (an open outer layer in palette.outer), or dress (to the knee in palette.top)."
        },
        "footwear": {
          "type": "string",
          "enum": [
            "shoe",
            "sneaker",
            "boot",
            "sandal"
          ],
          "description": "Footwear: shoe (default), sneaker, boot or sandal (palette.shoes)."
        },
        "headwear": {
          "type": "string",
          "enum": [
            "cap",
            "beanie",
            "sunhat"
          ],
          "description": "Hat (humans): cap, beanie or sunhat, over tucked-in hair (palette.headwear)."
        },
        "eyewear": {
          "type": "string",
          "enum": [
            "glasses",
            "sunglasses"
          ],
          "description": "Glasses or sunglasses (humans; palette.eyewear frames)."
        },
        "neckwear": {
          "type": "string",
          "enum": [
            "scarf"
          ],
          "description": "A scarf (palette.neckwear)."
        },
        "backwear": {
          "type": "string",
          "enum": [
            "backpack"
          ],
          "description": "A backpack (palette.backwear)."
        },
        "earwear": {
          "type": "string",
          "enum": [
            "headphones"
          ],
          "description": "Headphones over the hair and any hat (palette.earwear)."
        },
        "wristwear": {
          "type": "string",
          "enum": [
            "watch"
          ],
          "description": "A watch on the left wrist (palette.wristwear strap)."
        },
        "bag": {
          "type": "string",
          "enum": [
            "crossbody"
          ],
          "description": "A crossbody bag at the right hip, its strap over the left shoulder (palette.bag)."
        },
        "tail": {
          "type": "string",
          "enum": [
            "none",
            "short",
            "long",
            "bushy"
          ],
          "description": "Tail style."
        },
        "ears": {
          "type": "string",
          "enum": [
            "none",
            "round",
            "pointed",
            "floppy"
          ],
          "description": "Ear style."
        },
        "horns": {
          "type": "string",
          "enum": [
            "none",
            "short",
            "long",
            "antlers"
          ],
          "description": "Horn style."
        },
        "feet": {
          "type": "string",
          "enum": [
            "plantigrade",
            "digitigrade",
            "unguligrade"
          ],
          "description": "Foot stance: flat feet, paws, or hooves."
        },
        "mane": {
          "type": "boolean",
          "description": "Neck mane (horses)."
        }
      },
      "additionalProperties": false,
      "description": "Discrete feature choices over the preset."
    },
    "palette": {
      "type": "object",
      "properties": {
        "skin": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Skin, fur, or hide color."
        },
        "hair": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Hair or mane color."
        },
        "eyes": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Color as \"#rrggbb\"."
        },
        "top": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Torso and sleeves."
        },
        "bottom": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Legwear."
        },
        "shoes": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Shoes, paws, or hooves."
        },
        "accent": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Belt, collar, or saddle strip."
        },
        "markings": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Secondary fur markings (animals)."
        },
        "outer": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Outer layer of a jacket or coat (absent: the top color)."
        },
        "headwear": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Hat."
        },
        "eyewear": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Glasses frames."
        },
        "neckwear": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Scarf."
        },
        "backwear": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Backpack."
        },
        "earwear": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Headphones."
        },
        "wristwear": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Watch strap."
        },
        "bag": {
          "type": "string",
          "pattern": "^#[0-9a-fA-F]{6}$",
          "description": "Bag and its strap."
        }
      },
      "additionalProperties": false,
      "description": "Color blocks over the preset (\"#rrggbb\")."
    },
    "seed": {
      "type": "string",
      "minLength": 1,
      "description": "Detail jitter seed (symmetry-safe details only; default none)."
    },
    "head": {
      "type": "object",
      "properties": {
        "preset": {
          "type": "string",
          "enum": [
            "10",
            "11",
            "12",
            "01",
            "02",
            "03",
            "04",
            "05",
            "06",
            "07",
            "08",
            "09"
          ],
          "description": "Head preset '01'..'12' ('01' is the reference head)."
        },
        "faceWidth": {
          "type": "number",
          "minimum": -1,
          "maximum": 1,
          "description": "Narrow (-1) to wide (1)."
        },
        "jaw": {
          "type": "number",
          "minimum": -1,
          "maximum": 1,
          "description": "Tapered (-1) to square (1)."
        },
        "chin": {
          "type": "number",
          "minimum": -1,
          "maximum": 1,
          "description": "Soft (-1) to prominent (1)."
        },
        "cheeks": {
          "type": "number",
          "minimum": -1,
          "maximum": 1,
          "description": "Lean (-1) to full (1)."
        },
        "cheekbones": {
          "type": "number",
          "minimum": -1,
          "maximum": 1,
          "description": "Flat (-1) to high and wide (1)."
        },
        "brow": {
          "type": "number",
          "minimum": -1,
          "maximum": 1,
          "description": "Smooth (-1) to a strong ridge (1)."
        },
        "noseBridge": {
          "type": "number",
          "minimum": -1,
          "maximum": 1,
          "description": "Low (-1) to high (1)."
        },
        "noseWidth": {
          "type": "number",
          "minimum": -1,
          "maximum": 1,
          "description": "Narrow (-1) to broad (1)."
        },
        "noseTip": {
          "type": "number",
          "minimum": -1,
          "maximum": 1,
          "description": "Small (-1) to full (1)."
        },
        "eyeSpacing": {
          "type": "number",
          "minimum": -1,
          "maximum": 1,
          "description": "Close (-1) to wide (1)."
        },
        "eyeSize": {
          "type": "number",
          "minimum": -1,
          "maximum": 1,
          "description": "Small (-1) to large (1)."
        },
        "eyeTilt": {
          "type": "number",
          "minimum": -1,
          "maximum": 1,
          "description": "Outer corners down (-1) to up (1)."
        },
        "lips": {
          "type": "number",
          "minimum": -1,
          "maximum": 1,
          "description": "Thin (-1) to full (1)."
        },
        "crown": {
          "type": "number",
          "minimum": -1,
          "maximum": 1,
          "description": "Flat (-1) to rounded (1) skull top."
        }
      },
      "additionalProperties": false,
      "description": "Human head shape: a preset and/or parameters, each -1..1 with 0 the reference head. Absent, the face follows the body form."
    }
  },
  "required": [
    "format",
    "preset"
  ],
  "additionalProperties": false
}
```
