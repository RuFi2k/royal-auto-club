-- Drop customsStatus, cabinType, websitePrice, generalPrice from cars.
-- dealerPrice becomes the single public asking price.
ALTER TABLE "cars"
  DROP COLUMN "cabinType",
  DROP COLUMN "customsStatus",
  DROP COLUMN "websitePrice",
  DROP COLUMN "generalPrice";

DROP TYPE "CabinType";
DROP TYPE "CustomsStatus";
