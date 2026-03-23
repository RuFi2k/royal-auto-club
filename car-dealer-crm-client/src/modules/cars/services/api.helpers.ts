import { auth } from "../../auth/firebase";

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Не авторизовано");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export async function authHeadersNoContentType(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Не авторизовано");
  return { Authorization: `Bearer ${token}` };
}
