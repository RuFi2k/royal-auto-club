import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "../../modules/auth/AuthProvider";
import { Login } from "../../modules/auth/Login";
import ProtectedRoute from "./ProtectedRoute";
import { CarsPage } from "../cars/components/CarsPage";
import { DashboardPage } from "../dashboard/components/DashboardPage";

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

          <Route path="*" element={<Navigate to="/listings" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}