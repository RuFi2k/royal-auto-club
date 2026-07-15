import { Router, Request, Response, NextFunction } from "express";
import { Car, CarPhoto, Prisma } from "@prisma/client";
import { prisma } from "../../db";
import { requireApiKey } from "../../middleware/api-key.middleware";

export const publicRouter = Router();

publicRouter.use(requireApiKey);

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : Array.isArray(v) ? (v[0] as string) : undefined;
}

function a(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
}

type CarWithPhotos = Car & { photos: CarPhoto[] };

// Strip internal fields and shape photos for public consumption.
function toPublicCar(car: CarWithPhotos) {
  const {
    vinNumber: _vin,
    vinNumberHash: _hash,
    registrationNumber: _reg,
    ownerPrice: _owner,
    dealerPrice: _dealer,
    generalPrice: _general,
    responsiblePerson: _resp,
    priceChangedAt: _pca,
    photos,
    photoUrl,
    ...rest
  } = car;

  const sortedPhotos = [...photos].sort((a, b) => a.sortOrder - b.sortOrder);
  const gallery = sortedPhotos.map((p) => ({
    url: p.url,
    alt: p.alt ?? `${rest.brand} ${rest.model}`,
  }));
  // Fallback: legacy photoUrl as cover when CarPhoto rows are absent.
  if (gallery.length === 0 && photoUrl) {
    gallery.push({ url: photoUrl, alt: `${rest.brand} ${rest.model}` });
  }
  const coverImage = gallery[0] ?? null;

  return { ...rest, coverImage, gallery, photoUrl: coverImage?.url ?? null };
}

type ListStatus = "upcoming" | "available" | "sold" | "all";
function parseStatus(v: unknown): ListStatus {
  const s = str(v);
  if (s === "upcoming" || s === "sold" || s === "all") return s;
  return "available";
}

// Hardcoded enum guards — keeps Prisma from throwing 500 on garbage values.
// When a request supplies a value outside the allowed set we silently drop the
// filter (treat as "no constraint") rather than 400-ing — the caller is usually
// the public marketing site, and showing all cars beats an error toast.
const BODY_TYPES = new Set([
  "sedan", "suv", "crossover", "hatchback", "coupe", "wagon",
  "minivan", "pickup", "van", "convertible", "liftback",
]);
const ENGINE_TYPES = new Set([
  "gasoline", "diesel", "electric", "hybrid_gasoline", "hybrid_diesel", "gas", "gasoline_gas",
]);
const GEARBOX_TYPES = new Set(["manual", "automatic", "cvt", "robot", "dual_clutch"]);
const DRIVETRAINS = new Set(["fwd", "rwd", "awd", "four_wd"]);
const CABIN_TYPES = new Set(["standard", "extended", "crew_cab", "panoramic"]);
const CUSTOMS = new Set(["cleared", "not_cleared", "in_progress"]);
const CAR_ORIGINS = new Set(["EU", "US", "korea", "japan", "china", "other"]);
const CAR_LOCATIONS = new Set(["owner", "dealership"]);
const SELL_TYPES = new Set(["retail", "wholesale", "auction", "consignment"]);
function pickEnum<T extends string>(v: unknown, allowed: Set<string>): T | undefined {
  const s = str(v);
  return s && allowed.has(s) ? (s as T) : undefined;
}

