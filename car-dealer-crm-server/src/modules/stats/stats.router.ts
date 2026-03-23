import { Router, Request, Response, NextFunction } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { StatsService } from "./stats.service";

export const statsRouter = Router();

statsRouter.use(requireAuth);

function a(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);
}

// GET /stats
statsRouter.get("/", a(async (_req, res) => {
  const stats = await StatsService.getStats();
  res.json(stats);
}));
