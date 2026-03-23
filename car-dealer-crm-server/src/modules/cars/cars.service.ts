import { Car, Prisma } from "@prisma/client";
import { prisma } from "../../db";
import { encrypt, decrypt, hmac } from "../../lib/encryption";

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
    const encrypted = encryptInput(data as Record<string, unknown>);
    const car = await prisma.car.create({ data: encrypted as Prisma.CarUncheckedCreateInput });
    await prisma.auditLog.create({
      data: {
        userId,
        action: "CREATE",
        carId: car.id,
        changedFields: { brand: car.brand, model: car.model, year: car.year } as object,
      },
    });
    return decryptCar(car);
  },

  async getById(id: number): Promise<Car | null> {
    const car = await prisma.car.findUnique({ where: { id } });
    return car ? decryptCar(car) : null;
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
      where.websitePrice = {
        ...(rest.priceMin !== undefined ? { gte: rest.priceMin } : {}),
        ...(rest.priceMax !== undefined ? { lte: rest.priceMax } : {}),
      };
    }
    if (rest.isAvailable !== undefined) where.isAvailable = rest.isAvailable;
    if (rest.carOrigin) where.carOrigin = rest.carOrigin as Prisma.EnumCarOriginFilter;
    if (rest.carLocation) where.carLocation = rest.carLocation as Prisma.EnumCarLocationStatusFilter;
    if (rest.responsiblePerson) where.responsiblePerson = rest.responsiblePerson;

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

    const priceFields = ["ownerPrice", "websitePrice", "dealerPrice", "generalPrice"];
    const touchesPrice = priceFields.some((f) => f in data);
    const encrypted = encryptInput(data as Record<string, unknown>);

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
  },

  async setAvailability(id: number, isAvailable: boolean, userId: string): Promise<Car> {
    const before = await prisma.car.findUnique({ where: { id } });
    const updated = await prisma.car.update({ where: { id }, data: { isAvailable } });
    await prisma.auditLog.create({
      data: {
        userId,
        action: "AVAILABILITY_CHANGE",
        carId: id,
        changedFields: { isAvailable: { from: before?.isAvailable, to: isAvailable } } as object,
      },
    });
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