// GET /public/cars
publicRouter.get("/cars", a(async (req, res) => {
  const q = req.query;
  const status = parseStatus(q.status);
  const where: Prisma.CarWhereInput = {};

  if (status === "available") where.listingStatus = "available";
  if (status === "upcoming") where.listingStatus = "upcoming";
  if (status === "sold") {
    where.listingStatus = "sold";
    const days = q.soldWithinDays ? Math.max(1, parseInt(str(q.soldWithinDays)!, 10)) : undefined;
    where.soldAt = days ? { gte: new Date(Date.now() - days * 86_400_000) } : { not: null };
  }
  // status=all still excludes CRM-only and archived rows.
  if (status === "all") where.listingStatus = { notIn: ["draft", "archived"] };

  const b = str(q.brand);
  if (b) where.brand = { contains: b, mode: "insensitive" };
  const m = str(q.model);
  if (m) where.model = { contains: m, mode: "insensitive" };

  const mn = q.mileageMin ? parseInt(str(q.mileageMin)!, 10) : undefined;
  const mx = q.mileageMax ? parseInt(str(q.mileageMax)!, 10) : undefined;
  if (mn !== undefined || mx !== undefined) {
    where.mileage = { ...(mn !== undefined ? { gte: mn } : {}), ...(mx !== undefined ? { lte: mx } : {}) };
  }
  const pmn = q.priceMin ? parseFloat(str(q.priceMin)!) : undefined;
  const pmx = q.priceMax ? parseFloat(str(q.priceMax)!) : undefined;
  if (pmn !== undefined || pmx !== undefined) {
    where.websitePrice = { ...(pmn !== undefined ? { gte: pmn } : {}), ...(pmx !== undefined ? { lte: pmx } : {}) };
  }
  const carOrigin = pickEnum(q.carOrigin, CAR_ORIGINS);
  if (carOrigin) where.carOrigin = carOrigin as Prisma.EnumCarOriginFilter;
  const carLocation = pickEnum(q.carLocation, CAR_LOCATIONS);
  if (carLocation) where.carLocation = carLocation as Prisma.EnumCarLocationStatusFilter;

  // Extended filters — drop unknown enum values silently.
  const bodyType = pickEnum(q.bodyType, BODY_TYPES);
  if (bodyType) where.bodyType = bodyType as Prisma.EnumBodyTypeFilter;
  const engineType = pickEnum(q.engineType, ENGINE_TYPES);
  if (engineType) where.engineType = engineType as Prisma.EnumEngineTypeFilter;
  const gearboxType = pickEnum(q.gearboxType, GEARBOX_TYPES);
  if (gearboxType) where.gearboxType = gearboxType as Prisma.EnumGearboxTypeFilter;
  const drv = pickEnum<string>(q.drivetrain, DRIVETRAINS);
  if (drv) {
    // awd and four_wd treated as equivalent — see CarsService.getAll for rationale.
    where.drivetrain = drv === "awd" || drv === "four_wd"
      ? { in: ["awd", "four_wd"] }
      : (drv as Prisma.EnumDrivetrainFilter);
  }
  const cabinType = pickEnum(q.cabinType, CABIN_TYPES);
  if (cabinType) where.cabinType = cabinType as Prisma.EnumCabinTypeFilter;
  const customsStatus = pickEnum(q.customsStatus, CUSTOMS);
  if (customsStatus) where.customsStatus = customsStatus as Prisma.EnumCustomsStatusFilter;
  const sellType = pickEnum(q.sellType, SELL_TYPES);
  if (sellType) where.sellType = sellType as Prisma.EnumSellTypeFilter;
  if (str(q.isCryptoAvailable) !== undefined) {
    where.isCryptoAvailable = str(q.isCryptoAvailable) === "true";
  }

  const yMin = q.yearMin ? parseInt(str(q.yearMin)!, 10) : undefined;
  const yMax = q.yearMax ? parseInt(str(q.yearMax)!, 10) : undefined;
  if (yMin !== undefined || yMax !== undefined) {
    where.year = { ...(yMin !== undefined ? { gte: yMin } : {}), ...(yMax !== undefined ? { lte: yMax } : {}) };
  }
  const epMin = q.enginePowerMin ? parseInt(str(q.enginePowerMin)!, 10) : undefined;
  const epMax = q.enginePowerMax ? parseInt(str(q.enginePowerMax)!, 10) : undefined;
  if (epMin !== undefined || epMax !== undefined) {
    where.enginePower = { ...(epMin !== undefined ? { gte: epMin } : {}), ...(epMax !== undefined ? { lte: epMax } : {}) };
  }
  const evMin = q.engineVolumeMin ? parseFloat(str(q.engineVolumeMin)!) : undefined;
  const evMax = q.engineVolumeMax ? parseFloat(str(q.engineVolumeMax)!) : undefined;
  if (evMin !== undefined || evMax !== undefined) {
    where.engineVolume = { ...(evMin !== undefined ? { gte: evMin } : {}), ...(evMax !== undefined ? { lte: evMax } : {}) };
  }
  const sMin = q.seatsMin ? parseInt(str(q.seatsMin)!, 10) : undefined;
  const sMax = q.seatsMax ? parseInt(str(q.seatsMax)!, 10) : undefined;
  if (sMin !== undefined || sMax !== undefined) {
    where.seatsCount = { ...(sMin !== undefined ? { gte: sMin } : {}), ...(sMax !== undefined ? { lte: sMax } : {}) };
  }

  // Free-text — ILIKE across visible columns. Cheap; revisit with tsvector when catalog grows.
  const text = str(q.q);
  if (text) {
    const like = { contains: text, mode: "insensitive" as const };
    where.OR = [
      { brand: like }, { model: like }, { color: like },
      { shortDescription: like }, { description: like },
    ];
  }

  const pg = q.page ? Math.max(1, parseInt(str(q.page)!, 10)) : 1;
  const ps = q.pageSize ? Math.min(100, Math.max(1, parseInt(str(q.pageSize)!, 10))) : 10;

  // Sort: upcoming by ETA asc (nearest arrivals first), sold by soldAt desc,
  // available/all by createdAt desc.
  const orderBy: Prisma.CarOrderByWithRelationInput =
    status === "upcoming"
      ? { eta: "asc" }
      : status === "sold"
        ? { soldAt: "desc" }
        : { createdAt: "desc" };

  const [data, total] = await Promise.all([
    prisma.car.findMany({
      where,
      include: { photos: true },
      orderBy,
      skip: (pg - 1) * ps,
      take: ps,
    }),
    prisma.car.count({ where }),
  ]);

  res.json({
    data: data.map((c) => toPublicCar(c as CarWithPhotos)),
    total,
    page: pg,
    pageSize: ps,
  });
}));

// GET /public/cars/:id — returns the car regardless of status (sold cars
// keep working URLs for shareable links and SEO). Draft and archived cars are hidden.
publicRouter.get("/cars/:id", a(async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const car = await prisma.car.findUnique({
    where: { id },
    include: { photos: true },
  });
  if (!car || car.listingStatus === "draft" || car.listingStatus === "archived") {
    res.status(404).json({ message: "Car not found" });
    return;
  }
  res.json(toPublicCar(car as CarWithPhotos));
}));
