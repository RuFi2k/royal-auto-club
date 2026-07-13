import sharp from "sharp";
import { putObject } from "../../lib/storage";

const MAX_DIMENSION = 1920;
const WEBP_QUALITY = 80;

export interface OptimizedUpload {
  url: string;
  originalName: string;
  originalSize: number;
  optimizedSize: number;
}

export async function optimizeAndUpload(
  buffer: Buffer,
  originalName: string,
): Promise<OptimizedUpload> {
  const optimized = await sharp(buffer)
    .rotate()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const key = `cars/photos/${Date.now()}_${Math.random().toString(36).slice(2)}.webp`;
  const url = await putObject(key, optimized, "image/webp");

  return {
    url,
    originalName,
    originalSize: buffer.length,
    optimizedSize: optimized.length,
  };
}
