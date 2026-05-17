-- Convert mileage from exact km to thousands of km (rounded)
UPDATE "cars" SET "mileage" = ROUND("mileage"::decimal / 1000);
