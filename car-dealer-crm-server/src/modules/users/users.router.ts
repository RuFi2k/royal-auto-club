import { Router, Request, Response } from "express";
import { requireFirebaseAuth, requireAuth, requireAdmin, isAdminEmail, evictFromCache, AuthRequest } from "../../middleware/auth.middleware";
import { UsersService } from "./users.service";
import { recordAudit } from "../../lib/audit";

export const usersRouter = Router();

function uid(req: Request): string {
  return (req as AuthRequest).uid;
}

function email(req: Request): string {
  return (req as AuthRequest).email;
}

function actor(req: Request): { userId: string; userEmail: string } {
  return { userId: uid(req), userEmail: email(req) };
}

// Map Better Auth's `id` to the `uid` field the client expects.
function toClientUser(u: { id: string; email: string; name: string | null; disabled: boolean; role: string; createdAt: Date }) {
  const isAdmin = u.role === "admin" || isAdminEmail(u.email);
  return {
    uid: u.id,
    email: u.email,
    name: u.name,
    disabled: u.disabled,
    role: isAdmin ? "admin" : "manager",
    isAdmin,
    // Env-listed admins cannot be demoted from the UI — the list wins.
    roleLocked: isAdminEmail(u.email),
    createdAt: u.createdAt,
  };
}

// GET /users/status — uses requireFirebaseAuth so pending users can call it
usersRouter.get("/status", requireFirebaseAuth, async (req: Request, res: Response) => {
  const userUid = uid(req);
  const userEmail = email(req);
  const admin = (req as AuthRequest).isAdmin;
  const status = await UsersService.getStatus(userUid, userEmail, admin);
  res.json(status);
});

// All routes below require full auth (approved users only)
usersRouter.use(requireAuth);

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
  void recordAudit({ ...actor(req), action: "USER_APPROVE", changedFields: { target: user.email } });
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
  void recordAudit({ ...actor(req), action: "USER_DISABLE", changedFields: { target: user.email } });
  res.json(toClientUser(user));
});

// PATCH /users/:uid/enable — admin only
usersRouter.patch("/:uid/enable", requireAdmin, async (req: Request, res: Response) => {
  const user = await UsersService.enable(req.params.uid as string);
  void recordAudit({ ...actor(req), action: "USER_ENABLE", changedFields: { target: user.email } });
  res.json(toClientUser(user));
});

// PATCH /users/:uid/role — admin only. Body: { role: "admin" | "manager" }
usersRouter.patch("/:uid/role", requireAdmin, async (req: Request, res: Response) => {
  const targetUid = req.params.uid as string;
  const { role } = req.body as { role?: string };
  if (role !== "admin" && role !== "manager") {
    res.status(400).json({ message: "role must be admin or manager" });
    return;
  }
  if (targetUid === uid(req)) {
    res.status(400).json({ message: "Cannot change your own role" });
    return;
  }
  const target = await UsersService.findByUid(targetUid);
  if (!target) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  // ADMIN_EMAILS is the bootstrap list — demoting one in the DB would not take
  // effect anyway, so reject it rather than pretend it worked.
  if (role === "manager" && isAdminEmail(target.email)) {
    res.status(400).json({ message: "Cannot demote an admin listed in ADMIN_EMAILS" });
    return;
  }
  const user = await UsersService.setRole(targetUid, role);
  // Role rides on the session, so existing sessions must be re-established.
  await evictFromCache(targetUid);
  void recordAudit({
    ...actor(req),
    action: "USER_ROLE_CHANGE",
    changedFields: { target: user.email, role: { from: target.role, to: role } },
  });
  res.json(toClientUser(user));
});

// DELETE /users/:uid — admin only
usersRouter.delete("/:uid", requireAdmin, async (req: Request, res: Response) => {
  const targetUid = req.params.uid as string;
  const target = await UsersService.findByUid(targetUid);
  await UsersService.remove(targetUid);
  void recordAudit({ ...actor(req), action: "USER_DELETE", changedFields: { target: target?.email ?? targetUid } });
  res.status(204).send();
});
