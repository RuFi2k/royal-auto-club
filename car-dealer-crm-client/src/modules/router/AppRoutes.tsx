import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "../../modules/auth/AuthProvider";
import { Login } from "../../modules/auth/Login";
import ProtectedRoute from "./ProtectedRoute";
import { CarsPage } from "../cars/components/CarsPage";
import { DashboardPage } from "../dashboard/components/DashboardPage";
import { AuditLogPage } from "../audit/components/AuditLogPage";

export function AppRoutes() {
    return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes - Only accessible to Sales Managers */}
          <Route
            path="/listings"
            element={
              <ProtectedRoute>
                <CarsPage />
              </ProtectedRoute>
            }
          />

          {/* Redirect any unknown path to dashboard (which will then trigger login if needed) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Admin-only; AuditLogPage redirects managers back to /listings. */}
          <Route
            path="/audit"
            element={
              <ProtectedRoute>
                <AuditLogPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/listings" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}