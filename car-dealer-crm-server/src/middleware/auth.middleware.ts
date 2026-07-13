import { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth, isAdminEmail } from "../lib/auth";
import { prisma } from "../db";

export interface AuthRequest extends Request {
  uid: string;
  email: string;
}

export { isAdminEmail };

async function resolveSession(req: Request) {
  return auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
}

// Verifies a valid session only — no approval check (for /users/status, so a
// freshly-registered, still-pending user can read their own status).
export async function requireFirebaseAuth(req: Request, res: Response, next: NextFunction) {
  const session = await resolveSession(req);
  if (!session) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  (req as AuthRequest).uid = session.user.id;
  (req as AuthRequest).email = (session.user.email ?? "").toLowerCase();
  next();
}

// Verifies session + checks approval (for all protected routes).
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await resolveSession(req);
  if (!session) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const email = (session.user.email ?? "").toLowerCase();
  const u = session.user as typeof session.user & { approved?: boolean; disabled?: boolean };

  if (!isAdminEmail(email)) {
    if (u.disabled) {
      res.status(403).json({ message: "account_disabled" });
      return;
    }
    if (!u.approved) {
      res.status(403).json({ message: "pending_approval" });
      return;
    }
  }

  (req as AuthRequest).uid = u.id;
  (req as AuthRequest).email = email;
  next();
}

// Revoke all active sessions for a user (called when disabling/removing them).
export async function evictFromCache(userId: string) {
  try {
    await prisma.session.deleteMany({ where: { userId } });
  } catch {
    // non-fatal
  }
}
