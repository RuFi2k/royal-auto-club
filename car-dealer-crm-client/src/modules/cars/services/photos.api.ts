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

export interface UploadProgress {
  done: number;
  total: number;
  failed: number;
}

export interface UploadFailure {
  index: number;
  name: string;
  message: string;
}

export interface PhotoUploadResult {
  // Index-aligned with the input files; null means that one failed.
  uploads: (OptimizedUpload | null)[];
  failures: UploadFailure[];
}

class UploadError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Photos used to go up as one giant multipart request. A full car (25-30 camera
// originals) lands around 100 MB, which is exactly Cloudflare's request-body cap
// — over it the batch was rejected at the edge, before ever reaching our nginx,
// and the whole save failed with no server-side trace. Now each photo is its own
// request, so total gallery size no longer matters.
const CONCURRENCY = 4;
const MAX_ATTEMPTS = 3;

// The server resizes to 1920px / WebP anyway, so sending full-size originals is
// wasted bandwidth. Shrinking here also keeps every request tiny.
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.85;

// Re-encoding through a canvas strips EXIF, so the browser must bake the
// orientation in while decoding — otherwise photos shot in portrait would land
// sideways, since the server's sharp .rotate() would have no tag left to read.
// Rather than trust a support matrix, probe it once with a 2x1 JPEG tagged
// Orientation=6: a browser that honours EXIF decodes it as 1x2.
const EXIF_PROBE_JPEG =
  "data:image/jpeg;base64,/9j/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAAAAAD/4AAQSkZJRgABAQAAAQABAAD/2wBDAFA3PEY8MlBGQUZaVVBfeMiCeG5uePWvuZHI////////////////////////////////////////////////////2wBDAVVaWnhpeOuCguv/////////////////////////////////////////////////////////////////////////wAARCAABAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCKiiiszsP/2Q==";

let exifAwareDecode: Promise<boolean> | null = null;

function browserAppliesExifOrientation(): Promise<boolean> {
  exifAwareDecode ??= (async () => {
    try {
      const blob = await (await fetch(EXIF_PROBE_JPEG)).blob();
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
      const rotated = bitmap.width === 1 && bitmap.height === 2;
      bitmap.close();
      return rotated;
    } catch {
      return false;
    }
  })();
  return exifAwareDecode;
}

// Downscale in the browser. Anything we can't decode with confidence (HEIC,
// exotic formats, browsers that ignore EXIF orientation) is sent untouched —
// the server handles it, and a slower upload beats a rotated or corrupted photo.
async function downscale(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (!(await browserAppliesExifOrientation())) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  try {
    const largestSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_DIMENSION / largestSide);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    // If re-encoding didn't actually save anything, keep the original.
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}

async function describeError(res: Response): Promise<string> {
  if (res.status === 413) return "файл завеликий";
  if (res.status === 401) return "сесія закінчилася, увійдіть знову";
  try {
    const body = await res.json();
    if (body && typeof body.message === "string") return body.message;
  } catch {
    // Not JSON — e.g. an HTML error page from Cloudflare or nginx.
  }
  return `помилка ${res.status}`;
}

async function uploadOne(file: File): Promise<OptimizedUpload> {
  const fd = new FormData();
  fd.append("files", file);
  const res = await fetch(`${API_URL}/cars/upload-photos`, {
    method: "POST",
    headers: await authHeadersNoContentType(),
    body: fd,
  });
  if (!res.ok) throw new UploadError(res.status, await describeError(res));
  const [item] = (await res.json()) as OptimizedUpload[];
  if (!item) throw new UploadError(res.status, "сервер не повернув фото");
  return item;
}

// Retry transient trouble only. A rejected file (too large, wrong type) or an
// expired session will fail again identically, so don't waste the round trips.
function retriable(err: unknown): boolean {
  if (err instanceof UploadError) {
    return err.status === 408 || err.status === 429 || err.status >= 500;
  }
  return true;
}

export async function uploadPhotos(
  files: File[],
  opts: {
    onProgress?: (p: UploadProgress) => void;
    // Lets a caller hand back photos a previous attempt already uploaded, so a
    // retry after a partial failure never re-sends what already landed.
    alreadyUploaded?: (index: number) => OptimizedUpload | null;
  } = {},
): Promise<PhotoUploadResult> {
  const uploads: (OptimizedUpload | null)[] = new Array(files.length).fill(null);
  const failures: UploadFailure[] = [];
  let done = 0;

  const report = () => opts.onProgress?.({ done, total: files.length, failed: failures.length });

  files.forEach((_, i) => {
    const cached = opts.alreadyUploaded?.(i) ?? null;
    if (cached) {
      uploads[i] = cached;
      done++;
    }
  });
  report();
  if (done === files.length) return { uploads, failures };

  let cursor = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const i = cursor++;
      if (i >= files.length) return;
      if (uploads[i]) continue;

      const file = files[i];
      let lastErr: unknown;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          uploads[i] = await uploadOne(await downscale(file));
          done++;
          report();
          break;
        } catch (err) {
          lastErr = err;
          if (!retriable(err) || attempt === MAX_ATTEMPTS) break;
          await new Promise((r) => setTimeout(r, 400 * attempt));
        }
      }
      if (!uploads[i]) {
        failures.push({
          index: i,
          name: file.name,
          message: lastErr instanceof Error ? lastErr.message : "невідома помилка",
        });
        report();
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, files.length) }, () => worker()),
  );
  return { uploads, failures };
}

export function describeFailures(failures: UploadFailure[], total: number): string {
  const shown = failures.slice(0, 3).map((f) => `${f.name} (${f.message})`).join(", ");
  const rest = failures.length > 3 ? ` та ще ${failures.length - 3}` : "";
  return `Не вдалося завантажити ${failures.length} з ${total} фото: ${shown}${rest}.`;
}
