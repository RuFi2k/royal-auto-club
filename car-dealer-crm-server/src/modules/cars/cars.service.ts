import { Car, Prisma } from "@prisma/client";
import { prisma } from "../../db";
import { encrypt, decrypt, hmac } from "../../lib/encryption";
import { syncCarTelegramPost } from "../telegram/poster";
import { syncCarAutoRiaAd, deleteAutoRiaAdById } from "../autoria/poster";
import { normalizeSelectedOptions } from "../autoria/options-catalog";

export type CarCreateInput = Omit<Prisma.CarUncheckedCreateInput, "vinNumberHash">;
export type CarUpdateInput = Omit<Prisma.CarUncheckedUpdateInput, "vinNumberHash">;

export interface CarFilters {
  id?: number;
  brand?: string;
  model?: string;
  mileageMin?: number;
  mileageMax?: number;
  priceMin?: number;
  priceMax?: number;
  isAvailable?: boolean;
  carOrigin?: string;
  carLocation?: string;
  responsiblePerson?: string;
  // Extended (added when AI search + faceted browsing landed)
  bodyType?: string;
  engineType?: string;
  gearboxType?: string;
  drivetrain?: string;
  sellType?: string;
  yearMin?: number;
  yearMax?: number;
  enginePowerMin?: number;
  enginePowerMax?: number;
  engineVolumeMin?: number;
  engineVolumeMax?: number;
  seatsMin?: number;
  seatsMax?: number;
  isCryptoAvailable?: boolean;
  page?: number;
  pageSize?: number;
}

// Fields stored encrypted in the DB
const ENCRYPTED_FIELDS = ["vinNumber", "registrationNumber"] as const;

function encryptInput(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };
  for (const field of ENCRYPTED_FIELDS) {
    if (typeof result[field] === "string") {
      result[field] = encrypt(result[field] as string);
    }
  }
  if (typeof data.vinNumber === "string") {
    result.vinNumberHash = hmac(data.vinNumber as string);
  }
  return result;
}

// Keep listingStatus and isAvailable / soldAt in sync. listingStatus is the
// canonical lifecycle field; isAvailable and soldAt are denormalized for the
// older queries that pre-date listingStatus.
function syncStatusFields(
  data: Record<string, unknown>,
  prev?: Pick<Car, "listingStatus" | "isAvailable">,
): Record<string, unknown> {
  const result = { ...data };
  const nextStatus = result.listingStatus as Car["listingStatus"] | undefined;

  // 1) listingStatus changed → derive isAvailable + soldAt
  if (nextStatus !== undefined) {
    const wasAvailable = prev?.isAvailable ?? false;
    const willBeAvailable = nextStatus === "available";
    result.isAvailable = willBeAvailable;

    if (nextStatus === "sold" && (!prev || prev.listingStatus !== "sold")) {
      result.soldAt = new Date();
    } else if (nextStatus !== "sold" && prev?.listingStatus === "sold") {
      result.soldAt = null;
    }

    // Cars going to upcoming/archived shouldn't carry an eta from a previous
    // sold/available run — leave eta only meaningful for upcoming.
    if (nextStatus !== "upcoming") {
      result.transitStage = result.transitStage ?? null;
      // eta intentionally not cleared — admin may want to keep it as a record.
    }

    // Track admin flipping availability via the legacy isAvailable boolean.
    void wasAvailable;
  }
  // 2) isAvailable changed but no explicit listingStatus → mirror it.
  else if (typeof result.isAvailable === "boolean" && prev) {
    if (result.isAvailable && prev.listingStatus !== "available") {
      result.listingStatus = "available";
      result.soldAt = null;
    } else if (!result.isAvailable && prev.listingStatus === "available") {
      result.listingStatus = "sold";
      result.soldAt = new Date();
    }
  }

  return result;
}

function decryptCar(car: Car): Car {
  return {
    ...car,
    vinNumber: tryDecrypt(car.vinNumber),
    registrationNumber: tryDecrypt(car.registrationNumber),
  };
}

function tryDecrypt(value: string): string {
  try {
    return decrypt(value);
  } catch {
    return value; // plaintext legacy value — return as-is
  }
}

