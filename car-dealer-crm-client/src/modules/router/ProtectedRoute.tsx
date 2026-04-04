import { type PropsWithChildren, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../modules/auth/AuthProvider";
import { fetchUserStatus, type UserStatus } from "../../modules/users/services/users.api";

const ProtectedRoute = ({ children }: PropsWithChildren) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchUserStatus()
      .then(setStatus)
      .catch(() => setStatus({ approved: false, isAdmin: false, disabled: false }))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", color: "#718096" }}>
        Завантаження...
      </div>
    );
  }

  if (status?.disabled) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 16, fontFamily: "sans-serif", color: "#1a1a2e", textAlign: "center", padding: "0 24px" }}>
        <div style={{ fontSize: 48 }}>🚫</div>
        <h2 style={{ margin: 0 }}>Акаунт заблоковано</h2>
        <p style={{ margin: 0, color: "#718096", maxWidth: 360 }}>
          Доступ для акаунту <strong>{user.email}</strong> було заблоковано адміністратором.
        </p>
        <button onClick={logout} style={{ marginTop: 8, padding: "8px 20px", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
          Вийти
        </button>
      </div>
    );
  }

  if (status && !status.approved) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 16, fontFamily: "sans-serif", color: "#1a1a2e", textAlign: "center", padding: "0 24px" }}>
        <div style={{ fontSize: 48 }}>⏳</div>
        <h2 style={{ margin: 0 }}>Очікуйте підтвердження</h2>
        <p style={{ margin: 0, color: "#718096", maxWidth: 360 }}>
          Ваш акаунт <strong>{user.email}</strong> зареєстровано та очікує підтвердження адміністратора. Спробуйте увійти пізніше.
        </p>
        <button onClick={logout} style={{ marginTop: 8, padding: "8px 20px", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
          Вийти
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

export { ProtectedRoute as default, type UserStatus };
