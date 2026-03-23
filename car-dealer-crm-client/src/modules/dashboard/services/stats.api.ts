import type { DashboardStats } from "../types/stats.types";
import { authHeadersNoContentType } from "../../cars/services/api.helpers";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function fetchStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_URL}/stats`, {
    headers: await authHeadersNoContentType(),
  });
  if (!res.ok) throw new Error(`Помилка завантаження статистики: ${res.statusText}`);
  return res.json();
}
