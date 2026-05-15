import { prisma } from "../../db";
import { buildCarCaption, pickPhotoUrls } from "./format";

const API = "https://api.telegram.org";

function config() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID;
  const siteUrl = process.env.SITE_PUBLIC_URL ?? "https://royalautoclub.org";
  if (!token || !chatId) return null;
  return { token, chatId, siteUrl };
}

type TgResult<T> = { ok: true; result: T } | { ok: false; error_code: number; description: string };

async function tgCall<T>(token: string, method: string, payload: unknown): Promise<TgResult<T>> {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as TgResult<T>;
}

type TgMessage = { message_id: number };

// Fire-and-forget. Errors are swallowed (logged) so they never break CRUD.
// Skips archived cars (no post). Creates a post the first time, edits caption
// after that. Photos in the original media group cannot be added/removed once
// posted — we only edit caption (covers price, status, spec, description).
export function syncCarTelegramPost(carId: number): void {
  void runSync(carId).catch((err) => {
    console.error(`[telegram] sync failed for car ${carId}:`, err);
  });
}

// Explicit republish: delete existing post (if any) and create a fresh one.
// Used by the CRM "Publish / Republish" button so admins can refresh photos.
export async function republishCarTelegramPost(carId: number): Promise<{ messageId: number | null }> {
  const cfg = config();
  if (!cfg) throw new Error("Telegram not configured");

  const car = await prisma.car.findUnique({
    where: { id: carId },
    include: { photos: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
  });
  if (!car) throw new Error("Car not found");
  if (car.listingStatus === "archived") throw new Error("Архівні авто не публікуються в Telegram");

  if (car.telegramMessageId) {
    await deleteMessage(cfg.token, cfg.chatId, car.telegramMessageId);
    await prisma.car.update({ where: { id: car.id }, data: { telegramMessageId: null } });
  }

  const caption = buildCarCaption(car, { siteUrl: cfg.siteUrl });
  const photoUrls = pickPhotoUrls(car.photos, car.photoUrl);
  const messageId = await createPost(cfg.token, cfg.chatId, caption, photoUrls);
  if (messageId !== null) {
    await prisma.car.update({ where: { id: car.id }, data: { telegramMessageId: messageId } });
  }
  return { messageId };
}

// Delete a car's Telegram post and clear the stored message id.
export async function deleteCarTelegramPost(carId: number): Promise<void> {
  const cfg = config();
  if (!cfg) throw new Error("Telegram not configured");

  const car = await prisma.car.findUnique({ where: { id: carId } });
  if (!car) throw new Error("Car not found");
  if (!car.telegramMessageId) return;

  await deleteMessage(cfg.token, cfg.chatId, car.telegramMessageId);
  await prisma.car.update({ where: { id: car.id }, data: { telegramMessageId: null } });
}

async function deleteMessage(token: string, chatId: string, messageId: number): Promise<void> {
  const r = await tgCall<true>(token, "deleteMessage", { chat_id: chatId, message_id: messageId });
  // "message to delete not found" — treat as already gone, don't error.
  if (!r.ok && !/not found/i.test(r.description)) {
    console.error(`[telegram] deleteMessage failed: ${r.description}`);
  }
}

async function runSync(carId: number): Promise<void> {
  const cfg = config();
  if (!cfg) return; // disabled silently when env not set

  const car = await prisma.car.findUnique({
    where: { id: carId },
    include: { photos: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
  });
  if (!car) return;

  // Don't post archived cars. If a previously-posted car gets archived, leave the
  // existing post alone (caller can delete manually if needed).
  if (car.listingStatus === "archived") return;

  const caption = buildCarCaption(car, { siteUrl: cfg.siteUrl });

  if (car.telegramMessageId) {
    await editExistingPost(cfg.token, cfg.chatId, car.telegramMessageId, caption);
    return;
  }

  const photoUrls = pickPhotoUrls(car.photos, car.photoUrl);
  const messageId = await createPost(cfg.token, cfg.chatId, caption, photoUrls);
  if (messageId !== null) {
    await prisma.car.update({ where: { id: car.id }, data: { telegramMessageId: messageId } });
  }
}

async function createPost(
  token: string,
  chatId: string,
  caption: string,
  photoUrls: string[],
): Promise<number | null> {
  if (photoUrls.length >= 2) {
    const media = photoUrls.map((url, idx) => ({
      type: "photo" as const,
      media: url,
      ...(idx === 0 ? { caption, parse_mode: "HTML" as const } : {}),
    }));
    const r = await tgCall<TgMessage[]>(token, "sendMediaGroup", { chat_id: chatId, media });
    if (!r.ok) {
      console.error(`[telegram] sendMediaGroup failed: ${r.description}`);
      return null;
    }
    return r.result[0]?.message_id ?? null;
  }

  if (photoUrls.length === 1) {
    const r = await tgCall<TgMessage>(token, "sendPhoto", {
      chat_id: chatId,
      photo: photoUrls[0],
      caption,
      parse_mode: "HTML",
    });
    if (!r.ok) {
      console.error(`[telegram] sendPhoto failed: ${r.description}`);
      return null;
    }
    return r.result.message_id;
  }

  const r = await tgCall<TgMessage>(token, "sendMessage", {
    chat_id: chatId,
    text: caption,
    parse_mode: "HTML",
    disable_web_page_preview: false,
  });
  if (!r.ok) {
    console.error(`[telegram] sendMessage failed: ${r.description}`);
    return null;
  }
  return r.result.message_id;
}

async function editExistingPost(
  token: string,
  chatId: string,
  messageId: number,
  caption: string,
): Promise<void> {
  // Try editMessageCaption first (works for sendPhoto + sendMediaGroup posts).
  const r = await tgCall<TgMessage>(token, "editMessageCaption", {
    chat_id: chatId,
    message_id: messageId,
    caption,
    parse_mode: "HTML",
  });
  if (r.ok) return;

  // "message is not modified" is benign — caption unchanged.
  if (/not modified/i.test(r.description)) return;

  // Fallback: text-only post created via sendMessage (no caption to edit).
  const r2 = await tgCall<TgMessage>(token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: caption,
    parse_mode: "HTML",
    disable_web_page_preview: false,
  });
  if (!r2.ok && !/not modified/i.test(r2.description)) {
    console.error(`[telegram] edit failed: ${r.description} / ${r2.description}`);
  }
}
