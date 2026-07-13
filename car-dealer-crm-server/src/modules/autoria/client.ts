// Thin HTTP client for the AUTO.RIA (developers.ria.com) advertisement API.
//
// Auth is via query params (user_id + api_key) on every request. The feature is
// silently disabled when either env var is missing — mirrors the Telegram poster.
//
// Docs: https://api-docs-v2.readthedocs.io/ru/latest/auto_ria/used_cars/personalized/

const DEFAULT_BASE = "https://developers.ria.com";

export interface AutoRiaConfig {
  base: string;
  userId: string;
  apiKey: string;
  // The photo-upload endpoint is the only one that authenticates the ad owner
  // via the RIA.com login cookie (PSP_ID, 30-day lifetime) instead of user_id.
  // Without it photo upload fails; the rest of the API works without it.
  pspId?: string;
}

export function autoriaConfig(): AutoRiaConfig | null {
  const userId = process.env.AUTORIA_USER_ID;
  const apiKey = process.env.AUTORIA_API_KEY;
  if (!userId || !apiKey) return null;
  const base = (process.env.AUTORIA_API_URL ?? DEFAULT_BASE).replace(/\/+$/, "");
  const pspId = process.env.AUTORIA_PSP_ID || undefined;
  return { base, userId, apiKey, pspId };
}

export class AutoRiaError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "AutoRiaError";
    this.status = status;
    this.body = body;
  }
}

function withAuth(cfg: AutoRiaConfig, path: string, includeUserId: boolean): string {
  const url = new URL(`${cfg.base}${path}`);
  url.searchParams.set("api_key", cfg.apiKey);
  if (includeUserId) url.searchParams.set("user_id", cfg.userId);
  return url.toString();
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function handle(res: Response): Promise<unknown> {
  const body = await parse(res);
  if (!res.ok) {
    const msg =
      (body && typeof body === "object" && "error" in body && String((body as { error: unknown }).error)) ||
      (typeof body === "string" && body) ||
      res.statusText;
    throw new AutoRiaError(res.status, `AUTO.RIA ${res.status}: ${msg}`, body);
  }
  return body;
}

// Reference/lookup GET (no user_id needed): categories, marks, models, colors…
export async function riaGet<T>(cfg: AutoRiaConfig, path: string): Promise<T> {
  const res = await fetch(withAuth(cfg, path, false));
  return (await handle(res)) as T;
}

// Advertisement management calls (require user_id).
export async function riaPost<T>(cfg: AutoRiaConfig, path: string, body: unknown): Promise<T> {
  const res = await fetch(withAuth(cfg, path, true), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await handle(res)) as T;
}

export async function riaPut<T>(cfg: AutoRiaConfig, path: string, body: unknown): Promise<T> {
  const res = await fetch(withAuth(cfg, path, true), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await handle(res)) as T;
}

// Ad deletion requires a reason_id: 4=sold via AUTO.RIA, 5=sold elsewhere,
// 6=reposting, 7=no longer selling. Omitting it returns 400.
export const RIA_DELETE_REASON = {
  SOLD_ELSEWHERE: 5,
  REPOSTING: 6,
  NO_LONGER_SELLING: 7,
} as const;

export async function riaDelete<T>(
  cfg: AutoRiaConfig,
  path: string,
  reasonId: number = RIA_DELETE_REASON.NO_LONGER_SELLING,
): Promise<T> {
  const url = new URL(withAuth(cfg, path, true));
  url.searchParams.set("reason_id", String(reasonId));
  const res = await fetch(url.toString(), { method: "DELETE" });
  return (await handle(res)) as T;
}

// Photo upload: POST /auto/used/autos/:adId/photos/upload with a JSON body of
// PUBLIC image URLs — AUTO.RIA fetches them itself, one request for all photos:
//   { "main": "<url>", "links": ["<url>", ...] }
// Requires the PSP_ID cookie for owner auth (see AutoRiaConfig.pspId).
export async function riaUploadPhotos(
  cfg: AutoRiaConfig,
  adId: string,
  mainUrl: string,
  linkUrls: string[],
): Promise<unknown> {
  if (!cfg.pspId) {
    throw new AutoRiaError(0, "AUTO.RIA: AUTORIA_PSP_ID не задано — фото не завантажуються");
  }
  const res = await fetch(withAuth(cfg, `/auto/used/autos/${adId}/photos/upload`, true), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `PSP_ID=${cfg.pspId}`,
    },
    body: JSON.stringify({ main: mainUrl, links: linkUrls }),
  });
  return handle(res);
}