export const CarsService = {
  async create(data: CarCreateInput, userId: string): Promise<Car> {
    const synced = syncStatusFields(data as Record<string, unknown>);
    const encrypted = encryptInput(synced);
    const car = await prisma.car.create({ data: encrypted as Prisma.CarUncheckedCreateInput });
    await prisma.auditLog.create({
      data: {
        userId,
        action: "CREATE",
        carId: car.id,
        changedFields: { brand: car.brand, model: car.model, year: car.year } as object,
      },
    });
    // Telegram post is synced from the router after photos are attached, so the
    // initial sendMediaGroup carries the gallery instead of being a text post.
    return decryptCar(car);
  },

  async getById(id: number): Promise<Car | null> {
    const car = await prisma.car.findUnique({ where: { id }, include: { options: true } });
    if (!car) return null;
    const { options, ...rest } = car;
    return { ...decryptCar(rest), options } as Car;
  },

  // Replace a car's AUTO.RIA options with a validated set (delete-all + insert).
  async replaceOptions(
    carId: number,
    options: Array<{ optionId: number; valueId?: number | null }>,
  ): Promise<void> {
    const clean = normalizeSelectedOptions(options);
    await prisma.$transaction([
      prisma.carOption.deleteMany({ where: { carId } }),
      ...(clean.length
        ? [
            prisma.carOption.createMany({
              data: clean.map((o) => ({ carId, optionId: o.optionId, valueId: o.valueId })),
            }),
          ]
        : []),
    ]);
  },

  async getAll(filters: CarFilters = {}) {
    const { page = 1, pageSize = 10, ...rest } = filters;
    const where: Prisma.CarWhereInput = {};

    if (rest.id) where.id = rest.id;
    if (rest.brand) where.brand = { contains: rest.brand, mode: "insensitive" };
    if (rest.model) where.model = { contains: rest.model, mode: "insensitive" };
    if (rest.mileageMin !== undefined || rest.mileageMax !== undefined) {
      where.mileage = {
        ...(rest.mileageMin !== undefined ? { gte: rest.mileageMin } : {}),
        ...(rest.mileageMax !== undefined ? { lte: rest.mileageMax } : {}),
      };
    }
    if (rest.priceMin !== undefined || rest.priceMax !== undefined) {
      where.dealerPrice = {
        ...(rest.priceMin !== undefined ? { gte: rest.priceMin } : {}),
        ...(rest.priceMax !== undefined ? { lte: rest.priceMax } : {}),
      };
    }
    if (rest.isAvailable !== undefined) where.isAvailable = rest.isAvailable;
    if (rest.carOrigin) where.carOrigin = rest.carOrigin as Prisma.EnumCarOriginFilter;
    if (rest.carLocation) where.carLocation = rest.carLocation as Prisma.EnumCarLocationStatusFilter;
    if (rest.responsiblePerson) where.responsiblePerson = rest.responsiblePerson;

    // Extended filters
    if (rest.bodyType) where.bodyType = rest.bodyType as Prisma.EnumBodyTypeFilter;
    if (rest.engineType) where.engineType = rest.engineType as Prisma.EnumEngineTypeFilter;
    if (rest.gearboxType) where.gearboxType = rest.gearboxType as Prisma.EnumGearboxTypeFilter;
    if (rest.drivetrain) {
      // Treat awd and four_wd as equivalent — practically users don't distinguish
      // "AWD" from "4WD" when filtering. Strict match is still possible by passing
      // a value the catalog doesn't share (e.g. "fwd" vs "rwd").
      if (rest.drivetrain === "awd" || rest.drivetrain === "four_wd") {
        where.drivetrain = { in: ["awd", "four_wd"] };
      } else {
        where.drivetrain = rest.drivetrain as Prisma.EnumDrivetrainFilter;
      }
    }
    if (rest.sellType) where.sellType = rest.sellType as Prisma.EnumSellTypeFilter;
    if (rest.isCryptoAvailable !== undefined) where.isCryptoAvailable = rest.isCryptoAvailable;
    if (rest.yearMin !== undefined || rest.yearMax !== undefined) {
      where.year = {
        ...(rest.yearMin !== undefined ? { gte: rest.yearMin } : {}),
        ...(rest.yearMax !== undefined ? { lte: rest.yearMax } : {}),
      };
    }
    if (rest.enginePowerMin !== undefined || rest.enginePowerMax !== undefined) {
      where.enginePower = {
        ...(rest.enginePowerMin !== undefined ? { gte: rest.enginePowerMin } : {}),
        ...(rest.enginePowerMax !== undefined ? { lte: rest.enginePowerMax } : {}),
      };
    }
    if (rest.engineVolumeMin !== undefined || rest.engineVolumeMax !== undefined) {
      where.engineVolume = {
        ...(rest.engineVolumeMin !== undefined ? { gte: rest.engineVolumeMin } : {}),
        ...(rest.engineVolumeMax !== undefined ? { lte: rest.engineVolumeMax } : {}),
      };
    }
    if (rest.seatsMin !== undefined || rest.seatsMax !== undefined) {
      where.seatsCount = {
        ...(rest.seatsMin !== undefined ? { gte: rest.seatsMin } : {}),
        ...(rest.seatsMax !== undefined ? { lte: rest.seatsMax } : {}),
      };
    }

    const [data, total] = await Promise.all([
      prisma.car.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.car.count({ where }),
    ]);

    return { data: data.map(decryptCar), total, page, pageSize };
  },

  async update(id: number, data: CarUpdateInput, userId: string): Promise<Car> {
    const before = await prisma.car.findUnique({ where: { id } });
    if (!before) throw Object.assign(new Error("Car not found"), { status: 404 });
    if (
      before.listingStatus !== "draft" &&
      (data as Record<string, unknown>).listingStatus === "draft"
    ) {
      throw Object.assign(new Error("Опубліковане авто не можна повернути в чернетки"), { status: 400 });
    }

    const priceFields = ["ownerPrice", "dealerPrice"];
    const touchesPrice = priceFields.some((f) => f in data);
    const synced = syncStatusFields(data as Record<string, unknown>, before);
    const encrypted = encryptInput(synced);

    const updated = await prisma.car.update({
      where: { id },
      data: {
        ...(encrypted as Prisma.CarUncheckedUpdateInput),
        ...(touchesPrice ? { priceChangedAt: new Date() } : {}),
      },
    });

    // Build before/after diff for the audit log (use decrypted values for readability)
    const decryptedBefore = decryptCar(before);
    const decryptedAfter = decryptCar(updated);
    const changedFields: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of Object.keys(data)) {
      const prev = (decryptedBefore as Record<string, unknown>)[key];
      const next = (decryptedAfter as Record<string, unknown>)[key];
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        changedFields[key] = { from: prev, to: next };
      }
    }

    await prisma.auditLog.create({
      data: { userId, action: "UPDATE", carId: id, changedFields: changedFields as object },
    });

    syncCarTelegramPost(id);
    syncCarAutoRiaAd(id);
    return decryptedAfter;
  },

  async delete(id: number, userId: string): Promise<void> {
    const car = await prisma.car.findUnique({ where: { id } });
    await prisma.car.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        userId,
        action: "DELETE",
        carId: id,
        changedFields: car
          ? ({ brand: car.brand, model: car.model, year: car.year } as object)
          : undefined,
      },
    });
    // Remove the AUTO.RIA ad too (row is gone; nothing to null out afterwards).
    void deleteAutoRiaAdById(car?.autoriaAdId).catch((err) =>
      console.error(`[autoria] delete on car removal failed for ${id}:`, err),
    );
  },

  async setAvailability(id: number, isAvailable: boolean, userId: string): Promise<Car> {
    const before = await prisma.car.findUnique({ where: { id } });
    // Track sold-at on the true→false transition; clear on re-listing. Also
    // mirror into listingStatus so the lifecycle field stays in sync.
    let soldAtUpdate: Prisma.CarUpdateInput["soldAt"] | undefined;
    let listingStatusUpdate: Prisma.CarUpdateInput["listingStatus"] | undefined;
    if (before && before.isAvailable && !isAvailable) {
      soldAtUpdate = new Date();
      listingStatusUpdate = "sold";
    } else if (before && !before.isAvailable && isAvailable) {
      soldAtUpdate = null;
      listingStatusUpdate = "available";
    }

    const updated = await prisma.car.update({
      where: { id },
      data: {
        isAvailable,
        ...(soldAtUpdate !== undefined ? { soldAt: soldAtUpdate } : {}),
        ...(listingStatusUpdate !== undefined ? { listingStatus: listingStatusUpdate } : {}),
      },
    });
    await prisma.auditLog.create({
      data: {
        userId,
        action: "AVAILABILITY_CHANGE",
        carId: id,
        changedFields: { isAvailable: { from: before?.isAvailable, to: isAvailable } } as object,
      },
    });
    syncCarTelegramPost(id);
    syncCarAutoRiaAd(id);
    return decryptCar(updated);
  },

  async getAuditLogs(filters: { carId?: number; userId?: string; page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20, carId, userId } = filters;
    const where: Prisma.AuditLogWhereInput = {};
    if (carId) where.carId = carId;
    if (userId) where.userId = userId;

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip: (page - 1) * pageSize,
        take: Math.min(pageSize, 100),
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, pageSize };
  },
};
