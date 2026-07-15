import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const BUCKET = process.env.S3_BUCKET ?? "";
// Public base URL under which the bucket is served to browsers (no trailing slash).
// e.g. https://crm.example.com/media/crm-media
const PUBLIC_URL = (process.env.S3_PUBLIC_URL ?? "").replace(/\/$/, "");

export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: true, // required for MinIO
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
});

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
  cacheControl = "public, max-age=31536000, immutable"
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  );
  return `${PUBLIC_URL}/${key}`;
}

// Best-effort extraction of the object key from a stored public URL.
export function keyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (PUBLIC_URL && url.startsWith(`${PUBLIC_URL}/`)) {
    return decodeURIComponent(url.slice(PUBLIC_URL.length + 1).split("?")[0]);
  }
  return null;
}

export async function deleteObjectByUrl(url: string | null | undefined): Promise<void> {
  const key = keyFromUrl(url);
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    // Object may already be gone — non-fatal.
  }
}
