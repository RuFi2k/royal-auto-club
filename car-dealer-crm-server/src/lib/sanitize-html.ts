import sanitizeHtml from "sanitize-html";

// Allowlist matches the TipTap editor surface in the admin UI: simple
// formatting + headings + lists + links. No images, scripts, iframes, etc.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "em", "u", "s", "blockquote", "code",
    "h1", "h2", "h3", "h4",
    "ul", "ol", "li",
    "a",
  ],
  allowedAttributes: {
    a: ["href", "rel", "target"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "nofollow noopener noreferrer",
      target: "_blank",
    }),
  },
};

export function sanitizeRichText(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return sanitizeHtml(trimmed, OPTIONS);
}
