import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { useUserStatus } from "../../users/hooks/useUserStatus";
import {
  fetchAuditLogs, fetchAuditActors,
  type AuditLogEntry, type AuditActor, type AuditFilters,
} from "../services/audit.api";
import { ACTION_LABELS, ACTION_TONE, describeChanges } from "../lib/describe";
import "../audit.css";

const PAGE_SIZE = 50;

// Ukrainian plural: 1 подія / 2-4 події / 5-20 подій, repeating per hundred.
function pluralEvents(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return "подій";
  if (mod10 === 1) return "подія";
  if (mod10 >= 2 && mod10 <= 4) return "події";
  return "подій";
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("uk-UA", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function AuditLogPage() {
  const { user, logout } = useAuth();
  const userStatus = useUserStatus();
  const navigate = useNavigate();

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [actors, setActors] = useState<AuditActor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditFilters>({});

  // The route is admin-only; managers get bounced back to the listings page.
  useEffect(() => {
    if (userStatus && !userStatus.isAdmin) navigate("/listings", { replace: true });
  }, [userStatus, navigate]);

  useEffect(() => {
    if (!userStatus?.isAdmin) return;
    fetchAuditActors().then(setActors).catch(() => {});
  }, [userStatus]);

  useEffect(() => {
    if (!userStatus?.isAdmin) return;
    setLoading(true);
    setError(null);
    fetchAuditLogs({ ...filters, page, pageSize: PAGE_SIZE })
      .then((res) => { setEntries(res.data); setTotal(res.total); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters, page, userStatus]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = useMemo(
    () => Object.values(filters).some((v) => v !== undefined && v !== ""),
    [filters],
  );

  function update(patch: Partial<AuditFilters>) {
    setPage(1);
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      for (const key of Object.keys(next) as (keyof AuditFilters)[]) {
        if (next[key] === "" || next[key] === undefined) delete next[key];
      }
      return next;
    });
  }

  return (
    <div className="audit-page">
      <header className="cars-header">
        <div className="cars-header-title">
          <img src="/logo.png" className="header-logo" alt="Royal Auto Club" />
          <span className="cars-total">{total} {pluralEvents(total)}</span>
        </div>
        <nav className="header-nav">
          <button className="nav-tab" onClick={() => navigate("/listings")}>Список</button>
          <button className="nav-tab" onClick={() => navigate("/dashboard")}>Дашборд</button>
          <button className="nav-tab nav-tab-active">Журнал подій</button>
        </nav>
        <div className="cars-header-user">
          <span>{user?.email}</span>
          <button className="btn-logout" onClick={logout}>Вийти</button>
        </div>
      </header>

      <div className="audit-body">
        <div className="audit-filters">
          <select
            value={filters.userId ?? ""}
            onChange={(e) => update({ userId: e.target.value || undefined })}
          >
            <option value="">Усі користувачі</option>
            {actors.map((a) => (
              <option key={a.userId} value={a.userId}>{a.email}</option>
            ))}
          </select>

          <select
            value={filters.action ?? ""}
            onChange={(e) => update({ action: e.target.value || undefined })}
          >
            <option value="">Усі дії</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <input
            type="number"
            placeholder="ID авто"
            value={filters.carId ?? ""}
            onChange={(e) => update({ carId: e.target.value ? Number(e.target.value) : undefined })}
          />

          <label className="audit-date">
            <span>Від</span>
            <input
              type="date"
              value={filters.from ?? ""}
              onChange={(e) => update({ from: e.target.value || undefined })}
            />
          </label>

          <label className="audit-date">
            <span>До</span>
            <input
              type="date"
              value={filters.to ?? ""}
              onChange={(e) => update({ to: e.target.value || undefined })}
            />
          </label>

          {hasFilters && (
            <button className="filter-reset" onClick={() => { setFilters({}); setPage(1); }}>
              Скинути
            </button>
          )}
        </div>

        {error && <div className="cars-error">{error}</div>}
        {loading && <div className="cars-state">Завантаження...</div>}

        {!loading && entries.length === 0 && (
          <div className="cars-state">Подій не знайдено.</div>
        )}

        {!loading && entries.length > 0 && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th style={{ width: 150 }}>Час</th>
                  <th style={{ width: 200 }}>Користувач</th>
                  <th style={{ width: 170 }}>Дія</th>
                  <th style={{ width: 190 }}>Обʼєкт</th>
                  <th>Деталі</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="audit-time">{fmtTime(entry.timestamp)}</td>
                    <td className="audit-user">{entry.userEmail ?? entry.userId}</td>
                    <td>
                      <span className={`audit-badge audit-badge-${ACTION_TONE[entry.action] ?? "neutral"}`}>
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </span>
                    </td>
                    <td className="audit-target">
                      {entry.carId !== null
                        ? <>#{entry.carId}{entry.carLabel ? ` · ${entry.carLabel}` : ""}</>
                        : "—"}
                    </td>
                    <td className="audit-details">{describeChanges(entry)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 && (
          <div className="audit-pagination">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Назад</button>
            <span>Сторінка {page} з {pageCount}</span>
            <button disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Далі →</button>
          </div>
        )}
      </div>
    </div>
  );
}
