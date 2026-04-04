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

// GET /users/approved — admin only
usersRouter.get("/approved", requireAdmin, async (_req: Request, res: Response) => {
  const users = await UsersService.getApproved();
  res.json(users.map((u) => ({ ...u, isAdmin: isAdminEmail(u.email) })));
});

// PATCH /users/:uid/approve — admin only
usersRouter.patch("/:uid/approve", requireAdmin, async (req: Request, res: Response) => {
  const user = await UsersService.approve(req.params.uid as string);
  res.json(user);
});

// PATCH /users/:uid/disable — admin only
usersRouter.patch("/:uid/disable", requireAdmin, async (req: Request, res: Response) => {
  const targetUid = req.params.uid as string;
  if (targetUid === uid(req)) {
    res.status(400).json({ message: "Cannot disable yourself" });
    return;
  }
  const target = await UsersService.findByUid(targetUid);
  if (target && isAdminEmail(target.email)) {
    res.status(400).json({ message: "Cannot disable another admin" });
    return;
  }
  const user = await UsersService.disable(targetUid);
  res.json(user);
});

// PATCH /users/:uid/enable — admin only
usersRouter.patch("/:uid/enable", requireAdmin, async (req: Request, res: Response) => {
  const user = await UsersService.enable(req.params.uid as string);
  res.json(user);
});

// DELETE /users/:uid — admin only
usersRouter.delete("/:uid", requireAdmin, async (req: Request, res: Response) => {
  await UsersService.remove(req.params.uid as string);
  res.status(204).send();
});
