import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useAuth } from "../../auth/AuthProvider";
import { fetchStats } from "../services/stats.api";
import type { DashboardStats } from "../types/stats.types";
import "../dashboard.css";

const ORIGIN_LABELS: Record<string, string> = {
  EU: "Європа", US: "США", japan: "Японія",
  korea: "Корея", china: "Китай", other: "Інше",
};

const PIE_COLORS = ["#4a90e2", "#48bb78", "#ed8936", "#9f7aea", "#f56565", "#a0aec0"];

function formatMonth(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("uk-UA", { month: "short", year: "2-digit" });
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="stat-card" style={accent ? { borderTop: `3px solid ${accent}` } : {}}>
      <div className="stat-value">{value.toLocaleString("uk-UA")}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadStats() {
    setLoading(true);
    setError(null);
    fetchStats()
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadStats();

    function onVisible() {
      if (document.visibilityState === "visible") loadStats();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const soldByMonthMap = stats
    ? new Map(stats.soldByMonth.map((s) => [s.month.slice(0, 7), s.count]))
    : new Map<string, number>();

  const addedVsSold = stats
    ? stats.addedByMonth.map((a) => ({
        month: formatMonth(a.month),
        added: a.count,
        sold: soldByMonthMap.get(a.month.slice(0, 7)) ?? 0,
      }))
    : [];

  const originData = stats
    ? stats.byOrigin.map((o) => ({ name: ORIGIN_LABELS[o.carOrigin] ?? o.carOrigin, value: o.count }))
    : [];

  return (
    <div className="dashboard-page">
      <header className="cars-header">
        <div className="cars-header-title">
          <img src="/logo.png" className="header-logo" alt="Royal Auto Club" />
        </div>
        <nav className="header-nav">
          <button className="nav-tab" onClick={() => navigate("/listings")}>Список</button>
          <button className="nav-tab nav-tab-active">Дашборд</button>
        </nav>
        <div className="cars-header-user">
          <span>{user?.email}</span>
          <button className="btn-logout" onClick={logout}>Вийти</button>
        </div>
      </header>

      <div className="dashboard-body">
        {error && <div className="cars-error">{error}</div>}
        {loading && <div className="dashboard-loading">Завантаження...</div>}

        {stats && (
          <>
            {/* ── Stat cards ── */}
            <div className="stat-cards">
              <StatCard label="Всього авто" value={stats.totals.all} accent="#4a90e2" />
              <StatCard label="В наявності" value={stats.totals.available} accent="#48bb78" />
              <StatCard label="Продано" value={stats.totals.sold} accent="#ed8936" />
              <StatCard label="Додано цього місяця" value={stats.totals.addedThisMonth} accent="#9f7aea" />
            </div>

            {/* ── Charts row 1: added vs sold by month ── */}
            <div className="chart-row">
              <div className="chart-card">
                <h3 className="chart-title">Додані та продані авто по місяцях</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={addedVsSold} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="added" name="Додані" fill="#4a90e2" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="sold"  name="Продані" fill="#48bb78" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Charts row 2: by brand + by origin ── */}
            <div className="chart-row chart-row-2col">
              <div className="chart-card">
                <h3 className="chart-title">Топ 5 брендів</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stats.byBrand} layout="vertical" barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="brand" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="count" name="Авто" fill="#9f7aea" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <h3 className="chart-title">По походженню</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={originData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {originData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
