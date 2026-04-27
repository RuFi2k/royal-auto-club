import { Request, Response, NextFunction } from "express";

const API_KEYS = new Set(
  (process.env.PUBLIC_API_KEYS ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
);

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  if (API_KEYS.size === 0) {
    res.status(503).json({ message: "Public API not configured" });
    return;
  }

  const provided =
    (req.headers["x-api-key"] as string | undefined) ??
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined);

  if (!provided || !API_KEYS.has(provided)) {
    res.status(401).json({ message: "Invalid or missing API key" });
    return;
  }

  next();
}
