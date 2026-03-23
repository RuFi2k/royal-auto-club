import { prisma } from "../../db";

interface MonthRow { month: Date; count: bigint }
interface BrandRow { brand: string; count: bigint }
interface OriginRow { carOrigin: string; count: bigint }

function toNum(v: bigint) { return Number(v); }

export const StatsService = {
  async getStats() {
    const now = new Date();
    const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [total, available, sold, addedThisMonth, addedRows, soldRows, brandRows, originRows] =
      await Promise.all([
        prisma.car.count(),
        prisma.car.count({ where: { isAvailable: true } }),
        prisma.car.count({ where: { isAvailable: false } }),
        prisma.car.count({ where: { createdAt: { gte: thisMonthStart } } }),

        prisma.$queryRaw<MonthRow[]>`
          SELECT DATE_TRUNC('month', "createdAt") AS month, COUNT(*) AS count
          FROM cars
          WHERE "createdAt" >= ${sixMonthsAgo}
          GROUP BY DATE_TRUNC('month', "createdAt")
          ORDER BY 1`,

        prisma.$queryRaw<MonthRow[]>`
          SELECT DATE_TRUNC('month', timestamp) AS month, COUNT(*) AS count
          FROM audit_logs
          WHERE action = 'AVAILABILITY_CHANGE'
            AND timestamp >= ${sixMonthsAgo}
            AND "changedFields"->'isAvailable'->>'to' = 'false'
          GROUP BY DATE_TRUNC('month', timestamp)
          ORDER BY 1`,

        prisma.$queryRaw<BrandRow[]>`
          SELECT brand, COUNT(*) AS count
          FROM cars
          GROUP BY brand ORDER BY count DESC LIMIT 5`,

        prisma.$queryRaw<OriginRow[]>`
          SELECT "carOrigin", COUNT(*) AS count
          FROM cars GROUP BY "carOrigin"`,
      ]);

    // Build a full 6-month spine so months with 0 entries still appear
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
      return d.toISOString();
    });

    function fillMonths(rows: MonthRow[]) {
      const map = new Map(rows.map(r => [new Date(r.month).toISOString().slice(0, 7), toNum(r.count)]));
      return months.map(m => ({ month: m, count: map.get(m.slice(0, 7)) ?? 0 }));
    }

    return {
      totals: { all: total, available, sold, addedThisMonth },
      addedByMonth: fillMonths(addedRows),
      soldByMonth:  fillMonths(soldRows),
      byBrand:  brandRows.map(r => ({ brand: r.brand, count: toNum(r.count) })),
      byOrigin: originRows.map(r => ({ carOrigin: r.carOrigin, count: toNum(r.count) })),
    };
  },
};
