import { Request, Response, NextFunction } from "express";
import { admin } from "../lib/firebase-admin";

export interface AuthRequest extends Request {
  uid: string;
}

interface CachedToken {
  uid: string;
  exp: number; // unix seconds
}

const tokenCache = new Map<string, CachedToken>();
const CACHE_TTL_SEC = 5 * 60; // cache verified tokens for 5 minutes

// Prune expired entries every 10 minutes to avoid unbounded memory growth
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [key, value] of tokenCache) {
    if (value.exp <= now) tokenCache.delete(key);
  }
}, 10 * 60 * 1000).unref();

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const token = header.slice(7);

  const now = Math.floor(Date.now() / 1000);
  const cached = tokenCache.get(token);
  if (cached && cached.exp > now) {
    (req as AuthRequest).uid = cached.uid;
    next();
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    tokenCache.set(token, { uid: decoded.uid, exp: now + CACHE_TTL_SEC });
    (req as AuthRequest).uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
