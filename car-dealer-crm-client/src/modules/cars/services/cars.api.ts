import type { AutoRiaOptionsCatalog, Car, CarFilters, CarsPage, SelectedOption } from "../types/car.types";
import { authHeaders, authHeadersNoContentType } from "./api.helpers";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function fetchCars(
  filters: CarFilters,
  page: number,
  pageSize: number
): Promise<CarsPage> {
  const params = new URLSearchParams();

  // Pass through every set filter; server ignores unknown keys.
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  const res = await fetch(`${API_URL}/cars?${params.toString()}`, {
    headers: await authHeadersNoContentType(),
  });
  if (!res.ok) throw new Error(`Помилка завантаження: ${res.statusText}`);
  return res.json();
}

export async function fetchAutoRiaOptions(): Promise<AutoRiaOptionsCatalog> {
  const res = await fetch(`${API_URL}/cars/autoria/options`, {
    headers: await authHeadersNoContentType(),
  });
  if (!res.ok) throw new Error(`Помилка завантаження опцій: ${res.statusText}`);
  return res.json();
}

export async function suggestAutoRiaOptions(payload: {
  brand: string;
  model: string;
  year: number;
  bodyType?: string | null;
  engineType?: string | null;
}): Promise<SelectedOption[]> {
  const res = await fetch(`${API_URL}/cars/autoria/options/suggest`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(msg.message ?? "Не вдалося отримати підказку");
  }
  const data: { options: SelectedOption[] } = await res.json();
  return data.options;
}

export async function createCar(data: Omit<Car, "id" | "createdAt" | "updatedAt" | "priceChangedAt">): Promise<Car> {
  const res = await fetch(`${API_URL}/cars`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Помилка створення: ${res.statusText}`);
  return res.json();
}

export async function updateCar(id: number, data: Partial<Omit<Car, "id" | "createdAt" | "updatedAt" | "priceChangedAt">>): Promise<Car> {
  const res = await fetch(`${API_URL}/cars/${id}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Помилка оновлення: ${res.statusText}`);
  return res.json();
}

export async function deleteCar(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/cars/${id}`, {
    method: "DELETE",
    headers: await authHeadersNoContentType(),
  });
  if (!res.ok) throw new Error(`Помилка видалення: ${res.statusText}`);
}

export async function publishCarToTelegram(id: number): Promise<{ messageId: number | null }> {
  const res = await fetch(`${API_URL}/cars/${id}/telegram/publish`, {
    method: "POST",
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(msg.message ?? "Помилка публікації в Telegram");
  }
  return res.json();
}

export async function deleteCarTelegramPost(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/cars/${id}/telegram`, {
    method: "DELETE",
    headers: await authHeadersNoContentType(),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(msg.message ?? "Помилка видалення з Telegram");
  }
}

export async function publishCarToAutoRia(id: number): Promise<{ adId: string | null }> {
  const res = await fetch(`${API_URL}/cars/${id}/autoria/publish`, {
    method: "POST",
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(msg.message ?? "Помилка публікації на AUTO.RIA");
  }
  return res.json();
}

export async function deleteCarAutoRiaAd(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/cars/${id}/autoria`, {
    method: "DELETE",
    headers: await authHeadersNoContentType(),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(msg.message ?? "Помилка видалення з AUTO.RIA");
  }
}

export async function setCarAvailability(id: number, isAvailable: boolean): Promise<Car> {
  const res = await fetch(`${API_URL}/cars/${id}/availability`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify({ isAvailable }),
  });
  if (!res.ok) throw new Error(`Помилка зміни статусу: ${res.statusText}`);
  return res.json();
}
