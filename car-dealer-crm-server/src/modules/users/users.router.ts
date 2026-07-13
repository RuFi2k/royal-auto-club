import { Router, Request, Response } from "express";
import { requireFirebaseAuth, requireAuth, isAdminEmail, evictFromCache, AuthRequest } from "../../middleware/auth.middleware";
import { UsersService } from "./users.service";

export const usersRouter = Router();

function uid(req: Request): string {
  return (req as AuthRequest).uid;
}

function email(req: Request): string {
  return (req as AuthRequest).email;
}

// Map Better Auth's `id` to the `uid` field the client expects.
function toClientUser(u: { id: string; email: string; name: string | null; disabled: boolean; createdAt: Date }) {
  return {
    uid: u.id,
    email: u.email,
    name: u.name,
    disabled: u.disabled,
    isAdmin: isAdminEmail(u.email),
    createdAt: u.createdAt,
  };
}

// GET /users/status — uses requireFirebaseAuth so pending users can call it
usersRouter.get("/status", requireFirebaseAuth, async (req: Request, res: Response) => {
  const userUid = uid(req);
  const userEmail = email(req);
  const admin = isAdminEmail(userEmail);
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
  res.json(users.map(toClientUser));
});

// GET /users/approved — admin only
usersRouter.get("/approved", requireAdmin, async (_req: Request, res: Response) => {
  const users = await UsersService.getApproved();
  res.json(users.map(toClientUser));
});

// PATCH /users/:uid/approve — admin only
usersRouter.patch("/:uid/approve", requireAdmin, async (req: Request, res: Response) => {
  const user = await UsersService.approve(req.params.uid as string);
  res.json(toClientUser(user));
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
  await evictFromCache(targetUid);
  res.json(toClientUser(user));
});

// PATCH /users/:uid/enable — admin only
usersRouter.patch("/:uid/enable", requireAdmin, async (req: Request, res: Response) => {
  const user = await UsersService.enable(req.params.uid as string);
  res.json(toClientUser(user));
});

// DELETE /users/:uid — admin only
usersRouter.delete("/:uid", requireAdmin, async (req: Request, res: Response) => {
  await UsersService.remove(req.params.uid as string);
  res.status(204).send();
});
