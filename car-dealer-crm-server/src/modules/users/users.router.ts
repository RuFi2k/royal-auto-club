import { Router, Request, Response } from "express";
import { requireFirebaseAuth, requireAuth, isAdminEmail, AuthRequest } from "../../middleware/auth.middleware";
import { UsersService } from "./users.service";

export const usersRouter = Router();

function uid(req: Request): string {
  return (req as AuthRequest).uid;
}

function email(req: Request): string {
  return (req as AuthRequest).email;
}

// GET /users/status — uses requireFirebaseAuth so pending users can call it
usersRouter.get("/status", requireFirebaseAuth, async (req: Request, res: Response) => {
  const userUid = uid(req);
  const userEmail = email(req);
  const admin = isAdminEmail(userEmail);
  await UsersService.upsert(userUid, userEmail);
  const status = await UsersService.getStatus(userUid, userEmail, admin);
  res.json(status);
});

// All routes below require full auth (approved users only)
usersRouter.use(requireAuth);

function requireAdmin(req: Request, res: Response, next: () => void) {
  if (!isAdminEmail(email(req))) {
    res.status(403).json({ message: "Admin only" });
    return;
  }
  next();
}

// GET /users/pending — admin only
usersRouter.get("/pending", requireAdmin, async (_req: Request, res: Response) => {
  const users = await UsersService.getPending();
  res.json(users);
});

// PATCH /users/:uid/approve — admin only
usersRouter.patch("/:uid/approve", requireAdmin, async (req: Request, res: Response) => {
  const user = await UsersService.approve(req.params.uid as string);
  res.json(user);
});

// DELETE /users/:uid — admin only
usersRouter.delete("/:uid", requireAdmin, async (req: Request, res: Response) => {
  await UsersService.remove(req.params.uid as string);
  res.status(204).send();
});
