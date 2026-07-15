-- AUTO.RIA equipment options selected per car (auto-posted to the ad).
-- optionId: binary (checkbox) options use the classic catalog id (>= 217) with
-- valueId NULL; selectable options use the internal field id (128-139) with
-- valueId holding the chosen value. See modules/autoria/options-catalog.ts.
CREATE TABLE "car_options" (
    "id" SERIAL NOT NULL,
    "carId" INTEGER NOT NULL,
    "optionId" INTEGER NOT NULL,
    "valueId" INTEGER,

    CONSTRAINT "car_options_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "car_options_carId_optionId_key" ON "car_options"("carId", "optionId");
CREATE INDEX "car_options_optionId_idx" ON "car_options"("optionId");
CREATE INDEX "car_options_optionId_valueId_idx" ON "car_options"("optionId", "valueId");

ALTER TABLE "car_options" ADD CONSTRAINT "car_options_carId_fkey"
    FOREIGN KEY ("carId") REFERENCES "cars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
