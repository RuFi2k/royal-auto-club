/*
  Warnings:

  - You are about to drop the column `photoArchiveUrl` on the `cars` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "cars" DROP COLUMN "photoArchiveUrl";

-- CreateTable
CREATE TABLE "car_photo_archives" (
    "id" SERIAL NOT NULL,
    "carId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "car_photo_archives_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "car_photo_archives" ADD CONSTRAINT "car_photo_archives_carId_fkey" FOREIGN KEY ("carId") REFERENCES "cars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
