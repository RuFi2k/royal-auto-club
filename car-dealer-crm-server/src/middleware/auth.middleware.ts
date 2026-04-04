import { Request, Response, NextFunction } from "express";
import { admin } from "../lib/firebase-admin";
import { UsersService } from "../modules/users/users.service";

export interface AuthRequest extends Request {
  uid: string;
  email: string;
}

interface CachedToken {
  uid: string;
  email: string;
  exp: number;
}

const tokenCache = new Map<string, CachedToken>();
const CACHE_TTL_SEC = 5 * 60;

setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [key, value] of tokenCache) {
    if (value.exp <= now) tokenCache.delete(key);
  }
}, 10 * 60 * 1000).unref();

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)
);

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.has(email.toLowerCase());
}

async function extractToken(req: Request, res: Response): Promise<string | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  return header.slice(7);
}

// Verifies Firebase token only — no approval check (for /users/status)
export async function requireFirebaseAuth(req: Request, res: Response, next: NextFunction) {
  const token = await extractToken(req, res);
  if (!token) return;

  const now = Math.floor(Date.now() / 1000);
  const cached = tokenCache.get(token);
  if (cached && cached.exp > now) {
    (req as AuthRequest).uid = cached.uid;
    (req as AuthRequest).email = cached.email;
    next();
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const email = (decoded.email ?? "").toLowerCase();
    tokenCache.set(token, { uid: decoded.uid, email, exp: now + CACHE_TTL_SEC });
    (req as AuthRequest).uid = decoded.uid;
    (req as AuthRequest).email = email;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Verifies token + checks approval (for all protected routes)
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = await extractToken(req, res);
  if (!token) return;

  const now = Math.floor(Date.now() / 1000);
  const cached = tokenCache.get(token);
  if (cached && cached.exp > now) {
    (req as AuthRequest).uid = cached.uid;
    (req as AuthRequest).email = cached.email;
    next();
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const email = (decoded.email ?? "").toLowerCase();

    if (!isAdminEmail(email)) {
      const approved = await UsersService.isApproved(decoded.uid);
      if (!approved) {
        res.status(403).json({ message: "pending_approval" });
        return;
      }
    }

    tokenCache.set(token, { uid: decoded.uid, email, exp: now + CACHE_TTL_SEC });
    (req as AuthRequest).uid = decoded.uid;
    (req as AuthRequest).email = email;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
