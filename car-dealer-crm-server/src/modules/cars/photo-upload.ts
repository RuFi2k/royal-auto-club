import { randomUUID } from "node:crypto";
import sharp from "sharp";
import heicConvert from "heic-convert";
import { admin } from "../../lib/firebase-admin";

const MAX_DIMENSION = 1920;
const WEBP_QUALITY = 80;

export interface OptimizedUpload {
  url: string;
  originalName: string;
  originalSize: number;
  optimizedSize: number;
}

function isHeic(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  if (buffer.toString("ascii", 4, 8) !== "ftyp") return false;
  const brand = buffer.toString("ascii", 8, 12);
  return ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand);
}

export async function optimizeAndUpload(
  buffer: Buffer,
  originalName: string,
): Promise<OptimizedUpload> {
  const inputBuffer = isHeic(buffer)
    ? Buffer.from(await heicConvert({ buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer, format: "JPEG", quality: 0.9 }))
    : buffer;

  const optimized = await sharp(inputBuffer)
    .rotate()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const path = `cars/photos/${Date.now()}_${Math.random().toString(36).slice(2)}.webp`;
  const bucket = admin.storage().bucket();
  const file = bucket.file(path);
  const downloadToken = randomUUID();

  await file.save(optimized, {
    resumable: false,
    metadata: {
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable",
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  });

  // When running against the Firebase Storage emulator, swap the host so URLs are
  // reachable from the browser. The emulator host is published to the browser via
  // PUBLIC_STORAGE_EMULATOR_HOST (FIREBASE_STORAGE_EMULATOR_HOST is the in-cluster
  // hostname which the browser cannot resolve).
  const publicEmulator = process.env.PUBLIC_STORAGE_EMULATOR_HOST;
  const base = publicEmulator
    ? `http://${publicEmulator}`
    : `https://firebasestorage.googleapis.com`;
  const url = `${base}/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${downloadToken}`;

  return {
    url,
    originalName,
    originalSize: buffer.length,
    optimizedSize: optimized.length,
  };
}
