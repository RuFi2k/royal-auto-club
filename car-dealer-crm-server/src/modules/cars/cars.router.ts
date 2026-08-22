import { Router, Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { CarsService } from "./cars.service";
import { prisma } from "../../db";
import { requireAuth, requireAdmin, AuthRequest } from "../../middleware/auth.middleware";
import { recordAudit } from "../../lib/audit";
import { sanitizeRichText } from "../../lib/sanitize-html";
import { optimizeAndUpload } from "./photo-upload";
import { putObject, deleteObjectByUrl } from "../../lib/storage";
import { syncCarTelegramPost, republishCarTelegramPost, deleteCarTelegramPost } from "../telegram/poster";
import { publishCarToAutoRia, deleteCarAutoRiaAd } from "../autoria/poster";
import { BINARY_OPTIONS, SELECTABLE_OPTIONS, GROUP_ORDER } from "../autoria/options-catalog";
import { suggestCarOptions, isSuggestConfigured } from "../autoria/suggest";

export const carsRouter = Router();

// A listing may not go public with fewer than this many photos. Drafts are
// exempt so half-finished work can still be saved. Mirrored in the CRM client;
// enforced here so the rule holds for direct API calls too.
const MIN_PUBLISHED_PHOTOS = 8;

carsRouter.use(requireAuth);

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 50 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "image/jpeg") cb(null, true);
    else cb(new Error("Only JPG photos are supported"));
  },
});

// Wraps multer middleware so its errors (file too large, non-image, etc.) become 400
// instead of falling through to the global 500 handler.
function uploadMiddleware(req: Request, res: Response, next: NextFunction) {
  photoUpload.array("files", 50)(req, res, (err) => {
    if (err) { res.status(400).json({ message: err.message ?? "Upload failed" }); return; }
    next();
  });
}

// Generic single-file upload (tech passports, defect-check scans, photo archives).
// No image filter — accepts pdf / zip / images. Stored to object storage as-is.
const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});
function singleFileMiddleware(req: Request, res: Response, next: NextFunction) {
  fileUpload.single("file")(req, res, (err) => {
    if (err) { res.status(400).json({ message: err.message ?? "Upload failed" }); return; }
    next();
  });
}

function uid(req: Request): string {
  return (req as AuthRequest).uid;
}

function actor(req: Request): { userId: string; userEmail: string } {
  return { userId: (req as AuthRequest).uid, userEmail: (req as AuthRequest).email };
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : Array.isArray(v) ? (v[0] as string) : undefined;
}

// Wraps async handlers so errors reach the Express global error handler (Express 4)
function a(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch((err) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
          res.status(409).json({ message: "Автомобіль з таким VIN вже існує" });
          return;
        }
        if (err.code === "P2025") {
          res.status(404).json({ message: "Запис не знайдено" });
          return;
        }
      }
      const status = (err as { status?: number }).status;
      if (status && status >= 400 && status < 500) {
        res.status(status).json({ message: err instanceof Error ? err.message : "Request failed" });
        return;
      }
      next(err);
    });
}

// POST /cars/upload-photos — multipart upload, optimizes each image to WebP and uploads to Firebase.
// Returns URLs the client then attaches to a car (via createCar payload or POST /:id/photos).
// MUST be before /:id to avoid "upload-photos" matching as an id.
carsRouter.post("/upload-photos", uploadMiddleware, a(async (req, res) => {
  const files = (req.files ?? []) as Express.Multer.File[];
  if (files.length === 0) { res.status(400).json({ message: "No files" }); return; }
  const results = await Promise.all(
    files.map((f) => optimizeAndUpload(f.buffer, f.originalname))
  );
  res.json(results);
}));

