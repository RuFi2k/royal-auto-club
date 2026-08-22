import { authHeadersNoContentType } from "../../cars/services/api.helpers";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type UserRole = "admin" | "manager";

export interface UserStatus {
  approved: boolean;
  isAdmin: boolean;
  role: UserRole;
  disabled: boolean;
}

export interface PendingUser {
  uid: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface ApprovedUser {
  uid: string;
  email: string;
  name: string | null;
  disabled: boolean;
  role: UserRole;
  isAdmin: boolean;
  // true when the account is pinned to admin via the ADMIN_EMAILS env var,
  // which the UI cannot override.
  roleLocked: boolean;
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

export async function fetchApprovedUsers(): Promise<ApprovedUser[]> {
  const res = await fetch(`${API_URL}/users/approved`, {
    headers: await authHeadersNoContentType(),
  });
  if (!res.ok) throw new Error("Failed to fetch approved users");
  return res.json();
}

export async function disableUser(uid: string): Promise<void> {
  const res = await fetch(`${API_URL}/users/${uid}/disable`, {
    method: "PATCH",
    headers: await authHeadersNoContentType(),
  });
  if (!res.ok) throw new Error("Failed to disable user");
}

export async function enableUser(uid: string): Promise<void> {
  const res = await fetch(`${API_URL}/users/${uid}/enable`, {
    method: "PATCH",
    headers: await authHeadersNoContentType(),
  });
  if (!res.ok) throw new Error("Failed to enable user");
}

export async function setUserRole(uid: string, role: UserRole): Promise<ApprovedUser> {
  const res = await fetch(`${API_URL}/users/${uid}/role`, {
    method: "PATCH",
    headers: { ...(await authHeadersNoContentType()), "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? "Не вдалося змінити роль");
  }
  return res.json();
}
