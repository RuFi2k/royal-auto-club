import { useEffect, useState } from "react";
import { fetchPendingUsers, approveUser, rejectUser, type PendingUser } from "../services/users.api";

interface Props {
  onClose: () => void;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function UsersPanel({ onClose }: Props) {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // uid being actioned

  useEffect(() => {
    fetchPendingUsers()
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleApprove(uid: string) {
    setBusy(uid);
    try {
      await approveUser(uid);
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
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
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
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
          <h2>Запити на доступ</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="cars-error" style={{ marginBottom: 12 }}>{error}</div>}
          {loading && <div className="cars-state">Завантаження...</div>}

          {!loading && users.length === 0 && (
            <div className="cars-state">Немає нових запитів на доступ.</div>
          )}

          {users.map((user) => (
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
        </div>

        <div className="modal-footer">
          <button className="filter-reset" onClick={onClose}>Закрити</button>
        </div>
      </div>
    </div>
  );
}
