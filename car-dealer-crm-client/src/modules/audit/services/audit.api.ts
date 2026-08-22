import { authHeadersNoContentType } from "../../cars/services/api.helpers";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type AuditAction =
  | "CREATE" | "UPDATE" | "DELETE" | "AVAILABILITY_CHANGE"
  | "PHOTO_ADD" | "PHOTO_DELETE" | "PHOTO_REORDER"
  | "TELEGRAM_PUBLISH" | "TELEGRAM_DELETE"
  | "AUTORIA_PUBLISH" | "AUTORIA_DELETE"
  | "USER_APPROVE" | "USER_DISABLE" | "USER_ENABLE" | "USER_DELETE" | "USER_ROLE_CHANGE"
  | "LOGIN" | "LOGOUT";

export interface AuditLogEntry {
  id: number;
  userId: string;
  userEmail: string | null;
  action: AuditAction;
  carId: number | null;
  carLabel: string | null;
  changedFields: Record<string, unknown> | null;
  timestamp: string;
}

export interface AuditLogPage {
  data: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditActor {
  userId: string;
  email: string;
}

export interface AuditFilters {
  userId?: string;
  action?: string;
  carId?: number;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchAuditLogs(filters: AuditFilters = {}): Promise<AuditLogPage> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "" && value !== null) qs.set(key, String(value));
  }
  const res = await fetch(`${API_URL}/cars/audit-logs?${qs}`, {
    headers: await authHeadersNoContentType(),
  });
  if (res.status === 403) throw new Error("Доступ лише для адміністраторів");
  if (!res.ok) throw new Error("Не вдалося завантажити журнал подій");
  return res.json();
}

export async function fetchAuditActors(): Promise<AuditActor[]> {
  const res = await fetch(`${API_URL}/cars/audit-actors`, {
    headers: await authHeadersNoContentType(),
  });
  if (!res.ok) throw new Error("Не вдалося завантажити список користувачів");
  return res.json();
}
