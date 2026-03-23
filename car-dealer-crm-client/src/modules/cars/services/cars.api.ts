import type { Car, CarFilters, CarsPage } from "../types/car.types";
import { authHeaders, authHeadersNoContentType } from "./api.helpers";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function fetchCars(
  filters: CarFilters,
  page: number,
  pageSize: number
): Promise<CarsPage> {
  const params = new URLSearchParams();

  if (filters.id) params.set("id", filters.id);
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.model) params.set("model", filters.model);
  if (filters.mileageMin) params.set("mileageMin", filters.mileageMin);
  if (filters.mileageMax) params.set("mileageMax", filters.mileageMax);
  if (filters.priceMin) params.set("priceMin", filters.priceMin);
  if (filters.priceMax) params.set("priceMax", filters.priceMax);
  if (filters.carOrigin) params.set("carOrigin", filters.carOrigin);
  if (filters.carLocation) params.set("carLocation", filters.carLocation);
  if (filters.isAvailable) params.set("isAvailable", filters.isAvailable);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  const res = await fetch(`${API_URL}/cars?${params.toString()}`, {
    headers: await authHeadersNoContentType(),
  });
  if (!res.ok) throw new Error(`Помилка завантаження: ${res.statusText}`);
  return res.json();
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

export async function setCarAvailability(id: number, isAvailable: boolean): Promise<Car> {
  const res = await fetch(`${API_URL}/cars/${id}/availability`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify({ isAvailable }),
  });
  if (!res.ok) throw new Error(`Помилка зміни статусу: ${res.statusText}`);
  return res.json();
}
