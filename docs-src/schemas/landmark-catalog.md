# Landmark catalog (`molen/landmark-catalog@1`)

An index of reusable external landmark model manifests.

## Example

```json
{
  "format": "molen/landmark-catalog@1",
  "version": 3,
  "models": {
    "sign.burger_restaurant": "burger_restaurant.landmark.json",
    "sign.mart_store": "mart_store.landmark.json",
    "sign.grocery_market": "grocery_market.landmark.json",
    "sign.neighborhood_grocery": "neighborhood_grocery.landmark.json",
    "sign.coffee_shop": "coffee_shop.landmark.json",
    "sign.food_market": "food_market.landmark.json",
    "sign.pharmacy_store": "pharmacy_store.landmark.json",
    "sign.general_merchandise": "general_merchandise.landmark.json",
    "sign.grocery": "grocery.landmark.json",
    "sign.restaurant": "restaurant.landmark.json",
    "sign.cafe": "cafe.landmark.json",
    "sign.pharmacy": "pharmacy.landmark.json",
    "sign.shop": "shop.landmark.json",
    "street_lamp": "street_lamp.landmark.json",
    "bench": "bench.landmark.json",
    "bike_rack": "bike_rack.landmark.json",
    "charger": "charger.landmark.json",
    "charger.fast": "charger.fast.landmark.json",
    "sign.electronics_store": "electronics_store.landmark.json",
    "sign.warehouse_club": "warehouse_club.landmark.json",
    "sign.member_warehouse": "member_warehouse.landmark.json",
    "sign.hardware_store": "hardware_store.landmark.json",
    "sign.home_improvement": "home_improvement.landmark.json",
    "sign.furniture_store": "furniture_store.landmark.json",
    "sign.traditional_department_store": "traditional_department_store.landmark.json",
    "sign.family_department_store": "family_department_store.landmark.json",
    "sign.fashion_department_store": "fashion_department_store.landmark.json",
    "sign.value_department_store": "value_department_store.landmark.json",
    "sign.discount_fashion": "discount_fashion.landmark.json",
    "sign.clothing_outlet": "clothing_outlet.landmark.json",
    "sign.discount_clothing": "discount_clothing.landmark.json",
    "sign.coat_outlet": "coat_outlet.landmark.json",
    "sign.sporting_goods": "sporting_goods.landmark.json",
    "sign.pet_supply": "pet_supply.landmark.json",
    "sign.pet_store": "pet_store.landmark.json",
    "sign.variety_store": "variety_store.landmark.json",
    "sign.discount_store": "discount_store.landmark.json",
    "sign.corner_pharmacy": "corner_pharmacy.landmark.json",
    "sign.discount_grocery": "discount_grocery.landmark.json",
    "sign.supermarket": "supermarket.landmark.json",
    "sign.community_market": "community_market.landmark.json",
    "sign.natural_grocery": "natural_grocery.landmark.json",
    "sign.burger_place": "burger_place.landmark.json",
    "sign.burger_diner": "burger_diner.landmark.json",
    "sign.taco_place": "taco_place.landmark.json",
    "sign.chicken_restaurant": "chicken_restaurant.landmark.json",
    "sign.sandwich_shop": "sandwich_shop.landmark.json",
    "sign.fried_chicken": "fried_chicken.landmark.json",
    "sign.chicken_kitchen": "chicken_kitchen.landmark.json",
    "sign.burrito_grill": "burrito_grill.landmark.json",
    "sign.bread_cafe": "bread_cafe.landmark.json",
    "sign.donut_cafe": "donut_cafe.landmark.json",
    "sign.pizza_place": "pizza_place.landmark.json",
    "sign.pizza_delivery": "pizza_delivery.landmark.json",
    "sign.mall": "mall.landmark.json",
    "sign.department_store": "department_store.landmark.json",
    "sign.outlet_mall": "outlet_mall.landmark.json",
    "sign.strip_mall": "strip_mall.landmark.json"
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
      "const": "molen/landmark-catalog@1"
    },
    "version": {
      "type": "integer",
      "exclusiveMinimum": 0,
      "maximum": 9007199254740991
    },
    "models": {
      "type": "object",
      "propertyNames": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_.]*$",
        "description": "Stable builtin model name, such as sign.burger_restaurant."
      },
      "additionalProperties": {
        "type": "string",
        "pattern": "^(?![A-Za-z]:|[/\\\\])(?!.*\\\\)(?!.*(?:^|\\/)\\.\\.(?:\\/|$)).+$"
      },
      "description": "Builtin model name to contained catalog-relative JSON manifest path."
    }
  },
  "required": [
    "format",
    "version",
    "models"
  ],
  "additionalProperties": false
}
```
