import { Router, Request, Response } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { StatsService } from "./stats.service";

export const statsRouter = Router();

statsRouter.use(requireAuth);

// GET /stats
statsRouter.get("/", async (_req: Request, res: Response) => {
  const stats = await StatsService.getStats();
  res.json(stats);
});
