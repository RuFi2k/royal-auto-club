import { authHeadersNoContentType } from "./api.helpers";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// Uploads a file (tech passport, defect-check scan, photo archive) to the server,
// which stores it in object storage (MinIO) and returns its public URL.
export async function uploadCarFile(file: File, folder: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_URL}/cars/upload-file?folder=${encodeURIComponent(folder)}`, {
    method: "POST",
    headers: await authHeadersNoContentType(),
    body: fd,
  });
  if (!res.ok) throw new Error("Не вдалося завантажити файл");
  const data = (await res.json()) as { url: string };
  return data.url;
}

// Object deletion is handled server-side when the owning photo/archive record is
// deleted (see cars.router). Kept as a no-op so existing callers don't break.
export async function deleteCarFile(_url: string): Promise<void> {
  return;
}
