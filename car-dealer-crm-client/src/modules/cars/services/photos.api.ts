import type { CarPhoto } from "../types/car.types";
import { authHeaders, authHeadersNoContentType } from "./api.helpers";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function getCarPhotos(carId: number): Promise<CarPhoto[]> {
  const res = await fetch(`${API_URL}/cars/${carId}/photos`, {
    headers: await authHeadersNoContentType(),
  });
  if (!res.ok) throw new Error("Не вдалося завантажити фото");
  return res.json();
}

export async function addCarPhoto(
  carId: number,
  data: { url: string; alt?: string | null; sortOrder?: number }
): Promise<CarPhoto> {
  const res = await fetch(`${API_URL}/cars/${carId}/photos`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Не вдалося додати фото");
  return res.json();
}

export async function updateCarPhoto(
  carId: number,
  photoId: number,
  data: { alt?: string | null; sortOrder?: number }
): Promise<CarPhoto> {
  const res = await fetch(`${API_URL}/cars/${carId}/photos/${photoId}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Не вдалося оновити фото");
  return res.json();
}

export async function reorderCarPhotos(carId: number, ids: number[]): Promise<CarPhoto[]> {
  const res = await fetch(`${API_URL}/cars/${carId}/photos/order`, {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("Не вдалося змінити порядок");
  return res.json();
}

export async function deleteCarPhoto(carId: number, photoId: number): Promise<void> {
  const res = await fetch(`${API_URL}/cars/${carId}/photos/${photoId}`, {
    method: "DELETE",
    headers: await authHeadersNoContentType(),
  });
  if (!res.ok) throw new Error("Не вдалося видалити фото");
}

export interface OptimizedUpload {
  url: string;
  originalName: string;
  originalSize: number;
  optimizedSize: number;
}

async function uploadSinglePhoto(file: File): Promise<OptimizedUpload> {
  const fd = new FormData();
  fd.append("files", file);
  const res = await fetch(`${API_URL}/cars/upload-photos`, {
    method: "POST",
    headers: await authHeadersNoContentType(),
    body: fd,
  });
  if (!res.ok) throw new Error(`Не вдалося завантажити ${file.name}`);
  const results: OptimizedUpload[] = await res.json();
  return results[0];
}

export async function uploadOptimizedPhotos(files: File[]): Promise<OptimizedUpload[]> {
  if (files.length === 0) return [];
  return Promise.all(files.map(uploadSinglePhoto));
}
