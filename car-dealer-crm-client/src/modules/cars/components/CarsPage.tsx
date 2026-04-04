import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { fetchCars, setCarAvailability, deleteCar } from "../services/cars.api";
import { CarsFilter } from "./CarsFilter";
import { CarsList } from "./CarsList";
import { Pagination } from "./Pagination";
import { CreateCarModal } from "./CreateCarModal";
import { CarDetailModal } from "./CarDetailModal";
import { PhotoArchivesModal } from "./PhotoArchivesModal";
import { UsersPanel } from "../../users/components/UsersPanel";
import { useUserStatus } from "../../users/hooks/useUserStatus";
import type { Car, CarFilters } from "../types/car.types";
import "../cars.css";

const PAGE_SIZE = 10;

export function CarsPage() {
  const { user, logout } = useAuth();
  const userStatus = useUserStatus();
  const navigate = useNavigate();

  const [cars, setCars] = useState<Car[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<CarFilters>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [showCreate, setShowCreate] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [viewingCar, setViewingCar] = useState<Car | null>(null);
  const [editingCar, setEditingCar] = useState<Car | null>(null);
  const [archiveCar, setArchiveCar] = useState<Car | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchCars(filters, page, PAGE_SIZE)
      .then(({ data, total }) => {
        setCars(data);
        setTotal(total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters, page, refreshKey]);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  function handleFilterChange(next: CarFilters) {
    setFilters(next);
    setPage(1);
  }

  async function handleToggleAvailability(car: Car) {
    if (car.isAvailable) {
      const ok = window.confirm(
        `Підтвердіть продаж автомобіля:\n${car.brand} ${car.model} (${car.year})\n\nЦю дію буде відображено на дашборді.`
      );
      if (!ok) return;
    }
    try {
      const updated = await setCarAvailability(car.id, !car.isAvailable);
      setCars((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(car: Car) {
    const ok = window.confirm(
      `Видалити автомобіль?\n${car.brand} ${car.model} (${car.year}) — #${car.id}\n\nЦю дію неможливо скасувати.`
    );
    if (!ok) return;
    try {
      await deleteCar(car.id);
      setCars((prev) => prev.filter((c) => c.id !== car.id));
      setTotal((t) => t - 1);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleSaved(savedCar: Car) {
    if (editingCar) {
      setCars((prev) => prev.map((c) => c.id === savedCar.id ? savedCar : c));
    } else {
      setPage(1);
      refresh();
    }
    setShowCreate(false);
    setEditingCar(null);
  }

  const modalOpen = showCreate || editingCar !== null;

  return (
    <div className="cars-page">
      <header className="cars-header">
        <div className="cars-header-title">
          <img src="/logo.png" className="header-logo" alt="Royal Auto Club" />
          <span className="cars-total">{total} авт.</span>
        </div>
        <nav className="header-nav">
          <button className="nav-tab nav-tab-active">Список</button>
          <button className="nav-tab" onClick={() => navigate("/dashboard")}>Дашборд</button>
        </nav>
        <div className="cars-header-user">
          {userStatus?.isAdmin && (
            <button className="btn-users" onClick={() => setShowUsers(true)}>Користувачі</button>
          )}
          <button className="btn-new-listing" onClick={() => setShowCreate(true)}>+ Нове оголошення</button>
          <span>{user?.email}</span>
          <button className="btn-logout" onClick={logout}>Вийти</button>
        </div>
      </header>

      <CarsFilter filters={filters} onChange={handleFilterChange} />

      {error && <div className="cars-error">{error}</div>}

      <CarsList
        cars={cars}
        loading={loading}
        onView={setViewingCar}
        onEdit={setEditingCar}
        onToggleAvailability={handleToggleAvailability}
        onDelete={handleDelete}
        onManageArchives={setArchiveCar}
      />

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onChange={setPage}
      />

      {modalOpen && (
        <CreateCarModal
          car={editingCar ?? undefined}
          onClose={() => { setShowCreate(false); setEditingCar(null); }}
          onSaved={handleSaved}
        />
      )}

      {showUsers && <UsersPanel onClose={() => setShowUsers(false)} />}

      {viewingCar && (
        <CarDetailModal
          car={viewingCar}
          onClose={() => setViewingCar(null)}
          onEdit={(car) => { setViewingCar(null); setEditingCar(car); }}
        />
      )}

      {archiveCar && (
        <PhotoArchivesModal car={archiveCar} onClose={() => setArchiveCar(null)} />
      )}
    </div>
  );
}
