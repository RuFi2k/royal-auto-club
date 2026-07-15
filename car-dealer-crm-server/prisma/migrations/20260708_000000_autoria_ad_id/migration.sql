-- AUTO.RIA advertisement id (the `_id` returned by POST /auto/used/autos).
-- Set when a car is published to AUTO.RIA; used to keep the ad in sync (edit/delete).
ALTER TABLE "cars" ADD COLUMN "autoriaAdId" TEXT;
