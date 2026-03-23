import { Router, Request, Response } from "express";
import { CarsService } from "./cars.service";
import { prisma } from "../../db";
import { requireAuth, AuthRequest } from "../../middleware/auth.middleware";

export const carsRouter = Router();

carsRouter.use(requireAuth);

function uid(req: Request): string {
  return (req as AuthRequest).uid;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : Array.isArray(v) ? (v[0] as string) : undefined;
}

// GET /cars/audit-logs — MUST be before /:id to avoid "audit-logs" matching as an id
carsRouter.get("/audit-logs", async (req: Request, res: Response) => {
  const { carId, userId, page, pageSize } = req.query;
  const result = await CarsService.getAuditLogs({
    carId: carId ? parseInt(str(carId)!, 10) : undefined,
    userId: str(userId),
    page: page ? parseInt(str(page)!, 10) : undefined,
    pageSize: pageSize ? parseInt(str(pageSize)!, 10) : undefined,
  });
  res.json(result);
});

// GET /cars
carsRouter.get("/", async (req: Request, res: Response) => {
  const { id, brand, model, mileageMin, mileageMax, priceMin, priceMax, isAvailable, carOrigin, carLocation, responsiblePerson, page, pageSize } = req.query;
  const result = await CarsService.getAll({
    id: id ? parseInt(str(id)!, 10) : undefined,
    brand: str(brand),
    model: str(model),
    mileageMin: mileageMin ? parseInt(str(mileageMin)!, 10) : undefined,
    mileageMax: mileageMax ? parseInt(str(mileageMax)!, 10) : undefined,
    priceMin: priceMin ? parseFloat(str(priceMin)!) : undefined,
    priceMax: priceMax ? parseFloat(str(priceMax)!) : undefined,
    isAvailable: isAvailable !== undefined ? str(isAvailable) === "true" : undefined,
    carOrigin: str(carOrigin),
    carLocation: str(carLocation),
    responsiblePerson: str(responsiblePerson),
    page: page ? Math.max(1, parseInt(str(page)!, 10)) : undefined,
    pageSize: pageSize ? Math.min(100, Math.max(1, parseInt(str(pageSize)!, 10))) : undefined,
  });
  res.json(result);
});

// GET /cars/:id
carsRouter.get("/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const car = await CarsService.getById(id);
  if (!car) { res.status(404).json({ message: "Car not found" }); return; }
  res.json(car);
});

// POST /cars
carsRouter.post("/", async (req: Request, res: Response) => {
  const car = await CarsService.create(req.body, uid(req));
  res.status(201).json(car);
});

// PATCH /cars/:id
carsRouter.patch("/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const car = await CarsService.update(id, req.body, uid(req));
  res.json(car);
});

// PATCH /cars/:id/availability
carsRouter.patch("/:id/availability", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { isAvailable } = req.body as { isAvailable: boolean };
  const car = await CarsService.setAvailability(id, isAvailable, uid(req));
  res.json(car);
});

// DELETE /cars/:id
carsRouter.delete("/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  await CarsService.delete(id, uid(req));
  res.status(204).send();
});

// GET /cars/:id/archives
carsRouter.get("/:id/archives", async (req: Request, res: Response) => {
  const carId = parseInt(req.params.id as string, 10);
  if (isNaN(carId)) { res.status(400).json({ message: "Invalid id" }); return; }
  const archives = await prisma.carPhotoArchive.findMany({
    where: { carId },
    orderBy: { createdAt: "desc" },
  });
  res.json(archives);
});

// POST /cars/:id/archives
carsRouter.post("/:id/archives", async (req: Request, res: Response) => {
  const carId = parseInt(req.params.id as string, 10);
  if (isNaN(carId)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { url, filename } = req.body as { url: string; filename: string };
  const archive = await prisma.carPhotoArchive.create({ data: { carId, url, filename } });
  res.status(201).json(archive);
});

// DELETE /cars/:id/archives/:archiveId
carsRouter.delete("/:id/archives/:archiveId", async (req: Request, res: Response) => {
  const carId = parseInt(req.params.id as string, 10);
  const archiveId = parseInt(req.params.archiveId as string, 10);
  if (isNaN(carId) || isNaN(archiveId)) { res.status(400).json({ message: "Invalid id" }); return; }
  await prisma.carPhotoArchive.delete({ where: { id: archiveId, carId } });
  res.status(204).send();
});
