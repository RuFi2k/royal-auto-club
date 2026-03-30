import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cron from "node-cron";
import { carsRouter } from "./modules/cars/cars.router";
import { statsRouter } from "./modules/stats/stats.router";
import { prisma } from "./db";
import { runBackup } from "./lib/backup";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.set("trust proxy", 1); // Trust Nginx reverse proxy

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());
app.use(
  rateLimit({
    windowMs: 60 * 1000,       // 1 minute window
    max: 120,                   // 120 requests per IP per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later" },
  })
);

app.use("/cars", carsRouter);
app.use("/stats", statsRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/admin/backup", async (_req, res) => {
  try {
    const filepath = await runBackup();
    res.json({ message: "Backup created", filepath });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// Global error handler — prevents stack traces leaking to clients
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

async function main() {
  await prisma.$connect();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Daily backup at 03:00
  cron.schedule("0 3 * * *", async () => {
    try {
      await runBackup();
    } catch (err) {
      console.error("[backup] Failed:", err);
    }
  });
  console.log("[backup] Scheduled daily at 03:00");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
