import { createAuthClient } from "better-auth/react";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const TOKEN_KEY = "crm_bearer_token";

export function getBearerToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearBearerToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Better Auth client. Auth uses the Bearer plugin: the server returns a session
// token in the `set-auth-token` header, which we persist and send back on every
// request. This keeps the existing `Authorization: Bearer <token>` API pattern.
export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: () => getBearerToken() ?? "",
    },
    onSuccess: (ctx) => {
      const token = ctx.response.headers.get("set-auth-token");
      if (token) localStorage.setItem(TOKEN_KEY, token);
    },
  },
});
