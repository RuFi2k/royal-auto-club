import { useEffect, useState } from "react";
import {
  fetchPendingUsers, approveUser, rejectUser,
  fetchApprovedUsers, disableUser, enableUser,
  type PendingUser, type ApprovedUser,
} from "../services/users.api";

interface Props {
  onClose: () => void;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function UsersPanel({ onClose }: Props) {
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [approved, setApproved] = useState<ApprovedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchPendingUsers(), fetchApprovedUsers()])
      .then(([p, a]) => { setPending(p); setApproved(a); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleApprove(uid: string) {
    setBusy(uid);
    try {
      await approveUser(uid);
      const user = pending.find((u) => u.uid === uid);
      setPending((prev) => prev.filter((u) => u.uid !== uid));
      if (user) setApproved((prev) => [...prev, { ...user, disabled: false }]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function handleReject(uid: string) {
    if (!window.confirm("Відхилити та видалити цей запит на доступ?")) return;
    setBusy(uid);
    try {
      await rejectUser(uid);
      setPending((prev) => prev.filter((u) => u.uid !== uid));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function handleDisable(uid: string) {
    if (!window.confirm("Заблокувати цього користувача?")) return;
    setBusy(uid);
    try {
      await disableUser(uid);
      setApproved((prev) => prev.map((u) => u.uid === uid ? { ...u, disabled: true } : u));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function handleEnable(uid: string) {
    setBusy(uid);
    try {
      await enableUser(uid);
      setApproved((prev) => prev.map((u) => u.uid === uid ? { ...u, disabled: false } : u));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2>Користувачі</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="cars-error" style={{ marginBottom: 12 }}>{error}</div>}
          {loading && <div className="cars-state">Завантаження...</div>}

          {!loading && (
            <>
              <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "#718096" }}>Очікують підтвердження</h3>
              {pending.length === 0 && (
                <div className="cars-state" style={{ marginBottom: 16 }}>Немає нових запитів.</div>
              )}
              {pending.map((user) => (
                <div key={user.uid} className="pending-user-row">
                  <div className="pending-user-info">
                    <span className="pending-user-name">{user.name ?? "—"}</span>
                    <span className="pending-user-email">{user.email}</span>
                    <span className="pending-user-date">Зареєстровано: {fmtDate(user.createdAt)}</span>
                  </div>
                  <div className="pending-user-actions">
                    <button
                      className="action-btn action-available"
                      disabled={busy === user.uid}
                      onClick={() => handleApprove(user.uid)}
                    >
                      Схвалити
                    </button>
                    <button
                      className="action-btn action-delete"
                      disabled={busy === user.uid}
                      onClick={() => handleReject(user.uid)}
                    >
                      Відхилити
                    </button>
                  </div>
                </div>
              ))}

              <h3 style={{ margin: "16px 0 8px", fontSize: 14, color: "#718096" }}>Активні користувачі</h3>
              {approved.length === 0 && (
                <div className="cars-state">Немає активних користувачів.</div>
              )}
              {approved.map((user) => (
                <div key={user.uid} className="pending-user-row" style={user.disabled ? { opacity: 0.6 } : {}}>
                  <div className="pending-user-info">
                    <span className="pending-user-name">{user.name ?? "—"}</span>
                    <span className="pending-user-email">{user.email}</span>
                    {user.disabled && <span style={{ color: "#e53e3e", fontSize: 12 }}>Заблоковано</span>}
                  </div>
                  <div className="pending-user-actions">
                    {user.isAdmin ? (
                      <span style={{ fontSize: 12, color: "#718096" }}>Адмін</span>
                    ) : user.disabled ? (
                      <button
                        className="action-btn action-available"
                        disabled={busy === user.uid}
                        onClick={() => handleEnable(user.uid)}
                      >
                        Розблокувати
                      </button>
                    ) : (
                      <button
                        className="action-btn action-delete"
                        disabled={busy === user.uid}
                        onClick={() => handleDisable(user.uid)}
                      >
                        Заблокувати
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="filter-reset" onClick={onClose}>Закрити</button>
        </div>
      </div>
    </div>
  );
}
