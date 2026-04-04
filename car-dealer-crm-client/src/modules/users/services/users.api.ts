import { authHeadersNoContentType } from "../../cars/services/api.helpers";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface UserStatus {
  approved: boolean;
  isAdmin: boolean;
}

export interface PendingUser {
  uid: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export async function fetchUserStatus(): Promise<UserStatus> {
  const res = await fetch(`${API_URL}/users/status`, {
    headers: await authHeadersNoContentType(),
  });
  if (!res.ok) throw new Error("Failed to fetch status");
  return res.json();
}

export async function fetchPendingUsers(): Promise<PendingUser[]> {
  const res = await fetch(`${API_URL}/users/pending`, {
    headers: await authHeadersNoContentType(),
  });
  if (!res.ok) throw new Error("Failed to fetch pending users");
  return res.json();
}

export async function approveUser(uid: string): Promise<void> {
  const res = await fetch(`${API_URL}/users/${uid}/approve`, {
    method: "PATCH",
    headers: await authHeadersNoContentType(),
  });
  if (!res.ok) throw new Error("Failed to approve user");
}

export async function rejectUser(uid: string): Promise<void> {
  const res = await fetch(`${API_URL}/users/${uid}`, {
    method: "DELETE",
    headers: await authHeadersNoContentType(),
  });
  if (!res.ok) throw new Error("Failed to reject user");
}
