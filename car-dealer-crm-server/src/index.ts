import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cron from "node-cron";
import { toNodeHandler } from "better-auth/node";
import { carsRouter } from "./modules/cars/cars.router";
import { statsRouter } from "./modules/stats/stats.router";
import { usersRouter } from "./modules/users/users.router";
import { publicRouter } from "./modules/public/public.router";
import { prisma } from "./db";
import { runBackup } from "./lib/backup";
import { auth, isAdminEmail } from "./lib/auth";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.set("trust proxy", 1); // Trust Nginx reverse proxy

const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigins, credentials: true }));

// Better Auth handler — MUST be mounted before express.json() so it can read the
// raw request body for its own routes.
app.all("/api/auth/*", toNodeHandler(auth));

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

app.use("/public", publicRouter);
app.use("/cars", carsRouter);
app.use("/stats", statsRouter);
app.use("/users", usersRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Global error handler — prevents stack traces leaking to clients
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

// Create the initial admin account if it doesn't exist yet. The databaseHook in
// lib/auth.ts auto-approves users whose email is in ADMIN_EMAILS.
async function seedAdmin() {
  const adminEmail = (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) return;
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) return;
  try {
    await auth.api.signUpEmail({
      body: { email: adminEmail, password: adminPassword, name: "Admin" },
    });
    console.log(`[seed] admin account created: ${adminEmail} (admin=${isAdminEmail(adminEmail)})`);
  } catch (err) {
    console.error("[seed] failed to create admin:", err);
  }
}

async function main() {
  await prisma.$connect();
  await seedAdmin();
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
