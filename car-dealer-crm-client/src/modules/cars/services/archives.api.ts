import type { CarPhotoArchive } from "../types/car.types";
import { authHeaders, authHeadersNoContentType } from "./api.helpers";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function getCarArchives(carId: number): Promise<CarPhotoArchive[]> {
  const res = await fetch(`${API_URL}/cars/${carId}/archives`, {
    headers: await authHeadersNoContentType(),
  });
  if (!res.ok) throw new Error("Не вдалося завантажити архіви");
  return res.json();
}

export async function addCarArchive(carId: number, data: { url: string; filename: string }): Promise<CarPhotoArchive> {
  const res = await fetch(`${API_URL}/cars/${carId}/archives`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Не вдалося додати архів");
  return res.json();
}

export async function deleteCarArchive(carId: number, archiveId: number): Promise<void> {
  const res = await fetch(`${API_URL}/cars/${carId}/archives/${archiveId}`, {
    method: "DELETE",
    headers: await authHeadersNoContentType(),
  });
  if (!res.ok) throw new Error("Не вдалося видалити архів");
}
