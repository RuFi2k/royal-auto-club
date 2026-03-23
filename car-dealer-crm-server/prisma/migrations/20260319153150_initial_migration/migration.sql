-- CreateEnum
CREATE TYPE "EngineType" AS ENUM ('gasoline', 'diesel', 'electric', 'hybrid_gasoline', 'hybrid_diesel', 'gas', 'gasoline_gas');

-- CreateEnum
CREATE TYPE "BodyType" AS ENUM ('sedan', 'suv', 'crossover', 'hatchback', 'coupe', 'wagon', 'minivan', 'pickup', 'van', 'convertible', 'liftback');

-- CreateEnum
CREATE TYPE "GearboxType" AS ENUM ('manual', 'automatic', 'cvt', 'robot', 'dual_clutch');

-- CreateEnum
CREATE TYPE "Drivetrain" AS ENUM ('fwd', 'rwd', 'awd', 'four_wd');

-- CreateEnum
CREATE TYPE "CabinType" AS ENUM ('standard', 'extended', 'crew_cab', 'panoramic');

-- CreateEnum
CREATE TYPE "CustomsStatus" AS ENUM ('cleared', 'not_cleared', 'in_progress');

-- CreateEnum
CREATE TYPE "SellType" AS ENUM ('retail', 'wholesale', 'auction', 'consignment');

-- CreateEnum
CREATE TYPE "CarOrigin" AS ENUM ('EU', 'US', 'korea', 'japan', 'china', 'other');

-- CreateEnum
CREATE TYPE "CarLocationStatus" AS ENUM ('owner', 'dealership');

-- CreateTable
CREATE TABLE "cars" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "mileage" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "vinNumber" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "countryOfRegistration" TEXT NOT NULL,
    "engineType" "EngineType" NOT NULL,
    "engineVolume" DECIMAL(4,1) NOT NULL,
    "enginePower" INTEGER NOT NULL,
    "gearboxType" "GearboxType" NOT NULL,
    "drivetrain" "Drivetrain" NOT NULL,
    "bodyType" "BodyType" NOT NULL,
    "doorsCount" INTEGER NOT NULL,
    "seatsCount" INTEGER NOT NULL,
    "cabinType" "CabinType" NOT NULL,
    "customsStatus" "CustomsStatus" NOT NULL,
    "carOrigin" "CarOrigin" NOT NULL,
    "carLocation" "CarLocationStatus" NOT NULL,
    "location" TEXT NOT NULL,
    "sellType" "SellType" NOT NULL,
    "isCryptoAvailable" BOOLEAN NOT NULL DEFAULT false,
    "ownerPrice" DECIMAL(12,2) NOT NULL,
    "websitePrice" DECIMAL(12,2) NOT NULL,
    "dealerPrice" DECIMAL(12,2) NOT NULL,
    "generalPrice" DECIMAL(12,2) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "responsiblePerson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cars_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cars_vinNumber_key" ON "cars"("vinNumber");
