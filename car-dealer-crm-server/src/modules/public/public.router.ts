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

// GET /public/cars
publicRouter.get("/cars", a(async (req, res) => {
  const { brand, model, mileageMin, mileageMax, priceMin, priceMax, carOrigin, carLocation, page, pageSize } = req.query;

  const where: Prisma.CarWhereInput = { isAvailable: true };
  const b = str(brand);
  if (b) where.brand = { contains: b, mode: "insensitive" };
  const m = str(model);
  if (m) where.model = { contains: m, mode: "insensitive" };
  const mn = mileageMin ? parseInt(str(mileageMin)!, 10) : undefined;
  const mx = mileageMax ? parseInt(str(mileageMax)!, 10) : undefined;
  if (mn !== undefined || mx !== undefined) {
    where.mileage = { ...(mn !== undefined ? { gte: mn } : {}), ...(mx !== undefined ? { lte: mx } : {}) };
  }
  const pmn = priceMin ? parseFloat(str(priceMin)!) : undefined;
  const pmx = priceMax ? parseFloat(str(priceMax)!) : undefined;
  if (pmn !== undefined || pmx !== undefined) {
    where.websitePrice = { ...(pmn !== undefined ? { gte: pmn } : {}), ...(pmx !== undefined ? { lte: pmx } : {}) };
  }
  if (str(carOrigin)) where.carOrigin = str(carOrigin) as Prisma.EnumCarOriginFilter;
  if (str(carLocation)) where.carLocation = str(carLocation) as Prisma.EnumCarLocationStatusFilter;

  const pg = page ? Math.max(1, parseInt(str(page)!, 10)) : 1;
  const ps = pageSize ? Math.min(100, Math.max(1, parseInt(str(pageSize)!, 10))) : 10;

  const [data, total] = await Promise.all([
    prisma.car.findMany({
      where,
      include: { photos: true },
      orderBy: { createdAt: "desc" },
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

// GET /public/cars/:id
publicRouter.get("/cars/:id", a(async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const car = await prisma.car.findUnique({
    where: { id },
    include: { photos: true },
  });
  if (!car || !car.isAvailable) { res.status(404).json({ message: "Car not found" }); return; }
  res.json(toPublicCar(car as CarWithPhotos));
}));