// POST /cars/upload-file?folder=tech-passports — single non-image file upload
// (tech passport, defect check, photo archive). Returns { url, filename }.
// MUST be before /:id to avoid "upload-file" matching as an id.
carsRouter.post("/upload-file", singleFileMiddleware, a(async (req, res) => {
  const file = req.file;
  if (!file) { res.status(400).json({ message: "No file" }); return; }
  const folder = (str(req.query.folder) ?? "misc").replace(/[^a-z0-9-]/gi, "") || "misc";
  const ext = (file.originalname.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const key = `cars/${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const url = await putObject(key, file.buffer, file.mimetype || "application/octet-stream");
  res.json({ url, filename: file.originalname });
}));

// GET /cars/audit-logs — admin only. MUST be before /:id so "audit-logs" is
// not matched as an id.
carsRouter.get("/audit-logs", requireAdmin, a(async (req, res) => {
  const { carId, userId, action, from, to, page, pageSize } = req.query;
  const date = (v: unknown) => {
    const raw = str(v);
    if (!raw) return undefined;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? undefined : d;
  };
  const result = await CarsService.getAuditLogs({
    carId: carId ? parseInt(str(carId)!, 10) : undefined,
    userId: str(userId),
    action: str(action),
    from: date(from),
    to: date(to),
    page: page ? parseInt(str(page)!, 10) : undefined,
    pageSize: pageSize ? parseInt(str(pageSize)!, 10) : undefined,
  });
  res.json(result);
}));

// GET /cars/audit-actors — admin only; populates the log's user filter.
carsRouter.get("/audit-actors", requireAdmin, a(async (_req, res) => {
  res.json(await CarsService.getAuditActors());
}));

// GET /cars
carsRouter.get("/", a(async (req, res) => {
  const q = req.query;
  const result = await CarsService.getAll({
    listingStatus: str(q.listingStatus),
    id: q.id ? parseInt(str(q.id)!, 10) : undefined,
    brand: str(q.brand),
    model: str(q.model),
    mileageMin: q.mileageMin ? parseInt(str(q.mileageMin)!, 10) : undefined,
    mileageMax: q.mileageMax ? parseInt(str(q.mileageMax)!, 10) : undefined,
    priceMin: q.priceMin ? parseFloat(str(q.priceMin)!) : undefined,
    priceMax: q.priceMax ? parseFloat(str(q.priceMax)!) : undefined,
    isAvailable: q.isAvailable !== undefined ? str(q.isAvailable) === "true" : undefined,
    carOrigin: str(q.carOrigin),
    carLocation: str(q.carLocation),
    responsiblePerson: str(q.responsiblePerson),
    bodyType: str(q.bodyType),
    engineType: str(q.engineType),
    gearboxType: str(q.gearboxType),
    drivetrain: str(q.drivetrain),
    sellType: str(q.sellType),
    yearMin: q.yearMin ? parseInt(str(q.yearMin)!, 10) : undefined,
    yearMax: q.yearMax ? parseInt(str(q.yearMax)!, 10) : undefined,
    enginePowerMin: q.enginePowerMin ? parseInt(str(q.enginePowerMin)!, 10) : undefined,
    enginePowerMax: q.enginePowerMax ? parseInt(str(q.enginePowerMax)!, 10) : undefined,
    engineVolumeMin: q.engineVolumeMin ? parseFloat(str(q.engineVolumeMin)!) : undefined,
    engineVolumeMax: q.engineVolumeMax ? parseFloat(str(q.engineVolumeMax)!) : undefined,
    seatsMin: q.seatsMin ? parseInt(str(q.seatsMin)!, 10) : undefined,
    seatsMax: q.seatsMax ? parseInt(str(q.seatsMax)!, 10) : undefined,
    isCryptoAvailable: q.isCryptoAvailable !== undefined ? str(q.isCryptoAvailable) === "true" : undefined,
    page: q.page ? Math.max(1, parseInt(str(q.page)!, 10)) : undefined,
    pageSize: q.pageSize ? Math.min(100, Math.max(1, parseInt(str(q.pageSize)!, 10))) : undefined,
  });
  res.json(result);
}));

// GET /cars/autoria/options — the AUTO.RIA equipment-options catalog for the UI.
// Registered before "/:id" so the literal path wins.
carsRouter.get("/autoria/options", a(async (_req, res) => {
  res.json({
    groups: GROUP_ORDER,
    binary: BINARY_OPTIONS,
    selectable: SELECTABLE_OPTIONS,
    aiEnabled: isSuggestConfigured(),
  });
}));

// POST /cars/autoria/options/suggest — AI-suggest options from make/model/year.
carsRouter.post("/autoria/options/suggest", a(async (req, res) => {
  const { brand, model, year, bodyType, engineType } = (req.body ?? {}) as Record<string, unknown>;
  if (!brand || !model || !year) {
    res.status(400).json({ message: "Вкажіть марку, модель і рік" });
    return;
  }
  const options = await suggestCarOptions({
    brand: String(brand),
    model: String(model),
    year: Number(year),
    bodyType: bodyType != null ? String(bodyType) : null,
    engineType: engineType != null ? String(engineType) : null,
  });
  res.json({ options });
}));

// GET /cars/:id
carsRouter.get("/:id", a(async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const car = await CarsService.getById(id);
  if (!car) { res.status(404).json({ message: "Car not found" }); return; }
  res.json(car);
}));

// POST /cars
carsRouter.post("/", a(async (req, res) => {
  const { photos, options, ...carInput } = (req.body ?? {}) as Record<string, unknown> & {
    photos?: Array<{ url: string; alt?: string | null }>;
    options?: Array<{ optionId: number; valueId?: number | null }>;
  };

  const photoCount = Array.isArray(photos) ? photos.length : 0;
  if (carInput.listingStatus !== "draft" && photoCount < MIN_PUBLISHED_PHOTOS) {
    res.status(400).json({
      message: `Для публікації потрібно щонайменше ${MIN_PUBLISHED_PHOTOS} фото (додано ${photoCount}).`,
    });
    return;
  }

  // Denormalize cover from gallery if explicit photoUrl wasn't provided.
  if (Array.isArray(photos) && photos.length > 0 && !carInput.photoUrl) {
    carInput.photoUrl = photos[0].url;
  }
  // Sanitize rich-text on entry — admin UI is trusted but defense-in-depth.
  if ("description" in carInput) {
    carInput.description = sanitizeRichText(carInput.description);
  }

  const car = await CarsService.create(carInput as Parameters<typeof CarsService.create>[0], uid(req));

  if (Array.isArray(photos) && photos.length > 0) {
    await prisma.$transaction(
      photos.map((p, idx) =>
        prisma.carPhoto.create({
          data: { carId: car.id, url: p.url, alt: p.alt ?? null, sortOrder: idx },
        })
      )
    );
  }

  if (Array.isArray(options)) {
    await CarsService.replaceOptions(car.id, options);
  }

  const withPhotos = await prisma.car.findUnique({
    where: { id: car.id },
    include: { photos: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }, options: true },
  });
  syncCarTelegramPost(car.id);
  res.status(201).json(withPhotos ?? car);
}));

// PATCH /cars/:id
carsRouter.patch("/:id", a(async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { options, ...body } = (req.body ?? {}) as Record<string, unknown> & {
    options?: Array<{ optionId: number; valueId?: number | null }>;
  };
  if ("description" in body) {
    body.description = sanitizeRichText(body.description);
  }
  // Replace options first so update()'s AUTO.RIA sync posts the fresh set.
  if (Array.isArray(options)) {
    await CarsService.replaceOptions(id, options);
  }
  await CarsService.update(id, body, uid(req));
  res.json(await CarsService.getById(id));
}));

// PATCH /cars/:id/availability
carsRouter.patch("/:id/availability", a(async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { isAvailable } = req.body as { isAvailable: boolean };
  const car = await CarsService.setAvailability(id, isAvailable, uid(req));
  res.json(car);
}));

// DELETE /cars/:id
carsRouter.delete("/:id", a(async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  await CarsService.delete(id, uid(req));
  res.status(204).send();
}));

// POST /cars/:id/telegram/publish — create or recreate the Telegram post
carsRouter.post("/:id/telegram/publish", a(async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    const result = await republishCarTelegramPost(id);
    void recordAudit({ ...actor(req), action: "TELEGRAM_PUBLISH", carId: id });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Telegram publish failed";
    res.status(400).json({ message: msg });
  }
}));

// DELETE /cars/:id/telegram — delete the Telegram post and clear the stored id
carsRouter.delete("/:id/telegram", a(async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    await deleteCarTelegramPost(id);
    void recordAudit({ ...actor(req), action: "TELEGRAM_DELETE", carId: id });
    res.status(204).send();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Telegram delete failed";
    res.status(400).json({ message: msg });
  }
}));

// POST /cars/:id/autoria/publish — create or recreate the AUTO.RIA advertisement
carsRouter.post("/:id/autoria/publish", a(async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    const result = await publishCarToAutoRia(id);
    void recordAudit({ ...actor(req), action: "AUTORIA_PUBLISH", carId: id, changedFields: { adId: (result as { adId?: unknown })?.adId ?? null } });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AUTO.RIA publish failed";
    res.status(400).json({ message: msg });
  }
}));

// DELETE /cars/:id/autoria — delete the AUTO.RIA ad and clear the stored id
carsRouter.delete("/:id/autoria", a(async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    await deleteCarAutoRiaAd(id);
    void recordAudit({ ...actor(req), action: "AUTORIA_DELETE", carId: id });
    res.status(204).send();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AUTO.RIA delete failed";
    res.status(400).json({ message: msg });
  }
}));

// GET /cars/:id/photos — gallery, sorted by sortOrder asc
carsRouter.get("/:id/photos", a(async (req, res) => {
  const carId = parseInt(req.params.id as string, 10);
  if (isNaN(carId)) { res.status(400).json({ message: "Invalid id" }); return; }
  const photos = await prisma.carPhoto.findMany({
    where: { carId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  res.json(photos);
}));

async function syncCoverPhoto(carId: number): Promise<void> {
  const first = await prisma.carPhoto.findFirst({
    where: { carId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  await prisma.car.update({ where: { id: carId }, data: { photoUrl: first?.url ?? null } });
}

// POST /cars/:id/photos — append a photo to the gallery
carsRouter.post("/:id/photos", a(async (req, res) => {
  const carId = parseInt(req.params.id as string, 10);
  if (isNaN(carId)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { url, alt, sortOrder } = req.body as { url: string; alt?: string | null; sortOrder?: number };
  if (!url) { res.status(400).json({ message: "url required" }); return; }
  const next = sortOrder !== undefined
    ? sortOrder
    : ((await prisma.carPhoto.aggregate({ where: { carId }, _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1;
  const photo = await prisma.carPhoto.create({
    data: { carId, url, alt: alt ?? null, sortOrder: next },
  });
  await syncCoverPhoto(carId);
  syncCarTelegramPost(carId);
  void recordAudit({ ...actor(req), action: "PHOTO_ADD", carId, changedFields: { photoId: photo.id, url: photo.url } });
  res.status(201).json(photo);
}));

// PATCH /cars/:id/photos/:photoId — update alt or sortOrder
carsRouter.patch("/:id/photos/:photoId", a(async (req, res) => {
  const carId = parseInt(req.params.id as string, 10);
  const photoId = parseInt(req.params.photoId as string, 10);
  if (isNaN(carId) || isNaN(photoId)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { alt, sortOrder } = req.body as { alt?: string | null; sortOrder?: number };
  const photo = await prisma.carPhoto.update({
    where: { id: photoId, carId },
    data: {
      ...(alt !== undefined ? { alt } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    },
  });
  syncCarTelegramPost(carId);
  res.json(photo);
}));

// PUT /cars/:id/photos/order — bulk reorder. Body: { ids: number[] } in display order.
carsRouter.put("/:id/photos/order", a(async (req, res) => {
  const carId = parseInt(req.params.id as string, 10);
  if (isNaN(carId)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { ids } = req.body as { ids: number[] };
  if (!Array.isArray(ids)) { res.status(400).json({ message: "ids[] required" }); return; }
  await prisma.$transaction(
    ids.map((id, idx) =>
      prisma.carPhoto.update({ where: { id, carId }, data: { sortOrder: idx } })
    )
  );
  const photos = await prisma.carPhoto.findMany({
    where: { carId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  await prisma.car.update({ where: { id: carId }, data: { photoUrl: photos[0]?.url ?? null } });
  syncCarTelegramPost(carId);
  void recordAudit({ ...actor(req), action: "PHOTO_REORDER", carId, changedFields: { count: ids.length } });
  res.json(photos);
}));

// DELETE /cars/:id/photos/:photoId
carsRouter.delete("/:id/photos/:photoId", a(async (req, res) => {
  const carId = parseInt(req.params.id as string, 10);
  const photoId = parseInt(req.params.photoId as string, 10);
  if (isNaN(carId) || isNaN(photoId)) { res.status(400).json({ message: "Invalid id" }); return; }
  const existing = await prisma.carPhoto.findUnique({ where: { id: photoId } });
  await prisma.carPhoto.delete({ where: { id: photoId, carId } });
  await deleteObjectByUrl(existing?.url);
  await syncCoverPhoto(carId);
  syncCarTelegramPost(carId);
  void recordAudit({ ...actor(req), action: "PHOTO_DELETE", carId, changedFields: { photoId, url: existing?.url ?? null } });
  res.status(204).send();
}));

// GET /cars/:id/archives
carsRouter.get("/:id/archives", a(async (req, res) => {
  const carId = parseInt(req.params.id as string, 10);
  if (isNaN(carId)) { res.status(400).json({ message: "Invalid id" }); return; }
  const archives = await prisma.carPhotoArchive.findMany({
    where: { carId },
    orderBy: { createdAt: "desc" },
  });
  res.json(archives);
}));

// POST /cars/:id/archives
carsRouter.post("/:id/archives", a(async (req, res) => {
  const carId = parseInt(req.params.id as string, 10);
  if (isNaN(carId)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { url, filename } = req.body as { url: string; filename: string };
  const archive = await prisma.carPhotoArchive.create({ data: { carId, url, filename } });
  res.status(201).json(archive);
}));

// DELETE /cars/:id/archives/:archiveId
carsRouter.delete("/:id/archives/:archiveId", a(async (req, res) => {
  const carId = parseInt(req.params.id as string, 10);
  const archiveId = parseInt(req.params.archiveId as string, 10);
  if (isNaN(carId) || isNaN(archiveId)) { res.status(400).json({ message: "Invalid id" }); return; }
  const existing = await prisma.carPhotoArchive.findUnique({ where: { id: archiveId } });
  await prisma.carPhotoArchive.delete({ where: { id: archiveId, carId } });
  await deleteObjectByUrl(existing?.url);
  res.status(204).send();
}));
