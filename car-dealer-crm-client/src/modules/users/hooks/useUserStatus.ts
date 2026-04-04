import { useEffect, useState } from "react";
import { fetchUserStatus, type UserStatus } from "../services/users.api";
import { useAuth } from "../../auth/AuthProvider";

export function useUserStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<UserStatus | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchUserStatus().then(setStatus).catch(() => {});
  }, [user]);

  return status;
}
