# Business identity catalog (`molen/business-catalog@1`)

Map source brand IDs, aliases and place categories onto reusable landmark manifests.

## Example

```json
{
  "format": "molen/business-catalog@1",
  "version": 3,
  "profiles": [
    {
      "id": "mcdonalds",
      "aliases": [
        "McDonald's",
        "McDonalds",
        "Mc Donalds",
        "マクドナルド",
        "麦当劳",
        "麥當勞",
        "맥도날드"
      ],
      "brandIds": [
        "Q38076",
        "Q4043856"
      ],
      "categories": [
        "fast_food",
        "restaurant"
      ],
      "landmark": "sign.burger_restaurant"
    },
    {
      "id": "walmart",
      "aliases": [
        "Walmart",
        "Wal-Mart",
        "Walmart Supercenter",
        "Walmart Supercentre",
        "Walmart Neighborhood Market",
        "沃尔玛",
        "沃爾瑪"
      ],
      "brandIds": [
        "Q483551"
      ],
      "categories": [
        "department_store",
        "supermarket",
        "wholesale",
        "hypermarket"
      ],
      "landmark": "sign.mart_store"
    },
    {
      "id": "safeway",
      "aliases": [
        "Safeway"
      ],
      "brandIds": [
        "Q1508234",
        "Q17111901"
      ],
      "categories": [
        "supermarket",
        "grocery"
      ],
      "landmark": "sign.grocery_market"
    },
    {
      "id": "trader_joes",
      "aliases": [
        "Trader Joe's",
        "Trader Joes"
      ],
      "brandIds": [
        "Q688825"
      ],
      "categories": [
        "supermarket",
        "grocery"
      ],
      "landmark": "sign.neighborhood_grocery"
    },
    {
      "id": "starbucks",
      "aliases": [
        "Starbucks",
        "Starbucks Coffee",
        "スターバックス",
        "星巴克",
        "스타벅스"
      ],
      "brandIds": [
        "Q37158"
      ],
      "categories": [
        "cafe"
      ],
      "landmark": "sign.coffee_shop"
    },
    {
      "id": "qfc",
      "aliases": [
        "QFC",
        "Quality Food Centers"
      ],
      "brandIds": [
        "Q7265425"
      ],
      "categories": [
        "supermarket",
        "grocery"
      ],
      "landmark": "sign.food_market"
    },
    {
      "id": "cvs",
      "aliases": [
        "CVS",
        "CVS Pharmacy",
        "CVS/pharmacy"
      ],
      "brandIds": [
        "Q2078880"
      ],
      "categories": [
        "pharmacy",
        "chemist"
      ],
      "landmark": "sign.pharmacy_store"
    },
    {
      "id": "target",
      "aliases": [
        "Target",
        "SuperTarget",
        "Target Superstore"
      ],
      "brandIds": [
        "Q1046951"
      ],
      "categories": [
        "department_store",
        "supermarket"
      ],
      "landmark": "sign.general_merchandise"
    },
    {
      "id": "best_buy",
      "aliases": [
        "Best Buy",
        "BestBuy"
      ],
      "brandIds": [
        "Q533415"
      ],
      "categories": [
        "electronics"
      ],
      "landmark": "sign.electronics_store"
    },
    {
      "id": "costco",
      "aliases": [
        "Costco",
        "Costco Wholesale",
        "Costco Business Center"
      ],
      "brandIds": [
        "Q715583"
      ],
      "categories": [
        "wholesale",
        "supermarket"
      ],
      "landmark": "sign.warehouse_club"
    },
    {
      "id": "sams_club",
      "aliases": [
        "Sam's Club",
        "Sams Club"
      ],
      "brandIds": [
        "Q1972120"
      ],
      "categories": [
        "wholesale",
        "supermarket"
      ],
      "landmark": "sign.member_warehouse"
    },
    {
      "id": "home_depot",
      "aliases": [
        "The Home Depot",
        "Home Depot"
      ],
      "brandIds": [
        "Q864407"
      ],
      "categories": [
        "doityourself"
      ],
      "landmark": "sign.hardware_store"
    },
    {
      "id": "lowes",
      "aliases": [
        "Lowe's",
        "Lowes",
        "Lowe's Home Improvement"
      ],
      "brandIds": [
        "Q1373493"
      ],
      "categories": [
        "doityourself"
      ],
      "landmark": "sign.home_improvement"
    },
    {
      "id": "ikea",
      "aliases": [
        "IKEA"
      ],
      "brandIds": [
        "Q54078"
      ],
      "categories": [
        "furniture"
      ],
      "landmark": "sign.furniture_store"
    },
    {
      "id": "macys",
      "aliases": [
        "Macy's",
        "Macys"
      ],
      "brandIds": [
        "Q629269"
      ],
      "categories": [
        "department_store",
        "clothes"
      ],
      "landmark": "sign.traditional_department_store"
    },
    {
      "id": "kohls",
      "aliases": [
        "Kohl's",
        "Kohls"
      ],
      "brandIds": [
        "Q967265"
      ],
      "categories": [
        "department_store",
        "clothes"
      ],
      "landmark": "sign.family_department_store"
    },
    {
      "id": "nordstrom",
      "aliases": [
        "Nordstrom"
      ],
      "brandIds": [
        "Q174310"
      ],
      "categories": [
        "department_store",
        "clothes"
      ],
      "landmark": "sign.fashion_department_store"
    },
    {
      "id": "jcpenney",
      "aliases": [
        "JCPenney",
        "JC Penney",
        "J.C. Penney"
      ],
      "brandIds": [
        "Q920037"
      ],
      "categories": [
        "department_store",
        "clothes"
      ],
      "landmark": "sign.value_department_store"
    },
    {
      "id": "tj_maxx",
      "aliases": [
        "TJ Maxx",
        "T.J. Maxx",
        "TJMaxx"
      ],
      "brandIds": [
        "Q10860683"
      ],
      "categories": [
        "department_store",
        "clothes"
      ],
      "landmark": "sign.discount_fashion"
    },
    {
      "id": "marshalls",
      "aliases": [
        "Marshalls"
      ],
      "brandIds": [
        "Q15903261"
      ],
      "categories": [
        "department_store",
        "clothes"
      ],
      "landmark": "sign.clothing_outlet"
    },
    {
      "id": "ross",
      "aliases": [
        "Ross Dress for Less",
        "Ross"
      ],
      "brandIds": [
        "Q3442791"
      ],
      "categories": [
        "department_store",
        "clothes"
      ],
      "landmark": "sign.discount_clothing"
    },
    {
      "id": "burlington",
      "aliases": [
        "Burlington"
      ],
      "brandIds": [
        "Q4999220"
      ],
      "categories": [
        "department_store",
        "clothes"
      ],
      "landmark": "sign.coat_outlet"
    },
    {
      "id": "dicks",
      "aliases": [
        "Dick's Sporting Goods",
        "Dicks Sporting Goods"
      ],
      "brandIds": [
        "Q5272601"
      ],
      "categories": [
        "sports"
      ],
      "landmark": "sign.sporting_goods"
    },
    {
      "id": "petsmart",
      "aliases": [
        "PetSmart"
      ],
      "brandIds": [
        "Q3307147"
      ],
      "categories": [
        "pet"
      ],
      "landmark": "sign.pet_supply"
    },
    {
      "id": "petco",
      "aliases": [
        "Petco"
      ],
      "brandIds": [
        "Q7171798"
      ],
      "categories": [
        "pet"
      ],
      "landmark": "sign.pet_store"
    },
    {
      "id": "dollar_tree",
      "aliases": [
        "Dollar Tree"
      ],
      "brandIds": [
        "Q5289230"
      ],
      "categories": [
        "variety_store"
      ],
      "landmark": "sign.variety_store"
    },
    {
      "id": "dollar_general",
      "aliases": [
        "Dollar General",
        "Dollar General Market"
      ],
      "brandIds": [
        "Q145168"
      ],
      "categories": [
        "variety_store",
        "supermarket"
      ],
      "landmark": "sign.discount_store"
    },
    {
      "id": "walgreens",
      "aliases": [
        "Walgreens",
        "Walgreens Pharmacy"
      ],
      "brandIds": [
        "Q1591889"
      ],
      "categories": [
        "pharmacy",
        "chemist"
      ],
      "landmark": "sign.corner_pharmacy"
    },
    {
      "id": "aldi",
      "aliases": [
        "ALDI",
        "Aldi Sud",
        "Aldi Süd"
      ],
      "brandIds": [
        "Q41171672"
      ],
      "categories": [
        "supermarket",
        "grocery"
      ],
      "landmark": "sign.discount_grocery"
    },
    {
      "id": "kroger",
      "aliases": [
        "Kroger",
        "Kroger Marketplace"
      ],
      "brandIds": [
        "Q153417"
      ],
      "categories": [
        "supermarket",
        "grocery"
      ],
      "landmark": "sign.supermarket"
    },
    {
      "id": "publix",
      "aliases": [
        "Publix"
      ],
      "brandIds": [
        "Q672170"
      ],
      "categories": [
        "supermarket",
        "grocery"
      ],
      "landmark": "sign.community_market"
    },
    {
      "id": "whole_foods",
      "aliases": [
        "Whole Foods Market",
        "Whole Foods"
      ],
      "brandIds": [
        "Q1809448"
      ],
      "categories": [
        "supermarket",
        "grocery"
      ],
      "landmark": "sign.natural_grocery"
    },
    {
      "id": "burger_king",
      "aliases": [
        "Burger King",
        "BurgerKing"
      ],
      "brandIds": [
        "Q177054"
      ],
      "categories": [
        "fast_food",
        "restaurant"
      ],
      "landmark": "sign.burger_place"
    },
    {
      "id": "wendys",
      "aliases": [
        "Wendy's",
        "Wendys"
      ],
      "brandIds": [
        "Q550258"
      ],
      "categories": [
        "fast_food",
        "restaurant"
      ],
      "landmark": "sign.burger_diner"
    },
    {
      "id": "taco_bell",
      "aliases": [
        "Taco Bell"
      ],
      "brandIds": [
        "Q752941"
      ],
      "categories": [
        "fast_food",
        "restaurant"
      ],
      "landmark": "sign.taco_place"
    },
    {
      "id": "chick_fil_a",
      "aliases": [
        "Chick-fil-A",
        "Chick fil A"
      ],
      "brandIds": [
        "Q491516"
      ],
      "categories": [
        "fast_food",
        "restaurant"
      ],
      "landmark": "sign.chicken_restaurant"
    },
    {
      "id": "subway",
      "aliases": [
        "Subway"
      ],
      "brandIds": [
        "Q244457"
      ],
      "categories": [
        "fast_food",
        "restaurant"
      ],
      "landmark": "sign.sandwich_shop"
    },
    {
      "id": "kfc",
      "aliases": [
        "KFC",
        "Kentucky Fried Chicken"
      ],
      "brandIds": [
        "Q524757"
      ],
      "categories": [
        "fast_food",
        "restaurant"
      ],
      "landmark": "sign.fried_chicken"
    },
    {
      "id": "popeyes",
      "aliases": [
        "Popeyes",
        "Popeyes Louisiana Kitchen"
      ],
      "brandIds": [
        "Q1330910"
      ],
      "categories": [
        "fast_food",
        "restaurant"
      ],
      "landmark": "sign.chicken_kitchen"
    },
    {
      "id": "chipotle",
      "aliases": [
        "Chipotle",
        "Chipotle Mexican Grill"
      ],
      "brandIds": [
        "Q465751"
      ],
      "categories": [
        "fast_food",
        "restaurant"
      ],
      "landmark": "sign.burrito_grill"
    },
    {
      "id": "panera",
      "aliases": [
        "Panera Bread",
        "Panera"
      ],
      "brandIds": [
        "Q7130852"
      ],
      "categories": [
        "fast_food",
        "restaurant",
        "cafe"
      ],
      "landmark": "sign.bread_cafe"
    },
    {
      "id": "dunkin",
      "aliases": [
        "Dunkin'",
        "Dunkin",
        "Dunkin Donuts",
        "Dunkin' Donuts"
      ],
      "brandIds": [
        "Q847743"
      ],
      "categories": [
        "fast_food",
        "restaurant",
        "cafe"
      ],
      "landmark": "sign.donut_cafe"
    },
    {
      "id": "pizza_hut",
      "aliases": [
        "Pizza Hut"
      ],
      "brandIds": [
        "Q191615"
      ],
      "categories": [
        "restaurant",
        "fast_food"
      ],
      "landmark": "sign.pizza_place"
    },
    {
      "id": "dominos",
      "aliases": [
        "Domino's",
        "Domino's Pizza",
        "Dominos Pizza"
      ],
      "brandIds": [
        "Q839466"
      ],
      "categories": [
        "fast_food",
        "restaurant"
      ],
      "landmark": "sign.pizza_delivery"
    }
  ],
  "categories": [
    {
      "id": "grocery",
      "kinds": [
        "supermarket",
        "grocery",
        "greengrocer"
      ],
      "landmark": "sign.grocery"
    },
    {
      "id": "restaurant",
      "kinds": [
        "restaurant",
        "fast_food",
        "pub",
        "bar",
        "food_court",
        "ice_cream"
      ],
      "landmark": "sign.restaurant"
    },
    {
      "id": "cafe",
      "kinds": [
        "cafe"
      ],
      "landmark": "sign.cafe"
    },
    {
      "id": "pharmacy",
      "kinds": [
        "pharmacy",
        "chemist"
      ],
      "landmark": "sign.pharmacy"
    },
    {
      "id": "shop",
      "kinds": [
        "retail",
        "wholesale",
        "hypermarket",
        "convenience",
        "books",
        "bank",
        "clothes",
        "pet",
        "paint",
        "optician",
        "clinic",
        "doctors",
        "dentist",
        "beauty",
        "hairdresser",
        "fitness_centre",
        "sports",
        "dry_cleaning",
        "musical_instrument",
        "mobile_phone",
        "car_repair",
        "veterinary",
        "bakery",
        "florist",
        "jewelry",
        "electronics",
        "furniture",
        "doityourself",
        "variety_store",
        "toys",
        "tobacco"
      ],
      "landmark": "sign.shop"
    },
    {
      "id": "mall",
      "kinds": [
        "mall",
        "shopping_centre",
        "shopping_center"
      ],
      "landmark": "sign.mall"
    },
    {
      "id": "department_store",
      "kinds": [
        "department_store"
      ],
      "landmark": "sign.department_store"
    },
    {
      "id": "outlet_mall",
      "kinds": [
        "outlet_mall",
        "outlet_center",
        "outlet_centre"
      ],
      "landmark": "sign.outlet_mall"
    },
    {
      "id": "strip_mall",
      "kinds": [
        "strip_mall",
        "retail_plaza"
      ],
      "landmark": "sign.strip_mall"
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
